# Server image. Build from the repository root:
#   docker build -f apps/server/Dockerfile .
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Install only the server's runtime dependencies (not the mobile app's).
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
COPY packages/crypto/package.json packages/crypto/
RUN npm ci --workspace @realme/server --omit=dev --no-audit --no-fund

COPY apps/server apps/server

WORKDIR /app/apps/server
USER node
EXPOSE 8787
CMD ["npm", "start"]
