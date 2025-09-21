FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:18-alpine

# Install serve for static file serving
RUN npm install -g serve

# Copy built app
COPY --from=builder /app/build /app/build

# Expose port
EXPOSE 3000

# Start static file server
CMD ["serve", "-s", "build", "-l", "3000"]
