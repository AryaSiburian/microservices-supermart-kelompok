#!/usr/bin/env bash
# Integration checks for the read-only SuperMart gateway exercise.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v jq >/dev/null || { echo 'Install jq before running this check.' >&2; exit 1; }
compose=(docker compose -p supermart-gateway-local)
base=http://127.0.0.1:8000
out=${1:-"$HOME/Downloads/Laporan Pertemuan 9 API Gateway SuperMart/hasil-uji"}
mkdir -p "$out"
out=$(cd "$out" && pwd)
stopped=''
baseline=''
cleanup() {
  if [[ -n "$baseline" ]]; then docker rm -f "$baseline" >/dev/null; fi
  if [[ -n "$stopped" ]]; then
    "${compose[@]}" start "$stopped" >/dev/null
  fi
}
trap cleanup EXIT
request() {
  local name=$1 path=$2
  curl --http1.1 --max-time 10 -sS -D "$out/$name.headers" \
    -o "$out/$name.json" "$base$path"
  head -n 1 "$out/$name.headers" | tr -d '\r'
}
wait_gateway() {
  for _ in {1..40}; do
    if curl --http1.1 --max-time 2 -fsS "$base/api/v1/orders/1" >/dev/null 2>&1; then return; fi
    sleep 1
  done
  echo 'Gateway not ready' >&2; return 1
}
"${compose[@]}" config --quiet
"${compose[@]}" exec -T api-gateway krakend check -c /etc/krakend/krakend.json
"${compose[@]}" exec -T gateway-entry nginx -t
"${compose[@]}" restart api-gateway >/dev/null
wait_gateway

echo '1. Single routes'
request product /api/v1/products/1
grep -q '200 OK' "$out/product.headers"
jq -e '.id == "1" and .base_price == 95000' "$out/product.json"
request order /api/v1/orders/1
grep -q '200 OK' "$out/order.headers"
jq -e '.id == "1" and .items[0].product_id == "1"' "$out/order.json"

echo '2. Internal ports are unpublished'
"${compose[@]}" config --format json | jq -e \
  '[.services | to_entries[] | select(.key == "catalog-service" or .key == "order-service" or .key == "mysql" or .key == "backend" or .key == "api-gateway") | (.value.ports // [] | length == 0)] | all'
docker port supermart-catalog > "$out/catalog-published-ports.txt"
docker port supermart-order > "$out/order-published-ports.txt"
test ! -s "$out/catalog-published-ports.txt"
test ! -s "$out/order-published-ports.txt"
# Ports 8080/8081 belong to other local stacks. Establish a dedicated baseline
# on 18081 using the SAME provider image, then remove that temporary mapping.
baseline=$(docker run --rm -d --network supermart-gateway-local_supermart-net \
  -p 127.0.0.1:18081:8080 \
  -e MYSQL_HOST=mysql -e MYSQL_DATABASE=nusantara_db \
  -e MYSQL_USER=nusantara_user -e MYSQL_PASSWORD=nusantara_secret \
  "$(docker inspect -f '{{.Config.Image}}' supermart-catalog)")
for _ in {1..20}; do
  if curl --noproxy '*' --max-time 2 -fsS -D "$out/direct-before.headers" \
    http://127.0.0.1:18081/products/1 > "$out/direct-before.json" 2>/dev/null; then break; fi
  sleep 1
done
grep -q '200 OK' "$out/direct-before.headers"
jq -e '.id == "1"' "$out/direct-before.json"
docker rm -f "$baseline" >/dev/null
baseline=''
set +e
curl --noproxy '*' --max-time 2 -sS -i http://127.0.0.1:18081/products/1 \
  > "$out/direct-port.txt" 2>&1
direct_status=$?
set -e
test "$direct_status" = 7
cat "$out/direct-port.txt"

echo '3. Parallel aggregation and actual order/product relationship'
request summary /api/v1/order-summary/1
grep -qi 'X-Krakend-Completed: true' "$out/summary.headers"
jq -e '.order_detail.id == "1" and .product_detail.products[0].id == "1"' "$out/summary.json"
request summary-related /api/v1/order-summary/ord00001-0000-0000-0000-000000000002
jq -e '.product_detail.products[0].id == "p0000001-0000-0000-0000-000000000004" and .order_detail.items[0].product_id == .product_detail.products[0].id' "$out/summary-related.json"

for service in catalog-service order-service; do
  echo "4. Partial response with $service stopped"
  stopped=$service
  "${compose[@]}" stop "$service" >/dev/null
  request "partial-$service" /api/v1/order-summary/1
  grep -q '200 OK' "$out/partial-$service.headers"
  grep -qi 'X-Krakend-Completed: false' "$out/partial-$service.headers"
  if [[ "$service" == catalog-service ]]; then
    jq -e '.order_detail.id == "1" and (has("product_detail") | not)' "$out/partial-$service.json"
  else
    jq -e '.product_detail.products[0].id == "1" and (has("order_detail") | not)' "$out/partial-$service.json"
  fi
  "${compose[@]}" up -d --wait --wait-timeout 60 "$service" >/dev/null
  stopped=''
done
request recovered /api/v1/order-summary/1
grep -qi 'X-Krakend-Completed: true' "$out/recovered.headers"
jq -e 'has("order_detail") and has("product_detail")' "$out/recovered.json"

echo '5. Eight requests from the same client'
"${compose[@]}" restart api-gateway >/dev/null
wait_gateway
: > "$out/rate-status.txt"
for i in {1..8}; do
  code=$(curl --http1.1 --max-time 5 -sS -D "$out/rate-$i.headers" \
    -o "$out/rate-$i.body" -w '%{http_code}' "$base/api/v1/products/1")
  printf 'Request %s: HTTP %s\n' "$i" "$code" | tee -a "$out/rate-status.txt"
  if (( i <= 5 )); then test "$code" = 200; else
    test "$code" = 429
    grep -qi '^Retry-After: 60' "$out/rate-$i.headers"
  fi
done
# Untrusted identity headers must not bypass the per-IP limit.
code=$(curl --http1.1 --max-time 5 -sS -D "$out/spoof.headers" -o "$out/spoof.body" \
  -w '%{http_code}' -H 'X-Gateway-Client-IP: 203.0.113.99' \
  -H 'X-Forwarded-For: 203.0.113.99' "$base/api/v1/products/1")
test "$code" = 429
echo "Spoofed client headers: HTTP $code"
"${compose[@]}" restart api-gateway >/dev/null
wait_gateway
"${compose[@]}" up -d --wait --wait-timeout 60 gateway-entry >/dev/null
"${compose[@]}" ps > "$out/containers.txt"
date -Iseconds > "$out/timestamp.txt"
echo "PASS: all gateway checks. Evidence: $out"
