// Vorlader für pipeline/check-meldungs-auffaelligkeiten.ts, Szenario in AUFFAELLIGKEITEN_LAUF. Lauf 1: drei Meldungen (Titel 1: 6 von 24 Folgen =
// Normalfall, Titel 3: 40 von 12 = Befund, Titel 4: Staffel-Widerspruch), alte Datei mit unlesbarem Eintrag und einem noch offenen Altbefund (Titel 2). Lauf 2: nur eine harmlose
// Meldung, die Datei hält zwei noch zutreffende Befunde (älteres Datum). Lauf 3: harmlose Meldung, die Datei hält einen erledigten Befund.
// Lauf 4: genau ein neuer Befund (Titel 3) neben zwei offenen Altbefunden.
// Lauf 5: 16 Netflix-Folgen mit gesperrter Folgenkennung (Sperrliste), Lauf 6: 16 mit unbekannten Kennungen (Gegenfall).
// Schreibzugriffe gehen nicht auf die Platte, sondern als JSON-Zeilen an die Datei in AUFFAELLIGKEITEN_LOG (Pfad, Inhalt).
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const gti = (n) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const titel = (id, folgen) => ({ id, titleDe: `Gti-Titel ${id}`, episodes: folgen, streams: [{ platform: 'primevideo', url: gti(id) }] })
const reihe = [
  { id: 4, name: 'Reihe', format: 'TV', jpYear: 2020 },
  { id: 5, name: 'Reihe 2', format: 'TV', jpYear: 2021 },
]
const NETFLIX = 'https://www.netflix.com/title/81183924'
/* Netflix trennt die Staffeln je Gruppe, ADN nicht: die Mehrstaffel-Fälle (Lauf 7-9) laufen über ADN-Adressen. */
const ADN_S2 = 'https://animationdigitalnetwork.com/de/video/1350-staffel-zwei'
const ADN_OHNE_REIHE = 'https://animationdigitalnetwork.com/de/video/1351-ohne-reihe'
const netflixTitel = { id: 6, titleDe: 'Gti-Titel 6', episodes: 6, streams: [{ platform: 'netflix', url: NETFLIX }, { platform: 'adn', url: ADN_OHNE_REIHE }] }
const titel5 = { ...titel(5, 12), streams: [...titel(5, 12).streams, { platform: 'adn', url: ADN_S2 }] }
const attrappe = { titles: [titel(1, 24), titel(2, 12), titel(3, 12), titel(4, 12), titel5, netflixTitel], franchises: { 40: reihe }, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/
const befundDatei = /(?:^|[\\/])data[\\/]meldungs-auffaelligkeiten\.json$/
const am = '2026-10-01'
const alteDateien = {
  1: [
    { am: '2026-01-01', text: 'Meldung 1: alter Befund, den der Lauf nicht mehr erzeugt' },
    { am, text: 'Meldung 6: 40 Folgen gemeldet (je Staffel), Titel 2 (Gti-Titel 2) hat 12 (X)' },
  ],
  2: [
    { am, text: 'Meldung 900002: 40 Folgen gemeldet (je Staffel), Titel 3 (Gti-Titel 3) hat 12 (0TESTGTI3)' },
    { am, text: 'Meldung 900003: Titel 4 (Gti-Titel 4) ist Staffel 1, die Seite 0TESTGTI4 Staffel 2' },
  ],
  3: [{ am, text: 'Meldung 5: 30 Folgen gemeldet (je Staffel), Titel 1 (Gti-Titel 1) hat 12 (X)' }],
  5: [],
  6: [],
  7: [{ am: '2026-11-10', text: 'Meldung 26355,26356: 25 Folgen gemeldet, Titel 5 (Gti-Titel 5) hat 12 (https://animationdigitalnetwork.com/de/video/1350-staffel-zwei)' }],
  8: [],
  9: [],
  4: [
    { am, text: 'Meldung 6: 40 Folgen gemeldet (je Staffel), Titel 2 (Gti-Titel 2) hat 12 (X)' },
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

/* Staffel 2 von Dragon Age unter der Adresse von Angry Birds (Sperrliste): 16 Folgen, Folgenkennungen 81508284 bis 81508299 (Meldungskopie 06.11.2026) oder unbekannte. */
const netflixZeilen = (ersteId, ersteKennung) =>
  Array.from({ length: 16 }, (_x, i) => ({
    ...zeile(ersteId + i, 6, 16),
    plattform: 'netflix',
    url: NETFLIX,
    seiten_kennung: null,
    folge_nr: i + 1,
    staffel: 2,
    folge: String(ersteKennung + i),
    notiz: null,
  }))

/* Lauf 7-9: eine Adresse, mehrere Staffeln, je Eintrag [Staffel, Anzahl Zeilen] (ADN 1350: Staffel 1 und 2 unter einer Adresse). */
const mehrStaffeln = (ersteId, url, staffeln) =>
  staffeln.flatMap(([staffel, anzahl], k) =>
    Array.from({ length: anzahl }, (_x, i) => ({
      ...zeile(ersteId + k * 100 + i, 6, 0),
      plattform: 'adn',
      url,
      seiten_kennung: null,
      folge_nr: i + 1,
      staffel,
      folge: null,
      notiz: null,
      folgen: null,
    })),
  )

const LIEFERUNG = {
  1: () => [zeile(900001, 1, 6), zeile(900002, 3, 40), zeile(900003, 4, 12, 2, 4)],
  4: () => [zeile(900002, 3, 40)],
  5: () => netflixZeilen(900101, 81508284),
  6: () => netflixZeilen(900201, 99000001),
  7: () => mehrStaffeln(900301, ADN_S2, [[1, 13], [2, 12]]),
  8: () => mehrStaffeln(900401, ADN_S2, [[1, 3], [2, 20]]),
  9: () => mehrStaffeln(900501, ADN_OHNE_REIHE, [[1, 6], [2, 10]]),
}

globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/pruefung') && !(opt && opt.method === 'POST')) {
    const pruefungen = (LIEFERUNG[lauf] ?? (() => [zeile(900004, 1, 6)]))()
    return new Response(JSON.stringify({ pruefungen }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  /* Jeder andere Abruf bleibt im Prozess (kein Netz) und steht im Log. */
  schreibe(`${opt?.method ?? 'GET'} ${url}`, String(opt?.body ?? ''))
  return new Response('{}', { status: 200 })
}
