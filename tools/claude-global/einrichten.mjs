#!/usr/bin/env node
/**
 * Richtet die globalen Claude-Regeln aus diesem Repo auf dem eigenen Rechner ein — für jedes
 * Projekt, nicht nur dieses. Das Repo ist ihre Quelle; `~/.claude/` ist nicht versioniert.
 *
 * - `rules/*.md` wird nach `~/.claude/rules/` kopiert (dort lädt Claude Code jede Datei bei
 *   Sitzungsstart; `~/.claude/CLAUDE.md` bleibt unberührt, es verweist nur).
 * - `skills/*` wird nach `~/.claude/skills/` kopiert.
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
 * Ziel: $CLAUDE_CONFIG_DIR, sonst ~/.claude (unter Windows %USERPROFILE%\.claude).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const QUELLE = import.meta.dirname
const ZIEL = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
const NUR_PRUEFEN = process.argv.includes('--pruefen')
const lies = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '')

/** Kopiert `relativ` aus dem Repo nach `~/.claude`, sofern es dort fehlt oder abweicht. */
function kopiere(relativ) {
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

const zeilen = [
  ...readdirSync(join(QUELLE, 'rules')).map((datei) => kopiere(join('rules', datei))),
  ...readdirSync(join(QUELLE, 'skills')).map((name) => kopiere(join('skills', name, 'SKILL.md'))),
  ...dateienUnter(join('mods', 'arbeitsliste')).map(kopiere),
  ...readdirSync(join(QUELLE, 'hooks')).filter((datei) => datei.endsWith('.js')).map((datei) => kopiere(join('hooks', datei))),
]
console.log(zeilen.join('\n'))
if (NUR_PRUEFEN && zeilen.some((z) => z.startsWith('FEHLT'))) process.exit(1)
