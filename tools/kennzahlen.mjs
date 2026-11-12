/**
 * Kennzahlen in ARCHITEKTUR.md erzeugen statt von Hand pflegen.
 * Marker: `<!-- kennzahlen:NAME -->Text<!-- /kennzahlen -->`; der Text trägt immer „Stand TT.MM.JJJJ“.
 * Aufruf (nur Node-Bordmittel):
 *   node tools/kennzahlen.mjs            schreibt alle Marker neu (public/data -> ARCHITEKTUR.md), Exit 1 bei fehlendem Marker
 *   node tools/kennzahlen.mjs --pruefen  liest nur: fehlender Marker = Exit 1, Stand älter als ALTER_TAGE = Zeile „⚠ WARNUNG“, Exit 0
 * Läuft auf Abruf, nie im Bestandsbau: auf main schreibt nur der Bestandsbau.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

export const ALTER_TAGE = 30
export const NAMEN = ['meta-gzip', 'woche-kacheln-gzip', 'nachladen-gzip', 'titles-gzip', 'public-dateien']
const DATEI = 'ARCHITEKTUR.md'
const MARKER = /<!-- kennzahlen:([a-z0-9-]+) -->(.*?)<!-- \/kennzahlen -->/g

const kb = (bytes) => (bytes / 1024).toFixed(1).replace('.', ',')
const gzipKb = (pfad) => kb(gzipSync(readFileSync(pfad), { level: 9 }).length)

/** Anzahl Dateien unter `ordner`, rekursiv. */
export function zaehleDateien(ordner) {
  let n = 0
  for (const e of readdirSync(ordner, { withFileTypes: true })) n += e.isDirectory() ? zaehleDateien(join(ordner, e.name)) : 1
  return n
}

/** Markername -> Text (ohne Marker) für den Stand `stand` (TT.MM.JJJJ); `wurzel` ist der Repo-Ordner. */
export function messeKennzahlen(wurzel, stand) {
  const daten = (name) => join(wurzel, 'public', 'data', name)
  const s = `Stand ${stand}`
  return {
    'meta-gzip': `${gzipKb(daten('meta.json'))} KB, ${s}`,
    'woche-kacheln-gzip': `${gzipKb(daten('woche-kacheln.json'))} KB, ${s}`,
    'nachladen-gzip': `\`titles-core\` ${gzipKb(daten('titles-core.json'))} KB, \`releases\` ${gzipKb(daten('releases.json'))} KB, \`events\` ${gzipKb(daten('events.json'))} KB, ${s}`,
    'titles-gzip': `${gzipKb(daten('titles.json'))} KB, ${s}`,
    'public-dateien': `${zaehleDateien(join(wurzel, 'public'))} Dateien in \`public/\` (Schwelle 15.000), ${s}`,
  }
}

/** Ersetzt jeden Marker durch seinen Wert; `fehlend` nennt Namen ohne Marker im Text und Marker ohne Wert. */
export function setzeMarker(text, werte) {
  const gesehen = new Set()
  const unbekannt = []
  const neu = text.replace(MARKER, (alt, name) => {
    if (!(name in werte)) {
      unbekannt.push(name)
      return alt
    }
    gesehen.add(name)
    return `<!-- kennzahlen:${name} -->${werte[name]}<!-- /kennzahlen -->`
  })
  const fehlend = [
    ...Object.keys(werte).filter((n) => !gesehen.has(n)).map((n) => `Marker „${n}“ fehlt in ${DATEI}`),
    ...unbekannt.map((n) => `Marker „${n}“ ist unbekannt`),
  ]
  const offen = (text.match(/<!-- kennzahlen:/g) ?? []).length - (text.match(/<!-- \/kennzahlen -->/g) ?? []).length
  if (offen !== 0) fehlend.push('Marker nicht paarig (Anfang und Ende ungleich oft)')
  return { text: neu, fehlend }
}

const tageSeit = (ttmmjjjj, heute) => {
  const [t, m, j] = ttmmjjjj.split('.').map(Number)
  return Math.floor((heute - Date.UTC(j, m - 1, t)) / 86400000)
}

/** Meldungen zu Markern ohne lesbaren Stand oder mit Stand älter als `tage` Tage; `heute` als UTC-Millisekunden des Tags. */
export function veraltet(text, heute, tage = ALTER_TAGE) {
  const meldungen = []
  for (const [, name, inhalt] of text.matchAll(MARKER)) {
    const stand = inhalt.match(/Stand (\d{2}\.\d{2}\.\d{4})/)
    if (!stand) meldungen.push(`Marker „${name}“ ohne Stand-Datum`)
    else if (tageSeit(stand[1], heute) > tage) meldungen.push(`Marker „${name}“ ist ${tageSeit(stand[1], heute)} Tage alt (Stand ${stand[1]})`)
  }
  return meldungen
}

function heuteBerlin() {
  const t = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())
  const [d, m, j] = t.split('.').map(Number)
  return { stand: t, utc: Date.UTC(j, m - 1, d) }
}

export function main(argv, wurzel) {
  const pfad = join(wurzel, DATEI)
  if (!existsSync(pfad)) return { code: 1, zeilen: [`kennzahlen: ${pfad} fehlt`] }
  const text = readFileSync(pfad, 'utf8')
  const heute = heuteBerlin()
  if (argv.includes('--pruefen')) {
    const fehlend = setzeMarker(text, Object.fromEntries(NAMEN.map((n) => [n, '']))).fehlend
    const alt = veraltet(text, heute.utc)
    const zeilen = [...fehlend.map((m) => `kennzahlen: ${m}`), ...alt.map((m) => `⚠ WARNUNG kennzahlen: ${m}; neu erzeugen mit node tools/kennzahlen.mjs`)]
    return { code: fehlend.length ? 1 : 0, zeilen: [...zeilen, `kennzahlen: ${fehlend.length} fehlend, ${alt.length} veraltet (Grenze ${ALTER_TAGE} Tage)`] }
  }
  const { text: neu, fehlend } = setzeMarker(text, messeKennzahlen(wurzel, heute.stand))
  if (fehlend.length) return { code: 1, zeilen: fehlend.map((m) => `kennzahlen: ${m}`) }
  if (neu !== text) writeFileSync(pfad, neu)
  return { code: 0, zeilen: [`kennzahlen: ${Object.keys(messeKennzahlen(wurzel, heute.stand)).length} Marker in ${DATEI} auf Stand ${heute.stand}`] }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, zeilen } = main(process.argv.slice(2), resolve(import.meta.dirname, '..'))
  console.log(zeilen.join('\n'))
  process.exitCode = code
}
