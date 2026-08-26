/**
 * Die Delta-Historie durchsehen — was hat sich seit wann verändert?
 *
 * Ergänzt `pipeline/bestand-historie.ts`: Die schreibt je Lauf eine Zeile,
 * dieses Werkzeug liest sie zusammen. Gedacht für den täglichen Blick in den
 * nächsten Tagen (Daniel, 26.08.2026: „du es dir für die nächsten paar tage
 * vornimmst dieses delta zu überwachen, sodass wir mitbekommen falls wir
 * irgendwo echte probleme haben").
 *
 * Aufruf:
 *   node tools/delta-pruefen.mjs [--tage 2] [--alles]
 *
 * Ohne `--alles` werden nur Läufe gezeigt, die etwas verändert haben — ein Lauf
 * ohne Delta ist die Regel und sagt nichts.
 */
import { existsSync, readFileSync } from 'node:fs'

const DATEI = 'data/bestand-historie.jsonl'
const args = process.argv.slice(2)
const TAGE = Number(args[args.indexOf('--tage') + 1]) || 2
const ALLES = args.includes('--alles')

if (!existsSync(DATEI)) {
  console.log('Noch keine Historie — der erste Lauf legt sie an.')
  process.exit(0)
}

const zeilen = readFileSync(DATEI, 'utf8')
  .trimEnd()
  .split('\n')
  .filter(Boolean)
  .map((z) => {
    try {
      return JSON.parse(z)
    } catch {
      return null
    }
  })
  .filter(Boolean)

const grenze = Date.now() - TAGE * 86400000
const jung = zeilen.filter((z) => Date.parse(z.zeitpunkt) >= grenze)

const zeit = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const vz = (n) => (n > 0 ? `+${n}` : String(n))

console.log(`${jung.length} Läufe in den letzten ${TAGE} Tagen (${zeilen.length} insgesamt)\n`)

let gezeigt = 0
for (const z of jung) {
  const d = z.delta
  const still = d && Object.values(d).every((v) => v === 0)
  if (still && !ALLES) continue
  gezeigt++
  const teile = d
    ? Object.entries(d)
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => `${k} ${vz(v)}`)
    : ['erste Zeile']
  console.log(`${zeit(z.zeitpunkt)}  ${(z.lauf ?? '?').slice(0, 22).padEnd(24)} ${teile.join(', ') || 'nichts'}`)
  if (z.auffaellig?.length) console.log(`${' '.repeat(12)}⚠  ${z.auffaellig.join('; ')}`)
}
if (!gezeigt) console.log('Keiner dieser Läufe hat etwas verändert.')

/* Der Stand jetzt, zum Vergleich mit dem Anfang des Zeitraums. */
const letzte = zeilen[zeilen.length - 1]
const erste = jung[0] ?? letzte
console.log('')
console.log(`Stand jetzt: ${letzte.titel} Titel, ${letzte.mitUrteil} Urteile, ${letzte.ohneUrteil} offen`)
if (erste !== letzte) {
  console.log(
    `Über den Zeitraum: Titel ${vz(letzte.titel - erste.titel)}, ` +
      `Urteile ${vz(letzte.mitUrteil - erste.mitUrteil)}, ` +
      `offen ${vz(letzte.ohneUrteil - erste.ohneUrteil)}`,
  )
}

const auffaellige = jung.filter((z) => z.auffaellig?.length)
if (auffaellige.length) {
  console.log('')
  console.log(`⚠  ${auffaellige.length} Lauf/Läufe mit Auffälligkeiten — siehe oben.`)
  process.exit(1)
}
