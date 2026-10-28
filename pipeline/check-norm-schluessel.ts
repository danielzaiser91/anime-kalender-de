import { readFileSync } from 'node:fs'
import { normSchluessel } from './lib/util.ts'

const faelle: Array<[string | null | undefined, string]> = [
  ['Attack on Titan: Final Season!', 'attackontitanfinalseason'],
  ['Re:Zero 2nd Season', 'rezero2ndseason'],
  ['Übermensch Öl', 'bermenschl'],
  ['A-B_C.d 7', 'abcd7'],
  ['12345', '12345'],
  ['  ', ''],
  ['', ''],
  [undefined, ''],
  [null, ''],
]

let fehler = 0
for (const [eingabe, erwartet] of faelle) {
  const ist = normSchluessel(eingabe)
  if (ist !== erwartet) {
    console.error(`✖ normSchluessel(${JSON.stringify(eingabe)}) = ${JSON.stringify(ist)}, erwartet ${JSON.stringify(erwartet)}`)
    fehler++
  }
}
if (fehler) process.exit(1)
console.log(`check-norm-schluessel: ${faelle.length} Fälle ok`)

// Umbau-Wache: die lokalen Helfer `norm`/`warte` sind gelöscht; ein freier Aufruf oder `.map(norm)` wäre erst zur Laufzeit ein ReferenceError.
const UMBAU_DATEIEN = [
  'bau/09-5-weitere-quellen.ts',
  'fetch-cr-filmbloecke.mjs',
  'fetch-cr-katalog.mjs',
  'fetch-kinoheld.ts',
  'fetch-rtlplus-folgen.ts',
  'fetch-toggo.ts',
  'fetch-wikipedia-folgen.ts',
  'lib/cr-einzelwerk-urteil.ts',
]
const ALTER_NAME = /(?<![\w.$])(?:norm|warte)\s*\(|[(,]\s*norm\s*[,)]/

export function findeAltAufrufe(text: string): string[] {
  const treffer: string[] = []
  text.split('\n').forEach((zeile, i) => {
    if (zeile.trim().startsWith('//')) return
    if (ALTER_NAME.test(zeile)) treffer.push(`${i + 1}: ${zeile.trim()}`)
  })
  return treffer
}

const altFaelle: Array<[string, number]> = [
  ['const a = x.map(norm)', 1],
  ['const a = x.map(normSchluessel)', 0],
  ['await warte(500)', 1],
  ['const n = norm(titel)', 1],
  ['const n = normSchluessel(titel)', 0],
  ['x.warte(1)', 0],
  ['// norm(a)', 0],
]
for (const [text, erwartet] of altFaelle) {
  if (findeAltAufrufe(text).length !== erwartet) {
    console.error(`✖ findeAltAufrufe(${JSON.stringify(text)}) ≠ ${erwartet} Treffer`)
    process.exit(1)
  }
}
let altTreffer = 0
for (const datei of UMBAU_DATEIEN) {
  const funde = findeAltAufrufe(readFileSync(new URL(`./${datei}`, import.meta.url), 'utf8'))
  for (const f of funde) console.error(`✖ ${datei}:${f}`)
  altTreffer += funde.length
}
if (altTreffer) process.exit(1)
console.log(`check-norm-schluessel: ${UMBAU_DATEIEN.length} Umbaudateien ohne alten Aufruf norm(/warte(`)
