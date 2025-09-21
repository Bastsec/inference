# Inference Platform SaaS

A credits-based AI gateway and dashboard built with Next.js 15, Supabase Auth, Paystack payments (USD/KES), Drizzle ORM, and LiteLLM integration. Users sign in, create virtual API keys, and spend prepaid credits on AI inference routed through a LiteLLM proxy. Credits and budgets are tracked, and payments automatically credit user balances via a Supabase Edge Function.

Status: Active development. The original Stripe-oriented template has been replaced with a Paystack + Supabase + LiteLLM stack.

Features
- Marketing landing page (/) with animated terminal
- Auth: Sign in/sign up (Supabase SSR), protected dashboard routes via middleware
- Dashboard: analytics, general, security sections
- Pricing and checkout flow integrated with Paystack
  - Support for USD and KES (with a configurable USD→KES rate)
  - Optional M-Pesa exploration route present
- Credits system tied to virtual API keys
  - Purchases credit user balances (cents)
  - Updates LiteLLM budgets to mirror plan value
- Usage analytics (tokens, costs, latency) and spend tracking
- Admin/monitoring endpoints for operational visibility
- TypeScript + Tailwind CSS v4 UI primitives and components

Tech Stack
- Framework: Next.js 15 (App Router)
- Language/Tooling: TypeScript, Bun
- Styling: Tailwind CSS v4, PostCSS
- Database: Postgres
- ORM/Migrations: Drizzle
- Auth & Edge Functions: Supabase
- Payments: Paystack (USD/KES), M-Pesa route (experimental)
- AI Proxy: LiteLLM
- Testing: Jest

Architecture Overview
- Auth: Supabase SSR session in middleware.ts protects /dashboard and /analytics. Application-user identity is the profiles table (UUID).
- Payments:
  - app/(dashboard)/pricing is the purchase entry point.
  - app/api/checkout/start creates a Paystack transaction (sends user_id/email/return_url metadata).
  - Supabase Edge Function supabase/functions/payment-function handles:
    - GET callbacks (reference/trxref verify)
    - POST webhooks (charge.success + signature verification)
    - Credits = 2x USD-equivalent of purchase; budgets aligned to plan value
    - Idempotency guard using transactions table by paystack_ref
    - LiteLLM budget update (best-effort)
    - Redirects back to the app with status
- Data model (lib/db/schema.ts):
  - profiles (UUID, LiteLLM customer config)
  - virtual_keys (per-user API keys, credit_balance in cents, LiteLLM linkage)
  - transactions (ledger of payments/credit additions)
  - usage_logs (per-request metrics, costs in cents)
  - system_alerts, monitoring_logs (ops)
  - plus classic SaaS tables (users/teams/etc.) retained

Prerequisites
- Bun (https://bun.sh)
- Postgres database
- Supabase project (for auth + Edge Functions)
- Paystack account and secret key
- Optional: LiteLLM proxy URL and master key
- Optional: Supabase CLI (for deploying Edge Functions)

Setup
1) Install dependencies
   bun install

2) Configure environment
   - Copy .env.example to .env
   - Fill required values:
     - POSTGRES_URL
     - BASE_URL (e.g., http://localhost:3000)
     - AUTH_SECRET (generate with: openssl rand -base64 32)
     - Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
     - Paystack: PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY (optional client-side usage)
     - PAYSTACK_CURRENCY (USD|KES), USD_TO_KES_RATE (e.g., 129)
     - PAYSTACK_FUNCTION_NAME=payment-function
     - POST_PAYMENT_REDIRECT_PATH=/dashboard (or your billing page)
     - LiteLLM: LITELLM_BASE_URL, LITELLM_MASTER_KEY
   - See .env.example for all keys and documentation.

3) Database
   - Generate SQL (optional): bun run db:generate
   - Apply migrations: bun run db:migrate
   - Inspect DB: bun run db:studio
   - Programmatic migration runner: bun run db:run

Running Locally
- Dev server (Next + Turbopack): bun run dev
- Build: bun run build
- Start (production): bun run start
- Open http://localhost:3000

Payments (Paystack) — Local and Production
- Checkout flow creates a Paystack transaction with metadata:
  - user_id (UUID of profiles.id), email, and return_url
  - plan_usd (optional hint to guide pricing/credits math)
- After user pays:
  - Paystack redirects to the Supabase Edge Function (GET) with reference/trxref
  - Or sends a webhook (POST) with a signature header (sha512) that is validated
- The function verifies payment, credits the user, writes a transactions row, updates LiteLLM budgets, and redirects back to BASE_URL + POST_PAYMENT_REDIRECT_PATH with status.
- Ensure PAYSTACK_FUNCTION_NAME=payment-function in your .env and the Supabase Edge Function is deployed.

Supabase Edge Function: payment-function
- Code: supabase/functions/payment-function/index.ts
- Deploy with Supabase CLI (example):
  - supabase functions deploy payment-function --project-ref <your-project-ref>
  - supabase secrets set --env-file .env --project-ref <your-project-ref>
- In your Paystack dashboard:
  - Configure the callback/webhook to point to the deployed function URL
  - Make sure your server role key and Paystack secret are set as Supabase function secrets

LiteLLM Integration
- LITELLM_BASE_URL and LITELLM_MASTER_KEY must be configured
- The payment-function updates LiteLLM key budgets to reflect purchased plan value
- Virtual keys map to LiteLLM proxy keys via litellm_key_id
- Usage and spend are tracked in local tables in cents

Testing
- Run tests: bunx jest
- Add tests for payments math (KES vs USD), idempotency, and LiteLLM update semantics

Deployment
- Vercel (app):
  - Connect repository, set environment variables (mirroring .env)
  - Ensure BASE_URL matches your domain
- Supabase:
  - Configure Auth and redirect URLs
  - Deploy Edge Function payment-function and set its secrets
  - Point Paystack webhook/callbacks to the function URL
- Database:
  - Run migrations against your production Postgres

Security Notes
- Do not expose SUPABASE_SERVICE_ROLE_KEY in the browser or client-side code
- Webhook verification: payment-function validates Paystack signature (sha512)
- Consider rate-limiting keys and admin endpoints
- Consider a unique index on transactions.paystack_ref to enforce idempotency at the DB layer
- Audit/monitor budget and credit adjustments via system_alerts/monitoring_logs

Command Reference (package.json scripts)
- dev: next dev --turbopack
- build: next build
- start: next start
- db:generate: drizzle-kit generate
- db:migrate: drizzle-kit migrate
- db:studio: drizzle-kit studio
- db:run: NODE_OPTIONS=--dns-result-order=ipv4first bunx tsx lib/db/migrate.ts

Notes
- The repository previously referenced Stripe and pnpm. It now uses Paystack and Bun. All README instructions have been updated accordingly.
- An app/api/checkout/mpesa route exists as an experimental path; not production-ready in this template.
