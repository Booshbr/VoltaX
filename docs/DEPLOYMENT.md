# Deployment

VoltaX is a standard Next.js 14 app and deploys to any Node-capable host
(Vercel, Fly.io, Render, a container, etc.). Deployment must not depend on a
developer's local machine (spec §65).

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

## Vercel (example)
1. Import the repo; framework auto-detected (Next.js).
2. Add environment variables for the chosen environment.
3. Deploy. Static pages prerender; server components run on the server runtime.

## Runtime notes
- The Deriv WebSocket client needs the Node runtime (global `WebSocket`, Node 22+),
  not the Edge runtime. Keep Deriv-touching route handlers on the Node runtime.
- Long-lived WS subscriptions and background scanning belong in a worker/service,
  not in per-request handlers (spec §58, §59).

## Pre-production checklist
- `npm run test`, `npm run lint`, `npm run build` all green.
- Migrations applied; RLS verified.
- Auth middleware gating `app/(app)`.
- `npm audit` reviewed; secrets set; security headers confirmed.
- Live trading disabled unless explicitly enabled and tested on a demo account.
