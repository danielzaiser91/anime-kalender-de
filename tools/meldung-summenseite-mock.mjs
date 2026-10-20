// Vorlader für pipeline/check-meldung-summenseite.ts: drei Titel mit je einer Prime-Seite und je einer Meldung (Bestand als Attrappe wie in
// `meldung-gti-mock.mjs`). Titel 1 (13 Folgen): Folge 1–25, die Summenseite zählt durch wie Haikyu!! Staffel 4 mit 27 Folgen.
// Titel 2 (12 Folgen): nur Folge 14–25, also gar keine eigene. Titel 3 (12 Folgen): Meldung ohne Folgennummer. Titel 4 (12 Folgen): 1–14, also um 2 drüber: bleibt. Titel 5: 1–15, um 3 drüber: gekappt.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const seite = (n) => `https://www.amazon.de/gp/video/detail/B0TESTSUMME${n}`
const titel = (id, episodes) => ({ id, titleDe: `Summen-Titel ${id}`, episodes, streams: [{ platform: 'primevideo', url: seite(id) }] })
const attrappe = { titles: [titel(1, 13), titel(2, 12), titel(3, 12), titel(4, 12), titel(5, 12)], franchises: {}, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  const treffer = typeof p === 'string' ? bestandDatei.exec(p) : null
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
syncBuiltinESMExports()

const zeile = (titelId, nr, zaehler) => ({
  id: 910000 + titelId * 100 + zaehler,
  plattform: 'primevideo',
  url: seite(titelId),
  sprachen: '["Deutsch"]',
  befund: 'dub',
  titel: `Summen-Titel ${titelId}`,
  folgen: 27,
  folge_nr: nr,
  staffel: 1,
  staffeln: null,
  serientitel: null,
  notiz: `Amazon-Seite B0TESTSUMME${titelId}: alle 27 Folgen geprüft, zugang=abo`,
  teil_von: null,
  teil_bis: null,
  gemeldet_am: '2026-10-18T10:00:00.000Z',
  seiten_kennung: `B0TESTSUMME${titelId}`,
  titel_id: null,
  folge: null,
})

const bereich = (titelId, von, bis) => Array.from({ length: bis - von + 1 }, (_, i) => zeile(titelId, von + i, i))

const echt = globalThis.fetch
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/pruefung') && !(opt && opt.method === 'POST')) {
    const pruefungen = [...bereich(1, 1, 25), ...bereich(2, 14, 25), zeile(3, null, 0), ...bereich(4, 1, 14), ...bereich(5, 1, 15)]
    return new Response(JSON.stringify({ pruefungen }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return echt(url, opt)
}
