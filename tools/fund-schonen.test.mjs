/**
 * `tools/fund-schonen.mjs`: Beim Nachliefern bleibt, was auf main nach dem Start des Fundlaufs geändert wurde (Anlass 14.11.2026, PR 3870: der Fund vom 10.11. hätte
 * aniSearch-Einträge, JustWatch-Audio und eine TMDB-Handkorrektur überlagert). Reine Entscheidung + Prozesslauf gegen ein Wegwerf-Repo mit echtem git.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entscheide, healthZusammenfuehren, hinweisZeilen, quelleBetroffen } from './fund-schonen.mjs'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const D = 'data'
const FUND = '2026-11-10T04:00:00Z'

// Entscheidung: Grenzfälle an der Startzeit
const pfade = [`${D}/gleich.json`, `${D}/spaeter.json`, `${D}/frueher.json`, `${D}/nie.json`, `${D}/source-health.json`]
const ent = entscheide(pfade, {
  [`${D}/gleich.json`]: FUND,
  [`${D}/spaeter.json`]: '2026-11-10T04:00:01Z',
  [`${D}/frueher.json`]: '2026-11-10T03:59:59Z',
  [`${D}/nie.json`]: null,
  [`${D}/source-health.json`]: '2026-11-14T00:00:00Z',
}, FUND)
pruefe('genau zur Startzeit: übernehmen', ent.uebernehmen.includes(`${D}/gleich.json`))
pruefe('eine Sekunde danach: verwerfen', ent.verwerfen.length === 1 && ent.verwerfen[0].pfad === `${D}/spaeter.json`, ent.verwerfen)
pruefe('früher und nie geändert: übernehmen', ent.uebernehmen.includes(`${D}/frueher.json`) && ent.uebernehmen.includes(`${D}/nie.json`))
pruefe('Gesundheitsdatei wird nie verworfen', ent.uebernehmen.includes(`${D}/source-health.json`))
pruefe('Fundzeit unlesbar: Fehler', (() => { try { entscheide([], {}, 'kaputt'); return false } catch { return true } })())

// Zuordnung Quelle -> Datei
pruefe('Quelle = Dateiname', quelleBetroffen('tmdb-titles', [`${D}/tmdb-titles.json`]))
pruefe('Quelle als Präfix mit Bindestrich', quelleBetroffen('anisearch', [`${D}/anisearch-eintraege.json`]))
pruefe('kein Teilwort ohne Bindestrich', !quelleBetroffen('anis', [`${D}/anisearch.json`]))
pruefe('fremde Quelle nicht betroffen', !quelleBetroffen('adn', [`${D}/tmdb-titles.json`]))

// Gesundheitsdatei zusammenführen
const eintrag = (t, n) => ({ lastOk: t, lastRun: t, lastCount: n })
const mainH = JSON.stringify({ adn: eintrag('2026-11-14T04:00:00Z', 1), 'tmdb-titles': eintrag('2026-11-09T04:00:00Z', 2), alt: eintrag('2026-11-14T05:00:00Z', 3) }, null, 2)
const fundH = JSON.stringify({ adn: eintrag('2026-11-10T04:30:00Z', 9), 'tmdb-titles': eintrag('2026-11-10T04:30:00Z', 8), alt: eintrag('2026-11-14T06:00:00Z', 7), neu: eintrag('2026-11-10T04:30:00Z', 5) }, null, 2)
const h = JSON.parse(healthZusammenfuehren(mainH, fundH, [`${D}/tmdb-titles.json`]))
pruefe('betroffene Quelle behält main-Eintrag', h['tmdb-titles'].lastCount === 2, h['tmdb-titles'])
pruefe('ältere Fund-Zeile überschreibt main nicht', h.adn.lastCount === 1, h.adn)
pruefe('jüngerer Fund-Eintrag unbetroffener Quelle gewinnt', h.alt.lastCount === 7, h.alt)
pruefe('neue Quelle aus dem Fund kommt dazu', h.neu?.lastCount === 5, h.neu)
pruefe('ohne Verwerfen gewinnt der jüngere Fund-Eintrag je Quelle', JSON.parse(healthZusammenfuehren(mainH, fundH, []))['tmdb-titles'].lastCount === 8)
pruefe('Dateiende ohne Zeilenumbruch bleibt', !healthZusammenfuehren(mainH, fundH, []).endsWith('\n'))
pruefe('Dateiende mit Zeilenumbruch bleibt', healthZusammenfuehren(`${mainH}\n`, fundH, []).endsWith('\n'))
pruefe('Hinweis leer ohne Verworfene', hinweisZeilen([]).length === 0)
pruefe('Hinweis nennt jede Datei', hinweisZeilen(ent.verwerfen).some((z) => z.includes(`${D}/spaeter.json`)) && hinweisZeilen(ent.verwerfen).length === 2)

// Prozesslauf im Wegwerf-Repo
const werkzeug = join(dirname(fileURLToPath(import.meta.url)), 'fund-schonen.mjs')
const dir = mkdtempSync(join(tmpdir(), 'fund-schonen-'))
const sh = (befehl, args, optionen = {}) => spawnSync(befehl, args, { cwd: dir, encoding: 'utf8', timeout: 60000, windowsHide: true, ...optionen })
const git = (...a) => sh('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a])
try {
  git('init', '-q', '-b', 'main')
  mkdirSync(join(dir, D))
  const schreibe = (p, t) => writeFileSync(join(dir, p), t)
  const lies = (p) => readFileSync(join(dir, p), 'utf8')
  schreibe(`${D}/tmdb-titles.json`, 'main-tmdb')
  schreibe(`${D}/adn.json`, 'main-adn')
  schreibe(`${D}/weg.json`, 'main-weg')
  schreibe(`${D}/source-health.json`, mainH)
  git('add', '.')
  git('commit', '-q', '-m', 'main')
  // der Fund
  schreibe(`${D}/tmdb-titles.json`, 'fund-tmdb')
  schreibe(`${D}/adn.json`, 'fund-adn')
  schreibe(`${D}/neu-und-spaet.json`, 'fund-neu')
  rmSync(join(dir, `${D}/weg.json`))
  schreibe(`${D}/source-health.json`, fundH)
  const aend = join(dir, '..', `fund-schonen-aend-${process.pid}.json`)
  writeFileSync(aend, JSON.stringify({ [`${D}/tmdb-titles.json`]: '2026-11-11T10:00:00Z', [`${D}/adn.json`]: null, [`${D}/weg.json`]: '2026-11-13T00:00:00Z', [`${D}/neu-und-spaet.json`]: null }))
  const hinweis = join(dir, '..', `fund-schonen-hinweis-${process.pid}.txt`)

  // Nichtauskunft: ohne Änderungsliste und ohne Repository-Name bricht es ab und fasst nichts an
  const ohne = sh('node', [werkzeug, FUND], { env: { ...process.env, GITHUB_REPOSITORY: '' } })
  pruefe('Abruf scheitert: Exit 1 mit Fehlertext', ohne.status === 1 && /gescheitert/.test(ohne.stderr), [ohne.status, ohne.stderr])
  pruefe('Abruf scheitert: Fund bleibt unberührt', lies(`${D}/tmdb-titles.json`) === 'fund-tmdb' && lies(`${D}/source-health.json`) === fundH)

  const lauf = sh('node', [werkzeug, FUND, '--aenderungen', aend, '--hinweis', hinweis])
  pruefe('Lauf endet mit Exit 0 und Schlusszeile', lauf.status === 0 && /2 verworfen/.test(lauf.stdout), [lauf.status, lauf.stdout, lauf.stderr])
  pruefe('später geänderte Datei: main-Stand zurück', lies(`${D}/tmdb-titles.json`) === 'main-tmdb')
  pruefe('Fund-Löschung einer später geänderten Datei: Datei wieder da', existsSync(join(dir, `${D}/weg.json`)) && lies(`${D}/weg.json`) === 'main-weg')
  pruefe('unveränderte Datei: Fund bleibt', lies(`${D}/adn.json`) === 'fund-adn')
  pruefe('neue Datei ohne Änderung auf main: bleibt', lies(`${D}/neu-und-spaet.json`) === 'fund-neu')
  const hh = JSON.parse(lies(`${D}/source-health.json`))
  pruefe('Gesundheit: verworfene Quelle bleibt auf main', hh['tmdb-titles'].lastCount === 2 && hh.neu.lastCount === 5, hh)
  pruefe('Gesundheit: Dateiende ohne Zeilenumbruch', !lies(`${D}/source-health.json`).endsWith('\n'))
  pruefe('Protokoll nennt jede verworfene Datei', lauf.stdout.includes(`${D}/tmdb-titles.json`) && lauf.stdout.includes(`${D}/weg.json`), lauf.stdout)
  pruefe('Hinweisdatei für den PR nennt beide', /2 Datei\(en\) verworfen/.test(lies('../' + `fund-schonen-hinweis-${process.pid}.txt`)))
  rmSync(aend, { force: true })
  rmSync(hinweis, { force: true })
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`fund-schonen: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('fund-schonen: Entscheidung (Grenze Startzeit, Gesundheitsdatei), Quelle→Datei, Gesundheit zusammenführen, Prozesslauf mit echtem git, Abruf-Fehler: alles grün')
