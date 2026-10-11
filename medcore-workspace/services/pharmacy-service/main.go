package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	pb "pharmacy-service/pb"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ─────────────────────────────────────────────
// gRPC Server Implementation
// ─────────────────────────────────────────────

type pharmacyServer struct {
	pb.UnimplementedPharmacyServiceServer
	mongoClient *mongo.Client
}

// DrugDoc merepresentasikan dokumen obat di koleksi MongoDB "drugs"
type DrugDoc struct {
	DrugCode   string  `bson:"drug_code"`
	Name       string  `bson:"name"`
	UnitPrice  float64 `bson:"unit_price"`
	TotalStock int32   `bson:"total_stock"`
}

func drugsCollection(client *mongo.Client) *mongo.Collection {
	dbName := os.Getenv("PHARMACY_DB_NAME")
	if dbName == "" {
		dbName = "medcore_pharmacy_db"
	}
	return client.Database(dbName).Collection("drugs")
}

// CheckDrugAvailability — Langkah 2.3 (gRPC Unary RPC)
// Studi Kasus 2.5: ResourceExhausted jika QuantityNeeded > 5000
func (s *pharmacyServer) CheckDrugAvailability(ctx context.Context, req *pb.CheckDrugRequest) (*pb.CheckDrugResponse, error) {
	log.Printf("[gRPC] CheckDrugAvailability | drug_code=%s quantity_needed=%d", req.GetDrugCode(), req.GetQuantityNeeded())

	// Studi Kasus 2.5: batas kuota farmasi
	if req.GetQuantityNeeded() > 5000 {
		return nil, status.Errorf(codes.ResourceExhausted,
			"Permintaan melebihi batas kuota farmasi (max 5000, diminta %d)", req.GetQuantityNeeded())
	}

	coll := drugsCollection(s.mongoClient)

	var drug DrugDoc
	err := coll.FindOne(ctx, bson.M{"drug_code": req.GetDrugCode()}).Decode(&drug)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, status.Errorf(codes.NotFound,
				"Obat dengan kode %s tidak ditemukan dalam inventaris", req.GetDrugCode())
		}
		return nil, status.Errorf(codes.Internal, "Database error: %v", err)
	}

	if drug.TotalStock < req.GetQuantityNeeded() {
		return &pb.CheckDrugResponse{
			DrugCode:     drug.DrugCode,
			IsAvailable:  false,
			CurrentStock: drug.TotalStock,
			UnitPrice:    drug.UnitPrice,
			Message: fmt.Sprintf("Stok tidak mencukupi. Tersedia: %d, Dibutuhkan: %d",
				drug.TotalStock, req.GetQuantityNeeded()),
		}, nil
	}

	return &pb.CheckDrugResponse{
		DrugCode:     drug.DrugCode,
		IsAvailable:  true,
		CurrentStock: drug.TotalStock,
		UnitPrice:    drug.UnitPrice,
		Message:      "Stok obat mencukupi",
	}, nil
}

// ReservePrescriptionStock — Langkah 2.3 (skeleton implementasi)
func (s *pharmacyServer) ReservePrescriptionStock(ctx context.Context, req *pb.ReserveStockRequest) (*pb.ReserveStockResponse, error) {
	log.Printf("[gRPC] ReservePrescriptionStock | prescription_id=%s appointment_id=%s items=%d",
		req.GetPrescriptionId(), req.GetAppointmentId(), len(req.GetItems()))

	// TODO: Implementasi pengurangan stok per batch di Sesi berikutnya
	txRef := fmt.Sprintf("TXN-%s-%d", req.GetPrescriptionId(), time.Now().UnixMilli())
	return &pb.ReserveStockResponse{
		ReservationSuccess:   true,
		TransactionReference: txRef,
		ErrorDetail:          "",
	}, nil
}

// ─────────────────────────────────────────────
// REST Baseline Server (Langkah 3.1)
// ─────────────────────────────────────────────

func startRESTServer(mongoClient *mongo.Client) {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/drugs/check", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		drugCode := r.URL.Query().Get("drug_code")
		if drugCode == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "parameter drug_code wajib diisi"})
			return
		}

		coll := drugsCollection(mongoClient)

		var drug DrugDoc
		err := coll.FindOne(r.Context(), bson.M{"drug_code": drugCode}).Decode(&drug)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Obat tidak ditemukan"})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"drug_code":     drug.DrugCode,
			"name":          drug.Name,
			"is_available":  drug.TotalStock >= 10,
			"current_stock": drug.TotalStock,
			"unit_price":    drug.UnitPrice,
			"message":       "Stok obat mencukupi",
		})
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "pharmacy-rest"})
	})

	log.Println("========================================================")
	log.Println("MedCore Pharmacy REST Baseline aktif pada port :8081")
	log.Println("========================================================")
	if err := http.ListenAndServe(":8081", mux); err != nil {
		log.Fatalf("REST server error: %v", err)
	}
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────

func main() {
	// Baca MongoDB URI dari environment atau gunakan default
	mongoURI := os.Getenv("PHARMACY_MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://adm_pharmacy_svc:SecuredPassPharm2026!@localhost:27018/medcore_pharmacy_db?authSource=admin"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Gagal terhubung ke MongoDB: %v", err)
	}
	defer func() {
		if err = client.Disconnect(context.Background()); err != nil {
			log.Printf("Peringatan: gagal disconnect MongoDB: %v", err)
		}
	}()

	// Ping MongoDB untuk verifikasi koneksi
	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("MongoDB ping gagal: %v", err)
	}
	log.Println("[MongoDB] Koneksi berhasil ke medcore-pharmacy-db")

	// Jalankan REST server secara goroutine (Langkah 3.1)
	go startRESTServer(client)

	// Jalankan gRPC Server (Langkah 2.3)
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("Gagal membuka port 50051: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterPharmacyServiceServer(s, &pharmacyServer{mongoClient: client})

	log.Println("==================================================")
	log.Println("MedCore Pharmacy gRPC Service aktif pada port :50051")
	log.Println("==================================================")

	if err := s.Serve(lis); err != nil {
		log.Fatalf("Gagal menjalankan gRPC server: %v", err)
	}
}
