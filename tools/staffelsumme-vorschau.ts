/**
 * Schnellweg zu F100: rechnet Beyblade X (Netflix-Staffel 2) mit der Staffelsumme auf unsere Zählung um, direkt auf den echten Daten.
 * Aufruf: `npx tsx tools/staffelsumme-vorschau.ts [Wurzel]`; liest nur, schreibt nichts.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { urteileStaffelsumme } from '../pipeline/lib/staffelsumme.ts'

const wurzel = resolve(process.argv[2] ?? '.')
const lies = (p: string) => JSON.parse(readFileSync(resolve(wurzel, p), 'utf8'))

const jw = lies('data/justwatch-audio.json')['165159'].staffeln as { nr: number; folgen: number }[]
const liste = (lies('data/anisearch-folgen.json')['18438'].folgen as { nr: number; de?: string }[]).map((f) => ({ nr: f.nr, de: f.de ?? null, en: null }))
const rtl = (lies('data/rtlplus-folgen.json').titel['165159'].videos as { staffel: number; folge: number; titel: string }[]).filter((v) => v.staffel === 2)
const anbieter = lies('data/anbieter-staffeln.json')['81924739'].staffeln as { seq: number; folgen: number }[]

const urteil = urteileStaffelsumme({
  erste: anbieter[0]!.seq,
  jw,
  blockFolgen: anbieter.reduce((n, s) => n + s.folgen, 0),
  meldungen: rtl.map((v) => ({ pos: v.folge, titel: v.titel })),
  liste,
  quelle: 'RTL+ Staffel 2 gegen aniSearch',
})
if (!urteil.ok) {
  console.log(`offen: ${urteil.grund}`)
  process.exit(1)
}
const folgen = anbieter.reduce((n, s) => n + s.folgen, 0)
console.log(`Netflix Staffel ${anbieter[0]!.seq}, Folge 1..${folgen} = unsere Folge ${urteil.versatz + 1}..${urteil.versatz + folgen}`)
console.log(urteil.vermerk)
