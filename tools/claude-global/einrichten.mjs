#!/usr/bin/env node
/**
 * Richtet die globalen Claude-Regeln aus diesem Repo auf dem eigenen Rechner ein — für jedes
 * Projekt, nicht nur dieses. Das Repo ist ihre Quelle; `~/.claude/` ist nicht versioniert.
 *
 * - `rules/*.md` wird nach `~/.claude/rules/` kopiert (dort lädt Claude Code jede Datei bei
 *   Sitzungsstart; `~/.claude/CLAUDE.md` bleibt unberührt, es verweist nur).
 * - `agents/*.md` (ohne den Unterordner `archiv/`) wird nach `~/.claude/agents/` kopiert.
 * - `skills/*` (alle Dateien je Skill) wird nach `~/.claude/skills/` kopiert.
 * - `mods/arbeitsliste/` (Quelltext der Claude-Code-Mod, die `daniel-zum-abarbeiten/stand.md` anzeigt)
 *   wird rekursiv nach `~/.claude/mods/arbeitsliste/` kopiert. Hier wird sie gepflegt; prüfen mit
 *   `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test` im Mod-Ordner. Nicht im Repo und am
 *   Ziel unberührt bleiben `messung.log` (Laufzeit) und `.claude-plugin/types/` (erzeugt Claude Code).
 * - `hooks/*.js` wird nach `~/.claude/hooks/` kopiert (der Eintrag in `~/.claude/settings.json` bleibt Handarbeit). Die
 *   `hooks/package.json` (commonjs) bleibt im Repo: Am Ziel sind `.js`-Hooks ohnehin CommonJS.
 * Eine abweichende Fassung am Ziel wird vorher als `.bak` gesichert.
 *
 * Aufruf:
 *   node tools/claude-global/einrichten.mjs            einrichten bzw. aktualisieren
 *   node tools/claude-global/einrichten.mjs --pruefen  nur prüfen (Exit 1, wenn etwas fehlt/veraltet)
 *   node tools/claude-global/einrichten.mjs --einsammeln  Gegenrichtung: holt die Fassung aus ~/.claude ins Repo
 *     (nur Dateien, die das Repo schon verwaltet; nichts wird gelöscht oder neu angelegt), danach als PR einreichen.
 *     Ist die Repo-Fassung neuer (letzter Commit oder ungesicherte Änderung jünger als die Zieldatei), bleibt sie: "UEBERSPRUNGEN".
 *   ... --einsammeln --neue-skills  nimmt zusätzlich Skills (samt Unterordnern) auf, die nur am Ziel liegen, außer den in
 *     `skills-ausschluss.json` (`{ name: Grund }`) geführten: Das Repo ist öffentlich, dort steht, was nicht hinein darf.
 *   --help / -h  Kurzhilfe, schreibt nichts (Exit 0). Unbekannte Schalter: Exit 2, nichts geschrieben.
 * Ziel: $CLAUDE_CONFIG_DIR, sonst ~/.claude (unter Windows %USERPROFILE%\.claude).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { pruefeSavvyHaken } from './savvy-haken.mjs'

const SCHALTER = ['--pruefen', '--einsammeln', '--neue-skills', '--help', '-h']
const HILFE = `Aufruf: node tools/claude-global/einrichten.mjs [Schalter]
  (ohne)          einrichten bzw. aktualisieren
  --pruefen       nur prüfen (Exit 1, wenn etwas fehlt/veraltet)
  --einsammeln    Gegenrichtung: holt Dateien aus dem Ziel ins Repo
  --neue-skills   nur mit --einsammeln: nimmt zusätzlich neue Skills auf
  --help, -h      diese Hilfe`

/** Prüft die Schalter, bevor etwas angefasst wird: Hilfe → Exit 0, Unbekanntes oder `--neue-skills` allein → Exit 2. */
function pruefeSchalter(args) {
  if (args.some((a) => a === '--help' || a === '-h')) {
    console.log(HILFE)
    process.exit(0)
  }
  const unbekannt = args.filter((a) => !SCHALTER.includes(a))
  const lose = args.includes('--neue-skills') && !args.includes('--einsammeln')
  if (unbekannt.length === 0 && !lose) return
  console.error(unbekannt.length ? `Unbekannter Schalter: ${unbekannt.join(' ')}` : '--neue-skills gilt nur zusammen mit --einsammeln')
  console.error(`Nichts geschrieben.\n${HILFE}`)
  process.exit(2)
}
pruefeSchalter(process.argv.slice(2))

const QUELLE = import.meta.dirname
const ZIEL = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
const NUR_PRUEFEN = process.argv.includes('--pruefen')
const EINSAMMELN = process.argv.includes('--einsammeln')
const NEUE_SKILLS = EINSAMMELN && process.argv.includes('--neue-skills')
const lies = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '')

