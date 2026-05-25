# Build stage
FROM node:24.16.0-alpine3.23@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 AS builder
WORKDIR /app

# Install dependencies
COPY package*.json .npmrc ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# Runner stage
FROM dhi.io/node:24.16.0-debian13@sha256:d5a2443fb1fd5ebd3909fdfcba3d2834c08f9b365b43ff25a46ef3d653e54919 AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Copy necessary files from builder
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

# Expose port
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]