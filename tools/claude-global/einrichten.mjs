#!/usr/bin/env node
/**
 * Richtet die globalen Claude-Regeln aus diesem Repo auf dem eigenen Rechner ein — für jedes
 * Projekt, nicht nur dieses. Das Repo ist ihre Quelle; `~/.claude/` ist nicht versioniert.
 *
 * - `CLAUDE-abschnitt.md` kommt als markierter Abschnitt in `~/.claude/CLAUDE.md`. Was dort
 *   sonst steht, bleibt unberührt; ein erneuter Lauf ersetzt nur den Abschnitt.
 * - `skills/*` wird nach `~/.claude/skills/` kopiert; eine abweichende Fassung dort wird vorher
 *   als `SKILL.md.bak` gesichert.
 *
 * Aufruf:
 *   node tools/claude-global/einrichten.mjs            einrichten bzw. aktualisieren
 *   node tools/claude-global/einrichten.mjs --pruefen  nur prüfen (Exit 1, wenn etwas fehlt/veraltet)
 * Ziel: $CLAUDE_CONFIG_DIR, sonst ~/.claude (unter Windows %USERPROFILE%\.claude).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const QUELLE = import.meta.dirname
const ZIEL = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
const NUR_PRUEFEN = process.argv.includes('--pruefen')
const ANFANG = '<!-- anime-kalender-de: globale Regeln, Anfang — verwaltet von tools/claude-global/einrichten.mjs -->'
const ENDE = '<!-- anime-kalender-de: globale Regeln, Ende -->'
const lies = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '')

function claudeMd() {
  const pfad = join(ZIEL, 'CLAUDE.md')
  const alt = lies(pfad)
  const block = `${ANFANG}\n${lies(join(QUELLE, 'CLAUDE-abschnitt.md')).trim()}\n${ENDE}`
  const a = alt.indexOf(ANFANG)
  const e = alt.indexOf(ENDE)
  const neu =
    a >= 0 && e > a ? alt.slice(0, a) + block + alt.slice(e + ENDE.length) : `${alt.trimEnd()}${alt ? '\n\n' : ''}${block}\n`
  if (neu === alt) return `ok      ${pfad}`
  if (NUR_PRUEFEN) return `FEHLT   ${pfad} (Abschnitt fehlt oder ist veraltet)`
  mkdirSync(ZIEL, { recursive: true })
  writeFileSync(pfad, neu)
  return `gesetzt ${pfad}`
}

function skills() {
  const ordner = join(QUELLE, 'skills')
  return readdirSync(ordner).map((name) => {
    const von = join(ordner, name, 'SKILL.md')
    const nach = join(ZIEL, 'skills', name, 'SKILL.md')
    if (lies(nach) === lies(von)) return `ok      ${nach}`
    if (NUR_PRUEFEN) return `FEHLT   ${nach} (fehlt oder weicht ab)`
    mkdirSync(join(ZIEL, 'skills', name), { recursive: true })
    if (existsSync(nach)) copyFileSync(nach, `${nach}.bak`)
    copyFileSync(von, nach)
    return `gesetzt ${nach}`
  })
}

const zeilen = [claudeMd(), ...skills()]
console.log(zeilen.join('\n'))
if (NUR_PRUEFEN && zeilen.some((z) => z.startsWith('FEHLT'))) process.exit(1)
