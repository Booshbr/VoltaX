# Security

Mandatory controls (spec §41, §42, §76).

## Secrets
- **Deriv token** and **Supabase service-role key** are server-side only. Nothing
  secret is `NEXT_PUBLIC_`. `lib/deriv/config.ts` and `lib/supabase/env.ts` guard
  against browser access.
- Secrets live in `.env.local` / platform secrets — never committed. `.gitignore`
  excludes `.env*`. `.env.example` documents variables with empty values.
- **Never log full tokens.** `redactToken()` masks them; errors are sanitized.

## Authorization
- Supabase **Row Level Security** on every user table; child rows gated via owned
  parents. Reference-table writes reserved to the service role.
- Server-side auth via `getCurrentUser()`. Client-side authorization is never
  trusted.

## Transport & headers
- Security headers in `next.config.mjs`: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  a restrictive `Permissions-Policy`, and `poweredByHeader: false`.

## Input validation
- External/config input validated with **Zod** (`lib/deriv/config.ts`). Candles are
  validated and de-duplicated before analysis.

## Trading safety (spec §18, §42)
- Live trading is opt-in and multi-gated: enablement, risk limits, account/instrument
  validity, fresh data, signal validity, exposure limits. Any critical failure ⇒
  no trade. A global emergency stop halts new execution. No martingale / auto-doubling.

## Fail safe (spec §39, §76)
Stale feed ⇒ no new signals. Provider failures degrade independently and never
break signal generation. On uncertainty, choose the safest path.

## Notifications
Telegram credentials are read server-side; a failed send is logged (never thrown)
so it can't disrupt signal generation.

## To harden before production
Add auth middleware to gate `app/(app)`, rate-limit any public route handlers,
run `npm audit` and update flagged transitive deps, and review CSP for any added
external assets.
