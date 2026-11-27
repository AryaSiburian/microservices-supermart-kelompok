package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/nusantara-supermart/gateway-services/internal/data"
	"github.com/nusantara-supermart/gateway-services/internal/httpapi"
)

func main() {
	db, err := data.Open()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /orders/{id}", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		o, err := data.OrderByID(ctx, db, r.PathValue("id"))
		if err != nil {
			httpapi.Error(w, err)
			return
		}
		httpapi.JSON(w, 200, o)
	})
	httpapi.Serve(db, mux)
}
