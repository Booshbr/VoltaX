import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Next.js 16 proxy (formerly "middleware"): refreshes Supabase sessions and
 * gates protected routes. No-ops entirely when Supabase is not configured
 * (demo mode). */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
