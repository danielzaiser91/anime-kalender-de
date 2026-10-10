/**
 * Prüft `bekannteFolgen()` an den Fällen aus dem Betrieb (4.24.21, 10.10.2026).
 * Aufruf: node tools/pruefstand-bekannt-pruefen.mjs (Teil von `npm run check:extension`).
 */
import { bekannteFolgen } from './pruefstand-bekannt.mjs'

const kennung = (u) => /entity-([0-9a-f-]{8,})/i.exec(u)?.[1]
const stream = (url, dubRanges) => ({ platform: 'disneyplus', url: `https://www.disneyplus.com/de-de/browse/entity-${url}`, dubRanges })
const fehler = []
const pruefe = (name, ok, gefunden) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

const BAND = '8cc06990-0faf-4a7e-ac1f-fb74cb4b9286'
const BLEACH = 'aaaaaaaa-0000-0000-0000-000000000185'
const NARUTO = 'bbbbbbbb-0000-0000-0000-000000000001'

const titel = [
  { streams: [stream(BAND, [{ from: 1, to: 11, dub: true }])] },
  /* Bleach TYBW – The Calamity (185874): 1–6 deutsch, 7–8 ohne, Disney+ führt 10. */
  { streams: [stream(BLEACH, [{ from: 1, to: 6, dub: true }, { from: 7, to: 8, dub: false }])] },
]
const b = bekannteFolgen(titel, 'disneyplus', kennung)
console.log('bekannteFolgen')
pruefe('rein deutsche Spanne: die obere Grenze', b[BAND] === 11, b)
pruefe('Teilsynchro (Spanne ohne Deutsch): keine Angabe, also kein "Neue Folgen 9–10"', !(BLEACH in b), b)

const geteilt = [
  { streams: [stream(NARUTO, [{ from: 1, to: 53, dub: true }])] },
  { streams: [stream(NARUTO, [{ from: 54, to: 112, dub: true }])] },
]
pruefe('zwei Einträge an einer Adresse: keine Angabe', !(NARUTO in bekannteFolgen(geteilt, 'disneyplus', kennung)))
pruefe('ohne Spannen: keine Angabe', Object.keys(bekannteFolgen([{ streams: [stream(BAND, undefined)] }], 'disneyplus', kennung)).length === 0)
pruefe('anderer Anbieter bleibt draußen', Object.keys(bekannteFolgen(titel, 'netflix', kennung)).length === 0)

if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zu `bekannt` halten.')
