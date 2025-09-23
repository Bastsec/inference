# Stage 1: Build (Bun)
FROM oven/bun:1.2 AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install deps with cache + lockfile for reproducible, faster builds
COPY bun.lock package.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production

# Build the app (Next outputs standalone server)
RUN mkdir -p public
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
  bun run build

# Stage 2: Runtime (lean, copies only standalone artifacts)
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DEBUG="next:*"

# Copy minimal runtime outputs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Run Next standalone server with Bun
CMD ["bun", "server.js"]
