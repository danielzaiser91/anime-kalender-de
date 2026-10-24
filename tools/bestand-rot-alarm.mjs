/**
 * Alarm „Bestandsbau rot“: der letzte grüne Lauf von `bestand-bauen.yml` ist älter als die Grenze, und danach liegen rote oder
 * abgebrochene Läufe. Liest nur GitHub (kein Worker, kein Token), damit ein Ausfall des Status-Workers ihn nicht verdeckt.
 * Anlass: Der Bau war vom 21.10.2026 18:10 bis 23.10.2026 13:07 UTC rot (46 Läufe); die Wache erlaubt dem Workflow 36 h
 * (`wache-woechentlich.mjs`), das Urteil nannte es erst nach 39,9 h.
 */
export const BESTAND_ROT_GRENZE_STUNDEN = 6
export const BESTAND_WORKFLOW = 'bestand-bauen.yml'
const ROT = new Set(['failure', 'timed_out', 'cancelled'])

/** `laeufe`: `[{ status, conclusion, createdAt }]` (gh run list). Übersprungene Läufe (Push ohne Bau) zählen weder grün noch rot. */
export function bestandRotAlarm(laeufe, jetztMs, grenzeStunden = BESTAND_ROT_GRENZE_STUNDEN) {
  const fertig = laeufe.filter((l) => l.status === 'completed')
  const gruen = fertig
    .filter((l) => l.conclusion === 'success')
    .map((l) => l.createdAt)
    .sort()
    .at(-1)
  const aelteste = fertig.map((l) => l.createdAt).sort()[0]
  const bezug = gruen ?? aelteste
  const rote = fertig.filter((l) => ROT.has(l.conclusion) && (gruen === undefined || l.createdAt > gruen)).length
  if (bezug === undefined) return { alarm: false, stunden: 0, gruenAm: gruen, rote }
  const stunden = (jetztMs - Date.parse(bezug)) / 3_600_000
  return { alarm: rote > 0 && stunden > grenzeStunden, stunden, gruenAm: gruen, rote }
}

/** Die Alarmzeile, oder `undefined` ohne Alarm. */
export function alarmZeile(ergebnis) {
  if (!ergebnis.alarm) return undefined
  const gruen = ergebnis.gruenAm ? `letzter grüner Lauf ${ergebnis.gruenAm}` : 'kein grüner Lauf in den abgefragten Läufen'
  return `ALARM Bestandsbau seit ${ergebnis.stunden.toFixed(1)} h rot (${gruen}, ${ergebnis.rote} rote/abgebrochene danach, Grenze ${BESTAND_ROT_GRENZE_STUNDEN} h)`
}

/** Liest die Läufe mit der übergebenen `gh`-Funktion; nicht lesbar ist selbst eine Zeile, nie Schweigen. */
export function bestandRotText(gh, repo, jetztMs) {
  try {
    const laeufe = JSON.parse(gh('run', 'list', '--repo', repo, '--workflow', BESTAND_WORKFLOW, '--limit', '200', '--json', 'status,conclusion,createdAt'))
    const ergebnis = bestandRotAlarm(laeufe, jetztMs)
    return alarmZeile(ergebnis) ?? `Bestandsbau: kein Alarm (letzter grüner Lauf ${ergebnis.gruenAm ?? 'unbekannt'}, ${ergebnis.rote} rote/abgebrochene danach)`
  } catch (fehler) {
    return `ALARM? Läufe des Bestandsbaus nicht lesbar: ${String(fehler.message).split('\n')[0]}`
  }
}
