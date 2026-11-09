#!/usr/bin/env node
/**
 * UserPromptSubmit: meldet, wenn stand.md oder mockups/index.html (Daniels Sicht) veraltet wirkt
 * (Daniel, 09.10.2026; seit 10.10.2026 nur noch stand.md mit „Daniel-Todo“ / „In Arbeit“ / „Als Nächstes“).
 *
 * Still, solange alles stimmt. Prüft nur, was sich ohne Urteil messen lässt:
 *  1. stand.md ist deutlich älter als die jüngste Arbeit in agenten/ und berichte/. (index.html nicht:
 *     sie ändert sich nur bei Mockup-Ereignissen, die 3. und die OFFEN-Prüfung unten decken.)
 *  2. stand.md: Zeitstempel „Aktualisiert“ älter als 60 Minuten; „wartet auf <Datum>“ liegt in der Vergangenheit;
 *     der Abschnitt „Daniel-Todo“ nennt Entschiedenes oder Erledigtes.
 *  3. mockups/: eine Mockup-Datei im Ordner, die index.html nicht kennt (landet bei Daniel nie).
 *  4. stand.md: offener PR ohne Zeile mit `pull/N` oder `PR N` (gh, 15 min zwischengespeichert).
 * Das Urteil (was genau zu ändern ist) bleibt bei der Sitzung; Skill `daniel-dateien-pflegen`.
 * Dieselbe Meldung kommt je Sitzung nur einmal; sie kehrt erst zurück, wenn sich ihr Inhalt ändert
 * (Minutenzahlen zählen nicht) oder zwischendurch nichts zu melden war.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const WURZEL = process.env.DANIEL_ORDNER || 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten'
const STAND = process.env.DANIEL_DATEIEN_STAND || join(homedir(), '.claude', 'hooks', 'state', 'daniel-dateien.mjson')
const MIN = 60_000
const MAX_SITZUNGEN = 20

function mtime(p) {
  try { return statSync(p).mtimeMs } catch { return 0 }
}
function neuesteIn(ordner) {
  let m = 0
  try {
    for (const e of readdirSync(ordner, { withFileTypes: true })) {
      const p = join(ordner, e.name)
      m = Math.max(m, e.isDirectory() ? 0 : mtime(p))
    }
  } catch { /* Ordner fehlt */ }
  return m
}
function lies(p) {
  try { return readFileSync(p, 'utf8') } catch { return '' }
}

/** Inhalt der Funde ohne Minutenzahlen: gleiche Lage = gleiche Kennung. */
export const kennung = (funde) => funde.map((f) => f.replace(/\d+ min/g, 'N min')).join('|')

/** Meldet die Funde nur, wenn sich ihre Kennung in dieser Sitzung geändert hat. */
function nurNeue(funde, sitzung, stand = STAND) {
  let karte = {}
  try { karte = JSON.parse(readFileSync(stand, 'utf8')) } catch { /* erster Lauf */ }
  const neu = kennung(funde)
  const gleich = karte[sitzung]?.kennung === neu
  delete karte[sitzung] // ans Ende der Reihenfolge, Älteste fallen heraus
  karte[sitzung] = { kennung: neu }
  for (const alt of Object.keys(karte).slice(0, -MAX_SITZUNGEN)) delete karte[alt]
  try {
    mkdirSync(dirname(stand), { recursive: true })
    writeFileSync(stand, JSON.stringify(karte))
  } catch { /* ohne Merker kommt die Meldung eben öfter */ }
  return !gleich
}

/** Meldetext oder leer; der Bündel-Dispatcher ruft das im selben Prozess auf. */
export function lauf(input = {}) {
try {
  const funde = sammleFunde()
  if (!nurNeue(funde, input.session_id || 'unbekannt')) return ''
  return funde.length ? `[Daniel-Dateien veraltet? ${funde.join(' · ')} — vor der Antwort beheben (Skill daniel-dateien-pflegen)]` : ''
} catch {
  return '' /* Nie stören. */
}
}

/**
 * Offene PRs ohne Verweis (`pull/N` oder `PR N`) in stand.md: 14 PRs waren dort unsichtbar, nachdem
 * der Kopf von „In Arbeit“ in einen Bericht ausgelagert wurde, einer davon Daniels Kachelrand-Auftrag (18.10.2026).
 */
