// Verdrahtung: `laeufe-aufraeumen.mjs --trocken` meldet die liegegut-Funde als Sammelzeile `LIEGT:` und einen Abruffehler als eigene Zeile `LIEGT?`.
// Läuft als echter Prozess; execFileSync (gh/git) kommt aus tools/pr-nachrechnen-mock.mjs, fetch (Status-Worker) ist ein abgelehnter Abruf.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { kopfZeiten, liegtZeile, meldeLiegt } from './liegegut.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${JSON.stringify(info)}`}`)
  if (!ok) fehler.push(name)
}

const JETZT = Date.parse('2026-10-30T12:00:00Z')
const vorStunden = (h) => new Date(JETZT - h * 3600 * 1000).toISOString()
const FELDER = 'number,title,headRefOid,createdAt,mergeable,mergeStateStatus,isDraft,body,comments,reviews,statusCheckRollup'
const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

console.log('liegt-wachphase: Sammelzeile (rein)')
{
  pruefe('keine Funde → keine Zeile', liegtZeile([], JETZT) === null)
  const funde = [
    { nr: 2377, signale: [{ nr: 3, seit: JETZT - 30.5 * 3600 * 1000 }, { nr: 8, seit: JETZT - 52 * 3600 * 1000 }] },
    { nr: 1500, signale: [{ nr: 1, seit: JETZT - 13 * 3600 * 1000 }] },
  ]
  pruefe('Sammelzeile mit Signalen und abgerundeten Stunden', liegtZeile(funde, JETZT) === 'LIEGT: 2377 (Konflikt 30 h, Stillstand 52 h), 1500 (Freigabe ruht 13 h)', liegtZeile(funde, JETZT))
  const aus = []
  meldeLiegt(() => { throw new Error('HTTP 502\nzweite Zeile') }, () => '', (t) => aus.push(t), JETZT)
  pruefe('Abruffehler → eigene Zeile, erste Fehlerzeile, nichts geworfen', aus.length === 1 && aus[0] === 'LIEGT? liegegut nicht lesbar: HTTP 502', aus)
}

console.log('liegt-wachphase: eigener Prozess laeufe-aufraeumen --trocken')
{
  const werk = fs.mkdtempSync(path.join(os.tmpdir(), 'liegt-wache-'))
  const still = {
    number: 2377,
    title: 'fix(x): wartet',
    headRefOid: KOPF,
    createdAt: vorStunden(200),
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    isDraft: false,
    body: '',
    comments: [{ author: { login: 'danielzaiser91' }, createdAt: vorStunden(60), body: 'Hinweis' }],
    reviews: [],
    statusCheckRollup: [],
  }
  let graphqlSchluessel = ''
  kopfZeiten((args) => {
    graphqlSchluessel = args.join(' ')
    return ''
  })
  const liste = `pr list --state open --limit 100 --json ${FELDER}`
  const daten = {
    [liste]: { aus: JSON.stringify([still]) },
    [graphqlSchluessel]: { aus: `${KOPF} ${vorStunden(100)}\n` },
    'pr list --state open --limit 100 --json number,title,body,createdAt': { aus: '[]' },
    'api repos/danielzaiser91/anime-kalender-de/issues/comments?sort=created&direction=desc&per_page=100': { aus: '[]' },
    ...Object.fromEntries(['bestand-bauen.yml', 'deploy.yml'].map((w) => [`run list --repo danielzaiser91/anime-kalender-de --workflow ${w} --limit 200 --json status,conclusion,createdAt,databaseId`, { aus: '[]' }])),
  }
  const abruf = path.join(werk, 'abruf-abgelehnt.mjs')
  fs.writeFileSync(abruf, "globalThis.fetch = async () => { throw new Error('offline') }\n")
  const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
  const skript = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  // gh-Aufrufe aus dem Aufruflog, für die die Kulisse keine Antwort hat (ein echter gh-Aufruf liefe sonst ins Netz).
  const unbekannteGh = (d) => {
    const log = path.join(werk, 'log.txt')
    if (!fs.existsSync(log)) return []
    return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z))
      .filter(([befehl, args]) => befehl === 'gh' || (typeof befehl === 'string' && /^gh /.test(befehl) && args.length === 0))
      .map(([befehl, args]) => (args.length > 0 ? args.join(' ') : befehl.replace(/^gh /, '')))
      .filter((schluessel) => !(schluessel in d))
  }
  const starte = (d) => {
    fs.rmSync(path.join(werk, 'log.txt'), { force: true })
    fs.writeFileSync(path.join(werk, 'daten.json'), JSON.stringify(d))
    const env = { ...process.env, ATTRAPPE_LOG: path.join(werk, 'log.txt'), ATTRAPPE_DATEN: path.join(werk, 'daten.json') }
    return spawnSync(process.execPath, ['--import', vorlader, '--import', pathToFileURL(abruf).href, skript, '--trocken', '--wurzel', werk, '--gesundheit', path.join(werk, 'fehlt.json')], { encoding: 'utf8', env })
  }
  const ok = starte(daten)
  pruefe('Kulisse kennt jeden gh-Aufruf der Wachphase', unbekannteGh(daten).length === 0 && !/nicht lesbar: Command failed/.test(ok.stdout), { unbekannt: unbekannteGh(daten), o: ok.stdout })
  pruefe('Wächter: ein Aufruf ohne Antwort wird gemeldet', unbekannteGh({}).length > 0)
  pruefe('Prozess: Sammelzeile LIEGT: für den stillen PR (Wachphase lief durch)', /^LIEGT: 2377 \(Stillstand \d+ h\)$/m.test(ok.stdout) && /Status-Worker nicht erreichbar/.test(ok.stderr), { s: ok.status, o: ok.stdout, e: ok.stderr })
  const kaputtDaten = { ...daten, [liste]: { fehler: 'HTTP 502' } }
  const kaputt = starte(kaputtDaten)
  pruefe('Kulisse kennt jeden gh-Aufruf auch im Fehlerfall', unbekannteGh(kaputtDaten).length === 0, unbekannteGh(kaputtDaten))
  pruefe('Prozess: Abruffehler → Zeile LIEGT? und kein LIEGT:-Fund', /^LIEGT\? liegegut nicht lesbar: HTTP 502$/m.test(kaputt.stdout) && !/^LIEGT: /m.test(kaputt.stdout) && /Status-Worker nicht erreichbar/.test(kaputt.stderr), { s: kaputt.status, o: kaputt.stdout, e: kaputt.stderr })
  fs.rmSync(werk, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`liegt-wachphase.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('liegt-wachphase.test: alle Fälle grün (Sammelzeile, Abruffehler, Prozess)')
