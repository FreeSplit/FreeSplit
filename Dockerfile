# Multi-stage build for both frontend and backend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies (including dev dependencies for build)
RUN npm ci

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

# Set environment variable for production (empty string = relative URLs)
ENV REACT_APP_API_URL=""

# Create nginx config with API proxy
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 3000;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Proxy API requests to backend' >> /etc/nginx/conf.d/default.conf && \
    echo '    location /api/ {' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_pass http://localhost:8080;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Handle client-side routing' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'rest_server &' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

# Expose only port 3000 (frontend with API proxy)
EXPOSE 3000

# Start both services
CMD ["/start.sh"]
