# Stage 1: Build (Bun)
FROM oven/bun:1.2 AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install deps (avoid legacy bun.lock parsing issues)
COPY package.json ./
RUN bun install

# Build the app (Next outputs standalone server)
COPY . .
RUN bun run build

# Stage 2: Runtime (lean, copies only standalone artifacts)
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy minimal runtime outputs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Run Next standalone server with Bun
CMD ["bun", "server.js"]
