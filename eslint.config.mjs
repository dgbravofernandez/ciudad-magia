import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**'],
  },

  // Configuración base de Next.js (incluye react-hooks, jsx-a11y, @next/next)
  ...compat.extends('next/core-web-vitals'),

  // TypeScript parser + plugin para todos los archivos .ts/.tsx
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // `as any` explícito: warn (patrón documentado con supabase-js; los eslint-disable son intencionales)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Pre-existing: comillas literales en JSX y <a> en vez de <Link> → warn hasta que se migren
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },

  // SEC-4: en src/features/ está prohibido importar createAdminClient directamente.
  // Todos los server actions deben usar getScopedClient() de @/lib/supabase/scoped-client,
  // que garantiza que clubId siempre está accesible y reduce el riesgo de fugas multi-tenant.
  {
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@/lib/supabase/admin',
              importNames: ['createAdminClient'],
              message:
                'Usa getScopedClient() de @/lib/supabase/scoped-client (SEC-4). Ver docs/kb/04-seguridad/backlog-seguridad.md.',
            },
          ],
        },
      ],
    },
  },
]

export default config