export function prsOhneEintrag(stand, prs) {
  const fehlen = prs.filter((p) => !new RegExp(`(pull/|\\bPR ?)${p.number}\\b`).test(stand))
  if (!fehlen.length) return []
  return [`stand.md: ${fehlen.length} offene PRs ohne Eintrag (${fehlen.slice(0, 8).map((p) => `${p.number} ${p.title.slice(0, 40)}`).join('; ')}${fehlen.length > 8 ? '; …' : ''}) — je PR eine Zeile mit Link unter „In Arbeit“`]
}

const PR_CACHE = join(homedir(), '.claude', 'hooks', 'state', 'offene-prs.json')
/** gh-Abfrage höchstens alle 15 min, damit der Hook schnell bleibt; ohne gh oder Netz: leer. */
function offenePrs(jetzt) {
  try {
    const c = JSON.parse(readFileSync(PR_CACHE, 'utf8'))
    if (jetzt - c.t < 15 * MIN) return c.prs
  } catch { /* erster Lauf */ }
  try {
    const out = execFileSync('gh', ['pr', 'list', '--repo', 'danielzaiser91/anime-kalender-de', '--state', 'open', '--limit', '100', '--json', 'number,title'], { encoding: 'utf8', timeout: 8000, windowsHide: true })
    const prs = JSON.parse(out)
    writeFileSync(PR_CACHE, JSON.stringify({ t: jetzt, prs }))
    return prs
  } catch { return [] }
}

/** Top-Prio auf {arbeit-agent}, deren jüngste Uhrzeit über 2 h zurückliegt: Der Agent ist meist längst fertig (Daniel, 17.10.2026). */
export function alteAgentenPrios(stand, jetzt) {
  const funde = []
  for (const m of stand.matchAll(/^- \*\*([^*]+)\*\* \{arbeit-agent\}(.*)$/gm)) {
    let juengste = 0
    for (const u of m[2].matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)) {
      const d = new Date(jetzt); d.setHours(+u[1], +u[2], 0, 0)
      if (d.getTime() > jetzt) d.setDate(d.getDate() - 1) // Uhrzeit ohne Datum: liegt sie in der Zukunft, war es gestern.
      juengste = Math.max(juengste, d.getTime())
    }
    if (!juengste || jetzt - juengste > 120 * MIN) funde.push(`stand.md: Top-Prio „${m[1]}“ steht auf arbeit-agent, jüngste Uhrzeit ${juengste ? Math.round((jetzt - juengste) / MIN) + ' min alt' : 'fehlt'} — läuft wirklich ein Agent?`)
  }
  return funde
}

/**
 * Windows-Pfad als Text in Markdown ohne Backticks: `\_` und `\*` sind Escapes, die Vorschau zeigt „C:\code\ai__assets“,
 * Daniels Kopie scheitert (E42, 04.11.2026). Code-Blöcke und Code-Spans zählen nicht; `file:///`-Links haben keinen Rückstrich.
 */
export function pfadeOhneBackticks(text, name) {
  const ohneCode = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '')
  const treffer = ohneCode.match(/\b[A-Za-z]:\\[^\s)\]|]+/g) ?? []
  return treffer.length ? [`${name}: ${treffer.length} Windows-Pfade ohne Backticks (${treffer.slice(0, 2).join('; ')}) — in Backticks setzen`] : []
}

function fragenPfadFunde() {
  const ordner = join(WURZEL, 'fragen')
  let namen = []
  try { namen = readdirSync(ordner).filter((n) => n.endsWith('.md')) } catch { /* kein Ordner */ }
  return namen.flatMap((n) => pfadeOhneBackticks(lies(join(ordner, n)), `fragen/${n}`))
}

