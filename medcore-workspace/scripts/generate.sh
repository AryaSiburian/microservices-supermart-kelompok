#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p services/{pharmacy,appointment}-service/pb services/patient-service/src/generated
protoc -I proto --go_out=services/pharmacy-service/pb --go_opt=paths=source_relative \
  --go-grpc_out=services/pharmacy-service/pb --go-grpc_opt=paths=source_relative proto/pharmacy.proto
cp services/pharmacy-service/pb/*.go services/appointment-service/pb/
protoc -I proto --plugin=protoc-gen-ts_proto=/usr/local/bin/protoc-gen-ts_proto \
  --ts_proto_out=services/patient-service/src/generated \
  --ts_proto_opt=outputServices=grpc-js,esModuleInterop=true proto/pharmacy.proto proto/clinical.proto
for service in pharmacy appointment; do
  (cd "services/$service-service" && go mod tidy && gofmt -w main.go && go build -o /tmp/"$service" .)
done
(cd tests/benchmark && go mod tidy && gofmt -w inspect_payload.go && go build -o /tmp/inspect-payload .)
(cd services/patient-service && npm ci --ignore-scripts && npm run typecheck)
mkdir -p docs/evidence
{
  go version
  protoc --version
  protoc-gen-go --version
  protoc-gen-go-grpc --version
  node --version
  npm list --global ts-proto --depth=0
  printf 'Go build: Pharmacy, Appointment, inspect_payload PASS\nTypeScript tsc --noEmit: PASS\n'
} > docs/evidence/build.txt
