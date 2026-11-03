# Build stage
FROM node:26.11.1-alpine3.24@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS builder
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
FROM dhi.io/node:26.10.0-debian13@sha256: AS runner
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