export function sammleFunde() {
  if (!existsSync(WURZEL)) return []
  const jetzt = Date.now()
  const dateien = { 'stand.md': join(WURZEL, 'stand.md'), 'mockups/index.html': join(WURZEL, 'mockups', 'index.html') }
  const arbeit = Math.max(neuesteIn(join(WURZEL, 'agenten')), neuesteIn(join(WURZEL, 'berichte')))
  const funde = []

  const t0 = mtime(dateien['stand.md'])
  if (arbeit && t0 && arbeit - t0 > 25 * MIN) funde.push(`stand.md ist ${Math.round((arbeit - t0) / MIN)} min älter als die jüngste Arbeit in agenten/berichte`)

  const stand = lies(dateien['stand.md'])
  // stand.md schreibt seit Oktober 2026 ISO (2026-10-17 00:17); die alte Form TT.MM.JJJJ zählt weiter.
  const iso = /Aktualisiert:\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(stand)
  const alt = /Aktualisiert:\s*(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/.exec(stand)
  const stempel = iso ? [iso[1], iso[2], iso[3], iso[4], iso[5]] : alt ? [alt[3], alt[2], alt[1], alt[4], alt[5]] : null
  if (stempel) {
    const t = new Date(+stempel[0], +stempel[1] - 1, +stempel[2], +stempel[3], +stempel[4]).getTime()
    if (jetzt - t > 60 * MIN) funde.push(`stand.md: Stempel „Aktualisiert“ ist ${Math.round((jetzt - t) / MIN)} min alt`)
  }
  funde.push(...alteAgentenPrios(stand, jetzt))
  funde.push(...prsOhneEintrag(stand, offenePrs(jetzt)))
  funde.push(...topPrioZeilenbruch(stand))
  funde.push(...pfadeOhneBackticks(stand, 'stand.md'), ...fragenPfadFunde())
  const heute = new Date(jetzt); heute.setHours(0, 0, 0, 0)
  for (const m of stand.matchAll(/wartet auf[^.\n]*?(\d{2})\.(\d{2})\.(?:(\d{4}))?/gi)) {
    const t = new Date(m[3] ? +m[3] : heute.getFullYear(), +m[2] - 1, +m[1]).getTime()
    if (t < heute.getTime()) funde.push(`stand.md: „${m[0].slice(0, 60)}“ liegt in der Vergangenheit — messen und Zeile erledigen oder fortschreiben`)
  }
  const daniel_todo = /## Daniel-Todo([\s\S]*?)(?=\n## |$)/.exec(stand)
  if (daniel_todo && /entschieden|erledigt|gemergt|gebaut/i.test(daniel_todo[1])) funde.push('stand.md, „Daniel-Todo“ nennt Entschiedenes/Erledigtes — streichen, Ergebnis gehört in „In Arbeit“ oder die Release-Notes-Abschnitte')

  const index = lies(dateien['mockups/index.html'])
  const offeneMockups = /var OFFEN = \[(?!\s*\])([\s\S]*?)\n  \]/.exec(index)
  // Seit 10.10.2026 ohne Nummern (`- 🟠 …`); alte Nummernzeilen zählen weiter.
  const vonDirLeer = daniel_todo && !/^\s*(?:\d+\.|-) /m.test(daniel_todo[1])
  if (offeneMockups && offeneMockups[1].trim() && vonDirLeer) funde.push('mockups/index.html hat Einträge unter OFFEN, aber „Daniel-Todo“ in stand.md ist leer — jede offene Wahl braucht eine Zeile mit Link')
  // Keine Prüfung „nicht im Navigator“ mehr: der Navigator liest seit PR 1605 (19.10.2026) aus dem Board, nicht aus index.html.

  return funde
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const text = lauf()
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }))
}

/** Top-Prios: Leerzeile oder Absatz ohne „- “ zerreißt den Eintrag, die Mod zeigt dann Knöpfe ohne Titel (18.10.2026). */
export function topPrioZeilenbruch(stand) {
  const block = /^## Top-Prios[^\n]*\n([\s\S]*?)(?=^## )/m.exec(stand)?.[1] ?? ''
  const falsch = block.split('\n').slice(0, -1).filter((z) => !/^\s*- /.test(z))
  return falsch.length ? [`stand.md: ${falsch.length} Zeilen in „Top-Prios“ ohne „- “ (Leerzeile/Absatz) — Mod zeigt verwaiste Knöpfe; zu einer Zeile zusammenziehen`] : []
}
