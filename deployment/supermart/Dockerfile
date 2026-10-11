FROM golang:1.26.4-alpine AS build
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /out/backend . \
 && CGO_ENABLED=0 go build -o /out/inventory-server ./cmd/inventory-server \
 && CGO_ENABLED=0 go build -o /out/stock-benchmark ./cmd/stock-benchmark
FROM alpine:3.23
RUN apk add --no-cache ca-certificates tzdata
COPY --from=build /out/ /usr/local/bin/
USER 1000:1000
CMD ["inventory-server"]
