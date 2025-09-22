FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve globally to serve static files
RUN npm install -g serve

# Expose port (will be overridden by PORT env var)
EXPOSE 3000

# Start the server with dynamic port
CMD ["sh", "-c", "serve -s build -l ${PORT:-3000}"]
