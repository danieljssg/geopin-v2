import js from '@eslint/js'
import babelParser from '@babel/eslint-parser'
import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import globals from 'globals'

/**
 * Configuración de ESLint.
 *
 * El proyecto tenía el script `lint` sin la dependencia instalada: el
 * comando fallaba con "orden no encontrada". Y al instalarla, el preset
 * `eslint-config-next` no funciona: `typescript-eslint` rechaza TypeScript 7
 * —el compilador nativo que usa el proyecto— con un error que no tiene
 * workaround.
 *
 * La salida es parsear TypeScript con **Babel**, que no depende de la
 * versión del compilador, y aplicar a mano las reglas de React, React Hooks
 * y Next. Se pierden las reglas que necesitan información de tipos, que en
 * este proyecto son pocas: el typecheck estricto ya las cubre.
 */
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'odd/**',
      'public/**',
    ],
  },

  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
        },
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,

      // Los tipos de React 19 no hace falta importarlos explícitamente.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // Los `<img>` crudos aparecen en los popups de Leaflet, donde no hay
      // alternativa declarativa sin romper el mapa.
      '@next/next/no-img-element': 'off',

      /**
       * `no-undef` y `no-unused-vars` son reglas de JavaScript y no sirven
       * en TypeScript: no conocen los tipos, los genéricos ni los imports de
       * solo tipo. Las equivalents son `noUnusedLocals` y `noUnusedParameters`
       * del compilador, que están activadas en tsconfig.json.
       */
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
]
