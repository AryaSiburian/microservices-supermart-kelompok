// Closed-loop load test: N concurrent workers, one request per worker in flight.
// REST: HTTP/1.1 keep-alive pool. gRPC: one HTTP/2 channel with concurrent streams.
package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"sort"
	"sync"
	"time"

	inventoryv1 "github.com/nusantara-supermart/backend/gen/inventory/v1"
	"github.com/nusantara-supermart/backend/internal/inventoryclient"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type result struct {
	Hostname                 string                          `json:"hostname"`
	Protocol                 string                          `json:"protocol"`
	GoVersion                string                          `json:"go_version"`
	Concurrency              int                             `json:"concurrency"`
	RequestedDurationSeconds float64                         `json:"requested_duration_seconds"`
	ActualDurationSeconds    float64                         `json:"actual_duration_seconds"`
	StartedAt                time.Time                       `json:"started_at"`
	FinishedAt               time.Time                       `json:"finished_at"`
	SuccessfulRequests       int                             `json:"successful_requests"`
	FailedRequests           int                             `json:"failed_requests"`
	FirstError               string                          `json:"first_error,omitempty"`
	MeanMS                   float64                         `json:"mean_ms"`
	P50MS                    float64                         `json:"p50_ms"`
	P95MS                    float64                         `json:"p95_ms"`
	P99MS                    float64                         `json:"p99_ms"`
	RPS                      float64                         `json:"rps"`
	ResponseBytesMean        float64                         `json:"response_bytes_mean"`
	Response                 *inventoryv1.CheckStockResponse `json:"response"`
	Target                   string                          `json:"target"`
}
type workerResult struct {
	latencies  []float64
	bytes      int64
	failures   int
	firstError string
}
type caller func(context.Context) (*inventoryv1.CheckStockResponse, int, error)

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	return sorted[int(math.Ceil(p*float64(len(sorted))))-1]
}
func main() {
	mode := flag.String("protocol", "rest", "rest or grpc")
	concurrency := flag.Int("concurrency", 50, "concurrent workers")
	duration := flag.Duration("duration", 30*time.Second, "measured duration, excluding warmup")
	warmup := flag.Duration("warmup", 2*time.Second, "unmeasured warmup")
	restURL := flag.String("rest-url", "http://inventory:8081/api/v1/inventory/check-stock", "REST endpoint")
	grpcTarget := flag.String("grpc-target", "inventory:50051", "gRPC target")
	productID := flag.String("product-id", "p0000001-0000-0000-0000-000000000001", "same product for both protocols")
	warehouseID := flag.String("warehouse-id", "w0000001-0000-0000-0000-000000000001", "same warehouse for both protocols")
	out := flag.String("out", "", "JSON result file")
	flag.Parse()
	if *concurrency <= 0 || *concurrency > 10000 || *duration <= 0 || *warmup < 0 {
		panic("invalid load parameters")
	}
	req := &inventoryv1.CheckStockRequest{ProductId: *productID, WarehouseId: *warehouseID}
	var call caller
	var target, protocol string
	switch *mode {
	case "rest":
		u, err := url.Parse(*restURL)
		if err != nil {
			panic(err)
		}
		if u.Scheme != "http" {
			panic("REST benchmark requires plaintext HTTP/1.1")
		}
		q := u.Query()
		q.Set("product_id", req.ProductId)
		q.Set("warehouse_id", req.WarehouseId)
		u.RawQuery = q.Encode()
		target = u.String()
		protocol = "HTTP/1.1 + JSON"
		transport := &http.Transport{ForceAttemptHTTP2: false, TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{}, MaxIdleConns: *concurrency, MaxIdleConnsPerHost: *concurrency, MaxConnsPerHost: *concurrency, DisableCompression: true}
		defer transport.CloseIdleConnections()
		client := &http.Client{Transport: transport, Timeout: 5 * time.Second}
		call = func(ctx context.Context) (*inventoryv1.CheckStockResponse, int, error) {
			request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
			if err != nil {
				return nil, 0, err
			}
			response, err := client.Do(request)
			if err != nil {
				return nil, 0, err
			}
			defer response.Body.Close()
			body, err := io.ReadAll(response.Body)
			if err != nil {
				return nil, 0, err
			}
			if response.ProtoMajor != 1 || response.ProtoMinor != 1 || response.StatusCode != 200 {
				return nil, 0, fmt.Errorf("unexpected REST status/protocol: %d %s", response.StatusCode, response.Proto)
			}
			var decoded inventoryv1.CheckStockResponse
			if err = protojson.Unmarshal(body, &decoded); err != nil {
				return nil, 0, err
			}
			return &decoded, len(body), nil
		}
	case "grpc":
		client, err := inventoryclient.New(*grpcTarget)
		if err != nil {
			panic(err)
		}
		defer client.Close()
		target = *grpcTarget
		protocol = "HTTP/2 + Protobuf"
		call = func(ctx context.Context) (*inventoryv1.CheckStockResponse, int, error) {
			response, err := client.CheckStock(ctx, req)
			if err != nil {
				return nil, 0, err
			}
			return response, proto.Size(response), nil
		}
	default:
		panic("protocol must be rest or grpc")
	}
	baseline, _, err := call(context.Background())
	if err != nil {
		panic(fmt.Errorf("preflight: %w", err))
	}
	if baseline.ProductId != req.ProductId || baseline.WarehouseId != req.WarehouseId {
		panic("preflight response identifiers differ")
	}
	// Reuse persistent connections, compare each response with the preflight data.
	checked := func(ctx context.Context) (*inventoryv1.CheckStockResponse, int, error) {
		response, size, err := call(ctx)
		if err != nil {
			return nil, 0, err
		}
		if !proto.Equal(response, baseline) {
			return nil, 0, fmt.Errorf("stock changed during read-only test: %v", response)
		}
		return response, size, nil
	}
	run := func(d time.Duration) ([]workerResult, time.Time, time.Time) {
		workers := make([]workerResult, *concurrency)
		var ready, done sync.WaitGroup
		ready.Add(*concurrency)
		done.Add(*concurrency)
		startSignal := make(chan struct{})
		var deadline time.Time
		for i := range workers {
			go func(index int) {
				defer done.Done()
				ready.Done()
				<-startSignal
				for time.Now().Before(deadline) {
					started := time.Now()
					_, size, callErr := checked(context.Background())
					elapsed := float64(time.Since(started)) / float64(time.Millisecond)
					if callErr != nil {
						workers[index].failures++
						if workers[index].firstError == "" {
							workers[index].firstError = callErr.Error()
						}
						continue
					}
					workers[index].latencies = append(workers[index].latencies, elapsed)
					workers[index].bytes += int64(size)
				}
			}(i)
		}
		ready.Wait()
		started := time.Now()
		deadline = started.Add(d)
		close(startSignal)
		done.Wait()
		return workers, started, time.Now()
	}
	if *warmup > 0 {
		run(*warmup)
	}
	workers, started, finished := run(*duration)
	hostname, _ := os.Hostname()
	if host := os.Getenv("BENCHMARK_HOSTNAME"); host != "" {
		hostname = host
	}
	record := result{Hostname: hostname, Protocol: protocol, GoVersion: runtime.Version(), Concurrency: *concurrency, RequestedDurationSeconds: duration.Seconds(), ActualDurationSeconds: finished.Sub(started).Seconds(), StartedAt: started.UTC(), FinishedAt: finished.UTC(), Response: baseline, Target: target}
	var latencies []float64
	var sizeSum int64
	var latencySum float64
	for _, worker := range workers {
		latencies = append(latencies, worker.latencies...)
		sizeSum += worker.bytes
		record.FailedRequests += worker.failures
		if record.FirstError == "" {
			record.FirstError = worker.firstError
		}
	}
	record.SuccessfulRequests = len(latencies)
	for _, latency := range latencies {
		latencySum += latency
	}
	sort.Float64s(latencies)
	if len(latencies) > 0 {
		record.MeanMS = latencySum / float64(len(latencies))
		record.ResponseBytesMean = float64(sizeSum) / float64(len(latencies))
	}
	record.P50MS = percentile(latencies, .50)
	record.P95MS = percentile(latencies, .95)
	record.P99MS = percentile(latencies, .99)
	record.RPS = float64(len(latencies)) / record.ActualDurationSeconds
	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		panic(err)
	}
	if *out != "" {
		if err = os.WriteFile(*out, append(data, '\n'), 0644); err != nil {
			panic(err)
		}
	}
	fmt.Printf("Hostname: %s\n%s | workers=%d | duration=%.3fs\n", hostname, protocol, *concurrency, record.ActualDurationSeconds)
	fmt.Printf("mean_ms\tp50_ms\tp95_ms\tp99_ms\tRPS\tpayload_bytes\tsuccess\terrors\n%.3f\t%.3f\t%.3f\t%.3f\t%.2f\t%.2f\t%d\t%d\n", record.MeanMS, record.P50MS, record.P95MS, record.P99MS, record.RPS, record.ResponseBytesMean, record.SuccessfulRequests, record.FailedRequests)
	if record.FailedRequests > 0 || record.SuccessfulRequests == 0 {
		fmt.Fprintln(os.Stderr, record.FirstError)
		os.Exit(1)
	}
}
