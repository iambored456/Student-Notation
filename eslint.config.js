import js from '@eslint/js';

export default [
  // Apply to all JS files
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'dist/**',
      'docs/**',
      '*.config.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        AudioContext: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        TouchEvent: 'readonly',
        PointerEvent: 'readonly',
        DragEvent: 'readonly',
        ClipboardEvent: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        Path2D: 'readonly',
        ImageData: 'readonly',
        MediaDevices: 'readonly',
        MediaStream: 'readonly',
        AnalyserNode: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        performance: 'readonly',
        getComputedStyle: 'readonly',
        FontFace: 'readonly',
        requestIdleCallback: 'readonly',
        logger: 'readonly',
        scheduleCell: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,

      // Possible Problems
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'no-constant-condition': ['warn', { checkLoops: false }],

      // Best Practices
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-var': 'warn',
      'prefer-const': 'warn',
      'curly': ['warn', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Style (light enforcement)
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'indent': ['warn', 2, { SwitchCase: 1 }],
      'comma-dangle': ['warn', 'never'],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always']
    }
  }
];
