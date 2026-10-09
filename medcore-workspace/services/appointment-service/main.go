package main

import (
	pb "appointment-service/pb"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"os"
	"time"
)

func main() {
	target := os.Getenv("PHARMACY_GRPC_TARGET")
	if target == "" {
		target = "localhost:50051"
	}
	addr := flag.String("target", target, "alamat Pharmacy")
	drug := flag.String("drug-code", "MED-AMX-500", "kode obat")
	qty := flag.Int("quantity", 20, "jumlah dibutuhkan")
	timeout := flag.Duration("timeout", 2*time.Second, "deadline RPC")
	expected := flag.String("expect", "OK", "status yang diharapkan")
	delay := flag.Int("delay-ms", 0, "injeksi delay untuk lab")
	flag.Parse()
	if *qty < 1 || int64(*qty) > 2147483647 || *timeout <= 0 {
		fmt.Fprintln(os.Stderr, "argumen tidak valid")
		os.Exit(2)
	}
	conn, err := grpc.Dial(*addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer conn.Close()
	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()
	if *delay > 0 {
		ctx = metadata.AppendToOutgoingContext(ctx, "x-lab-delay-ms", fmt.Sprint(*delay))
	}
	start := time.Now()
	resp, err := pb.NewPharmacyServiceClient(conn).CheckDrugAvailability(ctx, &pb.CheckDrugRequest{DrugCode: *drug, QuantityNeeded: int32(*qty)})
	code := status.Code(err).String()
	message := "Pemeriksaan stok berhasil"
	if err != nil {
		message = status.Convert(err).Message()
		switch code {
		case "NotFound":
			fmt.Fprintln(os.Stderr, "Peringatan klinis: periksa kembali kode obat")
		case "ResourceExhausted":
			fmt.Fprintln(os.Stderr, "Peringatan klinis: permintaan melewati kuota farmasi")
		case "DeadlineExceeded":
			fmt.Fprintln(os.Stderr, "Peringatan klinis: farmasi lambat; proses lain dapat dilanjutkan")
		}
	}
	result := map[string]interface{}{"status": code, "message": message, "elapsed_ms": float64(time.Since(start).Microseconds()) / 1000, "response": resp}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if code != *expected {
		fmt.Fprintf(os.Stderr, "status %s, diharapkan %s\n", code, *expected)
		os.Exit(1)
	}
}
