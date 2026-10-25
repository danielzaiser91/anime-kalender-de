// Vorlader für pipeline/check-kanal-abgehakt.ts: GET /pruefung liefert eine erfundene Kanal-Meldung ohne Urteil an einer erfundenen Adresse.
// Der Bestand ist eine Attrappe: Lesezugriffe auf public/data/{titles,franchises,cartoons}.json liefern sie statt der gebauten Dateien.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { baueFetchAttrappe, istMeldungsabruf, meldungsAntwort } from './fetch-attrappe.mjs'

const URL_DER_MELDUNG = 'https://www.disneyplus.com/de-de/browse/entity-00000000-0000-0000-0000-000000000000'
const TITEL_ID = 1

const attrappe = {
  titles: [{ id: TITEL_ID, streams: [{ platform: 'disneyplus', url: URL_DER_MELDUNG }] }],
  franchises: {},
  cartoons: [],
}
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  const treffer = typeof p === 'string' ? bestandDatei.exec(p) : null
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
syncBuiltinESMExports()

const echt = globalThis.fetch
globalThis.fetch = baueFetchAttrappe(
  (url, opt) => {
    if (!istMeldungsabruf(url, opt)) return undefined
    const zeile = {
      id: 99999,
      plattform: 'disneyplus',
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
      gemeldet_am: new Date().toISOString(),
      seiten_kennung: null,
      titel_id: TITEL_ID,
      folge: null,
    }
    return meldungsAntwort([zeile])
  },
  echt,
)
