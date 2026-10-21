/**
 * `tools/quellen-pr.sh` gegen einen lokalen Ursprung mit Attrappe für `gh`: Der Pull-Request-Zweig entsteht aus den eigenen Änderungen auf dem jüngsten Stand, und eine
 * abgelehnte erste Übertragung (GitHub verweigert Zweige mit abweichenden Workflow-Dateien) wird neu aufgesetzt statt als Verlust des Laufs zu enden.
 * Anlass (05.10.2026): Der Wochenlauf verlor am Ende 107 Minuten Abrufe, weil ein Workflow auf main geändert worden war.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const sh = (cwd, befehl, env = {}) => {
  const r = spawnSync('bash', ['-c', befehl], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}
const git = 'git -c user.name=t -c user.email=t@t'
/* Git Bash trennt PATH-Einträge an Doppelpunkten: „C:/x" muss dort „/c/x" heißen. */
const posix = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, l) => `/${l.toLowerCase()}`)

const dir = mkdtempSync(join(tmpdir(), 'quellen-pr-'))
try {
  const ursprung = join(dir, 'ursprung.git')
  const lauf = join(dir, 'lauf')
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  sh(dir, 'git init -q --bare -b main ursprung.git && git clone -q ursprung.git lauf 2>/dev/null')

  // Der Ursprung lehnt die erste Übertragung eines Zweigs ab (Attrappe für „refusing to allow a GitHub App to create or update workflow …").
  mkdirSync(join(ursprung, 'hooks'), { recursive: true })
  writeFileSync(join(ursprung, 'hooks/pre-receive'), '#!/bin/sh\nif [ -f "$GIT_DIR/ablehnen" ]; then rm "$GIT_DIR/ablehnen"; echo "abgelehnt (Attrappe)" >&2; exit 1; fi\nexit 0\n')
  chmodSync(join(ursprung, 'hooks/pre-receive'), 0o755)

  // Attrappe für gh: legt nichts an, antwortet MERGEABLE, merge gelingt nur mit --admin (Bypass der App im Ruleset).
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh
case "$1 $2" in
  "pr create") echo "https://github.com/x/y/pull/99" ;;
  "pr view") echo "MERGEABLE" ;;
  "pr merge") case "$*" in *--admin*) ;; *) echo "To use administrator privileges to immediately merge the pull request, add the --admin flag." >&2; exit 1 ;; esac
    if [ ! -f "$(dirname "$0")/schon-einmal" ]; then : > "$(dirname "$0")/schon-einmal"; echo "GraphQL: Base branch was modified." >&2; exit 1; fi; exit 0 ;;
