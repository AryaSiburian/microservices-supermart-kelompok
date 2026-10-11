package order

import (
	"context"
	"errors"
	"net"
	"testing"

	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"github.com/nusantara-supermart/backend/internal/inventoryclient"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type checkoutRepo struct {
	Repository
	saveErr, probeErr     error
	exists                bool
	saveCalls, clearCalls int
}

func (r *checkoutRepo) GetOrCreateCart(string) (*Cart, error) { return &Cart{ID: "cart"}, nil }
func (r *checkoutRepo) GetCartItems(string) ([]CartItem, error) {
	return []CartItem{{ProductID: "product-a", Quantity: 2, ProductPrice: 100, Subtotal: 200}, {ProductID: "product-b", Quantity: 1, ProductPrice: 50, Subtotal: 50}}, nil
}
func (r *checkoutRepo) GetOrderStatusByCode(string) (*OrderStatus, error) {
	return &OrderStatus{ID: "awaiting"}, nil
}
func (r *checkoutRepo) CreateOrder(*Order, []OrderItem, *OrderShippingDetail) error {
	r.saveCalls++
	return r.saveErr
}
func (r *checkoutRepo) OrderExists(string) (bool, error) { return r.exists, r.probeErr }
func (r *checkoutRepo) ClearCart(string) error           { r.clearCalls++; return nil }

type stockServer struct {
	inventoryv1.UnimplementedInventoryServiceServer
	reserveErr, releaseErr error
	reserves, releases     int
	reservedID, releasedID string
	itemCount              int
}

func (s *stockServer) ReserveStockBatch(_ context.Context, r *inventoryv1.ReserveStockBatchRequest) (*inventoryv1.ReserveStockBatchResponse, error) {
	s.reserves++
	s.reservedID = r.ReferenceOrderId
	s.itemCount = len(r.Items)
	return &inventoryv1.ReserveStockBatchResponse{AllReserved: true, ReferenceOrderId: r.ReferenceOrderId}, s.reserveErr
}
func (s *stockServer) ReleaseStockBatch(_ context.Context, r *inventoryv1.ReleaseStockBatchRequest) (*inventoryv1.ReleaseStockBatchResponse, error) {
	s.releases++
	s.releasedID = r.ReferenceOrderId
	return &inventoryv1.ReleaseStockBatchResponse{Released: true}, s.releaseErr
}

func TestCheckoutUsesNetworkBatchAndCompensates(t *testing.T) {
	for _, tc := range []struct {
		name                                      string
		saveErr, probeErr, reserveErr, releaseErr error
		exists, wantSuccess                       bool
		wantSaves, wantReleases                   int
	}{
		{name: "success", wantSuccess: true, wantSaves: 1},
		{name: "save fails", saveErr: errors.New("insert failed"), wantSaves: 1, wantReleases: 1},
		{name: "RPC outcome uncertain", reserveErr: status.Error(codes.DeadlineExceeded, "response lost"), wantReleases: 1},
		{name: "compensation fails visibly", saveErr: errors.New("insert failed"), releaseErr: status.Error(codes.Unavailable, "provider down"), wantSaves: 1, wantReleases: 3},
		{name: "commit succeeded but response lost", saveErr: ErrOrderCommitOutcomeUnknown, exists: true, wantSuccess: true, wantSaves: 1},
		{name: "commit still unobserved", saveErr: ErrOrderCommitOutcomeUnknown, wantSaves: 1},
		{name: "save outcome unresolved", saveErr: ErrOrderCommitOutcomeUnknown, probeErr: errors.New("DB down"), wantSaves: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lis, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			rpc := grpc.NewServer()
			stock := &stockServer{reserveErr: tc.reserveErr, releaseErr: tc.releaseErr}
			inventoryv1.RegisterInventoryServiceServer(rpc, stock)
			go rpc.Serve(lis)
			defer rpc.Stop()
			client, err := inventoryclient.New(lis.Addr().String())
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()
			repo := &checkoutRepo{saveErr: tc.saveErr, probeErr: tc.probeErr, exists: tc.exists}
			service := NewService(repo, nil, client)
			o, err := service.Checkout("customer", CheckoutRequest{WarehouseID: "warehouse", ShippingAddressID: "address"})
			if (err == nil) != tc.wantSuccess || (o != nil) != tc.wantSuccess {
				t.Fatalf("order=%v err=%v", o, err)
			}
			if stock.reserves != 1 || stock.itemCount != 2 || stock.releases != tc.wantReleases || repo.saveCalls != tc.wantSaves {
				t.Fatalf("reserves=%d items=%d releases=%d saves=%d", stock.reserves, stock.itemCount, stock.releases, repo.saveCalls)
			}
			if tc.wantReleases > 0 && stock.reservedID != stock.releasedID {
				t.Fatal("compensated wrong order")
			}
			if repo.clearCalls > 0 && !tc.wantSuccess {
				t.Fatal("cleared cart after failure")
			}
		})
	}
}
