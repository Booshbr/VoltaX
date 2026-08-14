'use client';

import { useState, useTransition } from 'react';
import { saveRiskSettingsAction } from '@/app/(app)/settings/actions';
import type { RiskSettings } from '@/lib/config/risk-settings';

/** Editable execution-risk settings (spec §10, §20). Percentages are entered as
 * human percents and stored as fractions. Values are re-clamped on the server. */
export function RiskSettingsForm({ initial }: { initial: RiskSettings }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Local field state, percentages shown as percents.
  const [perTradeRisk, setPerTradeRisk] = useState((initial.perTradeRisk * 100).toString());
  const [maxDailyRisk, setMaxDailyRisk] = useState((initial.maxDailyRisk * 100).toString());
  const [maxOpenRisk, setMaxOpenRisk] = useState((initial.maxOpenRisk * 100).toString());
  const [maxOpenTrades, setMaxOpenTrades] = useState(initial.maxOpenTrades.toString());
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(initial.maxConsecutiveLosses.toString());
  const [multiplier, setMultiplier] = useState(initial.multiplier.toString());
  const [fixedStake, setFixedStake] = useState(initial.fixedStake != null ? initial.fixedStake.toString() : '');

  function save() {
    setStatus(null);
    const stakeNum = parseFloat(fixedStake);
    startTransition(async () => {
      const res = await saveRiskSettingsAction({
        perTradeRisk: parseFloat(perTradeRisk) / 100,
        maxDailyRisk: parseFloat(maxDailyRisk) / 100,
        maxOpenRisk: parseFloat(maxOpenRisk) / 100,
        maxOpenTrades: parseInt(maxOpenTrades, 10),
        maxConsecutiveLosses: parseInt(maxConsecutiveLosses, 10),
        multiplier: parseInt(multiplier, 10),
        fixedStake: fixedStake.trim() === '' || !Number.isFinite(stakeNum) ? null : stakeNum,
      });
      if (res.ok && res.settings) {
        // Reflect the server-clamped values back into the form.
        const s = res.settings;
        setPerTradeRisk((s.perTradeRisk * 100).toString());
        setMaxDailyRisk((s.maxDailyRisk * 100).toString());
        setMaxOpenRisk((s.maxOpenRisk * 100).toString());
        setMaxOpenTrades(s.maxOpenTrades.toString());
        setMaxConsecutiveLosses(s.maxConsecutiveLosses.toString());
        setMultiplier(s.multiplier.toString());
        setFixedStake(s.fixedStake != null ? s.fixedStake.toString() : '');
        setStatus({ ok: true, msg: 'Saved. New trades use these limits (values clamped to safe ranges).' });
      } else {
        setStatus({ ok: false, msg: res.error ?? 'Could not save.' });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Per-trade risk" suffix="%" value={perTradeRisk} onChange={setPerTradeRisk} step="0.1" hint="Loss per trade (0.1–10%)" />
        <Field label="Fixed stake" suffix="$" value={fixedStake} onChange={setFixedStake} step="0.5" hint="Blank = auto from risk %" placeholder="auto" />
        <Field label="Max daily loss" suffix="%" value={maxDailyRisk} onChange={setMaxDailyRisk} step="0.5" hint="Auto-disables live (0.5–50%)" />
        <Field label="Max open risk" suffix="%" value={maxOpenRisk} onChange={setMaxOpenRisk} step="0.5" hint="Across open positions" />
        <Field label="Max open trades" value={maxOpenTrades} onChange={setMaxOpenTrades} step="1" hint="1–20" />
        <Field label="Max consecutive losses" value={maxConsecutiveLosses} onChange={setMaxConsecutiveLosses} step="1" hint="Halts new trades" />
        <Field label="Multiplier" value={multiplier} onChange={setMultiplier} step="1" hint="Deriv contract multiplier" />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-surface hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save risk settings'}
        </button>
        {status ? <span className={`text-xs font-semibold ${status.ok ? 'text-bull' : 'text-bear'}`}>{status.msg}</span> : null}
      </div>

      <p className="text-xs leading-5 text-muted">
        These tune live execution only — never the signal engine. Martingale and increasing risk after a loss stay
        disabled by design. Trading synthetic indices carries risk of loss; this is not financial advice.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  step,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <span className="mt-1 flex items-center rounded-md border border-border bg-surface px-2 focus-within:border-accent">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="tnum w-full bg-transparent py-1.5 text-fg outline-none"
        />
        {suffix ? <span className="pl-1 text-xs text-muted">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-0.5 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}
