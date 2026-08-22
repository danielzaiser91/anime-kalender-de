/**
 * Was steht im deutschen Katalog über Lizenzfristen — und was folgt daraus für
 * die Prüftaktung?
 *
 * Der Hintergrund (Daniel, 22.08.2026): „das lizenz attribut … könnten wir
 * nutzen um serien zu kennzeichnen bis wann sie voraussichtlich bei crunchy im
 * raum deutschland mit deutscher synchro verfügbar sind, sodass wir nicht
 * erneut unnötig prüfen."
 *
 * Vorsicht ist geboten: Aus **US-Sicht** trug `availability_ends` bei 445 von
 * 911 Adressen ein Datum in der Vergangenheit — Dragon Ball (weg) und JoJo
 * (sichtbar) beide den 31.12.2025. Als Kriterium für „nicht mehr im Angebot"
 * war das Feld damit widerlegt. Ob es im deutschen Katalog trägt, ist eine
 * andere Frage, und genau die misst dieses Werkzeug.
 *
 * Aufruf: node tools/analyse-cr-lizenzen.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import zlib from 'node:zlib'

const PLATZHALTER = '9998'
const jetzt = new Date().toISOString()

const dateien = readdirSync('data/crunchyroll-raw').filter((d) => d.endsWith('.de.json.gz'))
console.log(`Deutsche Rohantworten im Archiv: ${dateien.length}`)
if (!dateien.length) {
  console.log('Noch keine — der Lauf muss erst durch sein.')
  process.exit(0)
}

const zahlen = { ohneEnde: 0, kuenftig: 0, vergangen: 0, gemischt: 0 }
const kuenftige = []
const jeMonat = {}

for (const d of dateien) {
  let r
  try {
    r = JSON.parse(zlib.gunzipSync(readFileSync('data/crunchyroll-raw/' + d)).toString())
  } catch {
    continue
  }
  const folgen = sammleFolgen(r)
  if (!folgen.length) continue

  const enden = folgen
    .map((f) => f.availability_ends)
    .filter((e) => e && !String(e).startsWith(PLATZHALTER))
  if (!enden.length) {
    zahlen.ohneEnde++
    continue
  }
  const spaetestes = enden.slice().sort().at(-1)
  const frühestes = enden.slice().sort()[0]
  if (spaetestes < jetzt) zahlen.vergangen++
  else if (frühestes >= jetzt) {
    zahlen.kuenftig++
    kuenftige.push({ id: r.seriesId, url: r.url, bis: spaetestes.slice(0, 10), folgen: folgen.length })
  } else zahlen.gemischt++

  const monat = spaetestes.slice(0, 7)
  jeMonat[monat] = (jeMonat[monat] ?? 0) + 1
}

console.log('\nLizenzenden je Serie:')
console.log('  ohne jedes Enddatum:      ', zahlen.ohneEnde)
console.log('  alle Enden in der Zukunft:', zahlen.kuenftig)
console.log('  alle Enden vergangen:     ', zahlen.vergangen)
console.log('  gemischt:                 ', zahlen.gemischt)

console.log('\nWann die Lizenzen enden (spätestes Ende je Serie, nach Monat):')
for (const [monat, n] of Object.entries(jeMonat).sort().slice(-14)) {
  console.log(`   ${monat}  ${'█'.repeat(Math.min(40, n))} ${n}`)
}

console.log('\nDie zehn Serien mit dem nächsten Lizenzende in der Zukunft:')
for (const k of kuenftige.sort((a, b) => a.bis.localeCompare(b.bis)).slice(0, 10)) {
  console.log(`   ${k.bis}  ${k.folgen.toString().padStart(4)} Folgen  ${k.url.slice(0, 60)}`)
}

function sammleFolgen(r) {
  const e = r.episodes
  if (!e) return []
  return Array.isArray(e) ? e : Object.values(e).flatMap((x) => x.data ?? x)
}
