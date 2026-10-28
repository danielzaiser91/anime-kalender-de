import globals from 'globals'

/**
 * Nur `no-undef` für die .mjs-Skripte: `tsc` sieht sie nicht, keine Kette lädt
 * sie. Anlass 28.10.2026 (PR 2278): `.map(norm)` blieb nach dem Löschen von
 * `norm` in pipeline/fetch-cr-katalog.mjs stehen, ReferenceError erst im Lauf.
 *
 * Browser-Globals sind erlaubt, weil Playwright-`evaluate`-Funktionen im
 * Browser laufen (422 Treffer in Messskripten, Stand 28.10.2026); ein
 * unbekannter Name, der kein Browser- oder Node-Global ist, wird rot.
 */
export default [
  {
    files: ['pipeline/**/*.mjs', 'tools/**/*.mjs'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { 'no-undef': 'error' },
  },
]
