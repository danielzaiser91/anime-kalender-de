import globals from 'globals'

/**
 * Nur `no-undef` für die .mjs-Skripte: `tsc` sieht sie nicht, keine Kette lädt
 * sie. Anlass 28.10.2026 (PR 2278): `.map(norm)` blieb nach dem Löschen von
 * `norm` in pipeline/fetch-cr-katalog.mjs stehen, ReferenceError erst im Lauf.
 *
 * Playwright-`evaluate`-Funktionen laufen im Browser: erlaubt sind nur die dort
 * genutzten Browser-Namen (21, gemessen 28.10.2026), nicht ganz globals.browser
 * (703 Namen wie name, status, close). Jeder andere unbekannte Name wird rot.
 */
const BROWSER = Object.fromEntries(
  [
    'Image', 'MutationObserver', 'NodeFilter', 'OffscreenCanvas', 'PointerEvent',
    'addEventListener', 'caches', 'createImageBitmap', 'document', 'getComputedStyle',
    'history', 'innerHeight', 'innerWidth', 'localStorage', 'location', 'navigator',
    'requestAnimationFrame', 'scrollTo', 'scrollX', 'scrollY', 'window',
  ].map((name) => [name, 'readonly']),
)

export default [
  {
    files: ['pipeline/**/*.mjs', 'tools/**/*.mjs'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...BROWSER },
    },
    rules: { 'no-undef': 'error' },
  },
]
