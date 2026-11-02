import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', '.next/**', 'node_modules/**', 'next-env.d.ts', 'src/db/migrations/**', 'src/lib/rbac/data.generated.ts'] },
  js.configs.recommended,
  { files: ['**/*.mjs', 'scripts/**'], languageOptions: { globals: { console: 'readonly', process: 'readonly' } } },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
