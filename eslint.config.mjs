import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import { defineConfig } from 'eslint/config'
import importPlugin from 'eslint-plugin-import'
import pluginJsxA11y from 'eslint-plugin-jsx-a11y'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'eslint.config.mjs',
      '.vscode/**'
    ]
  },

  // Base JS settings
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended']
  },

  // Browser globals
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },

  // TypeScript
  ...tseslint.configs.recommended,

  // React settings
  {
    files: ['**/*.{jsx,tsx}'],
    ...pluginReact.configs.flat.recommended,
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off', // TypeScript handles this
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // Next.js
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: {
      next: nextPlugin
    },
    rules: {
      'next/no-html-link-for-pages': 'error',
      'next/no-img-element': 'warn',
      'next/no-unwanted-polyfillio': 'warn'
    }
  },

  // Import ordering
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: {
      import: importPlugin
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type'
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true }
        }
      ]
    }
  },

  // TypeScript-specific rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ]
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  }
])
