import reactHooks from 'eslint-plugin-react-hooks'
import tsParser from '@typescript-eslint/parser'

/**
 * Absichtlich kein Stil-Linter, sondern genau zwei Regeln.
 *
 * Am 20.08.2026 war die ganze Seite weiß: React-Fehler #310, „Rendered more
 * hooks than during the previous render" — ein `useMemo` stand hinter einem
 * vorzeitigen `return`. Die komplette Prüfkette war grün, `tsc -b` auch, denn
 * für den Compiler ist ein Hook ein gewöhnlicher Funktionsaufruf; dass seine
 * Reihenfolge über die Renderdurchläufe hinweg gleich bleiben muss, steht in
 * keinem Typ. Gefunden wurde es durch einen Blick auf die laufende Seite, und
 * der Service Worker lieferte das kaputte Bundle bis dahin weiter aus.
 *
 * Deshalb nur das, was diesen Fehler fängt — keine Formatierung, kein
 * Prettier, keine Regel, die vorhandene Dateien umschreiben will.
 */
export default [
  {
    files: ['web/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Der Fehler vom 20.08.2026. Ein Verstoß ist kein Stilproblem, sondern
      // eine weiße Seite — deshalb Fehler und nicht Warnung.
      'react-hooks/rules-of-hooks': 'error',
      // Bleibt Warnung: Die Regel hat bekannte Fehlalarme (Werte, die
      // absichtlich nur beim ersten Lauf gelesen werden), und ein Fehlalarm,
      // der den Deploy rot macht, bringt einem bei, die Farbe zu ignorieren.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
