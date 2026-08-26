# ---- Build stage ----
FROM node:24-slim AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM node:24-slim
WORKDIR /app

ENV MODE=production
ENV HOST=0.0.0.0

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json tsconfig.server.json ./
COPY --chown=node:node src/server ./src/server
COPY --chown=node:node src/shared ./src/shared

RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/version', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["sh", "-c", "npm_package_version=$(node -p \"require('./package.json').version\") node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.server.json src/server"]
