/**
 * Verdrahtung: `fetch-rohfolgen.ts` sperrt fremde Netflix-Meldungen und warnt vor neuen (13.10.2026, Barbie unter The Loud House).
 * Das ganze Skript läuft zweimal gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/rohfolgen-ablauf-mock.mjs`) mit denselben Zeilen
 * (gti wörtlich aus der Meldungskopie): einmal mit der echten Sperrliste, einmal ohne. Fehlt der Aufruf im Skript, fehlt Zeile oder Warnung.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/rohfolgen-ablauf-mock.mjs')).href

const BARBIE = 'https://www.netflix.com/title/81184735'
const LOUD = 'https://www.netflix.com/title/81186971'
const GTI = [81184787, 81184789, 81184792, 81184790, 81184793, 81184791, 81184795, 81184794, 81184796, 81184799, 81184788, 81184797, 81184798]
let id = 0
const zeilen = (url: string) =>
  GTI.map((gti, i) => ({
    id: ++id,
    url,
    asin: null,
    gti: String(gti),
    nummer: i + 1,
    titel: `Folge ${i + 1}`,
    erschienen: null,
    dauer_sek: null,
    sprachen: JSON.stringify(['de|Deutsch']),
    untertitel: null,
    staffel_text: '81184773',
    staffel_nr: 2,
    gemeldet_am: '2026-10-13T15:53:32Z',
    titel_id: null,
    plattform: 'netflix',
  }))
const titel = (tid: number, url: string, name: string) => ({ id: tid, titleDe: name, jpYear: 2026, episodes: 13, format: 'TV', streams: [{ platform: 'netflix', url }] })

function lauf(mitSperre: boolean): string {
  const kulisse = mkdtempSync(join(tmpdir(), 'netflix-fremde-lauf-'))
  const schreibe = (pfad: string, inhalt: string) => {
    mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
    writeFileSync(join(kulisse, pfad), inhalt)
  }
  try {
    schreibe('rohfolgen.json', JSON.stringify([...zeilen(BARBIE), ...zeilen(LOUD)]))
    schreibe('public/data/titles.json', JSON.stringify([titel(7101, BARBIE, 'Barbie Probe'), titel(7102, LOUD, 'Loud Probe')]))
    schreibe('public/data/cartoons.json', '[]')
    schreibe('public/data/ohne-synchro.json', '[]')
    schreibe('data/dub-confirmed.yaml', '[]\n')
    schreibe('data/cartoon-folgen.json', '{}')
    if (mitSperre) copyFileSync(join(wurzel, 'data/netflix-fremde-meldungen.json'), join(kulisse, 'data/netflix-fremde-meldungen.json'))
    const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-rohfolgen.ts')], {
      cwd: wurzel,
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
    })
    return `${r.status === 0 ? 'EXIT0' : `EXIT${r.status}`}\n${r.stdout}\n${r.stderr}`
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}

const fehler: string[] = []
const mit = lauf(true)
if (!mit.startsWith('EXIT0')) fehler.push(`Lauf mit Sperrliste: ${mit.slice(0, 300)}`)
if (!/13 Rohfolgen aussortiert .*fremde Netflix-Meldungen/.test(mit)) fehler.push('mit Sperrliste: die 13 Zeilen unter Loud House wurden nicht aussortiert')
if (mit.includes('WARNUNG Netflix-Meldung unter zwei Adressen')) fehler.push('mit Sperrliste: Warnung trotz gesperrter Zeilen')
const ohne = lauf(false)
if (!ohne.startsWith('EXIT0')) fehler.push(`Lauf ohne Sperrliste: ${ohne.slice(0, 300)}`)
if (!ohne.includes(`WARNUNG Netflix-Meldung unter zwei Adressen: Staffelkennung 81184773 unter ${BARBIE} und ${LOUD}`)) fehler.push('ohne Sperrliste: keine Warnung für Staffelkennung 81184773')
if (/Rohfolgen aussortiert/.test(ohne)) fehler.push('ohne Sperrliste: es wurde trotzdem aussortiert')
if (fehler.length) {
  console.error(`FEHL check-netflix-fremde-meldung-lauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-netflix-fremde-meldung-lauf: mit Sperrliste 13 fremde Zeilen aussortiert, ohne sie die Warnung für Staffelkennung 81184773.')
