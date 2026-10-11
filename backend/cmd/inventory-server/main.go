package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"github.com/nusantara-supermart/backend/internal/inventory"
	"github.com/nusantara-supermart/backend/pkg/config"
	"github.com/nusantara-supermart/backend/pkg/database"
	"google.golang.org/grpc"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	db, err := database.ConnectMySQL(config.LoadConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	// Reuse the full 25-connection pool instead of churning TCP connections
	// under concurrent benchmark load. This tuning applies only to Inventory.
	db.SetMaxIdleConns(25)
	service := inventory.NewSyncService(db)
	listener, err := net.Listen("tcp", env("INVENTORY_GRPC_ADDR", "127.0.0.1:50051"))
	if err != nil {
		log.Fatal(err)
	}
	rpc := grpc.NewServer()
	inventoryv1.RegisterInventoryServiceServer(rpc, inventory.NewRPCServer(service))
	// net/http without TLS/h2c only serves HTTP/1.x, ensuring the REST baseline.
	rest := &http.Server{Addr: env("INVENTORY_REST_ADDR", "127.0.0.1:8081"), Handler: inventory.NewRESTHandler(service), ReadHeaderTimeout: 5 * time.Second}
	failures := make(chan error, 2)
	go func() { failures <- rpc.Serve(listener) }()
	go func() { failures <- rest.ListenAndServe() }()
	log.Printf("Inventory provider: REST HTTP/1.1 %s; gRPC HTTP/2 %s", rest.Addr, listener.Addr())
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	select {
	case <-ctx.Done():
	case err := <-failures:
		log.Printf("server stopped: %v", err)
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = rest.Shutdown(shutdownCtx)
	done := make(chan struct{})
	go func() { rpc.GracefulStop(); close(done) }()
	select {
	case <-done:
	case <-shutdownCtx.Done():
		rpc.Stop()
	}
}
