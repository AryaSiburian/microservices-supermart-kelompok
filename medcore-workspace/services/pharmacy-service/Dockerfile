FROM golang:1.25-alpine AS build
WORKDIR /src
COPY services/pharmacy-service/go.* ./
RUN go mod download
COPY services/pharmacy-service/ ./
RUN CGO_ENABLED=0 go build -trimpath -o /pharmacy .
FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /pharmacy /usr/local/bin/pharmacy
USER 65532:65532
ENTRYPOINT ["pharmacy"]
