/**
 * Trefferprobe, die **im Browser** läuft (`page.evaluate`): Jedes sichtbare Bedienelement muss an seiner Mitte selbst oder
 * über einen Nachfahren getroffen werden — sonst kann ein Nutzer es nicht anklicken (Flaggen und Banner im Panel, 16.10.2026).
 * Aufrufer: `tools/panel-messen.mjs` (Detail-Panel) und `tools/ansicht-trefferprobe.mjs` (Hauptansichten).
 */


/**
 * @param {{ wurzel?: string, ausnahmen?: { waehler: string, grund: string }[] }} arg
 *   `wurzel`: Auswahl, unter der gesucht wird (Vorgabe: ganze Seite). `ausnahmen`: benannte, begründete Ausnahmen.
 * @returns {{ geprueft: number, befunde: string[] }}
 */
export function trefferprobe({ wurzel, ausnahmen = [] }) {
  const BEDIENELEMENTE = 'a[href], button, [role="button"], input:not([type="hidden"]), summary'
  const start = wurzel ? document.querySelector(wurzel) : document.body
  const befunde = []
  let geprueft = 0
  for (const el of start.querySelectorAll(BEDIENELEMENTE)) {
    if (ausnahmen.some((a) => el.matches(a.waehler))) continue
    if (el.disabled || !el.checkVisibility({ visibilityProperty: true })) continue
    /* Ein unsichtbares Eingabefeld (Schalter, Auswahl) trägt sein Etikett als Ziel. */
    const ziel = el.matches('input') && el.getBoundingClientRect().width < 8 ? (el.labels?.[0] ?? el) : el
    if (ziel.closest('[aria-hidden="true"]')) continue
    ziel.scrollIntoView({ block: 'center', inline: 'center' })
    const r = ziel.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    geprueft++
    const oben = document.elementFromPoint(x, y)
    if (oben && ziel.contains(oben)) continue
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
    const befund = `${el.tagName.toLowerCase()} „${name}“ liegt bei ${Math.round(x)}/${Math.round(y)} (Maße ${Math.round(r.width)}x${Math.round(r.height)}) unter ${oben?.tagName.toLowerCase() ?? 'nichts'} ${String(oben?.className ?? '').slice(0, 50)}`
    befunde.push(befund)
  }
  return { geprueft, befunde }
}
