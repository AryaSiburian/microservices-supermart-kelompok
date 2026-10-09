package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	pb "pharmacy-service/pb"
	"strconv"
	"syscall"
	"time"
)

type server struct {
	pb.UnimplementedPharmacyServiceServer
	drugs    *mongo.Collection
	delay    time.Duration
	labDelay bool
}
type drugDoc struct {
	DrugCode   string  `bson:"drug_code"`
	UnitPrice  float64 `bson:"unit_price"`
	TotalStock int32   `bson:"total_stock"`
}
type stockResponse struct {
	DrugCode     string  `json:"drug_code"`
	IsAvailable  bool    `json:"is_available"`
	CurrentStock int32   `json:"current_stock"`
	UnitPrice    float64 `json:"unit_price"`
	Message      string  `json:"message"`
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Kedua protokol memakai validasi, delay, query, dan pesan bisnis yang sama.
func (s *server) check(ctx context.Context, code string, qty int32, delay time.Duration) (*stockResponse, error) {
	if code == "" || qty <= 0 {
		return nil, status.Error(codes.InvalidArgument, "Kode obat dan kuantitas positif wajib diisi")
	}
	if qty > 5000 {
		return nil, status.Error(codes.ResourceExhausted, "Permintaan melebihi batas kuota farmasi")
	}
	if delay > 0 {
		timer := time.NewTimer(delay)
		defer timer.Stop()
		select {
		case <-timer.C:
		case <-ctx.Done():
			return nil, status.FromContextError(ctx.Err()).Err()
		}
	}
	var drug drugDoc
	err := s.drugs.FindOne(ctx, bson.M{"drug_code": code}).Decode(&drug)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, status.Errorf(codes.NotFound, "Obat dengan kode %s tidak ditemukan dalam inventaris", code)
		}
		if ctx.Err() != nil {
			return nil, status.FromContextError(ctx.Err()).Err()
		}
		log.Printf("query stok gagal: %v", err)
		return nil, status.Error(codes.Internal, "Database farmasi tidak tersedia")
	}
	available := drug.TotalStock >= qty
	msg := "Stok obat mencukupi"
	if !available {
		msg = fmt.Sprintf("Stok tidak mencukupi. Tersedia: %d, Dibutuhkan: %d", drug.TotalStock, qty)
	}
	return &stockResponse{drug.DrugCode, available, drug.TotalStock, drug.UnitPrice, msg}, nil
}
func (s *server) requestDelay(value string) (time.Duration, error) {
	if value == "" || !s.labDelay {
		return s.delay, nil
	}
	ms, err := strconv.Atoi(value)
	if err != nil || ms < 0 || ms > 5000 {
		return 0, status.Error(codes.InvalidArgument, "Delay lab harus 0-5000 ms")
	}
	return time.Duration(ms) * time.Millisecond, nil
}
func (s *server) CheckDrugAvailability(ctx context.Context, req *pb.CheckDrugRequest) (*pb.CheckDrugResponse, error) {
	injected := ""
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if values := md.Get("x-lab-delay-ms"); len(values) > 0 {
			injected = values[0]
		}
	}
	delay, err := s.requestDelay(injected)
	if err != nil {
		return nil, err
	}
	r, err := s.check(ctx, req.GetDrugCode(), req.GetQuantityNeeded(), delay)
	if err != nil {
		return nil, err
	}
	return &pb.CheckDrugResponse{DrugCode: r.DrugCode, IsAvailable: r.IsAvailable, CurrentStock: r.CurrentStock, UnitPrice: r.UnitPrice, Message: r.Message}, nil
}
func httpStatus(code codes.Code) int {
	switch code {
	case codes.InvalidArgument:
		return http.StatusBadRequest
	case codes.NotFound:
		return http.StatusNotFound
	case codes.ResourceExhausted:
		return http.StatusTooManyRequests
	case codes.DeadlineExceeded:
		return http.StatusGatewayTimeout
	case codes.Canceled:
		return http.StatusRequestTimeout
	default:
		return http.StatusInternalServerError
	}
}
func (s *server) restHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	qty, err := strconv.ParseInt(r.URL.Query().Get("quantity_needed"), 10, 32)
	if err != nil {
		qty = 0
	}
	delay, delayErr := s.requestDelay(r.Header.Get("X-Lab-Delay-Ms"))
	var resp *stockResponse
	if delayErr != nil {
		err = delayErr
	} else {
		resp, err = s.check(r.Context(), r.URL.Query().Get("drug_code"), int32(qty), delay)
	}
	if err != nil {
		st := status.Convert(err)
		w.WriteHeader(httpStatus(st.Code()))
		_ = json.NewEncoder(w).Encode(map[string]string{"code": st.Code().String(), "error": st.Message()})
		return
	}
	_ = json.NewEncoder(w).Encode(resp)
}
func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	dbName := env("PHARMACY_DB_NAME", "medcore_pharmacy_db")
	opts := options.Client().ApplyURI(env("MONGO_URI", "mongodb://localhost:27018"))
	opts.SetAuth(options.Credential{AuthSource: dbName, Username: os.Getenv("PHARMACY_DB_USER"), Password: os.Getenv("PHARMACY_DB_PASS")})
	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	client, err := mongo.Connect(connectCtx, opts)
	if err == nil {
		err = client.Ping(connectCtx, nil)
	}
	cancel()
	if err != nil {
		log.Fatalf("MongoDB tidak siap: %v", err)
	}
	defer client.Disconnect(context.Background())
	delayMS, err := strconv.Atoi(env("PHARMACY_DELAY_MS", "0"))
	if err != nil || delayMS < 0 || delayMS > 5000 {
		log.Fatal("PHARMACY_DELAY_MS harus 0-5000")
	}
	impl := &server{drugs: client.Database(dbName).Collection("drugs"), delay: time.Duration(delayMS) * time.Millisecond, labDelay: os.Getenv("ENABLE_LAB_DELAY") == "true"}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/drugs/check", impl.restHandler)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		pingCtx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if client.Ping(pingCtx, nil) != nil {
			http.Error(w, "MongoDB unavailable", 503)
			return
		}
		_, _ = w.Write([]byte("ok"))
	})
	rest := &http.Server{Addr: env("REST_ADDR", ":8081"), Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	lis, err := net.Listen("tcp", env("GRPC_ADDR", ":50051"))
	if err != nil {
		log.Fatal(err)
	}
	rpc := grpc.NewServer()
	pb.RegisterPharmacyServiceServer(rpc, impl)
	failures := make(chan error, 2)
	go func() { failures <- rest.ListenAndServe() }()
	go func() { failures <- rpc.Serve(lis) }()
	log.Printf("Pharmacy siap: gRPC=%s REST=%s delay=%dms", lis.Addr(), rest.Addr, delayMS)
	select {
	case <-ctx.Done():
	case err = <-failures:
		log.Printf("server berhenti: %v", err)
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
