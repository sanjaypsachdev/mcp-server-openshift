# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install OpenShift CLI
RUN apk add --no-cache curl tar gzip && \
    curl -LO https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux.tar.gz && \
    tar -xzf openshift-client-linux.tar.gz && \
    mv oc /usr/local/bin/ && \
    rm -f openshift-client-linux.tar.gz kubectl && \
    apk del curl tar gzip

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
RUN chown nodejs:nodejs /app
USER nodejs

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/manifest.json ./

# Expose port for HTTP transport
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Default to HTTP transport for container deployment
ENV MCP_TRANSPORT=sse
ENV MCP_PORT=3000
ENV MCP_HOST=0.0.0.0

# Start the server
CMD ["node", "dist/index.js", "--http", "--port=3000"]

# Labels for better maintainability
LABEL maintainer="sanjaypsachdev@gmail.com"
LABEL description="OpenShift MCP Server - AI-powered container orchestration"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/sanjaypsachdev/mcp-server-openshift"
LABEL org.opencontainers.image.description="Model Context Protocol server for OpenShift/Kubernetes management"
LABEL org.opencontainers.image.licenses="MIT"
