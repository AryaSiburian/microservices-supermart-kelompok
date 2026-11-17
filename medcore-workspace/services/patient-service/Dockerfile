FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /patient-service .

FROM alpine:3.23
RUN addgroup -S patient && adduser -S -G patient patient
COPY --from=build /patient-service /usr/local/bin/patient-service
USER patient
ENTRYPOINT ["/usr/local/bin/patient-service"]
