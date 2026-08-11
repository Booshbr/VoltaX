'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

/** Theme switch (spec §36, §49, §57). Persists to localStorage; the pre-paint
 * script in the root layout applies it before hydration to avoid a flash. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light');
    setTheme(isLight ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem('voltax-theme', next);
    } catch {
      // ignore storage errors (private mode)
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-fg transition-colors hover:bg-surface"
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );
}
