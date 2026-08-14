'use server';

import { revalidatePath } from 'next/cache';
import { saveUserRiskSettings, type SaveResult } from '@/lib/supabase/repositories/settings';
import type { RiskSettings } from '@/lib/config/risk-settings';

/** Persist edited execution-risk settings. Values are re-clamped server-side. */
export async function saveRiskSettingsAction(input: Partial<RiskSettings>): Promise<SaveResult> {
  const res = await saveUserRiskSettings(input);
  if (res.ok) revalidatePath('/settings');
  return res;
}
