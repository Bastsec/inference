# Repository Guidelines

## Project Structure & Module Organization
- `app/` – Next.js App Router routes, layouts, and grouped segments like `(dashboard)` and `(login)`.
- `components/` – Shared React components; UI primitives live in `components/ui/`.
- `lib/` – Domain logic: `db/` (Drizzle ORM, migrations, scripts), `auth/`, `supabase/`, `litellm/`.
- `supabase/functions/` – Edge functions (e.g., `payment-webhook/`, `proxy-service/`).
- Config: `drizzle.config.ts`, `next.config.ts`, `middleware.ts`, `.env.example` → copy to `.env`.

## Build, Test, and Development Commands
- Install deps: `bun install`
- Dev server: `bun run dev` (Next + Turbopack)
- Build/serve: `bun run build` then `bun run start`
- DB tooling (Drizzle): `bun run db:generate` (SQL), `bun run db:migrate` (apply), `bun run db:run` (programmatic), `bun run db:studio` (inspect), `bun run db:seed`/`db:setup` (local data)
- Tests (Jest): `bunx jest` or `bunx jest lib/litellm/__tests__` (add `--coverage` if needed)

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode). Use `tsx` for React components.
- Indentation: 2 spaces; keep lines focused and readable.
- Naming: React components PascalCase (e.g., `components/KeyManagement.tsx`); folders lower-kebab. Library modules in `lib/` use concise, descriptive names.
- Imports: prefer root alias `@/*` (see `tsconfig.json`).
- Styles: Tailwind CSS v4; global styles in `app/globals.css`. Keep utility classes close to markup.

## Testing Guidelines
- Framework: Jest. Place unit tests under `__tests__/` with `*.test.ts` (example: `lib/litellm/__tests__/client.test.ts`).
- Mock external effects (e.g., `global.fetch`) and avoid network calls.
- Aim for meaningful coverage on core logic (`lib/*`), especially auth, billing, and LiteLLM client.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `feat(ui):` etc. Example: `fix: handle missing GitHub emails`.
- PRs: include a clear summary, linked issues, screenshots for UI, and notes for DB migrations (apply/rollback plan).
- CI sanity: ensure `bun run build` and `bunx jest` succeed locally before requesting review.

## Security & Configuration Tips
- Never commit secrets. Start from `.env.example` and keep `.env` local. Required keys commonly include LiteLLM and Supabase values.
- Run migrations only against your dev DB; review SQL under `lib/db/migrations/`.

## Agent-Specific Notes
- Keep changes minimal and scoped. If editing `lib/db/migrations/` or `supabase/functions/`, update this file or README with operational notes.
