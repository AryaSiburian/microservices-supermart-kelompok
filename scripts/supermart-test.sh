#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker build -t supermart-tugas2-tools:local -f deployment/supermart/Dockerfile.tools .
docker compose -f docker-compose.supermart-grpc.yml up -d --wait mysql
docker run --rm --network supermart-tugas2_default \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e GOCACHE=/tmp/go-cache \
  -e GOPATH=/tmp/go \
  -e SUPERMART_TEST_DSN='nusantara_user:nusantara_secret@tcp(mysql:3306)/nusantara_db?parseTime=true' \
  -v "$PWD:/workspace" -w /workspace/backend supermart-tugas2-tools:local \
  sh -c 'go test -count=1 -v ./... && go vet ./... && go build ./...'