/** Sekunden seit 1970, seit denen die Repo-Datei ihren Stand hat: Zeit des letzten Commits, bei ungesicherter Änderung ihre Änderungszeit. 0 ohne git. */
function repoStandSekunden(nach) {
  const git = (...args) => {
    try {
      return execFileSync('git', ['-C', QUELLE, ...args, '--', nach], { encoding: 'utf8', timeout: 20000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      return ''
    }
  }
  if (git('status', '--porcelain')) return statSync(nach).mtimeMs / 1000
  return Number(git('log', '-1', '--format=%ct')) || 0
}

/** Holt `relativ` aus `~/.claude` ins Repo, nur wenn es dort existiert und abweicht; eine neuere Repo-Fassung bleibt stehen. */
function sammle(relativ) {
  const von = join(ZIEL, relativ)
  const nach = join(QUELLE, relativ)
  if (!existsSync(von)) return `fehlt   ${von} (am Ziel nicht vorhanden, Repo bleibt)`
  if (lies(nach) === lies(von)) return `ok      ${nach}`
  if (existsSync(nach) && repoStandSekunden(nach) > statSync(von).mtimeMs / 1000) return `UEBERSPRUNGEN ${nach} (Repo neuer als ${von})`
  mkdirSync(dirname(nach), { recursive: true })
  copyFileSync(von, nach)
  return `geholt  ${nach}`
}

/** Kopiert `relativ` aus dem Repo nach `~/.claude`, sofern es dort fehlt oder abweicht. */
function kopiere(relativ) {
  if (EINSAMMELN) return sammle(relativ)
  const von = join(QUELLE, relativ)
  const nach = join(ZIEL, relativ)
  if (lies(nach) === lies(von)) return `ok      ${nach}`
  if (NUR_PRUEFEN) return `FEHLT   ${nach} (fehlt oder weicht ab)`
  mkdirSync(dirname(nach), { recursive: true })
  if (existsSync(nach)) copyFileSync(nach, `${nach}.bak`)
  copyFileSync(von, nach)
  return `gesetzt ${nach}`
}

/** Alle Dateien unter `relativ` im Repo, als Pfade relativ zu `claude-global`. */
function dateienUnter(relativ) {
  return readdirSync(join(QUELLE, relativ), { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(relativ, eintrag.name)
    return eintrag.isDirectory() ? dateienUnter(pfad) : [pfad]
  })
}

/** Skills, die bewusst nicht ins (öffentliche) Repo kommen: `{ name: Grund }`. */
const AUSSCHLUSS = JSON.parse(readFileSync(join(QUELLE, 'skills-ausschluss.json'), 'utf8'))

/** Dateien unter `relativ` in `wurzel`, als Pfade relativ zu ihr. */
function dateienIn(wurzel, relativ) {
  if (!existsSync(join(wurzel, relativ))) return []
  return readdirSync(join(wurzel, relativ), { withFileTypes: true }).filter((eintrag) => !eintrag.name.startsWith('.') && !eintrag.name.includes('.bak')).flatMap((eintrag) => {
    const pfad = join(relativ, eintrag.name)
    return eintrag.isDirectory() ? dateienIn(wurzel, pfad) : [pfad]
  })
}

/** Dateien eines Skills (alle Unterordner); mit `--neue-skills` auch die, die nur am Ziel liegen. */
function skillDateien(name) {
  const pfad = join('skills', name)
  return [...new Set([...dateienIn(QUELLE, pfad), ...(NEUE_SKILLS ? dateienIn(ZIEL, pfad) : [])])]
}

/** Verwaltete Skills: die im Repo, mit `--neue-skills` auch alle am Ziel; nie die ausgeschlossenen. */
function skillNamen() {
  const ordner = (wurzel) => (existsSync(join(wurzel, 'skills')) ? readdirSync(join(wurzel, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name) : [])
  return [...new Set([...ordner(QUELLE), ...(NEUE_SKILLS ? ordner(ZIEL) : [])])].filter((name) => !Object.hasOwn(AUSSCHLUSS, name)).sort()
}

const zeilen = [
  ...readdirSync(join(QUELLE, 'agents')).filter((datei) => datei.endsWith('.md')).map((datei) => kopiere(join('agents', datei))),
  ...readdirSync(join(QUELLE, 'rules')).map((datei) => kopiere(join('rules', datei))),
  ...skillNamen().flatMap((name) => skillDateien(name).map(kopiere)),
  ...dateienUnter(join('mods', 'arbeitsliste')).map(kopiere),
  ...readdirSync(join(QUELLE, 'hooks')).filter((datei) => datei.endsWith('.js')).map((datei) => kopiere(join('hooks', datei))),
]
if (!EINSAMMELN) zeilen.push(pruefeSavvyHaken(ZIEL).zeile)
console.log(zeilen.join('\n'))
if (NUR_PRUEFEN && zeilen.some((z) => z.startsWith('FEHLT'))) process.exit(1)
