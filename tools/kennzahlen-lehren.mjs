/**
 * Neue Lehren je Tag aus daniel-zum-abarbeiten/berichte/lehren.md (lokal ausgeschlossen, nicht im Repo; Pfad wie bei den Kernpunkten
 * relativ zur Wurzel oder per --lehren=<Datei> an tageskennzahlen.mjs).
 *
 * Ein Eintrag = eine Lehre. Die Datei hat vier Formen, jede zählt einmal, das Datum steht im Kopf des Eintrags:
 *   - Tabellenzeile `| TT.MM. | …`  und  Aufzählungspunkt `- TT.MM. …`   (Jahr 2026: der erste Eintrag ist vom 10.10.2026)
 *   - Überschrift `## …` mit Datum `TT.MM.JJJJ`, `JJJJ-MM-TT` oder `TT.MM.`; steht dort nur eine Uhrzeit („## 19:14 — …“) oder gar nichts,
 *     gilt das Datum der letzten datierten Überschrift davor
 *   - `**N. … (TT.MM.JJJJ …)**` (nummerierte Lehren seit November)
 * Aufzählungspunkte ohne Datum (Unterpunkte eines Eintrags) zählen nie. Tage vor dem ersten Eintrag haben keine Quelle: sie fehlen (null).
 */
const VOLL = /(\d{2})\.(\d{2})\.(\d{4})/
const ISO = /(\d{4})-(\d{2})-(\d{2})/
const KURZ = /(?<![\d.])(\d{2})\.(\d{2})\.(?!\d)/
const JAHR = '2026'

/** `YYYY-MM-DD` aus dem ersten Datum im Text (alle drei Schreibweisen) oder null. */
export function datumIn(text) {
  const v = VOLL.exec(text)
  if (v) return `${v[3]}-${v[2]}-${v[1]}`
  const i = ISO.exec(text)
  if (i) return `${i[1]}-${i[2]}-${i[3]}`
  const k = KURZ.exec(text)
  return k ? `${JAHR}-${k[2]}-${k[1]}` : null
}

/** Datum des Eintrags, den die Zeile eröffnet: [eintrag?, datum|null]; `letztes` = Datum der letzten datierten Überschrift. */
function eintragDaten(zeile, letztes) {
  if (zeile.startsWith('## ')) return datumIn(zeile) ?? letztes
  if (/^\*\*\d+\. /.test(zeile)) return datumIn(zeile)
  const kopf = /^(?:\| |- )(\d{2}\.\d{2}\.)(?!\d)/.exec(zeile)
  return kopf ? datumIn(kopf[1]) : null
}

/** { 'YYYY-MM-DD': Anzahl } über den ganzen Text; Tage ohne Eintrag fehlen. */
export function lehrenJeTag(text) {
  const jeTag = {}
  let letztes = null
  for (const zeile of text.split('\n')) {
    const datum = eintragDaten(zeile, letztes)
    if (zeile.startsWith('## ') && datumIn(zeile)) letztes = datum
    if (datum) jeTag[datum] = (jeTag[datum] ?? 0) + 1
  }
  return jeTag
}

/** Lehren am Tag: 0, wenn die Datei den Tag überdeckt (ab dem ersten Eintrag), sonst undefined (keine Quelle). */
export function lehrenAmTag(jeTag, tag) {
  const erster = Object.keys(jeTag).sort()[0]
  if (!erster || tag < erster) return undefined
  return jeTag[tag] ?? 0
}
