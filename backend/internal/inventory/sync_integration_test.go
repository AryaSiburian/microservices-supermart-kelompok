package inventory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"github.com/nusantara-supermart/backend/internal/inventoryclient"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type fixture struct {
	db       *sqlx.DB
	service  *SyncService
	products [2]string
	stocks   [3]string
	wh       [2]string
	orders   []string
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	dsn := os.Getenv("SUPERMART_TEST_DSN")
	if dsn == "" {
		t.Skip("set SUPERMART_TEST_DSN to the disposable Tugas 2 fixture database")
	}
	db, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(25)
	f := &fixture{db: db, service: NewSyncService(db), wh: [2]string{"w0000001-0000-0000-0000-000000000001", "w0000002-0000-0000-0000-000000000002"}}
	for i := range f.products {
		f.products[i] = uuid.NewString()
		if _, err = db.Exec(`INSERT INTO products (id,sku,title,base_price) VALUES (?,?,'Integration fixture',1)`, f.products[i], f.products[i]); err != nil {
			t.Fatal(err)
		}
	}
	for i := range f.stocks {
		f.stocks[i] = uuid.NewString()
		product, wh, onHand, reserved := f.products[0], f.wh[0], 10, 0
		if i == 1 {
			product = f.products[1]
			onHand = 0
		}
		if i == 2 {
			wh = f.wh[1]
			onHand = 30
			reserved = 5
		}
		if _, err = db.Exec(`INSERT INTO inventory_stocks (id,product_id,warehouse_id,quantity_on_hand,quantity_reserved) VALUES (?,?,?,?,?)`, f.stocks[i], product, wh, onHand, reserved); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		for _, id := range f.orders {
			db.Exec(`DELETE FROM stock_reservations WHERE reference_order_id=?`, id)
			db.Exec(`DELETE FROM inventory_reservation_batches WHERE reference_order_id=?`, id)
		}
		for _, id := range f.products {
			db.Exec(`DELETE FROM inventory_stocks WHERE product_id=?`, id)
			db.Exec(`DELETE FROM products WHERE id=?`, id)
		}
		db.Close()
	})
	return f
}
func (f *fixture) request(items ...*inventoryv1.ReserveStockLineItem) *inventoryv1.ReserveStockBatchRequest {
	id := uuid.NewString()
	f.orders = append(f.orders, id)
	return &inventoryv1.ReserveStockBatchRequest{ReferenceOrderId: id, WarehouseId: f.wh[0], Items: items}
}
func (f *fixture) reserved(t *testing.T, stock string) int {
	t.Helper()
	var n int
	if err := f.db.Get(&n, `SELECT quantity_reserved FROM inventory_stocks WHERE id=?`, stock); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestUnaryRESTAndGRPCEquivalent(t *testing.T) {
	f := newFixture(t)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := grpc.NewServer()
	inventoryv1.RegisterInventoryServiceServer(server, NewRPCServer(f.service))
	go server.Serve(listener)
	t.Cleanup(server.Stop)
	client, err := inventoryclient.New(listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	rest := httptest.NewServer(NewRESTHandler(f.service))
	defer rest.Close()
	request := &inventoryv1.CheckStockRequest{ProductId: f.products[0], WarehouseId: f.wh[0]}
	rpcResult, err := client.CheckStock(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.Get(fmt.Sprintf("%s/api/v1/inventory/check-stock?product_id=%s&warehouse_id=%s", rest.URL, request.ProductId, request.WarehouseId))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 || response.Proto != "HTTP/1.1" {
		t.Fatalf("%d %s", response.StatusCode, response.Proto)
	}
	body, _ := io.ReadAll(response.Body)
	var decoded inventoryv1.CheckStockResponse
	if err = protojson.Unmarshal(body, &decoded); err != nil {
		t.Fatal(err)
	}
	if !proto.Equal(rpcResult, &decoded) || decoded.AvailableQty != 10 {
		t.Fatalf("non-equivalent responses: %s %v", body, rpcResult)
	}
	var raw map[string]any
	if err = json.Unmarshal(body, &raw); err != nil || len(raw) != 4 {
		t.Fatalf("unexpected JSON contract: %s", body)
	}
	_, err = client.CheckStock(context.Background(), &inventoryv1.CheckStockRequest{WarehouseId: f.wh[0]})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("invalid input: %v", err)
	}
	_, err = client.CheckStock(context.Background(), &inventoryv1.CheckStockRequest{ProductId: uuid.NewString(), WarehouseId: f.wh[0]})
	if status.Code(err) != codes.NotFound {
		t.Fatalf("missing stock: %v", err)
	}
	for _, path := range []struct {
		query string
		code  int
	}{{"", 400}, {"?product_id=missing&warehouse_id=" + f.wh[0], 404}} {
		r, e := http.Get(rest.URL + "/api/v1/inventory/check-stock" + path.query)
		if e != nil {
			t.Fatal(e)
		}
		r.Body.Close()
		if r.StatusCode != path.code {
			t.Fatalf("REST error %d want %d", r.StatusCode, path.code)
		}
	}
}

func TestBatchRollsBackEarlierItem(t *testing.T) {
	f := newFixture(t)
	// Make the insufficient item sort after the first, guaranteeing an earlier UPDATE.
	ids := []string{f.products[0], f.products[1]}
	if ids[0] > ids[1] {
		ids[0], ids[1] = ids[1], ids[0]
		f.db.Exec(`UPDATE inventory_stocks SET quantity_on_hand=10 WHERE product_id=? AND warehouse_id=?`, ids[0], f.wh[0])
		f.db.Exec(`UPDATE inventory_stocks SET quantity_on_hand=0 WHERE product_id=? AND warehouse_id=?`, ids[1], f.wh[0])
	}
	req := f.request(&inventoryv1.ReserveStockLineItem{ProductId: ids[0], Quantity: 2}, &inventoryv1.ReserveStockLineItem{ProductId: ids[1], Quantity: 1})
	if _, err := f.service.ReserveStockBatch(context.Background(), req); !errors.Is(err, ErrInsufficientStock) {
		t.Fatalf("expected insufficiency, got %v", err)
	}
	if f.reserved(t, f.stocks[0]) != 0 || f.reserved(t, f.stocks[1]) != 0 || f.reserved(t, f.stocks[2]) != 5 {
		t.Fatal("partial hold or wrong warehouse modified")
	}
	var count int
	if err := f.db.Get(&count, `SELECT COUNT(*) FROM stock_reservations WHERE reference_order_id=?`, req.ReferenceOrderId); err != nil || count != 0 {
		t.Fatalf("orphan reservation: %d %v", count, err)
	}
	if err := f.db.Get(&count, `SELECT COUNT(*) FROM inventory_reservation_batches WHERE reference_order_id=?`, req.ReferenceOrderId); err != nil || count != 0 {
		t.Fatalf("batch metadata was not rolled back: %d %v", count, err)
	}
}

func TestBatchRetryAndCompensationAreIdempotent(t *testing.T) {
	f := newFixture(t)
	req := f.request(&inventoryv1.ReserveStockLineItem{ProductId: f.products[0], Quantity: 2}, &inventoryv1.ReserveStockLineItem{ProductId: f.products[0], Quantity: 1})
	for i := 0; i < 2; i++ {
		if resp, err := f.service.ReserveStockBatch(context.Background(), req); err != nil || !resp.AllReserved {
			t.Fatalf("reserve: %v %v", resp, err)
		}
	}
	if f.reserved(t, f.stocks[0]) != 3 {
		t.Fatal("retry double-held stock")
	}
	changed := proto.Clone(req).(*inventoryv1.ReserveStockBatchRequest)
	changed.Items[0].Quantity = 5
	if _, err := f.service.ReserveStockBatch(context.Background(), changed); !errors.Is(err, ErrReservationConflict) {
		t.Fatalf("changed idempotency key: %v", err)
	}
	release := &inventoryv1.ReleaseStockBatchRequest{ReferenceOrderId: req.ReferenceOrderId}
	for i := 0; i < 2; i++ {
		if _, err := f.service.ReleaseStockBatch(context.Background(), release); err != nil {
			t.Fatal(err)
		}
	}
	if f.reserved(t, f.stocks[0]) != 0 || f.reserved(t, f.stocks[2]) != 5 {
		t.Fatal("release changed wrong warehouse or ran twice")
	}
	if _, err := f.service.ReserveStockBatch(context.Background(), req); !errors.Is(err, ErrReservationConflict) {
		t.Fatalf("late reservation resurrected released key: %v", err)
	}
}

func TestReleaseBeforeDelayedReserveFencesHold(t *testing.T) {
	f := newFixture(t)
	req := f.request(&inventoryv1.ReserveStockLineItem{ProductId: f.products[0], Quantity: 1})
	if _, err := f.service.ReleaseStockBatch(context.Background(), &inventoryv1.ReleaseStockBatchRequest{ReferenceOrderId: req.ReferenceOrderId}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.ReserveStockBatch(context.Background(), req); !errors.Is(err, ErrReservationConflict) {
		t.Fatalf("late reserve: %v", err)
	}
	if f.reserved(t, f.stocks[0]) != 0 {
		t.Fatal("late hold committed")
	}
}

func TestConcurrentReservationsDoNotOversell(t *testing.T) {
	f := newFixture(t)
	requests := make([]*inventoryv1.ReserveStockBatchRequest, 20)
	for i := range requests {
		requests[i] = f.request(&inventoryv1.ReserveStockLineItem{ProductId: f.products[0], Quantity: 1})
	}
	var wg sync.WaitGroup
	out := make(chan error, 20)
	for _, req := range requests {
		wg.Add(1)
		go func(r *inventoryv1.ReserveStockBatchRequest) {
			defer wg.Done()
			_, err := f.service.ReserveStockBatch(context.Background(), r)
			out <- err
		}(req)
	}
	wg.Wait()
	close(out)
	success := 0
	for err := range out {
		if err == nil {
			success++
		} else if !errors.Is(err, ErrInsufficientStock) {
			t.Fatalf("unexpected concurrent failure: %v", err)
		}
	}
	if success != 10 || f.reserved(t, f.stocks[0]) != 10 {
		t.Fatalf("success=%d reserved=%d", success, f.reserved(t, f.stocks[0]))
	}
}

func TestBatchSpansMultipleStockRows(t *testing.T) {
	f := newFixture(t)
	extra := uuid.NewString()
	if _, err := f.db.Exec(`INSERT INTO inventory_stocks (id,product_id,warehouse_id,quantity_on_hand,quantity_reserved) VALUES (?,?,?,5,0)`, extra, f.products[0], f.wh[0]); err != nil {
		t.Fatal(err)
	}
	req := f.request(&inventoryv1.ReserveStockLineItem{ProductId: f.products[0], Quantity: 12})
	if _, err := f.service.ReserveStockBatch(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	resp, err := f.service.CheckStock(context.Background(), &inventoryv1.CheckStockRequest{ProductId: f.products[0], WarehouseId: f.wh[0]})
	if err != nil || resp.AvailableQty != 3 {
		t.Fatalf("%v %v", resp, err)
	}
	if _, err = f.service.ReleaseStockBatch(context.Background(), &inventoryv1.ReleaseStockBatchRequest{ReferenceOrderId: req.ReferenceOrderId}); err != nil {
		t.Fatal(err)
	}
	if f.reserved(t, f.stocks[0]) != 0 || f.reserved(t, extra) != 0 {
		t.Fatal("multi-row hold not fully released")
	}
}
