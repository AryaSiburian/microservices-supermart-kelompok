FROM golang:1.25-alpine AS build
WORKDIR /src
COPY services/appointment-service/go.* ./
RUN go mod download
COPY services/appointment-service/ ./
RUN CGO_ENABLED=0 go build -trimpath -o /appointment-client .
FROM alpine:3.22
COPY --from=build /appointment-client /usr/local/bin/appointment-client
USER 65532:65532
ENTRYPOINT ["appointment-client"]
