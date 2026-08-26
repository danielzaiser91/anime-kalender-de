/**
 * Nur eine Frage an die Erweiterung: Benutzt sie Namen, die es nicht gibt?
 *
 * Anlass (26.08.2026): Beim Umbau des Dialogs auf Bereiche fiel die Variable
 * `empfohlen` weg, eine spätere Zeile nutzte sie weiter. Der Dialog ließ sich
 * danach nicht mehr öffnen — „anime kalender click not working and i see an
 * error" —, und keine der 236 Zusicherungen hat es bemerkt: Sie prüfen die
 * Daten, nicht den Dialog.
 *
 * Ein Sandkasten für das ganze DOM wäre der gründlichere Weg und kostet einen
 * Tag. Diese Prüfung kostet eine Sekunde und fängt genau die Klasse Fehler, die
 * mir heute dreimal passiert ist.
 *
 * Nur `no-undef` — kein Stil, keine Meinung. Was hier rot wird, ist ein
 * Absturz im Browser.
 */
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        history: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        chrome: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        XMLHttpRequest: 'readonly',
        Response: 'readonly',
        PopStateEvent: 'readonly',
        MutationObserver: 'readonly',
        globalThis: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        AbortController: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
      },
    },
    rules: { 'no-undef': 'error' },
  },
]
