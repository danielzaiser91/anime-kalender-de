/** Liest die Lauf-Arten aus der Quelle der Statusanzeige (`ARTEN` in deren index.html). */
export function artenAusAnzeige(html) {
  const block = /const ARTEN = \[([\s\S]*?)\n\]/.exec(html)?.[1] ?? ''
  return [...block.matchAll(/\{ kurz: '[^']+', lang: '([^']+)' \}/g)].map((m) => m[1])
}
