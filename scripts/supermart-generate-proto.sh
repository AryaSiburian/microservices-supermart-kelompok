#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backend/gen
protoc -I proto --go_out=backend/gen --go_opt=paths=source_relative \
  --go-grpc_out=backend/gen --go-grpc_opt=paths=source_relative \
  inventory/v1/inventory.proto
