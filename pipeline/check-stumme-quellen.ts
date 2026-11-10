/**
 * Zusicherung zu zwei Quellen, die fälschlich „stumm“ hießen (09.11.2026):
 * kitsu-folgen (leere Warteschlange = fertig, aber nur bei geladener Titelliste; ein Kitsu-Fehler ist kein Erfolg)
 * und tv-de (HTTP 403 = Abbruch nach einer Seite, Tagesmarke, Sperre in der Health auch bei Teilerfolg).
 * Läuft in `check:logic`; schreibt nur in Wegwerf-Ordner unter `os.tmpdir()`.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const kulisse = mkdtempSync(join(tmpdir(), 'ak-stumm-'))
process.env.AK_ROOT = kulisse

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function schreibe(wurzel: string, pfad: string, inhalt: string): void {
  mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
  writeFileSync(join(wurzel, pfad), inhalt)
}

type Gesundheit = Record<string, { lastOk?: string; lastError?: string; lastCount?: number }>
const gesundheit = (wurzel: string): Gesundheit => JSON.parse(readFileSync(join(wurzel, 'data/source-health.json'), 'utf8')) as Gesundheit
const ALT = '2000-01-01T00:00:00.000Z'
const gesundAlt = (name: string): string => JSON.stringify({ [name]: { lastOk: ALT, lastRun: ALT, lastCount: 3 } })

/* kitsu-folgen als eigener Prozess; fetch ist per Vorlader auf 404 gestellt (Kitsu-Fehler ohne Retry). */
const tsx = createRequire(join(WURZEL, 'package.json')).resolve('tsx/esm')
schreibe(kulisse, 'vorlader.mjs', "globalThis.fetch = async () => new Response('', { status: 404 })\n")
const titel = (id: number, malId?: number): string => JSON.stringify({ id, episodes: 12, ...(malId ? { malId } : {}) })

function kitsuLauf(fall: string, titles: string | null, bestand: string): { wurzel: string; ausgabe: string } {
  const wurzel = join(kulisse, `kitsu-${fall}`)
  if (titles !== null) schreibe(wurzel, 'public/data/titles.json', titles)
  schreibe(wurzel, 'data/kitsu-folgen.json', bestand)
  schreibe(wurzel, 'data/source-health.json', gesundAlt('kitsu-folgen'))
  const lauf = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(tsx).href, '--import', pathToFileURL(join(kulisse, 'vorlader.mjs')).href, join(WURZEL, 'pipeline', 'fetch-kitsu-folgen.ts')],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, env: { ...process.env, AK_ROOT: wurzel } },
  )
  const ausgabe = `${lauf.status} ${lauf.stdout}${lauf.stderr}`
  pruefe(`kitsu ${fall}: Prozess läuft bis zur Schlusszeile`, lauf.status === 0 && /Titeln mit Kitsu-Folgen/.test(lauf.stdout), ausgabe.slice(0, 300))
  return { wurzel, ausgabe }
}
const kitsuOk = (wurzel: string): boolean => gesundheit(wurzel)['kitsu-folgen']?.lastOk !== ALT

const fertig = kitsuLauf('fertig', `[${titel(1, 111)}]`, '{"1":{"k":null,"f":[]}}')
pruefe('kitsu: alle Titel schon geholt = Erfolg (lastOk neu)', kitsuOk(fertig.wurzel), gesundheit(fertig.wurzel))
const ohneListe = kitsuLauf('ohne-liste', null, '{}')
pruefe('kitsu: titles.json fehlt = kein Erfolg (lastOk bleibt)', !kitsuOk(ohneListe.wurzel), gesundheit(ohneListe.wurzel))
const leereListe = kitsuLauf('leere-liste', '[]', '{}')
pruefe('kitsu: leere Titelliste = kein Erfolg (lastOk bleibt)', !kitsuOk(leereListe.wurzel), gesundheit(leereListe.wurzel))
const ohneMal = kitsuLauf('ohne-mal', `[${titel(1)}]`, '{}')
pruefe('kitsu: kein Titel mit MAL-Kennung = kein Erfolg (lastOk bleibt)', !kitsuOk(ohneMal.wurzel), gesundheit(ohneMal.wurzel))
const kitsuFehler = kitsuLauf('fehler', `[${titel(1, 111)}]`, '{}')
pruefe('kitsu: ein offener Titel und Kitsu-Fehler = kein Erfolg (lastOk bleibt)', !kitsuOk(kitsuFehler.wurzel) && /1 Fehler/.test(kitsuFehler.ausgabe), gesundheit(kitsuFehler.wurzel))

const { tvDeSeitenLesen, tvdeMarke, meldeTvDe, main: tvMain } = await import('./fetch-tv-programm.ts')
const keinePause = async (): Promise<void> => {}
function attrappe(status: number): { f: typeof fetch; aufrufe: string[] } {
  const aufrufe: string[] = []
  const f = (async (url: string) => {
    aufrufe.push(url)
    return new Response(status === 200 ? '<html></html>' : '', { status })
  }) as unknown as typeof fetch
  return { f, aufrufe }
}
const tage = ['2026-11-09', '2026-11-10', '2026-11-11']
const slugs = ['a', 'b', 'c']

const a403 = attrappe(403)
const r403 = await tvDeSeitenLesen(a403.f, tage, slugs, () => pruefe('403: keine Seite wird verarbeitet', false), keinePause)
pruefe('403: Abbruch nach der ersten Seite (1 Aufruf statt 9)', a403.aufrufe.length === 1, a403.aufrufe)
pruefe('403: gesperrt, 0 Seiten', r403.gesperrt === true && r403.seiten === 0, r403)

