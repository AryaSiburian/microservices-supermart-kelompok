package main

import (
	"context"
	"log"
	"time"

	pb "appointment-service/pb"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

func checkDrug(client pb.PharmacyServiceClient, drugCode string, qty int32) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	log.Printf("[RPC Call] Memvalidasi obat: %s | jumlah: %d", drugCode, qty)
	resp, err := client.CheckDrugAvailability(ctx, &pb.CheckDrugRequest{
		DrugCode:       drugCode,
		QuantityNeeded: qty,
	})

	if err != nil {
		// ─── Studi Kasus 2.5: Penanganan error berbeda per kode status ───
		st, _ := status.FromError(err)
		switch st.Code() {
		case codes.NotFound:
			log.Printf("[PERINGATAN KLINIS] Obat '%s' tidak ditemukan dalam inventaris farmasi. "+
				"Konsultasi harus ditunda hingga obat tersedia. Detail: %s", drugCode, st.Message())
		case codes.ResourceExhausted:
			log.Printf("[PERINGATAN KLINIS] Permintaan obat '%s' melebihi batas kuota farmasi. "+
				"Kurangi jumlah atau ajukan permintaan khusus ke apoteker senior. Detail: %s", drugCode, st.Message())
		case codes.DeadlineExceeded:
			log.Printf("[PERINGATAN KLINIS] Farmasi tidak merespon dalam batas waktu (timeout). "+
				"Potensi cascading failure. Gunakan protokol darurat jika perlu. Detail: %s", st.Message())
		case codes.Unavailable:
			log.Printf("[PERINGATAN KLINIS] Farmasi Service tidak tersedia (DOWN). "+
				"Hubungi DevOps on-call. Detail: %s", st.Message())
		default:
			log.Printf("[ERROR] RPC gagal tidak terduga: Code=%s | Message=%s", st.Code(), st.Message())
		}
		return
	}

	log.Println("================== HASIL RESPON gRPC ==================")
	log.Printf("Kode Obat      : %s", resp.GetDrugCode())
	log.Printf("Tersedia       : %t", resp.GetIsAvailable())
	log.Printf("Stok Aktual    : %d", resp.GetCurrentStock())
	log.Printf("Harga Satuan   : Rp %.2f", resp.GetUnitPrice())
	log.Printf("Catatan Sistem : %s", resp.GetMessage())
	log.Println("========================================================")
}

func main() {
	log.Println("[Appointment Service] Menginisialisasi koneksi gRPC ke Pharmacy Service...")

	// Koneksi gRPC Channel (HTTP/2 Multiplexed)
	conn, err := grpc.Dial("localhost:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("Tidak dapat membentuk koneksi ke Pharmacy Service: %v", err)
	}
	defer conn.Close()

	client := pb.NewPharmacyServiceClient(conn)

	// ─── Skenario 1: Obat tersedia (Amoxicillin 500mg, butuh 20) ───
	checkDrug(client, "MED-AMX-500", 20)

	// ─── Skenario 2: Studi Kasus 2.5 — NotFound ───
	checkDrug(client, "MED-TIDAK-ADA", 5)

	// ─── Skenario 3: Studi Kasus 2.5 — ResourceExhausted (>5000) ───
	checkDrug(client, "MED-AMX-500", 10000)
}
