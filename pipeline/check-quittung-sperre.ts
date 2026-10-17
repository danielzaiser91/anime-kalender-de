/**
 * Zusicherung (17.10.2026): Die quittierenden Skripte schicken nur ab, was `tools/commit-data.sh` nach dem Commit
 * freigegeben hat (`lib/spaeter-quittieren.ts`), und laufen mit falschen Schaltern gar nicht (`lib/schalter.ts`).
 * - `fetch-pruefungen.ts` hakt beim Abruf nie selbst ab, auch ohne `--abhaken-spaeter`; `--nur-abhaken` vor der Freigabe schickt nichts.
 * - Ein Schalter ohne `--` hinter `npm run` (npm schluckt ihn, `npm_config_…`) oder ein unbekanntes Argument bricht vor jedem Abruf ab.
 * Attrappen: `tools/kanal-messung-mock.mjs` + `tools/quittung-aufzeichner-mock.mjs` (Abruf), sonst die Ablauf-Attrappen.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pruefeSchalter } from './lib/schalter.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const vorlader = (name: string) => ['--import', pathToFileURL(join(wurzel, 'tools', name)).href]
const OFFEN = 'data/cache/quittung-offen/pruefungen-abhaken.json'
const FREI = 'data/cache/quittung-frei/pruefungen-abhaken.json'
const ALTES_JA = `- anilistId: 1
  platform: primevideo
  url: https://www.amazon.de/dp/B0TESTKAN1
  dub: true
  checkedAt: '2026-10-01'
  note: "Kanal-Titel"
`

const kulisse = mkdtempSync(join(tmpdir(), 'quittung-sperre-'))
const fehler: string[] = []
const da = (pfad: string) => existsSync(join(kulisse, pfad))

function starte(skript: string, argumente: string[], vorlage: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [tsx, ...vorlage, join(wurzel, 'pipeline', skript), ...argumente], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, LAUF_TOKEN: 'test', ...env },
  })
}

/** Ein Abruf von fetch-pruefungen.ts gegen die Kanal-Attrappe; liefert Exit und Aufzeichnung (Abrufe, Merker). */
function abruf(name: string, argumente: string[], env: Record<string, string> = {}) {
  const yaml = join(kulisse, `${name}.yaml`)
  const aufzeichnung = join(kulisse, `${name}.jsonl`)
  writeFileSync(yaml, ALTES_JA)
  const meldungen = JSON.stringify([{ befund: 'kein_dub', gemeldet_am: '2026-10-12T10:00:00Z' }])
  const r = starte('fetch-pruefungen.ts', argumente, [...vorlader('kanal-messung-mock.mjs'), ...vorlader('quittung-aufzeichner-mock.mjs')], {
    ...env,
    KANAL_MOCK_YAML: yaml,
    KANAL_MOCK_MELDUNGEN: meldungen,
    AK_AUFZEICHNUNG: aufzeichnung,
  })
  const zeilen = existsSync(aufzeichnung) ? readFileSync(aufzeichnung, 'utf8').trim().split('\n').filter(Boolean).map((z) => JSON.parse(z)) : []
  return { status: r.status, zeilen: zeilen as { methode?: string; schreibt?: string; inhalt?: string }[], stderr: r.stderr }
}

function pruefeAbruf(): void {
  for (const argumente of [[], ['--abhaken-spaeter']]) {
    const r = abruf(`merkt${argumente.length}`, argumente)
    const wort = argumente.join(' ') || 'ohne Schalter'
    if (r.status !== 0) fehler.push(`Abruf ${wort} endete mit ${r.status}: ${r.stderr.slice(-300)}`)
    if (!r.zeilen.some((z) => z.methode === 'GET')) fehler.push(`Abruf ${wort}: kein GET (Attrappe nicht angesprochen)`)
    if (r.zeilen.some((z) => z.methode === 'POST')) fehler.push(`Abruf ${wort} hakt sofort ab, statt zu merken`)
    const merker = r.zeilen.filter((z) => z.schreibt)
    if (JSON.stringify(merker) !== JSON.stringify([{ schreibt: 'quittung-offen/pruefungen-abhaken.json', inhalt: '[90000]' }])) {
      fehler.push(`Abruf ${wort}: Merker ${JSON.stringify(merker)}, erwartet [90000] unter quittung-offen/`)
    }
  }
  const trocken = abruf('trocken', ['--trocken'])
  if (trocken.status !== 0 || trocken.zeilen.some((z) => z.methode === 'POST' || z.schreibt)) fehler.push('--trocken hakt ab oder merkt')
}

/** Falsche Schalter: Abbruch mit Exit 1, bevor irgendetwas abgerufen oder gemerkt wird. */
function pruefeFalscheSchalter(): void {
  const faelle: [string, string[], Record<string, string>][] = [
    ['npm schluckt --abhaken-spaeter', [], { npm_config_abhaken_spaeter: 'true' }],
    ['npm schluckt --nur-abhaken', [], { npm_config_nur_abhaken: 'true' }],
    ['npm schluckt --trocken', ['--abhaken-spaeter'], { npm_config_trocken: 'true' }],
    ['unbekannter Schalter', ['--nur-loeschen'], {}],
    ['Schalter mit Wert', ['--nur-abhaken=1'], {}],
  ]
  for (const [name, argumente, env] of faelle) {
    const r = abruf(name.replaceAll(/\W+/g, '-'), argumente, env)
    if (r.status !== 1 || r.zeilen.length || !r.stderr.includes('✖')) fehler.push(`${name}: Exit ${r.status}, ${r.zeilen.length} Aufzeichnung(en), erwartet Abbruch vor jedem Abruf`)
  }
}

