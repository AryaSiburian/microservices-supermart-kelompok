FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /billing-worker .

FROM alpine:3.23
RUN addgroup -S billing && adduser -S -G billing billing
COPY --from=build /billing-worker /usr/local/bin/billing-worker
USER billing
ENTRYPOINT ["/usr/local/bin/billing-worker"]
