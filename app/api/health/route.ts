import { NextResponse } from 'next/server';
import { getDerivConfig } from '@/lib/deriv/config';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { METHODOLOGY_VERSION } from '@/lib/config/strategy';

export const dynamic = 'force-dynamic';

/** Public health/status endpoint (spec §43, §66). Reports configuration booleans
 * only — never any secret value. Useful for uptime monitoring and deploy checks. */
export async function GET() {
  const deriv = getDerivConfig();
  return NextResponse.json({
    status: 'ok',
    service: 'voltax',
    methodologyVersion: METHODOLOGY_VERSION,
    time: new Date().toISOString(),
    engine: 'operational',
    config: {
      derivConfigured: deriv.configured,
      derivAccountToken: deriv.hasToken,
      supabase: isSupabaseConfigured(),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      ai: Boolean(process.env.AI_API_KEY),
    },
  });
}
