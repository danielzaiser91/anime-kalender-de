/**
 * `tools/fund-ohne.mjs` und seine Verdrahtung in `fund-schonen.mjs`: Schlüssel, die die TMDB-Handdatei mit `ohne: true` ausschließt, kommen beim Nachliefern
 * eines Funds nicht in den PR zurück (Lehre 87). Reine Funktionen am echten Handbestand + Prozesslauf im Wegwerf-Repo.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ohneSchluessel, streicheSchluessel } from './fund-ohne.mjs'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const D = 'data'
const hier = dirname(fileURLToPath(import.meta.url))
const HAND = readFileSync(join(hier, '..', D, 'tmdb-von-hand.yaml'), 'utf8')

// Echter Handbestand (Stand 15.11.2026: Kitaro Shinsei-ban und Tekkon Kinkreet Pilot)
const echt = ohneSchluessel(HAND)
pruefe('echter Bestand: beide ohne-Schlüssel gefunden', echt.includes('10019697') && echt.includes('99717'), echt)
pruefe('echter Bestand: Eintrag mit Kennung ist kein ohne-Schlüssel', !echt.includes('130622') && !echt.includes('99718'), echt)

// Fälle der Zeilenlesung
const yaml = ['# Kopf: ohne: true', '- anilistId: 1', '  tmdbId: 5', '  ohne: true', '', '- anilistId: 2 # mit Kommentar', '  ohne: true', '', '- anilistId: 3', '  tmdbId: 9', '', '- tmdbId: 8', '  ohne: true', '', '- anilistId: 4', '  titel: x', '  ohne: false', '- anilistId: 5', '  ohne: true', ''].join('\n')
pruefe('ohne-Lesung: Eintrag mit ohne, mit Kommentar, am Dateiende; false und fehlend nicht', JSON.stringify(ohneSchluessel(yaml)) === JSON.stringify(['1', '2', '5']), ohneSchluessel(yaml))
pruefe('ohne-Lesung: leere Datei gibt leere Liste', ohneSchluessel('').length === 0)
pruefe('ohne-Lesung: CRLF', JSON.stringify(ohneSchluessel(yaml.replace(/\n/g, '\r\n'))) === JSON.stringify(['1', '2', '5']))

// Streichen
const json = JSON.stringify({ 1: { a: 1 }, 7: { a: 2 }, 99717: { a: 3 } })
const r = streicheSchluessel(json, ['99717', '10019697'])
pruefe('Streichen: nur der vorhandene Schlüssel, Rest bleibt, kompakt ohne Zeilenende', r.text === JSON.stringify({ 1: { a: 1 }, 7: { a: 2 } }) && r.entfernt.join() === '99717', r)
pruefe('Streichen: nichts zu tun gibt den Text byte-gleich zurück', streicheSchluessel(`${json}\n`, ['5']).text === `${json}\n`)
pruefe('Streichen: Zeilenende am Ende bleibt', streicheSchluessel(`${json}\n`, ['7']).text.endsWith('}\n'))

// Prozesslauf: Fund mit ohne-Schlüsseln in drei Dateien, eine Datei auf main später geändert (verworfen)
const werkzeug = join(hier, 'fund-schonen.mjs')
const dir = mkdtempSync(join(tmpdir(), 'fund-ohne-'))
const sh = (befehl, args) => spawnSync(befehl, args, { cwd: dir, encoding: 'utf8', timeout: 60000, windowsHide: true })
const git = (...a) => sh('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a])
try {
  git('init', '-q', '-b', 'main')
  mkdirSync(join(dir, D))
  const lies = (n) => readFileSync(join(dir, D, n), 'utf8')
  const mit = (extra) => JSON.stringify({ 1: { n: 1 }, ...extra })
  writeFileSync(join(dir, D, 'tmdb-von-hand.yaml'), HAND)
  // main-Stand der Folgen trägt einen ohne-Schlüssel: die verworfene Datei darf ihn behalten (nur übernommene Dateien werden gestrichen)
  const mainFolgen = mit({ 99717: { n: 9 } })
  for (const n of ['tmdb-titles', 'tmdb-banner']) writeFileSync(join(dir, D, `${n}.json`), mit({}))
  writeFileSync(join(dir, D, 'tmdb-folgen.json'), mainFolgen)
  git('add', '.')
  git('commit', '-q', '-m', 'main')
  const fund = mit({ 99717: { n: 2 }, 10019697: { n: 3 }, 130622: { n: 4 } })
  for (const n of ['tmdb-titles', 'tmdb-banner', 'tmdb-folgen']) writeFileSync(join(dir, D, `${n}.json`), fund)
  const aend = join(dir, '..', `fund-ohne-aend-${process.pid}.json`)
  writeFileSync(aend, JSON.stringify({ [`${D}/tmdb-folgen.json`]: '2026-11-12T00:00:00Z', [`${D}/tmdb-titles.json`]: null, [`${D}/tmdb-banner.json`]: null }))
  const lauf = sh('node', [werkzeug, '2026-11-10T04:00:00Z', '--aenderungen', aend])
  pruefe('Lauf endet mit Exit 0 und Schlusszeile', lauf.status === 0 && /Fund schonen: 2 Datei\(en\) übernommen, 1 verworfen/.test(lauf.stdout), [lauf.status, lauf.stdout, lauf.stderr])
  const titel = JSON.parse(lies('tmdb-titles.json'))
  pruefe('titles: ohne-Schlüssel raus, Eintrag mit Kennung und Fremdes bleiben', !('99717' in titel) && !('10019697' in titel) && '130622' in titel && '1' in titel, titel)
  const banner = JSON.parse(lies('tmdb-banner.json'))
  pruefe('banner (übernommen): ohne-Schlüssel raus, Rest bleibt', !('99717' in banner) && !('10019697' in banner) && '130622' in banner && '1' in banner, banner)
  pruefe('verworfene Datei (folgen): main-Stand mit seinem Schlüssel, nicht gestrichen, nicht der Fund', lies('tmdb-folgen.json') === mainFolgen)
  pruefe('Protokoll nennt Schlüssel und Datei', /10019697, 99717 aus data\/tmdb-titles\.json entfernt/.test(lauf.stdout), lauf.stdout)

  // zweiter Lauf auf dem Ergebnis: nichts mehr zu streichen, Datei bleibt byte-gleich
  const vorher = lies('tmdb-titles.json')
  const zweit = sh('node', [werkzeug, '2026-11-10T04:00:00Z', '--aenderungen', aend])
  pruefe('zweiter Lauf: Exit 0, Datei unverändert, kein ohne-Protokoll', zweit.status === 0 && lies('tmdb-titles.json') === vorher && !/ohne \(tmdb-von-hand\)/.test(zweit.stdout), zweit.stdout)

  // ohne Handdatei: laut abbrechen, nichts verwerfen, nichts streichen
  git('checkout', '-q', 'HEAD', '--', D)
  rmSync(join(dir, D, 'tmdb-von-hand.yaml'))
  for (const n of ['tmdb-titles', 'tmdb-banner', 'tmdb-folgen']) writeFileSync(join(dir, D, `${n}.json`), fund)
  const keine = sh('node', [werkzeug, '2026-11-10T04:00:00Z', '--aenderungen', aend])
  pruefe('ohne Handdatei: Exit 1 mit Fehlertext', keine.status === 1 && /tmdb-von-hand\.yaml fehlt/.test(keine.stderr), [keine.status, keine.stderr])
  pruefe('ohne Handdatei: Fund bleibt unberührt (auch die zu verwerfende Datei)', ['tmdb-titles', 'tmdb-banner', 'tmdb-folgen'].every((n) => lies(`${n}.json`) === fund))
  rmSync(aend, { force: true })
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`fund-ohne: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('fund-ohne: Lesung am echten Handbestand, Zeilenfälle (Kommentar, Dateiende, CRLF, false, Eintrag ohne anilistId), Streichen, Prozesslauf (titles und banner übernommen, folgen verworfen, zweiter Lauf, fehlende Handdatei = Exit 1): alles grün')
