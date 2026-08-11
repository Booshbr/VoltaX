import tseslint from 'typescript-eslint';

/**
 * ESLint 9 flat config (spec §38 strict TS). Uses typescript-eslint directly —
 * the Next.js shareable config via FlatCompat currently trips a circular-ref bug
 * on ESLint 9, and this keeps linting stable across the toolchain.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      '*.config.mjs',
      '*.config.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
