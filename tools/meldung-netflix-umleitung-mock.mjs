// Vorlader für pipeline/check-netflix-umleitung-ablauf.ts: ein Titel mit Netflix-Seite 81171925, eine Meldung der Umleitung 81301833
// (Ranma ½, 24.10.2026). Bestand als Attrappe wie in `meldung-summenseite-mock.mjs`; Wurzel (AK_ROOT) ist ein Wegwerf-Ordner.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { baueFetchAttrappe, istMeldungsabruf, meldungsAntwort } from './fetch-attrappe.mjs'

const titel = { id: 900001, titleDe: 'Umleitungs-Titel', episodes: 12, streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/81171925' }] }
const attrappe = { titles: [titel], franchises: {}, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  const treffer = typeof p === 'string' ? bestandDatei.exec(p) : null
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
syncBuiltinESMExports()

const zeile = (nr) => ({
  id: 920000 + nr,
  plattform: 'netflix',
  url: 'https://www.netflix.com/title/81301833',
  sprachen: '["Deutsch"]',
  befund: 'dub',
  titel: 'Umleitungs-Titel',
  folgen: 12,
  folge_nr: nr,
  staffel: 1,
  staffeln: JSON.stringify([{ seq: 1, name: 'St. 1', folgen: 12, erste: 1 }]),
  serientitel: null,
  notiz: 'Netflix-Seite: Umleitungstest',
  teil_von: null,
  teil_bis: null,
  gemeldet_am: '2026-10-18T10:00:00.000Z',
  seiten_kennung: null,
  titel_id: 900001,
  folge: null,
})

globalThis.fetch = baueFetchAttrappe(
  (url, opt) => {
    if (!istMeldungsabruf(url, opt)) return undefined
    const pruefungen = Array.from({ length: 12 }, (_, i) => zeile(i + 1))
    return meldungsAntwort(pruefungen)
  },
)
