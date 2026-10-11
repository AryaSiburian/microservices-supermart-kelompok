package main

import (
	"encoding/json"
	"fmt"
	"google.golang.org/protobuf/proto"
	"os"
	pb "pharmacy-service/pb"
)

func main() {
	response := &pb.CheckDrugResponse{DrugCode: "MED-AMX-500", IsAvailable: true, CurrentStock: 500, UnitPrice: 3500, Message: "Stok obat mencukupi"}
	binary, err := proto.Marshal(response)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	jsonPayload, err := json.Marshal(map[string]interface{}{"drug_code": response.DrugCode, "is_available": response.IsAvailable, "current_stock": response.CurrentStock, "unit_price": response.UnitPrice, "message": response.Message})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_ = json.NewEncoder(os.Stdout).Encode(map[string]interface{}{
		"json_bytes": len(jsonPayload), "protobuf_bytes": len(binary),
		"reduction_percent": (1 - float64(len(binary))/float64(len(jsonPayload))) * 100,
		"scope":             "serialized response body only; excludes HTTP headers, gRPC 5-byte prefix, framing, TCP/IP and TLS",
	})
}
