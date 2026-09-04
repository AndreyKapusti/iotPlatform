FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /ingest ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=builder /ingest /ingest

EXPOSE 8001

ENTRYPOINT ["/ingest"]
