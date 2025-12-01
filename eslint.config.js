import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Custom globals specific to your application
const customGlobals = {
  logger: 'readonly',
  scheduleCell: 'readonly'
};

// Shared rules for both JS and TS files
const baseRules = {
  // Possible Problems
  'no-constant-condition': ['warn', { checkLoops: false }],

  // Best Practices
  'eqeqeq': ['warn', 'always', { null: 'ignore' }],
  'curly': ['warn', 'all'],
  'no-eval': 'error',

  // Style (light enforcement)
  'semi': ['warn', 'always'],
  'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
  'indent': ['warn', 2, { SwitchCase: 1 }],
  'comma-dangle': ['warn', 'never'],
  'no-trailing-spaces': 'warn',
  'eol-last': ['warn', 'always']
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'docs/**',
      '*.config.js',
      '*.config.cjs',
      '*.config.ts'
    ]
  },
  // JavaScript files configuration
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...customGlobals
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...baseRules,
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }]
    }
  },
  // TypeScript files configuration with type-aware linting
  {
    files: ['**/*.ts'],
    ignores: ['js/services/timbreEffects/**/*.ts'], // Excluded from tsconfig
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...customGlobals
      }
    },
    rules: {
      ...baseRules,
      // Disable base ESLint rules that are replaced by TypeScript-aware versions
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-implied-eval': 'off',

      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],

      // Type-aware rules (these leverage your tsconfig.json)
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Too many false positives
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Can be fixed gradually
      '@typescript-eslint/prefer-optional-chain': 'off', // Can be fixed gradually

      // Adjust strictness for existing codebase
      '@typescript-eslint/no-explicit-any': 'off', // Too many to fix at once
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off', // Too many to fix at once
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/prefer-for-of': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/consistent-generic-constructors': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/require-await': 'off',

      // These we'll keep to improve code quality
      '@typescript-eslint/ban-ts-comment': 'error', // Remove @ts-nocheck
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // Use interfaces

      // Turn off rules that are too strict for this codebase
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off', // Valid patterns in codebase
      '@typescript-eslint/restrict-plus-operands': 'off', // Tone.js uses custom Time objects
      '@typescript-eslint/no-base-to-string': 'off', // Tone.js objects have custom toString
      '@typescript-eslint/restrict-template-expressions': 'off' // Allow Tone.js Time in templates
    }
  }
);
