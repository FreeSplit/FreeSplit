FROM golang:1.21-alpine AS builder

# Install protobuf compiler and grpc plugins
RUN apk add --no-cache protobuf-dev protoc-gen-go protoc-gen-go-grpc

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Generate protobuf files
RUN protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/expense.proto

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates sqlite

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Create directory for database
RUN mkdir -p /data

# Expose ports
EXPOSE 8080 8081

# Run the binary
CMD ["./main"]

