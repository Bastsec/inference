# Multi-stage build for Next.js (Bun runtime)
# Uses Bun for install/build, runs Next.js with Bun in production

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --ci

FROM oven/bun:1 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Provide minimal env to satisfy build-time module evaluation
ENV POSTGRES_URL=postgresql://user:pass@localhost:5432/dummy
ENV SUPABASE_URL=https://xpvkmsuvaambcsanbydk.supabase.co
ENV SUPABASE_ANON_KEY=dummy
ENV SUPABASE_SERVICE_ROLE_KEY=dummy
ENV PAYSTACK_SECRET_KEY=dummy
ENV BASE_URL=http://localhost:3000
ENV LITELLM_BASE_URL=http://localhost:4000
ENV LITELLM_MASTER_KEY=dummy
ENV PAYSTACK_FUNCTION_NAME=payment-function
ENV POST_PAYMENT_REDIRECT_PATH=/dashboard/billing
ENV PAYSTACK_CURRENCY=USD
ENV USD_TO_KES_RATE=129
RUN bun run typecheck && bun run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# No public dir in this project; static assets are served from app/

EXPOSE 3000

CMD ["node", "server.js"]
