# Multi-stage build for both frontend and backend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY frontend/ .

# Build frontend
RUN npm run build

# Backend builder stage
FROM golang:1.21-alpine AS backend-builder

# Install build tools
RUN apk add --no-cache protobuf-dev
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2.0
ENV PATH="/root/go/bin:${PATH}"

WORKDIR /app/backend

# Copy backend go mod files
COPY backend/go.mod backend/go.sum ./

# Download backend dependencies
RUN go mod download

# Copy backend source code
COPY backend/ .

# Generate protobuf files (if they exist)
RUN if [ -d "proto" ]; then \
        protoc --go_out=. --go_opt=paths=source_relative \
        --go-grpc_out=. --go-grpc_opt=paths=source_relative \
        proto/expense.proto; \
    fi

# Build backend
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o rest_server rest_server.go

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates sqlite nginx

# Create directories
RUN mkdir -p /data /var/log/nginx /var/lib/nginx/tmp /run/nginx

# Copy backend binary
COPY --from=backend-builder /app/backend/rest_server /usr/local/bin/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'nginx &' >> /start.sh && \
    echo 'rest_server &' >> /start.sh && \
    echo 'wait' >> /start.sh && \
    chmod +x /start.sh

# Expose ports
EXPOSE 3000 8080

# Start both services
CMD ["/start.sh"]
