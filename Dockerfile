# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* bun.lockb* ./
# Use npm for a pure Node environment
RUN npm install

# Stage 2: Build the application
FROM node:22-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pass build-time args from Docker Compose
ARG POSTGRES_URL
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
# ... (add all your other ARGs here)

# Set them as environment variables for the build process
ENV POSTGRES_URL=$POSTGRES_URL
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
# ... (add all your other ENVs here)

RUN npm run build

# Stage 3: Production runner
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone production build
# .next/standalone contains server.js and minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Include server artifacts required by the App Router (client/server reference manifests)
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./.next/server
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]