const a200 = attrappe(200)
const verarbeitet: string[] = []
const r200 = await tvDeSeitenLesen(a200.f, tage, slugs, (s, t) => verarbeitet.push(`${s}|${t}`), keinePause)
pruefe('200: alle 9 Seiten gelesen und verarbeitet', r200.seiten === 9 && !r200.gesperrt && a200.aufrufe.length === 9 && verarbeitet.length === 9, r200)

const a500 = attrappe(500)
const r500 = await tvDeSeitenLesen(a500.f, tage, slugs, () => {}, keinePause)
pruefe('500 ist keine Sperre: alle Seiten werden versucht', !r500.gesperrt && a500.aufrufe.length === 9, r500)

pruefe('Marke nach Sperre: heute', tvdeMarke(0, true, '2026-11-09', '2026-11-05') === '2026-11-09')
pruefe('Marke nach Erfolg: heute', tvdeMarke(3, false, '2026-11-09', '2026-11-05') === '2026-11-09')
pruefe('Marke ohne Seite und ohne Sperre: alte bleibt (Neuversuch)', tvdeMarke(0, false, '2026-11-09', '2026-11-05') === '2026-11-05')

/* Teilsperre: Seiten gelesen, Sendungen gefunden, dann 403 — die Sperre darf nicht als Erfolg durchgehen. */
schreibe(kulisse, 'data/source-health.json', gesundAlt('tv-de'))
meldeTvDe(5, 3, true)
const teil = gesundheit(kulisse)['tv-de']
pruefe('tv-de Teilsperre: „gesperrt (HTTP 403)“ sichtbar, lastOk nicht erneuert', teil?.lastError === 'gesperrt (HTTP 403)' && teil.lastOk === ALT, teil)
meldeTvDe(5, 3)
pruefe('tv-de ohne Sperre: Erfolg erneuert lastOk, kein Fehlertext', gesundheit(kulisse)['tv-de']?.lastOk !== ALT && gesundheit(kulisse)['tv-de']?.lastError === undefined, gesundheit(kulisse)['tv-de'])

/* Ganzer Lauf über main: fetch-Attrappe liefert RTL+ 500, tv.de erst `okSeiten` mal 200, dann 403. */
const BESTAND = { 'tvde_a+1': { titleId: 5, titel: 'Probe', sender: 'A', start: '2999-01-01T20:00:00+01:00', ende: '2999-01-01T20:30:00+01:00', gesehenAm: '2999-01-01' } }
async function mainLauf(okSeiten: number): Promise<{ tvdeAufrufe: number; datei: { tvdeGeholtAm?: string; sendungen: unknown }; health: Gesundheit }> {
  schreibe(kulisse, 'data/tv-programm.json', JSON.stringify({ tvdeGeholtAm: '2000-01-01', sendungen: BESTAND }))
  schreibe(kulisse, 'data/source-health.json', gesundAlt('tv-de'))
  let tvdeAufrufe = 0
  const echt = globalThis.fetch
  globalThis.fetch = (async (url: string) => {
    if (!String(url).startsWith('https://tv.de/')) return new Response('', { status: 500 })
    tvdeAufrufe++
    return new Response(tvdeAufrufe <= okSeiten ? '<html></html>' : '', { status: tvdeAufrufe <= okSeiten ? 200 : 403 })
  }) as typeof fetch
  try {
    await tvMain()
  } finally {
    globalThis.fetch = echt
    process.exitCode = 0
  }
  const datei = JSON.parse(readFileSync(join(kulisse, 'data/tv-programm.json'), 'utf8')) as { tvdeGeholtAm?: string; sendungen: unknown }
  return { tvdeAufrufe, datei, health: gesundheit(kulisse) }
}
const heuteMarke = (m: string | undefined): boolean => /^\d{4}-\d\d-\d\d$/.test(m ?? '') && m !== '2000-01-01'

const sperre = await mainLauf(0)
pruefe('main 403: ein tv.de-Abruf, keine Nachtblock-Seiten', sperre.tvdeAufrufe === 1, sperre.tvdeAufrufe)
pruefe('main 403: Tagesmarke gesetzt', heuteMarke(sperre.datei.tvdeGeholtAm), sperre.datei)
pruefe('main 403: Bestand unverändert', JSON.stringify(sperre.datei.sendungen) === JSON.stringify(BESTAND), sperre.datei.sendungen)
pruefe('main 403: Health „gesperrt (HTTP 403)“, lastOk bleibt', sperre.health['tv-de']?.lastError === 'gesperrt (HTTP 403)' && sperre.health['tv-de']?.lastOk === ALT, sperre.health['tv-de'])

const teilsperre = await mainLauf(2)
pruefe('main Teilsperre: nach der Sperre kein weiterer Abruf (3 statt 9+)', teilsperre.tvdeAufrufe === 3, teilsperre.tvdeAufrufe)
pruefe('main Teilsperre: Tagesmarke gesetzt', heuteMarke(teilsperre.datei.tvdeGeholtAm), teilsperre.datei)
pruefe('main Teilsperre: Health zeigt die Sperre trotz 2 gelesener Seiten', teilsperre.health['tv-de']?.lastError === 'gesperrt (HTTP 403)' && teilsperre.health['tv-de']?.lastOk === ALT, teilsperre.health['tv-de'])

rmSync(kulisse, { recursive: true, force: true })
if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-stumme-quellen: kitsu-folgen (5 Fälle: fertig = ok; ohne Liste, leer, ohne MAL, Kitsu-Fehler = kein Erfolg), tv-de (403 = Abbruch, Marke, „gesperrt“, Teilsperre sichtbar, 2 Läufe über main)')
