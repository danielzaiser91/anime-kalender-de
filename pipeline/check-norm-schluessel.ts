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
