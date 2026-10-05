/**
 * `quellen_aufsetzen` (tools/quellen-aufsetzen.sh): Ein Lauf legt nach dem Aufsetzen auf den Fernstand nur zurück, was er selbst geändert hat.
 * Anlass (05.10.2026): Der alte Reset überschrieb Quelldateien, die ein anderer Lauf inzwischen aktualisiert hatte.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const sh = (cwd, befehl) => {
  const r = spawnSync('bash', ['-c', befehl], { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${befehl}\n${r.stdout}\n${r.stderr}`)
  return r.stdout
}
const git = 'git -c user.name=t -c user.email=t@t'

const dir = mkdtempSync(join(tmpdir(), 'aufsetzen-'))
try {
  const ursprung = join(dir, 'ursprung.git')
  const lauf = join(dir, 'lauf')
  const anderer = join(dir, 'anderer')
  sh(dir, `git init -q --bare -b main ursprung.git && git clone -q ursprung.git lauf 2>/dev/null && git clone -q ursprung.git anderer 2>/dev/null`)

  // Ausgangsstand: vier Quellen, ein Archivordner, die Gesundheitsdatei.
  const schreibe = (basis, pfad, inhalt) => {
    mkdirSync(dirname(join(basis, pfad)), { recursive: true })
    writeFileSync(join(basis, pfad), inhalt)
  }
  for (const [pfad, inhalt] of [
    ['data/anisearch.json', '{"v":1}'],
    ['data/cinestar.json', '{"v":1}'],
    ['data/adn-raw/a.json.gz', 'a1'],
    ['data/adn-raw/b.json.gz', 'b1'],
    ['data/source-health.json', JSON.stringify({ alt: { lastRun: '2026-10-01T00:00:00Z' }, adn: { lastRun: '2026-10-01T00:00:00Z' } })],
  ])
    schreibe(lauf, pfad, inhalt)
  for (const datei of ['quellen-liste.sh', 'quellen-aufsetzen.sh', 'health-vereinen.mjs', 'dub-belege-vereinen.mjs']) {
    mkdirSync(join(lauf, 'tools'), { recursive: true })
    copyFileSync(join(wurzel, 'tools', datei), join(lauf, 'tools', datei))
  }
  sh(lauf, `git add -A && ${git} commit -q -m start && git push -q origin HEAD:main`)

  // Der Lauf startet hier und ändert: anisearch.json (eigene Datei), eine neue Archivdatei, löscht adn-raw/b, trägt "cinestar" in die Gesundheit ein.
  sh(anderer, 'git pull -q origin main')
  schreibe(lauf, 'data/anisearch.json', '{"v":2,"von":"lauf"}')
  schreibe(lauf, 'data/adn-raw/c.json.gz', 'c-lauf')
  rmSync(join(lauf, 'data/adn-raw/b.json.gz'))
  schreibe(lauf, 'data/source-health.json', JSON.stringify({ alt: { lastRun: '2026-10-01T00:00:00Z' }, adn: { lastRun: '2026-10-01T00:00:00Z' }, cinestar: { lastRun: '2026-10-05T10:00:00Z' } }))

  // Währenddessen pusht ein anderer Lauf: cinestar.json (die der Lauf NICHT angefasst hat), adn in der Gesundheit (jünger), sowie eine Datei, die der Lauf auch änderte.
  schreibe(anderer, 'data/cinestar.json', '{"v":2,"von":"anderer"}')
  schreibe(anderer, 'data/source-health.json', JSON.stringify({ alt: { lastRun: '2026-10-01T00:00:00Z' }, adn: { lastRun: '2026-10-05T11:00:00Z' } }))
  sh(anderer, `git add -A && ${git} commit -q -m anderer && git push -q origin HEAD:main`)

  // Eine Datei, die in keiner Quellenliste steht, aber vom Lauf geschrieben wurde, geht verloren — und muss auffallen (voices, adn-vde-historie, 05.10.2026).
  schreibe(lauf, 'data/unbekannt-vom-lauf.json', '{}')
  const verloren = sh(lauf, 'source tools/quellen-liste.sh; source tools/quellen-aufsetzen.sh; quellen_verloren').trim()
  pruefe('eine nicht eingetragene, vom Lauf geschriebene Datei wird gemeldet, eingetragene nicht', verloren === 'data/unbekannt-vom-lauf.json', verloren)
  rmSync(join(lauf, 'data/unbekannt-vom-lauf.json'))

  sh(lauf, 'git fetch -q origin main')
  const ausgabe = sh(lauf, 'source tools/quellen-liste.sh; source tools/quellen-aufsetzen.sh; quellen_aufsetzen origin/main')
  const lies = (pfad) => readFileSync(join(lauf, pfad), 'utf8')

  pruefe('eigene Änderung bleibt', lies('data/anisearch.json') === '{"v":2,"von":"lauf"}')
  pruefe('fremde Änderung an einer Datei, die der Lauf nicht anfasste, wird nicht überschrieben', lies('data/cinestar.json') === '{"v":2,"von":"anderer"}', lies('data/cinestar.json'))
  pruefe('neue eigene Archivdatei kommt zurück', existsSync(join(lauf, 'data/adn-raw/c.json.gz')))
  pruefe('eigene Löschung bleibt gelöscht', !existsSync(join(lauf, 'data/adn-raw/b.json.gz')))
  pruefe('unberührte Archivdatei bleibt', lies('data/adn-raw/a.json.gz') === 'a1')
  const gesundheit = JSON.parse(lies('data/source-health.json'))
  pruefe('Gesundheit: eigener neuer Schlüssel bleibt', gesundheit.cinestar?.lastRun === '2026-10-05T10:00:00Z', gesundheit)
  pruefe('Gesundheit: fremder jüngerer Eintrag gewinnt gegen den eigenen älteren', gesundheit.adn?.lastRun === '2026-10-05T11:00:00Z', gesundheit.adn)
  pruefe('das Protokoll nennt die Zahl der zurückgelegten Änderungen', /4 eigene Änderung/.test(ausgabe) || /\d+ eigene Änderung/.test(ausgabe), ausgabe)
  pruefe('HEAD steht auf dem Fernstand', sh(lauf, 'git rev-parse HEAD').trim() === sh(lauf, 'git rev-parse origin/main').trim())
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('quellen_aufsetzen: alle Zusicherungen gehalten.')
