# Build stage
FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder
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
FROM dhi.io/node:24.21.0-debian13@sha256:386d930ada89a074fa5846839c65067796d777977a74cb92b070000811da9094 AS runner
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