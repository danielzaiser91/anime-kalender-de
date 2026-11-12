// Vorlader für pipeline/check-adn-staffel-meldungen.ts: Der Lauf von pipeline/fetch-pruefungen.ts schreibt wirklich, aber nur in eine Wegwerfdatei.
// GET /pruefung liefert die Meldungen aus ADN_MOCK_MELDUNGEN (volle Zeilen); POST (Abhaken) tut nichts.
// dub-confirmed.yaml liegt in ADN_MOCK_YAML. Der Bestand ist ADN_MOCK_TITEL (JSON [id, Folgen, Jahr, Jahreszeit]) an ADN_MOCK_URL, ohne Angabe die fünf JoJo-Titel (Folgenzahl und Jahr wie in public/data).
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const URL_DER_MELDUNG = process.env.ADN_MOCK_URL ?? 'https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure'
const titel = (id, episodes, jpYear, jpSeason) => ({
  id,
  titleDe: `JoJo ${id}`,
  episodes,
  format: 'TV',
  jpYear,
  jpSeason,
  streams: [{ platform: 'adn', url: URL_DER_MELDUNG }],
})
const attrappe = {
  titles: (process.env.ADN_MOCK_TITEL ? JSON.parse(process.env.ADN_MOCK_TITEL).map((t) => titel(...t)) : [
    titel(14719, 26, 2012, 'FALL'),
    titel(20474, 24, 2014, 'SPRING'),
    titel(20799, 24, 2015, 'WINTER'),
    titel(21450, 39, 2016, 'SPRING'),
    titel(102883, 39, 2018, 'FALL'),
  ]),
  franchises: {},
  cartoons: [],
  'ohne-synchro': [],
}
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons|ohne-synchro)\.json$/
const belegDatei = /(?:^|[\\/])data[\\/]dub-confirmed\.yaml$/
const merkDatei = /(?:^|[\\/])data[\\/]kanal-seiten\.json$/
const ziel = (p) => (belegDatei.test(p) ? process.env.ADN_MOCK_YAML : merkDatei.test(p) ? `${process.env.ADN_MOCK_YAML}.kanal.json` : null)

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  if (typeof p !== 'string') return echteLesung(p, ...rest)
  const bestand = bestandDatei.exec(p)
  if (bestand) return JSON.stringify(attrappe[bestand[1]])
  return echteLesung(ziel(p) ?? p, ...rest)
}
const echteSchreibung = fs.writeFileSync
fs.writeFileSync = (p, ...rest) => {
  const datei = typeof p === 'string' ? ziel(p) : null
  if (datei) echteSchreibung(datei, ...rest)
}
const echtesExists = fs.existsSync
fs.existsSync = (p) => echtesExists(typeof p === 'string' ? (ziel(p) ?? p) : p)
fs.appendFileSync = () => {}
fs.rmSync = () => {}
fs.mkdirSync = () => {}
syncBuiltinESMExports()

const grundzeile = {
  plattform: 'adn',
  url: URL_DER_MELDUNG,
  sprachen: '[]',
  titel: 'Jojo’s Bizarre Adventure',
  folgen: null,
  staffeln: null,
  serientitel: 'Jojo’s Bizarre Adventure',
  notiz: null,
  teil_von: null,
  teil_bis: null,
  seiten_kennung: null,
  titel_id: null,
  folge: null,
}
globalThis.fetch = async (url, opt) => {
  const holen = String(url).includes('/pruefung') && !(opt && opt.method === 'POST')
  if (!holen) return new Response('{}', { status: 200 })
  const meldungen = JSON.parse(process.env.ADN_MOCK_MELDUNGEN).map((m, i) => ({ ...grundzeile, id: 91000 + i, ...m }))
  return new Response(JSON.stringify({ pruefungen: meldungen }), { status: 200, headers: { 'content-type': 'application/json' } })
}
