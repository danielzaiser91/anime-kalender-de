/**
 * Urteil der Auge-Messung (360 px) als reine Funktion. Eingabe je Auge: `breite`/`hoehe` der sichtbaren Schaltfläche,
 * `flaeche` = Breite/Höhe der unsichtbaren Trefferfläche (`::after`), `rechts` = rechte Kante, `fenster` = Fensterbreite.
 * Das Auge ist erreichbar, wenn die Trefferfläche mindestens 44 × 44 px misst und die Schaltfläche im Fenster liegt.
 */
export const MIN_TREFFER = 44

export function urteil(augen, fenster) {
  if (!augen.length) return { ok: false, zeile: 'bereich-auge: ✖ kein Auge gefunden' }
  const fehler = []
  for (const a of augen) {
    if (a.flaeche.breite < MIN_TREFFER || a.flaeche.hoehe < MIN_TREFFER) fehler.push(`${a.bereich}: Trefferfläche ${a.flaeche.breite}×${a.flaeche.hoehe} px`)
    if (a.rechts > fenster) fehler.push(`${a.bereich}: ragt über das Fenster (${a.rechts} > ${fenster})`)
  }
  const ok = fehler.length === 0
  const kopf = `bereich-auge: ${ok ? '✓' : '✖'} ${augen.length} Augen bei ${fenster} px, Trefferfläche mindestens ${MIN_TREFFER} px`
  return { ok, zeile: ok ? kopf : `${kopf} — ${fehler.join('; ')}` }
}
