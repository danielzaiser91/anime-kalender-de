// Vorlader für pipeline/check-nein-datum.ts: ein Lauf von fetch-pruefungen.ts mit einer einzigen Disney+-Meldung „nichts da“ (weg).
// NEIN_DATUM_ALT bestimmt, was `data/dub-confirmed.yaml` vorher enthält: 'nein' = dasselbe Nein vom 26.08.2026, 'ja' = Nein vom 26.08.
// plus ein jüngeres Ja vom 15.09., sonst leer. Schreibzugriffe gehen als JSON-Zeilen (Pfad, Inhalt) an NEIN_DATUM_LOG, nicht auf die Platte.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const ADRESSE = 'https://www.disneyplus.com/de-de/browse/entity-900010'
const NOTIZ = 'Disney+ meldet: nicht in deinem Gebiet verfügbar'
const nein = ['- anilistId: 900010', '  title: "Testserie"', '  platform: disneyplus', `  url: ${ADRESSE}`, '  available: false', "  checkedAt: '2026-08-26'", `  note: "${NOTIZ}"`]
const ja = ['- anilistId: 900010', '  title: "Testserie"', '  platform: disneyplus', '  dub: true', "  checkedAt: '2026-09-15'"]
const alt = { nein: [...nein, ''], ja: [...nein, '', ...ja, ''], leer: [''] }[process.env.NEIN_DATUM_ALT ?? 'leer'].join('\n')

const attrappe = { titles: [{ id: 900010, titleDe: 'Testserie', episodes: 12, streams: [{ platform: 'disneyplus', url: ADRESSE }] }], franchises: {}, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/
const belegDatei = /(?:^|[\\/])data[\\/]dub-confirmed\.yaml$/
const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  if (typeof p !== 'string') return echteLesung(p, ...rest)
  if (belegDatei.test(p)) return alt
  const treffer = bestandDatei.exec(p)
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
const log = fs.openSync(process.env.NEIN_DATUM_LOG, 'a')
const schreibe = (p, inhalt) => fs.writeSync(log, JSON.stringify({ pfad: String(p), inhalt: String(inhalt) }) + '\n')
fs.writeFileSync = schreibe
fs.appendFileSync = schreibe
fs.mkdirSync = () => undefined
fs.rmSync = () => undefined
syncBuiltinESMExports()

const meldung = {
  id: 900101,
  plattform: 'disneyplus',
  url: ADRESSE,
  sprachen: null,
  befund: 'weg',
  titel: 'Testserie',
  folgen: null,
  folge_nr: null,
  staffel: null,
  staffeln: null,
  serientitel: 'Testserie',
  notiz: NOTIZ,
  teil_von: null,
  teil_bis: null,
  gemeldet_am: '2026-10-24T15:30:19Z',
  seiten_kennung: null,
  titel_id: 900010,
  folge: null,
}

globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/pruefung') && !(opt && opt.method === 'POST')) {
    return new Response(JSON.stringify({ pruefungen: [meldung] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  schreibe(`${opt?.method ?? 'GET'} ${url}`, String(opt?.body ?? ''))
  return new Response('{}', { status: 200 })
}
