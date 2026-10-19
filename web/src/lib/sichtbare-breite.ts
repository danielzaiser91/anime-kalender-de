/**
 * Breite, in der fixierte Elemente rechnen: das Fenster ohne Bildlaufleiste. `innerWidth` zählt die Leiste mit, und
 * `clientWidth` zählt bei gesperrter Seite (`overflow: hidden` mit `scrollbar-gutter: stable`) den freigehaltenen Streifen mit.
 */
export const sichtbareBreite = (): number => document.documentElement.getBoundingClientRect().width
