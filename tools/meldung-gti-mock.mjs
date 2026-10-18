// Vorlader für pipeline/check-meldung-gti.ts: drei Titel mit je einer gti-Adresse (JustWatchs Amazon-Weg), eine Meldung ohne
// `titel_id` an der mittleren. Der Bestand ist eine Attrappe wie in `kanal-abgehakt-mock.mjs`; GET /pruefung liefert die Meldung.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const gti = (n) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const titel = (id) => ({ id, titleDe: `Gti-Titel ${id}`, episodes: 12, streams: [{ platform: 'primevideo', url: gti(id) }] })

const attrappe = { titles: [titel(1), titel(2), titel(3)], franchises: {}, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  const treffer = typeof p === 'string' ? bestandDatei.exec(p) : null
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
syncBuiltinESMExports()

const echt = globalThis.fetch
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/pruefung') && !(opt && opt.method === 'POST')) {
    const zeile = {
      id: 900001,
      plattform: 'primevideo',
      url: `${gti(2)}&ref_=atv_dp`,
      sprachen: '["Deutsch"]',
      befund: 'dub',
      titel: 'Gti-Titel 2',
      folgen: 12,
      folge_nr: null,
      staffel: 1,
      staffeln: null,
      serientitel: null,
      notiz: 'Amazon-Seite 0TESTGTI2: alle 12 Folgen geprüft, zugang=abo',
      teil_von: null,
      teil_bis: null,
      gemeldet_am: new Date().toISOString(),
      seiten_kennung: '0TESTGTI2',
      titel_id: null,
      folge: null,
    }
    return new Response(JSON.stringify({ pruefungen: [zeile] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return echt(url, opt)
}