esac
`,
  )
  chmodSync(join(bin, 'gh'), 0o755)

  mkdirSync(join(lauf, 'data'), { recursive: true })
  mkdirSync(join(lauf, 'tools'), { recursive: true })
  for (const datei of ['quellen-liste.sh', 'quellen-aufsetzen.sh', 'quellen-pr.sh', 'quellen-pruefen.sh', 'health-vereinen.mjs', 'dub-belege-vereinen.mjs'])
    copyFileSync(join(wurzel, 'tools', datei), join(lauf, 'tools', datei))
  writeFileSync(join(lauf, 'data/anisearch.json'), '{"v":1}')
  sh(lauf, `git add -A && ${git} commit -q -m start && git push -q origin HEAD:main`)

  // Der Lauf ändert eine Quelle, eine zweite Person (der Fernstand) bewegt main in der Zwischenzeit.
  writeFileSync(join(lauf, 'data/anisearch.json'), '{"v":2}')
  writeFileSync(join(lauf, 'data/cinestar.json'), '{"neu":true}')
  const anderer = join(dir, 'anderer')
  sh(dir, 'git clone -q ursprung.git anderer 2>/dev/null')
  writeFileSync(join(anderer, 'README.md'), 'fremd')
  sh(anderer, `git add -A && ${git} commit -q -m fremd && git push -q origin HEAD:main`)

  writeFileSync(join(ursprung, 'ablehnen'), '')
  const ausgabeDatei = join(dir, 'ausgabe.txt')
  writeFileSync(ausgabeDatei, '')
  const r = sh(lauf, `PATH="${posix(bin)}:$PATH" GITHUB_OUTPUT="${posix(ausgabeDatei)}" GITHUB_RUN_ID=77 QUELLEN_PRUEFBEFEHL=true bash tools/quellen-pr.sh "chore(data): Test"`, {})
  const knapp = r.out.split('\n').filter((z) => !z.includes('übersprungen (nicht vorhanden)')).join('\n').slice(-1800)
  pruefe('das Skript endet mit Erfolg', r.status === 0, `${r.status} ${knapp}`)
  pruefe('die abgelehnte erste Übertragung wird gemeldet und neu aufgesetzt', /Push abgelehnt \(Versuch 1 von 3\)/.test(r.out), r.out.slice(-400))
  pruefe('ein Merge, der an „Base branch was modified" scheitert, wird wiederholt', /Merge-Versuch 1 von 6 abgelehnt/.test(r.out), r.out.slice(-400))
  const ausgabe = readFileSync(ausgabeDatei, 'utf8')
  pruefe('der Pull Request ist angelegt und gemergt', /pr=99/.test(ausgabe) && /gemerged=true/.test(ausgabe), ausgabe)
  const zweige = sh(ursprung, 'git branch --list "daten/*"').out.trim()
  pruefe('der Zweig steht im Ursprung', /daten\/77-/.test(zweige), zweige)
  const zweig = zweige.replace(/^\*?\s*/, '').split('\n')[0]
  const inhalt = sh(ursprung, `git show ${zweig}:data/anisearch.json`).out.trim()
  const dateien = sh(ursprung, `git diff --name-only main ${zweig}`).out.trim().split('\n').sort()
  pruefe('der Zweig trägt die eigene Änderung', inhalt === '{"v":2}', inhalt)
  pruefe('der Zweig liegt auf dem jüngsten main: nur die eigenen Dateien unterscheiden ihn', dateien.join(',') === 'data/anisearch.json,data/cinestar.json', dateien)

  // Anmeldung der Claude-Läufe: Token in der Remote-Adresse; insteadOf (nur in der Umgebung, nicht in .git/config) lenkt sie auf den lokalen Ursprung.
  const mitToken = 'https://x-access-token:geheim@github.com/x/y.git'
  sh(lauf, `git remote set-url origin "${mitToken}"`)
  pruefe('Vorbedingung: das Token steht in .git/config', readFileSync(join(lauf, '.git/config'), 'utf8').includes('geheim'))
  const umlenken = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.${posix(ursprung)}.insteadOf`, GIT_CONFIG_VALUE_0: mitToken }
  const r2 = sh(lauf, `PATH="${posix(bin)}:$PATH" GITHUB_RUN_ID=78 QUELLEN_PRUEFBEFEHL=true bash tools/quellen-pr.sh "chore(data): Test 2"`, umlenken)
  pruefe('zweiter Lauf über die Token-Adresse endet mit Erfolg', r2.status === 0, r2.out.slice(-600))
  const remote = sh(lauf, 'git config --get remote.origin.url').out.trim()
  pruefe('nach dem Lauf steht das Token nicht mehr in .git/config', !readFileSync(join(lauf, '.git/config'), 'utf8').includes('geheim') && remote === 'https://github.com/x/y.git', remote)

  // Lokaler Aufruf ohne Lauf-Kennung (Daniels Rechner): kein `daten/`-Zweig, den Kette und CI-Prüfer überspringen.
  sh(lauf, `git remote set-url origin "${posix(ursprung)}"`)
  writeFileSync(join(lauf, 'data/cinestar.json'), '{"neu":"lokal"}')
  const r3 = sh(lauf, `env -u GITHUB_RUN_ID PATH="${posix(bin)}:$PATH" QUELLEN_PRUEFBEFEHL=true bash tools/quellen-pr.sh "chore(data): Test 3"`, {})
  pruefe('lokaler Aufruf endet mit Erfolg', r3.status === 0, r3.out.slice(-600))
  const lokal = sh(ursprung, 'git branch --list "fix/lokal-*"').out.trim()
  pruefe('lokaler Aufruf legt einen Zweig fix/lokal-… an', /fix\/lokal-\d{8}-\d{4}/.test(lokal), lokal)
  const daten = sh(ursprung, 'git branch --list "daten/*"').out
  pruefe('lokaler Aufruf legt keinen daten/-Zweig an', !/daten\/lokal/.test(daten), daten)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('quellen-pr.sh: alle Zusicherungen gehalten.')
