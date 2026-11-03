/**
 * Fast-Doppel aus `data/dub-confirmed.yaml` entfernen (Regel und Ausnahmen: `pipeline/lib/handbeleg-fast-doppel.ts`).
 * Aufruf: `npx tsx tools/handbelege-fast-doppel.ts [--trocken] [Datei]`; ohne Datei die Handbelege im Arbeitsordner.
 * Gegenprobe vor dem Schreiben: Die Zahl der Belege sinkt genau um `entfernt`, und jeder verbleibende Beleg stand vorher da.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { entferneFastDoppel } from '../pipeline/lib/handbeleg-fast-doppel.ts'

const args = process.argv.slice(2)
const trocken = args.includes('--trocken')
const pfad = args.find((a) => !a.startsWith('--')) ?? 'data/dub-confirmed.yaml'
const text = readFileSync(pfad, 'utf8')
const bilanz = entferneFastDoppel(text)
const vorher = (yaml.load(text) as unknown[]) ?? []
const nachher = (yaml.load(bilanz.text) as unknown[]) ?? []
const stand = new Set(vorher.map((b) => JSON.stringify(b)))
const ok = vorher.length - nachher.length === bilanz.entfernt && nachher.every((b) => stand.has(JSON.stringify(b)))
console.log(`Belege vorher ${vorher.length}, nachher ${nachher.length}, entfernt ${bilanz.entfernt}`)
console.log(`Gruppen ${bilanz.gruppen}, davon nicht zusammengeführt: ${bilanz.gemischt} mit gemischter Herkunft, ${bilanz.mitKommentar} mit eigenem Kommentar`)
if (!ok) {
  console.error('Gegenprobe gescheitert — nichts geschrieben.')
  process.exit(1)
}
if (!trocken) writeFileSync(pfad, bilanz.text)
console.log(trocken ? '(trocken — nichts geschrieben)' : `${pfad} geschrieben`)
