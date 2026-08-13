'use client';

import { useState, useTransition } from 'react';
import type { SignalExplanation } from '@/lib/ai/types';
import { generateAiExplanation } from '@/app/(app)/signals/[symbol]/actions';
import { Card, CardTitle, Badge } from './ui';

/**
 * Signal explanation panel (spec §33, §54). Shows the deterministic explanation
 * immediately; when AI is configured, a button upgrades it to an AI-written
 * version on demand. Progressive disclosure via expandable sections.
 */
export function AiExplanation({
  initial,
  symbol,
  aiEnabled,
}: {
  initial: SignalExplanation;
  symbol: string;
  aiEnabled: boolean;
}) {
  const [explanation, setExplanation] = useState<SignalExplanation>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateAiExplanation(symbol);
        if (result) {
          setExplanation(result.explanation);
          if (result.warning) setError(result.warning);
        } else setError('Could not generate an explanation.');
      } catch {
        setError('AI explanation is temporarily unavailable — showing the standard explanation.');
      }
    });
  }

  const sections: [string, string][] = [
    ['Market structure', explanation.structure],
    ['Setup', explanation.setup],
    ['Entry confirmation', explanation.entry],
    ['Risk', explanation.risk],
    ['Historical reliability', explanation.reliability],
    ['Invalidation', explanation.invalidation],
  ];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Why VoltaX generated this read</CardTitle>
        <Badge tone={explanation.source === 'ai' ? 'accent' : 'muted'}>
          {explanation.source === 'ai' ? `AI · ${explanation.model ?? 'model'}` : 'Standard'}
        </Badge>
      </div>

      <p className="text-sm text-fg">{explanation.summary}</p>

      <div className="mt-3 space-y-2">
        {sections.map(([title, body]) => (
          <details key={title} className="group rounded-md border border-border bg-surface-2/50 p-2">
            <summary className="cursor-pointer list-none text-sm font-medium text-fg marker:content-none">
              <span className="mr-1 text-muted group-open:hidden">▸</span>
              <span className="mr-1 hidden text-muted group-open:inline">▾</span>
              {title}
            </summary>
            <p className="mt-1.5 pl-4 text-sm text-muted">{body}</p>
          </details>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {aiEnabled ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {pending ? 'Generating…' : explanation.source === 'ai' ? 'Regenerate with AI' : 'Explain with AI'}
          </button>
        ) : (
          <span className="text-xs text-muted">
            Configure <code className="text-fg">GEMINI_API_KEY</code> or <code className="text-fg">AI_API_KEY</code> to enable AI-written explanations.
          </span>
        )}
        {error ? <span className="text-xs text-warn">{error}</span> : null}
      </div>

      <p className="mt-2 text-[11px] text-muted">
        AI explains the deterministic engine&apos;s decision from verified data only — it never
        invents prices, statistics, or signals.
      </p>
    </Card>
  );
}
