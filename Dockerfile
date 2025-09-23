# Stage 1: Install dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* bun.lockb* ./
# Install deps: prefer npm ci if a lockfile exists, otherwise npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Stage 2: Build the application
FROM node:20-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pass build-time args from Docker Compose (.env.example reference)
ARG POSTGRES_URL
ARG BASE_URL
ARG AUTH_SECRET

# Paystack
ARG PAYSTACK_SECRET_KEY
ARG PAYSTACK_PUBLIC_KEY
ARG PAYSTACK_CURRENCY
ARG USD_TO_KES_RATE
ARG PAYSTACK_FUNCTION_NAME
ARG POST_PAYMENT_REDIRECT_PATH

# Supabase
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY

# OAuth providers
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET


# LiteLLM
ARG LITELLM_BASE_URL
ARG LITELLM_MASTER_KEY

# Set them as environment variables for the build process
ENV POSTGRES_URL=$POSTGRES_URL \
    BASE_URL=$BASE_URL \
    AUTH_SECRET=$AUTH_SECRET \
    PAYSTACK_SECRET_KEY=$PAYSTACK_SECRET_KEY \
    PAYSTACK_PUBLIC_KEY=$PAYSTACK_PUBLIC_KEY \
    PAYSTACK_CURRENCY=$PAYSTACK_CURRENCY \
    USD_TO_KES_RATE=$USD_TO_KES_RATE \
    PAYSTACK_FUNCTION_NAME=$PAYSTACK_FUNCTION_NAME \
    POST_PAYMENT_REDIRECT_PATH=$POST_PAYMENT_REDIRECT_PATH \
    SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
    LITELLM_BASE_URL=$LITELLM_BASE_URL \
    LITELLM_MASTER_KEY=$LITELLM_MASTER_KEY

RUN npm run build

# Stage 3: Production runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone production build
# .next/standalone contains server.js and minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]
