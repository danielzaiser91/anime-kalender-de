// Vorlader für pipeline/check-meldungs-auffaelligkeiten.ts, Szenario in AUFFAELLIGKEITEN_LAUF. Lauf 1: drei Meldungen (Titel 1: 6 von 24 Folgen =
// Normalfall, Titel 3: 40 von 12 = Befund, Titel 4: Staffel-Widerspruch), alte Datei mit unlesbarem Eintrag und einem noch offenen Altbefund (Titel 2). Lauf 2: nur eine harmlose
// Meldung, die Datei hält zwei noch zutreffende Befunde (älteres Datum). Lauf 3: harmlose Meldung, die Datei hält einen erledigten Befund.
// Lauf 4: genau ein neuer Befund (Titel 3) neben zwei offenen Altbefunden.
// Schreibzugriffe gehen nicht auf die Platte, sondern als JSON-Zeilen an die Datei in AUFFAELLIGKEITEN_LOG (Pfad, Inhalt).
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const gti = (n) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const titel = (id, folgen) => ({ id, titleDe: `Gti-Titel ${id}`, episodes: folgen, streams: [{ platform: 'primevideo', url: gti(id) }] })
const reihe = [
  { id: 4, name: 'Reihe', format: 'TV', jpYear: 2020 },
  { id: 5, name: 'Reihe 2', format: 'TV', jpYear: 2021 },
]
const attrappe = { titles: [titel(1, 24), titel(2, 12), titel(3, 12), titel(4, 12), titel(5, 12)], franchises: { 40: reihe }, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/
const befundDatei = /(?:^|[\\/])data[\\/]meldungs-auffaelligkeiten\.json$/
const am = '2026-10-01'
const alteDateien = {
  1: [
    { am: '2026-01-01', text: 'Meldung 1: alter Befund, den der Lauf nicht mehr erzeugt' },
    { am, text: 'Meldung 6: 40 Folgen gemeldet, Titel 2 (Gti-Titel 2) hat 12 (X)' },
  ],
  2: [
    { am, text: 'Meldung 900002: 40 Folgen gemeldet, Titel 3 (Gti-Titel 3) hat 12 (0TESTGTI3)' },
    { am, text: 'Meldung 900003: Titel 4 (Gti-Titel 4) ist Staffel 1, die Seite 0TESTGTI4 Staffel 2' },
  ],
  3: [{ am, text: 'Meldung 5: 30 Folgen gemeldet, Titel 1 (Gti-Titel 1) hat 12 (X)' }],
  4: [
    { am, text: 'Meldung 6: 40 Folgen gemeldet, Titel 2 (Gti-Titel 2) hat 12 (X)' },
    { am, text: 'Meldung 900003: Titel 4 (Gti-Titel 4) ist Staffel 1, die Seite 0TESTGTI4 Staffel 2' },
  ],
}
const lauf = Number(process.env.AUFFAELLIGKEITEN_LAUF)
const alt = alteDateien[lauf]

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  if (typeof p !== 'string') return echteLesung(p, ...rest)
  if (befundDatei.test(p)) return JSON.stringify(alt)
  const treffer = bestandDatei.exec(p)
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
const log = fs.openSync(process.env.AUFFAELLIGKEITEN_LOG, 'a')
const schreibe = (p, inhalt) => fs.writeSync(log, JSON.stringify({ pfad: String(p), inhalt: String(inhalt) }) + '\n')
fs.writeFileSync = schreibe
fs.appendFileSync = schreibe
fs.mkdirSync = () => undefined
fs.rmSync = () => undefined
syncBuiltinESMExports()

const zeile = (id, titelNr, folgen, staffel = 1, titelId = null) => ({
  id,
  plattform: 'primevideo',
  url: `${gti(titelNr)}&ref_=atv_dp`,
  sprachen: '["Deutsch"]',
  befund: 'dub',
  titel: `Gti-Titel ${titelNr}`,
  folgen,
  folge_nr: null,
  staffel,
  staffeln: null,
  serientitel: null,
  notiz: `Amazon-Seite 0TESTGTI${titelNr}: alle ${folgen} Folgen geprüft, zugang=abo`,
  teil_von: null,
  teil_bis: null,
  gemeldet_am: new Date().toISOString(),
  seiten_kennung: `0TESTGTI${titelNr}`,
  titel_id: titelId,
  folge: null,
})

globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/pruefung') && !(opt && opt.method === 'POST')) {
    const pruefungen = lauf === 1 ? [zeile(900001, 1, 6), zeile(900002, 3, 40), zeile(900003, 4, 12, 2, 4)] : lauf === 4 ? [zeile(900002, 3, 40)] : [zeile(900004, 1, 6)]
    return new Response(JSON.stringify({ pruefungen }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  /* Jeder andere Abruf bleibt im Prozess (kein Netz) und steht im Log. */
  schreibe(`${opt?.method ?? 'GET'} ${url}`, String(opt?.body ?? ''))
  return new Response('{}', { status: 200 })
}
