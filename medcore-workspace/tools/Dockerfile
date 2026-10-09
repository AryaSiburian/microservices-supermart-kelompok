FROM golang:1.25-alpine
RUN apk add --no-cache protobuf nodejs npm bash \
    && go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.33.0 \
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.3.0 \
    && npm install --global ts-proto@1.170.0
WORKDIR /workspace
RUN mkdir -p /tmp/go-mod && chmod 1777 /tmp/go-mod
