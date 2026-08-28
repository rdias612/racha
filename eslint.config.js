import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '*.tsbuildinfo', '.vercel'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      // Preset flat clássico (rules-of-hooks + exhaustive-deps). O
      // `flat['recommended-latest']` do plugin v7 ativa 17 regras do React
      // Compiler (purity, set-state-in-effect...) com 22 erros arquiteturais
      // no código atual — evolução futura, não parte deste item.
      reactHooks.configs.flat.recommended,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // As 3 regras do React Compiler (preset v7) abaixo colidem com padrões
      // arquiteturais vigentes do app: setState síncrono em effects de carga
      // e reset de filtros (17 sites), Date.now()/Math.random() em renders de
      // countdown e sorteio (purity) e componente estático no Layout.
      // Desligá-las é deliberado; religar exige refatoração dedicada.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    // Service worker da PWA: JS puro fora de src, com escopo próprio de
    // globals (self, caches, clients...). Regras base de JS, sem TS.
    extends: [js.configs.recommended],
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.serviceworker,
    },
  }
);
