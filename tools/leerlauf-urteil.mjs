/**
 * Urteil des Leerlauf- und Leck-Tests (`leerlauf-tempo.mjs`) als reine Funktion. Grenzen (18.11.2026, Auftrag perf-waechter):
 * ein offener Tab soll den Rechner nicht wecken — CPU im Leerlauf unter 1 %, keine Dauer-Animation, kein Takt unter 1 s —
 * und Ansichtswechsel dürfen keinen Speicher liegen lassen (Wachstum nach erzwungener Bereinigung höchstens 1 MB).
 */
export const CPU_GRENZE = 0.01
export const INTERVALL_MIN_MS = 1000
export const LECK_GRENZE_BYTES = 1024 * 1024

const prozent = (x) => `${(x * 100).toFixed(2)} %`

/** `ansichten`: Ergebnisse von `leerlaufMessen` mit `name`; `leck`: { vorher, nachher, wechsel } in Bytes. */
export function urteil(ansichten, leck) {
  const fehler = []
  if (!ansichten.length) fehler.push('keine Ansicht gemessen')
  for (const a of ansichten) {
    if (!(a.cpu < CPU_GRENZE)) fehler.push(`${a.name}: CPU im Leerlauf ${prozent(a.cpu)} ≥ ${prozent(CPU_GRENZE)}`)
    for (const i of a.intervalle.filter((x) => x.takt < INTERVALL_MIN_MS)) fehler.push(`${a.name}: Intervall ${i.takt} ms läuft im Leerlauf (${i.ort})`)
    if (a.animationen.length) fehler.push(`${a.name}: ${a.animationen.length} unendliche Animation(en) im Leerlauf (${a.animationen.join(', ')})`)
  }
  if (!leck) fehler.push('Leck-Wache nicht gemessen')
  else if (!(leck.nachher - leck.vorher <= LECK_GRENZE_BYTES)) fehler.push(`Heap nach ${leck.wechsel} Wechseln +${((leck.nachher - leck.vorher) / 1048576).toFixed(2)} MB > 1 MB`)
  return fehler
}
