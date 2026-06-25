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

# Expose port for optional HTTP transport (pass --http --port=3000 to CMD)
EXPOSE 3000

# Default to stdio transport for MCP clients; use --http --port=3000 for HTTP/SSE mode
CMD ["node", "dist/index.js"]

# Labels for better maintainability
LABEL maintainer="sanjaypsachdev@gmail.com"
LABEL description="OpenShift MCP Server - AI-powered container orchestration"
LABEL org.opencontainers.image.source="https://github.com/sanjaypsachdev/mcp-server-openshift"
LABEL org.opencontainers.image.description="Model Context Protocol server for OpenShift/Kubernetes management"
LABEL org.opencontainers.image.licenses="MIT"
LABEL io.modelcontextprotocol.server.name="io.github.sanjaypsachdev/mcp-server-openshift"
