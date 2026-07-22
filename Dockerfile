FROM node:24-bookworm-slim AS dev-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dev-deps AS builder
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000

RUN groupadd --gid 10001 appgroup \
  && useradd --uid 10001 --gid appgroup --no-create-home --shell /usr/sbin/nologin appuser \
  && mkdir -p /app/data /app/backups \
  && chown appuser:appgroup /app/data /app/backups

COPY --chown=appuser:appgroup --from=prod-deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=builder /app/.next ./.next
COPY --chown=appuser:appgroup --from=builder /app/public ./public
COPY --chown=appuser:appgroup package.json next.config.mjs ./
COPY --chown=appuser:appgroup scripts ./scripts

USER appuser
EXPOSE 3000
CMD ["npm", "run", "start"]
