package inventoryclient

import (
	"context"
	"time"

	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// One persistent HTTP/2 connection. Plaintext is for the private/local lab network.
type Client struct {
	conn *grpc.ClientConn
	rpc  inventoryv1.InventoryServiceClient
}

func New(target string) (*Client, error) {
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &Client{conn: conn, rpc: inventoryv1.NewInventoryServiceClient(conn)}, nil
}
func (c *Client) Close() error { return c.conn.Close() }
func (c *Client) CheckStock(ctx context.Context, req *inventoryv1.CheckStockRequest) (*inventoryv1.CheckStockResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return c.rpc.CheckStock(ctx, req)
}
func (c *Client) ReserveStockBatch(ctx context.Context, req *inventoryv1.ReserveStockBatchRequest) (*inventoryv1.ReserveStockBatchResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return c.rpc.ReserveStockBatch(ctx, req)
}
func (c *Client) ReleaseStockBatch(ctx context.Context, req *inventoryv1.ReleaseStockBatchRequest) (*inventoryv1.ReleaseStockBatchResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return c.rpc.ReleaseStockBatch(ctx, req)
}
