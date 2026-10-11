package inventory

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
)

type RPCServer struct {
	inventoryv1.UnimplementedInventoryServiceServer
	service *SyncService
}

func NewRPCServer(service *SyncService) *RPCServer { return &RPCServer{service: service} }
func rpcError(err error) error {
	switch {
	case errors.Is(err, ErrInvalidStockRequest):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, ErrStockNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, ErrInsufficientStock), errors.Is(err, ErrReservationConflict):
		return status.Error(codes.FailedPrecondition, err.Error())
	case errors.Is(err, context.DeadlineExceeded):
		return status.Error(codes.DeadlineExceeded, "request deadline exceeded")
	case errors.Is(err, context.Canceled):
		return status.Error(codes.Canceled, "request canceled")
	default:
		log.Printf("inventory operation failed: %v", err)
		return status.Error(codes.Internal, "inventory database operation failed")
	}
}
func (s *RPCServer) CheckStock(ctx context.Context, req *inventoryv1.CheckStockRequest) (*inventoryv1.CheckStockResponse, error) {
	resp, err := s.service.CheckStock(ctx, req)
	if err != nil {
		return nil, rpcError(err)
	}
	return resp, nil
}
func (s *RPCServer) ReserveStockBatch(ctx context.Context, req *inventoryv1.ReserveStockBatchRequest) (*inventoryv1.ReserveStockBatchResponse, error) {
	resp, err := s.service.ReserveStockBatch(ctx, req)
	if err != nil {
		return nil, rpcError(err)
	}
	return resp, nil
}
func (s *RPCServer) ReleaseStockBatch(ctx context.Context, req *inventoryv1.ReleaseStockBatchRequest) (*inventoryv1.ReleaseStockBatchResponse, error) {
	resp, err := s.service.ReleaseStockBatch(ctx, req)
	if err != nil {
		return nil, rpcError(err)
	}
	return resp, nil
}

func NewRESTHandler(service *SyncService) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := service.db.PingContext(ctx); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/v1/inventory/check-stock", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		resp, err := service.CheckStock(ctx, &inventoryv1.CheckStockRequest{ProductId: r.URL.Query().Get("product_id"), WarehouseId: r.URL.Query().Get("warehouse_id")})
		if err != nil {
			code := http.StatusInternalServerError
			switch {
			case errors.Is(err, ErrInvalidStockRequest):
				code = http.StatusBadRequest
			case errors.Is(err, ErrStockNotFound):
				code = http.StatusNotFound
			case errors.Is(err, context.DeadlineExceeded):
				code = http.StatusGatewayTimeout
			}
			http.Error(w, status.Convert(rpcError(err)).Message(), code)
			return
		}
		body, err := (protojson.MarshalOptions{UseProtoNames: true, EmitUnpopulated: true}).Marshal(resp)
		if err != nil {
			http.Error(w, "encoding failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	})
	return mux
}
