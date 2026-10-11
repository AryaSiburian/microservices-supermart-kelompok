package order

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/google/uuid"
	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"github.com/nusantara-supermart/backend/internal/catalog"
)

type Service interface {
	GetCart(customerID string) (*Cart, error)
	AddToCart(customerID string, req AddToCartRequest) error
	UpdateCartItem(itemID string, req UpdateCartItemRequest) error
	RemoveCartItem(itemID string) error
	Checkout(customerID string, req CheckoutRequest) (*Order, error)
	GetOrders(customerID, userRole, statusID string) ([]Order, error)
	GetOrderByID(id string) (*Order, []OrderItem, *OrderShippingDetail, []OrderStatusHistory, []OrderNote, error)
	UpdateStatus(orderID, statusCode, notes string) error
	CancelOrder(orderID, reason, userID string) error
	AddOrderNote(orderID, userID, content string) error
	GetStatuses() ([]OrderStatus, error)
}

// The consumer depends only on the private RPC operations, not inventory.Service.
type InventoryClient interface {
	ReserveStockBatch(context.Context, *inventoryv1.ReserveStockBatchRequest) (*inventoryv1.ReserveStockBatchResponse, error)
	ReleaseStockBatch(context.Context, *inventoryv1.ReleaseStockBatchRequest) (*inventoryv1.ReleaseStockBatchResponse, error)
}

type orderService struct {
	repo         Repository
	catalogSvc   catalog.Service
	inventorySvc InventoryClient
}

func NewService(repo Repository, catalogSvc catalog.Service, inventorySvc InventoryClient) Service {
	return &orderService{
		repo:         repo,
		catalogSvc:   catalogSvc,
		inventorySvc: inventorySvc,
	}
}

func (s *orderService) GetCart(customerID string) (*Cart, error) {
	cart, err := s.repo.GetOrCreateCart(customerID)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.GetCartItems(cart.ID)
	if err != nil {
		return nil, err
	}
	cart.Items = items
	return cart, nil
}

func (s *orderService) AddToCart(customerID string, req AddToCartRequest) error {
	if req.Quantity <= 0 {
		return errors.New("quantity must be greater than zero")
	}

	// Coupling check: verify product exists in Catalog domain
	prod, _, _, err := s.catalogSvc.GetProductByID(req.ProductID)
	if err != nil || prod == nil {
		return errors.New("product does not exist")
	}

	cart, err := s.repo.GetOrCreateCart(customerID)
	if err != nil {
		return err
	}

	return s.repo.AddToCart(cart.ID, req.ProductID, req.Quantity)
}

func (s *orderService) UpdateCartItem(itemID string, req UpdateCartItemRequest) error {
	return s.repo.UpdateCartItem(itemID, req.Quantity)
}

func (s *orderService) RemoveCartItem(itemID string) error {
	return s.repo.RemoveCartItem(itemID)
}

