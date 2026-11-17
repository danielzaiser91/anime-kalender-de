/**
 * Liegegut für den Vorrat: eine `vergeben-*.md` (daniel-zum-abarbeiten/vorrat/, git-ausgeschlossen, nur im Hauptordner) länger als
 * VERGEBEN_H vergeben, ohne dass ein offener PR zu ihr gehört, ist ein liegender Auftrag (14.11.2026: sechs Dateien seit 12./13.11. ohne PR).
 * „Vergeben seit“: Uhrzeit in der Zeile `**Vergeben:** … (TT.MM. HH:MM)` (so schreibt `vergebenZeile` in cloud-auftraege.mjs), sonst mtime der Datei
 * (die Zeile entsteht beim Vergeben, die Datei wird danach selten angefasst). Zuordnung zum PR: nur über PR-Links der Vergeben-Zeile
 * (dieselbe Regel wie `.claude/hooks/vorrat-erledigt.js`); Zweignamen und Routinen-Register verknüpfen nicht belastbar, dann gilt „PR prüfen“.
 * Fehlt der Ordner (CI, Cloud), bleibt es still. Hinweisgeber, kein Tor.
 */
import fs from 'node:fs'
import path from 'node:path'

export const VERGEBEN_H = 24
const STUNDE = 3600 * 1000
const VERGEBEN = /^vergeben-.+\.md$/
const VERGEBEN_ZEILE = /^\*\*Vergeben:\*\*.*$/m
const PR_LINK = /\/pull\/(\d+)/g
const ZEIT = /\((\d{1,2})\.(\d{1,2})\.\s+(\d{1,2}):(\d{2})\)/

/** Versatz Europe/Berlin gegen UTC in ms an einem UTC-Zeitpunkt. */
function berlinVersatz(utcMs) {
  const optionen = { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }
  const t = Object.fromEntries(new Intl.DateTimeFormat('en-US', optionen).formatToParts(utcMs).map((p) => [p.type, Number(p.value)]))
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) - Math.floor(utcMs / 60000) * 60000
}

/** Zeitpunkt aus `(13.11. 14:43)` (Berlin, Jahr aus `jetzt`, nie in der Zukunft) oder null. */
export function zeitAusZeile(zeile, jetzt) {
  const m = ZEIT.exec(zeile)
  if (!m) return null
  const jahr = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(jetzt))
  const roh = (j) => Date.UTC(j, Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]))
  const ms = (j) => roh(j) - berlinVersatz(roh(j))
  return ms(jahr) > jetzt ? ms(jahr - 1) : ms(jahr)
}

/** Fundtext einer Datei oder null: Alter über der Grenze, und keine PR-Nummer der Vergeben-Zeile ist offen (leer = keine Verknüpfung). */
export function dateiFund(name, text, mtimeMs, offene, jetzt) {
  const zeile = VERGEBEN_ZEILE.exec(text)?.[0] ?? ''
  const seit = zeitAusZeile(zeile, jetzt) ?? mtimeMs
  if (jetzt - seit <= VERGEBEN_H * STUNDE) return null
  const alter = Math.floor((jetzt - seit) / STUNDE)
  const nummern = [...zeile.matchAll(PR_LINK)].map((m) => Number(m[1]))
  if (nummern.some((n) => offene.has(n))) return null
  const grund = nummern.length ? `PR ${nummern.map((n) => `#${n}`).join(', ')} nicht offen` : 'kein PR-Link'
  return `${name} (${alter} h vergeben, ${grund} – PR prüfen)`
}

/** Fundtexte aller liegenden `vergeben-*.md`; fehlt der Ordner, leer. `offene` = Set der offenen PR-Nummern. */
export function vorratFunde(ordner, offene, jetzt) {
  if (!fs.existsSync(ordner)) return []
  return fs.readdirSync(ordner).filter((n) => VERGEBEN.test(n)).sort().flatMap((n) => {
    const datei = path.join(ordner, n)
    return dateiFund(n, fs.readFileSync(datei, 'utf8'), fs.statSync(datei).mtimeMs, offene, jetzt) ?? []
  })
}

/** Vorrat-Ordner des Hauptordners; `AK_VORRAT_ORDNER` überschreibt ihn (Tests). */
export const vorratOrdner = (haupt) => process.env.AK_VORRAT_ORDNER ?? path.join(haupt, 'daniel-zum-abarbeiten', 'vorrat')

/** Sammelzeile `LIEGT-VORRAT: …`; null ohne Funde. */
export const vorratZeile = (funde) => (funde.length ? `LIEGT-VORRAT: ${funde.join(', ')}` : null)

/** Sammelzeile für die Wachphase: null ohne Funde; ohne Vorrat-Ordner null und ohne gh-Aufruf. */
export function vorratMeldung(ghFn, haupt, jetzt) {
  const ordner = vorratOrdner(haupt)
  if (!fs.existsSync(ordner)) return null
  const offene = new Set(JSON.parse(ghFn(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number'])).map((p) => p.number))
  return vorratZeile(vorratFunde(ordner, offene, jetzt))
}