/** `--nur-abhaken` schickt nur aus quittung-frei/ ab, was commit-data.sh dorthin verschoben hat. */
function pruefeNurAbhaken(): void {
  const nurAbhaken = () =>
    starte('fetch-pruefungen.ts', ['--nur-abhaken'], vorlader('rohfolgen-ablauf-mock.mjs'), { AK_ROOT: kulisse, AK_POST_STATUS: '200' })
  mkdirSync(dirname(join(kulisse, OFFEN)), { recursive: true })
  writeFileSync(join(kulisse, OFFEN), '[5,6]')
  const vorher = nurAbhaken()
  if (vorher.status !== 0 || da('post.json')) fehler.push(`--nur-abhaken vor der Freigabe: Exit ${vorher.status}, abgehakt: ${da('post.json')}`)
  if (!da(OFFEN)) fehler.push('--nur-abhaken vor der Freigabe hat den Merker angefasst')
  mkdirSync(dirname(join(kulisse, FREI)), { recursive: true })
  renameSync(join(kulisse, OFFEN), join(kulisse, FREI))
  const nachher = nurAbhaken()
  const gesendet = da('post.json') ? readFileSync(join(kulisse, 'post.json'), 'utf8') : 'nichts'
  if (nachher.status !== 0 || gesendet !== '{"uebernommen":[5,6]}') fehler.push(`--nur-abhaken nach der Freigabe sendet ${gesendet}`)
  if (da(FREI)) fehler.push('der freigegebene Merker bleibt nach dem Abhaken liegen')
}

/** Dieselbe Schalterprüfung in den beiden anderen quittierenden Skripten (Verdrahtung). */
function pruefeAndereSkripte(): void {
  const frei = 'data/cache/quittung-frei/rohfolgen-abhaken.json'
  writeFileSync(join(kulisse, frei), '[7]')
  rmSync(join(kulisse, 'post.json'), { force: true })
  const roh = starte('rohfolgen-abhaken.ts', ['--sofort'], vorlader('rohfolgen-ablauf-mock.mjs'), { AK_ROOT: kulisse })
  if (roh.status !== 1 || da('post.json') || !da(frei) || !roh.stderr.includes('✖')) fehler.push(`rohfolgen-abhaken.ts --sofort: Exit ${roh.status}, erwartet Abbruch ohne Abhaken`)
  writeFileSync(join(kulisse, 'data/cache/quittung-frei/vorfaelle-loeschen.json'), '[8]')
  for (const [argumente, env] of [[['--nur-loeschen=1'], {}], [[], { npm_config_nur_loeschen: 'true' }]] as [string[], Record<string, string>][]) {
    const r = starte('fetch-vorfaelle.ts', argumente, vorlader('vorfaelle-ablauf-mock.mjs'), { AK_ROOT: kulisse, ...env })
    if (r.status !== 1 || da('delete.json') || !r.stderr.includes('✖')) fehler.push(`fetch-vorfaelle.ts ${argumente.join(' ')} ${Object.keys(env).join(' ')}: Exit ${r.status}, erwartet Abbruch`)
  }
}

function pruefeRegel(): void {
  const faelle: [string[], Record<string, string>, number][] = [
    [['--a', '--b'], {}, 0],
    [['--b', '--x', '--a'], {}, 1],
    [['--a=1'], {}, 1],
    [['a'], {}, 1],
    [[], { npm_config_b: '' }, 1],
    [[], { npm_config_a: 'true', npm_config_cache: '/x', npm_config_b: 'true' }, 2],
    [['--a'], { npm_config_c: 'true' }, 0],
  ]
  for (const [argv, env, anzahl] of faelle) {
    const ist = pruefeSchalter(['--a', '--b'], argv, env).length
    if (ist !== anzahl) fehler.push(`pruefeSchalter(${JSON.stringify(argv)}, ${JSON.stringify(env)}): ${ist} Fehler, erwartet ${anzahl}`)
  }
  if (pruefeSchalter(['--nur-abhaken'], [], { npm_config_nur_abhaken: 'true' }).length !== 1) fehler.push('Bindestrich wird nicht zu _ im npm_config-Namen')
  if (pruefeSchalter(['--a-b-c'], [], { npm_config_a_b_c: 'true' }).length !== 1) fehler.push('nur der erste Bindestrich wird zu _')
}

try {
  pruefeRegel()
  pruefeAbruf()
  pruefeFalscheSchalter()
  pruefeNurAbhaken()
  pruefeAndereSkripte()
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-quittung-sperre: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-quittung-sperre: Abruf merkt nur, Quittung erst nach Freigabe, falsche Schalter brechen ab.')
