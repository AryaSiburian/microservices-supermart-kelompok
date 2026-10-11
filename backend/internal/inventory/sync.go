package inventory

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
)

var (
	ErrInvalidStockRequest = errors.New("invalid stock request")
	ErrStockNotFound       = errors.New("stock not found")
	ErrInsufficientStock   = errors.New("insufficient available stock")
	ErrReservationConflict = errors.New("reservation key reused or already released")
)

// SyncService owns the same business operations for REST and gRPC. No Catalog joins.
type SyncService struct{ db *sqlx.DB }

func NewSyncService(db *sqlx.DB) *SyncService { return &SyncService{db: db} }

func validID(id string) bool { return strings.TrimSpace(id) != "" && len(id) <= 36 }

func (s *SyncService) CheckStock(ctx context.Context, req *inventoryv1.CheckStockRequest) (*inventoryv1.CheckStockResponse, error) {
	if req == nil || !validID(req.ProductId) || !validID(req.WarehouseId) {
		return nil, ErrInvalidStockRequest
	}
	var result struct {
		Count     int64 `db:"row_count"`
		Available int64 `db:"available"`
	}
	// The legacy schema permits multiple stock rows/batches per product and warehouse.
	err := s.db.GetContext(ctx, &result, `SELECT COUNT(*) AS row_count,
 COALESCE(SUM(quantity_on_hand - quantity_reserved), 0) AS available
 FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ?`, req.ProductId, req.WarehouseId)
	if err != nil {
		return nil, err
	}
	if result.Count == 0 {
		return nil, ErrStockNotFound
	}
	return &inventoryv1.CheckStockResponse{ProductId: req.ProductId, WarehouseId: req.WarehouseId, AvailableQty: result.Available, InStock: result.Available > 0}, nil
}

type normalizedItem struct {
	ProductID string
	Quantity  int64
}

func normalizeBatch(req *inventoryv1.ReserveStockBatchRequest) ([]normalizedItem, string, error) {
	if req == nil || !validID(req.ReferenceOrderId) || !validID(req.WarehouseId) || len(req.Items) == 0 || len(req.Items) > 100 {
		return nil, "", ErrInvalidStockRequest
	}
	quantities := make(map[string]int64)
	for _, item := range req.Items {
		if item == nil || !validID(item.ProductId) || item.Quantity <= 0 {
			return nil, "", ErrInvalidStockRequest
		}
		quantities[item.ProductId] += int64(item.Quantity)
		if quantities[item.ProductId] > math.MaxInt32 {
			return nil, "", ErrInvalidStockRequest
		}
	}
	items := make([]normalizedItem, 0, len(quantities))
	for id, qty := range quantities {
		items = append(items, normalizedItem{id, qty})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ProductID < items[j].ProductID })
	b, err := json.Marshal(struct {
		Warehouse string
		Items     []normalizedItem
	}{req.WarehouseId, items})
	if err != nil {
		return nil, "", err
	}
	hash := sha256.Sum256(b)
	return items, hex.EncodeToString(hash[:]), nil
}

