FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /appointment-service .

FROM alpine:3.23
RUN addgroup -S appointment && adduser -S -G appointment appointment
COPY --from=build /appointment-service /usr/local/bin/appointment-service
USER appointment
ENTRYPOINT ["/usr/local/bin/appointment-service"]
