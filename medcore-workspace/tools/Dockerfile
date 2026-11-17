FROM golang:1.25-alpine AS base
RUN mkdir -p /tmp/go-mod && chmod 1777 /tmp/go-mod

FROM golang:1.25-alpine
WORKDIR /workspace
RUN addgroup -g 1000 -S medcore && adduser -u 1000 -S -G medcore medcore
COPY --from=base /tmp/go-mod /tmp/go-mod
RUN chmod 1777 /tmp/go-mod
USER medcore