func (s *orderService) Checkout(customerID string, req CheckoutRequest) (*Order, error) {
	cart, err := s.GetCart(customerID)
	if err != nil || len(cart.Items) == 0 {
		return nil, errors.New("cart is empty")
	}

	if req.ShippingAddressID == "" || req.WarehouseID == "" {
		return nil, errors.New("shipping_address_id and warehouse_id are required")
	}

	awaitingStatus, err := s.repo.GetOrderStatusByCode("AWAITING_PAYMENT")
	if err != nil {
		return nil, fmt.Errorf("order status AWAITING_PAYMENT not found: %w", err)
	}

	// Calculate totals
	var grossTotal float64
	orderItems := make([]OrderItem, len(cart.Items))
	for i, item := range cart.Items {
		grossTotal += item.Subtotal
		orderItems[i] = OrderItem{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
			UnitPrice: item.ProductPrice,
			Subtotal:  item.Subtotal,
		}
	}

	discountAmount := 0.00
	if req.VoucherCode != "" {
		discountAmount = 20000.00 // Standard voucher discount
		if discountAmount > grossTotal {
			discountAmount = grossTotal
		}
	}

	taxAmount := (grossTotal - discountAmount) * 0.11 // PPN 11%
	shippingFee := 15000.00                           // Fixed estimate
	totalNet := (grossTotal - discountAmount) + taxAmount + shippingFee

	orderNumber := fmt.Sprintf("ORD-%s-%04d", time.Now().Format("20060102"), time.Now().Unix()%10000)
	orderID := uuid.NewString()

	newOrder := &Order{
		ID:                orderID,
		OrderNumber:       orderNumber,
		CustomerID:        customerID,
		ShippingAddressID: req.ShippingAddressID,
		OrderStatusID:     awaitingStatus.ID,
		WarehouseID:       req.WarehouseID,
		TotalGrossAmount:  grossTotal,
		DiscountAmount:    discountAmount,
		TaxAmount:         taxAmount,
		ShippingFee:       shippingFee,
		TotalNetAmount:    totalNet,
	}

	courierName := req.CourierName
	if courierName == "" {
		courierName = "GoSend Instant Fulfillment"
	}
	shipping := &OrderShippingDetail{
		OrderID:      orderID,
		CourierName:  courierName,
		ShippingCost: shippingFee,
	}

	// One network batch; the provider owns atomicity across all cart items.
	stockItems := make([]*inventoryv1.ReserveStockLineItem, 0, len(orderItems))
	for _, item := range orderItems {
		if item.Quantity <= 0 || item.Quantity > math.MaxInt32 {
			return nil, errors.New("cart quantity is outside the inventory contract range")
		}
		stockItems = append(stockItems, &inventoryv1.ReserveStockLineItem{ProductId: item.ProductID, Quantity: int32(item.Quantity)})
	}
	reserved, reserveErr := s.inventorySvc.ReserveStockBatch(context.Background(), &inventoryv1.ReserveStockBatchRequest{
		ReferenceOrderId: orderID, WarehouseId: req.WarehouseID, Items: stockItems,
	})
	if reserveErr != nil || reserved == nil || !reserved.AllReserved {
		if reserveErr == nil {
			reserveErr = errors.New("inventory did not confirm all items")
		}
		// A timeout may happen after commit: release by the same key, including a
		// tombstone that fences a late RPC. Never blindly retry a non-idempotent hold.
		return nil, errors.Join(fmt.Errorf("reserve inventory for order %s: %w", orderID, reserveErr), s.releaseReservation(orderID))
	}

	// Save order
	if err := s.repo.CreateOrder(newOrder, orderItems, shipping); err != nil {
		// A DB commit error can have an uncertain outcome. Confirm absence before
		// compensation so a committed order does not lose its stock reservation.
		exists, probeErr := s.repo.OrderExists(orderID)
		if probeErr != nil || (!exists && errors.Is(err, ErrOrderCommitOutcomeUnknown)) {
			log.Printf("RECONCILIATION_REQUIRED order=%s: save=%v probe=%v", orderID, err, probeErr)
			return nil, fmt.Errorf("order %s save outcome unknown; reservation retained for reconciliation: %w", orderID, errors.Join(err, probeErr))
		}
		if !exists {
			return nil, errors.Join(fmt.Errorf("failed to create order %s: %w", orderID, err), s.releaseReservation(orderID))
		}
	}

	// Clear cart
	_ = s.repo.ClearCart(cart.ID)

	return newOrder, nil
}

func (s *orderService) GetOrders(customerID, userRole, statusID string) ([]Order, error) {
	// If customer, only see own orders
	if userRole == "CUSTOMER" {
		return s.repo.GetOrders(customerID, statusID)
	}
	// Staff/Admin sees all
	return s.repo.GetOrders("", statusID)
}

func (s *orderService) GetOrderByID(id string) (*Order, []OrderItem, *OrderShippingDetail, []OrderStatusHistory, []OrderNote, error) {
	order, err := s.repo.GetOrderByID(id)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}
	items, _ := s.repo.GetOrderItems(id)
	shipping, _ := s.repo.GetOrderShippingDetail(id)
	histories, _ := s.repo.GetOrderStatusHistories(id)
	notes, _ := s.repo.GetOrderNotes(id)

	return order, items, shipping, histories, notes, nil
}

func (s *orderService) UpdateStatus(orderID, statusCode, notes string) error {
	status, err := s.repo.GetOrderStatusByCode(statusCode)
	if err != nil {
		return fmt.Errorf("status code %s not found", statusCode)
	}
	return s.repo.UpdateOrderStatus(orderID, status.ID, notes)
}

func (s *orderService) CancelOrder(orderID, reason, userID string) error {
	cancelledStatus, err := s.repo.GetOrderStatusByCode("CANCELLED")
	if err != nil {
		return err
	}

	// Coupling: release reserved stock in Inventory domain
	if err := s.releaseReservation(orderID); err != nil {
		return err
	}

	return s.repo.CancelOrder(orderID, reason, userID, cancelledStatus.ID)
}

func (s *orderService) releaseReservation(orderID string) error {
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		resp, callErr := s.inventorySvc.ReleaseStockBatch(context.Background(), &inventoryv1.ReleaseStockBatchRequest{ReferenceOrderId: orderID})
		err = callErr
		if err == nil && resp != nil && resp.Released {
			return nil
		}
		if err == nil {
			err = errors.New("inventory did not confirm release")
		}
		if attempt < 2 {
			time.Sleep(100 * time.Millisecond)
		}
	}
	log.Printf("COMPENSATION_REQUIRED order=%s: %v", orderID, err)
	return fmt.Errorf("inventory compensation pending for order %s: %w", orderID, err)
}

func (s *orderService) AddOrderNote(orderID, userID, content string) error {
	note := &OrderNote{
		OrderID:      orderID,
		AuthorUserID: userID,
		NoteContent:  content,
	}
	return s.repo.AddOrderNote(note)
}

func (s *orderService) GetStatuses() ([]OrderStatus, error) {
	return s.repo.GetOrderStatuses()
}
