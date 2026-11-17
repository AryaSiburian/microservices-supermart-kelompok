FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /pharmacy-service .

FROM alpine:3.23
RUN addgroup -S pharmacy && adduser -S -G pharmacy pharmacy
COPY --from=build /pharmacy-service /usr/local/bin/pharmacy-service
USER pharmacy
EXPOSE 8081 50051
ENTRYPOINT ["/usr/local/bin/pharmacy-service"]
