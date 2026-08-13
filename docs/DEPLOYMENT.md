# Deployment

VoltaX is a standard Next.js 16 (React 19) app and deploys to any Node-capable
host (Vercel, Fly.io, Render, a container, etc.). Deployment must not depend on a
developer's local machine (spec §65).

## Prerequisites
- Node.js 22+ (the Deriv WebSocket client uses the global `WebSocket`).
- The repo committed to Git (GitHub/GitLab) for platform imports.

## Environments
Keep configuration per environment (spec §65):
- **development** — `.env.local`, demo mode or a Deriv demo app id.
- **staging** — separate Supabase project + Deriv app id; production-like.
- **production** — locked-down secrets; live trading only if explicitly required.

## Build
```bash
npm ci
npm run build
npm run start      # or the platform's start command
```

## Environment variables
Set every variable from `.env.example` in the platform's secret store. Only the
`NEXT_PUBLIC_*` values are exposed to the browser; keep `DERIV_API_TOKEN`,
`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` and `AI_API_KEY` server-side.

## Database
Apply migrations against the target Supabase project before first run
(`supabase db push` or the SQL editor). See DATABASE.md.

## Vercel (recommended for Next.js)
1. Push the repo to GitHub.
2. In Vercel, **New Project → Import** the repo (framework auto-detected as Next.js).
3. Add environment variables from `.env.example` (see below). At minimum set the
   Supabase keys if you want auth/persistence; VoltaX runs in demo mode without them.
4. Deploy. Data pages are server-rendered on demand (`ƒ`); a few static pages
   prerender (`○`). The `proxy.ts` (formerly middleware) runs the auth gate.

## Health check
`GET /api/health` is public (exempt from the auth gate) and returns a JSON status
with configuration booleans (no secrets) — point uptime monitoring at it.

## Runtime notes
- **Runtime:** the Deriv WebSocket client and Supabase service-role writes need the
  Node runtime (global `WebSocket`), not the Edge runtime. Keep them off Edge.
- **In-memory state:** the live cache (~60s TTL), the live-trading enable/emergency
  switches, and notification de-dup are process-memory. On a single long-lived Node
  server they persist; on autoscaled/serverless hosts they are per-instance and reset
  on cold start. For a multi-instance production deployment, move these to Supabase
  (or Redis) — the interfaces are already isolated for that.
- Long-lived WS subscriptions and background scanning belong in a worker/service,
  not per-request handlers (spec §58, §59).
- `VOLTAX_DEV_ORIGINS` is dev-only and irrelevant in production.

## Pre-production checklist
- `npm run test`, `npm run lint`, `npm run build` all green.
- Migrations applied; RLS verified; a user created in Supabase Auth.
- `proxy.ts` auth gate confirmed (protected routes redirect to `/login`).
- `/api/health` reachable; secrets set server-side; security headers confirmed.
- `npm audit` reviewed.
- Live trading disabled unless explicitly enabled and tested on a Deriv demo account.
