// Vorlader für pipeline/check-kanal-messung.ts: Der Lauf von pipeline/fetch-pruefungen.ts schreibt wirklich, aber nur in eine Wegwerfdatei.
// GET /pruefung liefert die Meldungen aus KANAL_MOCK_MELDUNGEN (JSON-Liste von Feldern, die die Grundzeile überschreiben); POST (Abhaken) tut nichts.
// dub-confirmed.yaml wird aus KANAL_MOCK_YAML gelesen und dorthin geschrieben, jede andere Schreibung der Pipeline entfällt.
// Der Bestand ist eine Attrappe (nichts aus public/data).
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const URL_DER_MELDUNG = 'https://www.amazon.de/dp/B0TESTKAN1'
const TITEL_ID = 1
const attrappe = {
  titles: [{ id: TITEL_ID, streams: [{ platform: 'primevideo', url: URL_DER_MELDUNG }] }],
  franchises: {},
  cartoons: [],
}
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/
const belegDatei = /(?:^|[\\/])data[\\/]dub-confirmed\.yaml$/

/* Die Merkliste der Kanal-Seiten (`data/kanal-seiten.json`) liegt wie die Belegdatei in einer Wegwerfdatei (KANAL_MOCK_MERKLISTE). */
const merkDatei = /(?:^|[\\/])data[\\/]kanal-seiten\.json$/
const ziel = (p) => (belegDatei.test(p) ? process.env.KANAL_MOCK_YAML : merkDatei.test(p) ? process.env.KANAL_MOCK_MERKLISTE : null)

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
  plattform: 'primevideo',
  url: URL_DER_MELDUNG,
  sprachen: '[]',
  befund: 'kein_dub',
  titel: 'Test',
  folgen: null,
  folge_nr: null,
  staffel: null,
  staffeln: null,
  serientitel: null,
  notiz: 'Kanal-Titel',
  teil_von: null,
  teil_bis: null,
  seiten_kennung: null,
  titel_id: TITEL_ID,
  folge: null,
}
globalThis.fetch = async (url, opt) => {
  const holen = String(url).includes('/pruefung') && !(opt && opt.method === 'POST')
  if (!holen) return new Response('{}', { status: 200 })
  const meldungen = JSON.parse(process.env.KANAL_MOCK_MELDUNGEN).map((m, i) => ({ ...grundzeile, id: 90000 + i, ...m }))
  return new Response(JSON.stringify({ pruefungen: meldungen }), { status: 200, headers: { 'content-type': 'application/json' } })
}
