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
# Build-time args with safe defaults; used only to allow module evaluation during build
ARG POSTGRES_URL=postgresql://user:pass@localhost:5432/dummy
ARG SUPABASE_URL=https://example.supabase.co
ARG SUPABASE_ANON_KEY=dummy
ARG SUPABASE_SERVICE_ROLE_KEY=dummy
ARG PAYSTACK_SECRET_KEY=dummy
ARG BASE_URL=http://localhost:3000
ARG LITELLM_BASE_URL=http://localhost:4000
ARG LITELLM_MASTER_KEY=dummy
ARG PAYSTACK_FUNCTION_NAME=payment-function
ARG POST_PAYMENT_REDIRECT_PATH=/dashboard/billing
ARG PAYSTACK_CURRENCY=USD
ARG USD_TO_KES_RATE=129

# Export as ENV so Next build and any SSR evals see them
ENV POSTGRES_URL=$POSTGRES_URL \
    SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    PAYSTACK_SECRET_KEY=$PAYSTACK_SECRET_KEY \
    BASE_URL=$BASE_URL \
    LITELLM_BASE_URL=$LITELLM_BASE_URL \
    LITELLM_MASTER_KEY=$LITELLM_MASTER_KEY \
    PAYSTACK_FUNCTION_NAME=$PAYSTACK_FUNCTION_NAME \
    POST_PAYMENT_REDIRECT_PATH=$POST_PAYMENT_REDIRECT_PATH \
    PAYSTACK_CURRENCY=$PAYSTACK_CURRENCY \
    USD_TO_KES_RATE=$USD_TO_KES_RATE
RUN bun run typecheck && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy production artifacts for next start
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
# No public dir in this project

EXPOSE 3000

CMD ["bun", "x", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