func (s *SyncService) ReserveStockBatch(ctx context.Context, req *inventoryv1.ReserveStockBatchRequest) (*inventoryv1.ReserveStockBatchResponse, error) {
	items, hash, err := normalizeBatch(req)
	if err != nil {
		return nil, err
	}
	tx, err := s.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	// The PK lock also serializes a Release racing with Reserve or a duplicate RPC.
	_, err = tx.ExecContext(ctx, `INSERT INTO inventory_reservation_batches
 (reference_order_id, warehouse_id, request_hash, status) VALUES (?, ?, ?, 'PENDING')
 ON DUPLICATE KEY UPDATE reference_order_id = reference_order_id`, req.ReferenceOrderId, req.WarehouseId, hash)
	if err != nil {
		return nil, err
	}
	var batch struct {
		Hash   string `db:"request_hash"`
		Status string `db:"status"`
	}
	if err = tx.GetContext(ctx, &batch, `SELECT request_hash, status FROM inventory_reservation_batches WHERE reference_order_id = ? FOR UPDATE`, req.ReferenceOrderId); err != nil {
		return nil, err
	}
	if batch.Hash != hash || batch.Status == "RELEASED" {
		return nil, ErrReservationConflict
	}
	if batch.Status == "HOLD" {
		if err = tx.Commit(); err != nil {
			return nil, err
		}
		return &inventoryv1.ReserveStockBatchResponse{ReferenceOrderId: req.ReferenceOrderId, AllReserved: true}, nil
	}
	// Lock all matching batch rows in deterministic product/id order, then allocate.
	for _, item := range items {
		var stocks []struct {
			ID        string `db:"id"`
			Available int64  `db:"available"`
		}
		err = tx.SelectContext(ctx, &stocks, `SELECT id, quantity_on_hand - quantity_reserved AS available
  FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? ORDER BY id FOR UPDATE`, item.ProductID, req.WarehouseId)
		if err != nil {
			return nil, err
		}
		if len(stocks) == 0 {
			return nil, fmt.Errorf("%w: %s", ErrStockNotFound, item.ProductID)
		}
		var available int64
		for _, stock := range stocks {
			if stock.Available > 0 {
				available += stock.Available
			}
		}
		if available < item.Quantity {
			return nil, fmt.Errorf("%w: %s", ErrInsufficientStock, item.ProductID)
		}
		remaining := item.Quantity
		for _, stock := range stocks {
			if remaining == 0 {
				break
			}
			if stock.Available <= 0 {
				continue
			}
			qty := min(remaining, stock.Available)
			_, err = tx.ExecContext(ctx, `UPDATE inventory_stocks SET quantity_reserved = quantity_reserved + ?, updated_at = NOW() WHERE id = ?`, qty, stock.ID)
			if err != nil {
				return nil, err
			}
			_, err = tx.ExecContext(ctx, `INSERT INTO stock_reservations
   (id, product_id, stock_id, reference_order_id, reserved_quantity, status) VALUES (?, ?, ?, ?, ?, 'HOLD')`, uuid.NewString(), item.ProductID, stock.ID, req.ReferenceOrderId, qty)
			if err != nil {
				return nil, err
			}
			remaining -= qty
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE inventory_reservation_batches SET status = 'HOLD' WHERE reference_order_id = ?`, req.ReferenceOrderId)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return &inventoryv1.ReserveStockBatchResponse{ReferenceOrderId: req.ReferenceOrderId, AllReserved: true}, nil
}

func (s *SyncService) ReleaseStockBatch(ctx context.Context, req *inventoryv1.ReleaseStockBatchRequest) (*inventoryv1.ReleaseStockBatchResponse, error) {
	if req == nil || !validID(req.ReferenceOrderId) {
		return nil, ErrInvalidStockRequest
	}
	tx, err := s.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	// A tombstone prevents a delayed reservation from committing after compensation.
	_, err = tx.ExecContext(ctx, `INSERT INTO inventory_reservation_batches
 (reference_order_id, warehouse_id, request_hash, status) VALUES (?, '', '', 'RELEASED')
 ON DUPLICATE KEY UPDATE reference_order_id = reference_order_id`, req.ReferenceOrderId)
	if err != nil {
		return nil, err
	}
	var batchStatus string
	if err = tx.GetContext(ctx, &batchStatus, `SELECT status FROM inventory_reservation_batches WHERE reference_order_id = ? FOR UPDATE`, req.ReferenceOrderId); err != nil {
		return nil, err
	}
	var reservations []struct {
		ID       string         `db:"id"`
		StockID  sql.NullString `db:"stock_id"`
		Quantity int64          `db:"reserved_quantity"`
	}
	if err = tx.SelectContext(ctx, &reservations, `SELECT id, stock_id, reserved_quantity FROM stock_reservations
	WHERE reference_order_id = ? AND status = 'HOLD' ORDER BY product_id, stock_id, id FOR UPDATE`, req.ReferenceOrderId); err != nil {
		return nil, err
	}
	for _, res := range reservations {
		if !res.StockID.Valid {
			return nil, errors.New("legacy reservation has no stock_id; reconcile its warehouse before release")
		}
		result, updateErr := tx.ExecContext(ctx, `UPDATE inventory_stocks SET quantity_reserved = quantity_reserved - ?, updated_at = NOW()
  WHERE id = ? AND quantity_reserved >= ?`, res.Quantity, res.StockID.String, res.Quantity)
		if updateErr != nil {
			return nil, updateErr
		}
		rows, rowsErr := result.RowsAffected()
		if rowsErr != nil {
			return nil, rowsErr
		}
		if rows != 1 {
			return nil, errors.New("reservation/stock accounting mismatch")
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE stock_reservations SET status = 'RELEASED' WHERE reference_order_id = ? AND status = 'HOLD'`, req.ReferenceOrderId)
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `UPDATE inventory_reservation_batches SET status = 'RELEASED' WHERE reference_order_id = ?`, req.ReferenceOrderId)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return &inventoryv1.ReleaseStockBatchResponse{Released: true}, nil
}
