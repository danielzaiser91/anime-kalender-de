/**
 * Rot-Alarm ohne Claude-Sitzung: macht aus den ALARM-Zeilen der Wachphase (`tools/laeufe-aufraeumen.mjs`) ein GitHub-Issue
 * (Label `alarm`, GitHub mailt dem Inhaber). Je Tag ein Issue; weitere Läufe am selben Tag kommentieren nur eine neue Alarmart.
 * Ist der Alarm vorbei, wird jedes offene Alarm-Issue mit Kommentar geschlossen.
 *
 * Aufruf (im Workflow `wecker-wache.yml`, Job `alarm`): `node tools/alarm-issue.mjs <ausgabe-datei>`
 *   Die Datei enthält die Ausgabe von `laeufe-aufraeumen.mjs`; `GH_TOKEN` und `GITHUB_REPOSITORY` kommen aus der Umgebung.
 *
 * Eine Zeile `ALARM? …` heißt „Abruf nicht lesbar“: sie löst nichts aus und schließt nichts. Fehlt die Schlusszeile der
 * Wachphase („Läufe in der App“), ist die Ausgabe unvollständig (Absturz): dann bleibt alles, wie es ist.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mitLimit } from './kind-mit-limit.mjs'

export const ALARM_LABEL = 'alarm'
const SCHLUSSZEILE = /Läufe in der App/

/** Die echten Alarmzeilen (`ALARM <Art> …`), ohne Lesefehler und ohne eingerückte Hinweiszeilen. */
export function alarmZeilen(ausgabe) {
  return ausgabe.split('\n').map((z) => z.trimEnd()).filter((z) => z.startsWith('ALARM '))
}

/** Die Art einer Alarmzeile: „ALARM Bestandsbau“, „ALARM Deploy“ (die Stundenzahl dahinter wechselt je Lauf). */
export function alarmArt(zeile) {
  return zeile.split(' ').slice(0, 2).join(' ')
}

const titelFuer = (tag) => `ALARM ${tag}: Bestandsbau oder Deploy rot`
const istTagesIssue = (issue, tag) => issue.title === titelFuer(tag)
const volltext = (issue) => [issue.body ?? '', ...(issue.comments ?? []).map((k) => k.body ?? '')].join('\n')
const zeilenText = (zeilen) => zeilen.map((z) => `- ${z}`).join('\n')

/**
 * Entscheidet, was mit den offenen Alarm-Issues geschieht. `offene` = offene Issues mit Label `alarm`
 * (`number`, `title`, `body`, `comments[].body`), `tag` = Datum `JJJJ-MM-TT`. Rückgabe: Liste von Handlungen
 * `{ typ: 'neu' | 'kommentar' | 'schliessen', … }`.
 */
export function alarmEntscheid({ ausgabe, offene, tag }) {
  const zeilen = alarmZeilen(ausgabe)
  const lesefehler = ausgabe.split('\n').some((z) => z.startsWith('ALARM?'))
  if (!zeilen.length) {
    if (lesefehler || !SCHLUSSZEILE.test(ausgabe)) return []
    return offene.map((i) => ({ typ: 'schliessen', nummer: i.number, text: 'Kein ALARM mehr in der Wachphase (laeufe-aufraeumen). Alarm vorbei.' }))
  }
  const heute = offene.find((i) => istTagesIssue(i, tag))
  if (!heute) {
    const text = `Wachphase meldet (Stand ${tag}):\n\n${zeilenText(zeilen)}\n\nBeschreibung der Zeilen: tools/bestand-rot-alarm.mjs. Das Issue schließt sich, sobald kein ALARM mehr gemeldet wird.`
    const alte = offene.map((i) => ({ typ: 'schliessen', nummer: i.number, text: `Alarm besteht weiter, neues Tagesissue vom ${tag}.` }))
    return [{ typ: 'neu', titel: titelFuer(tag), text }, ...alte]
  }
  const bekannt = volltext(heute)
  const neue = zeilen.filter((z) => !bekannt.includes(alarmArt(z)))
  if (!neue.length) return []
  return [{ typ: 'kommentar', nummer: heute.number, text: `Neue Alarmart:\n\n${zeilenText(neue)}` }]
}

/** Führt die Handlungen über `gh` aus (einspeisbar). */
export function alarmAusfuehren(handlungen, gh, repo) {
  for (const h of handlungen) {
    if (h.typ === 'neu') gh(['issue', 'create', '--repo', repo, '--label', ALARM_LABEL, '--title', h.titel, '--body', h.text])
    if (h.typ === 'kommentar') gh(['issue', 'comment', String(h.nummer), '--repo', repo, '--body', h.text])
    if (h.typ === 'schliessen') gh(['issue', 'close', String(h.nummer), '--repo', repo, '--comment', h.text])
  }
}

/** Ganzer Lauf: Label sicherstellen, offene Issues lesen, entscheiden, ausführen. Gibt die Handlungen zurück. */
export function alarmLauf({ ausgabe, tag, gh, repo }) {
  try {
    gh(['label', 'create', ALARM_LABEL, '--repo', repo, '--color', 'B60205', '--description', 'Rot-Alarm der Wachphase'])
  } catch {
    // Label besteht schon.
  }
  const offene = JSON.parse(gh(['issue', 'list', '--repo', repo, '--label', ALARM_LABEL, '--state', 'open', '--json', 'number,title,body,comments', '--limit', '30']))
  const handlungen = alarmEntscheid({ ausgabe, offene, tag })
  alarmAusfuehren(handlungen, gh, repo)
  return handlungen
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const gh = (a) => mitLimit('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 })
  const ausgabe = readFileSync(process.argv[2], 'utf8')
  const handlungen = alarmLauf({ ausgabe, tag: new Date().toISOString().slice(0, 10), gh, repo: process.env.GITHUB_REPOSITORY })
  console.log(`Alarm-Issues: ${handlungen.length} Handlung(en): ${handlungen.map((h) => h.typ).join(', ') || 'keine'}`)
}
