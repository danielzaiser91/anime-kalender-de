/**
 * `tools/daten-pr-mergen.sh` mit Attrappe für `gh`: Die App mergt am Ruleset vorbei, also nur eigene, nicht aus einem Fork stammende Pull Requests,
 * die ausschließlich Pfade der Quellenliste ändern (Prüfer-Urteil PR 767). Alles andere endet rot und ohne Merge.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
/* Git Bash trennt PATH-Einträge an Doppelpunkten: „C:/x" muss dort „/c/x" heißen. */
const posix = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, l) => `/${l.toLowerCase()}`)

const dir = mkdtempSync(join(tmpdir(), 'daten-pr-mergen-'))
try {
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  const gemergt = join(dir, 'gemergt.txt')
  // Attrappe: Antworten kommen aus FALL (autor | fork | datei | ok); `pr merge` hält die Nummer fest.
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh
case "$1 $2" in
  "pr merge") echo "$3" >> "${posix(gemergt)}"; exit 0 ;;
esac
case "$7" in
  .mergeable) if [ "$FALL" = konflikt ] || [ "$FALL" = autor-konflikt ]; then echo CONFLICTING; else echo MERGEABLE; fi ;;
  .title) if [ "$FALL" = rot ]; then echo "[Prüfung rot] chore(data): Test"; else echo "chore(data): Test"; fi ;;
  .author.login) if [ "$FALL" = autor ] || [ "$FALL" = autor-konflikt ]; then echo "app/fremder"; else echo "app/anime-kalender-daten"; fi ;;
  .isCrossRepository) if [ "$FALL" = fork ]; then echo true; else echo false; fi ;;
  .files*) echo data/crunchyroll.json; echo data/adn-raw/a.json; if [ "$FALL" = datei ]; then echo .github/workflows/x.yml; fi ;;
esac
`,
  )
  chmodSync(join(bin, 'gh'), 0o755)

  const lauf = (fall) => {
    rmSync(gemergt, { force: true })
    const r = spawnSync('bash', ['tools/daten-pr-mergen.sh', '7'], {
      cwd: wurzel,
      encoding: 'utf8',
      env: { ...process.env, FALL: fall, PATH: `${posix(bin)}:${process.env.PATH}` },
    })
    return { status: r.status, out: `${r.stdout}${r.stderr}`, gemergt: existsSync(gemergt) }
  }

  const ok = lauf('ok')
  pruefe('eigener PR mit Pfaden der Quellenliste wird gemergt', ok.status === 0 && ok.gemergt, ok.out)
  for (const [fall, grund] of [['fork', /Fork/], ['datei', /workflows\/x\.yml/]]) {
    const r = lauf(fall)
    pruefe(`Fall „${fall}“: nicht gemergt, Lauf rot, PR-Nummer im Fehler`, r.status === 1 && !r.gemergt && /::error::Pull Request 7 wird nicht gemergt/.test(r.out) && grund.test(r.out), r.out)
  }
  const fremd = lauf('autor')
  pruefe('fremder Autor: nicht gemergt, Lauf bleibt grün, Warnung mit PR-Nummer und Autor', fremd.status === 0 && !fremd.gemergt && /::warning::Pull Request 7 übersprungen: Autor ist app\/fremder/.test(fremd.out), fremd.out)
  const fremdKonflikt = lauf('autor-konflikt')
  pruefe('fremder Autor mit Konflikt: ebenfalls nur Warnung, Lauf grün', fremdKonflikt.status === 0 && !fremdKonflikt.gemergt && /::warning::/.test(fremdKonflikt.out) && !/::error::/.test(fremdKonflikt.out), fremdKonflikt.out)
  const konflikt = lauf('konflikt')
  pruefe('Konflikt nach dem Auflösen: nicht gemergt, Lauf rot, PR-Nummer und Zustand im Fehler', konflikt.status === 1 && !konflikt.gemergt && /::error::Pull Request 7 bleibt offen \(CONFLICTING\)/.test(konflikt.out), konflikt.out)
  const rot = lauf('rot')
  pruefe('Marke „Prüfung rot“ im Titel: nicht gemergt, Lauf bleibt grün, Hinweis im Protokoll', rot.status === 0 && !rot.gemergt && /Pull Request 7 trägt die Marke/.test(rot.out), rot.out)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('daten-pr-mergen.sh: alle Zusicherungen gehalten.')
