/**
 * Trockenlauf der gti-Brücke (17.09.2026): Welche Prime-Verweise bekämen welche
 * JustWatch-Adresse? Schreibt nichts in den Bestand, nur eine Liste zum Gegenlesen.
 *
 * Aufruf: npx tsx tools/amazon-gti-trocken.ts [--alle]
 */
import { readFileSync } from 'node:fs'
import { amazonGtiWahl, type JwAngebot } from '../pipeline/lib/amazon-gti.ts'

const jw = JSON.parse(readFileSync('data/justwatch-audio.json', 'utf8')) as Record<string, { angebote?: JwAngebot[] }>
const daten = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const titel = (daten.titles ?? daten) as {
  id: number
  titleDe?: string
  titleEn?: string
  streams?: { platform: string; url: string; dub?: boolean }[]
}[]

let wege = 0
let gewaehlt = 0
const ohneWahl: string[] = []
const zeilen: string[] = []
for (const t of titel) {
  const prime = (t.streams ?? []).filter((s) => s.platform === 'primevideo')
  const angebote = jw[t.id]?.angebote ?? []
  for (const s of prime) {
    wege++
    if (!angebote.some((a) => /gti=/.test(a.url ?? ''))) continue
    /* Mehrere Prime-Verweise eines Titels: Welcher welche Ausgabe ist, sagt die gti allein nicht. */
    const wahl = prime.length === 1 ? amazonGtiWahl(angebote, s.dub) : undefined
    const name = t.titleDe ?? t.titleEn ?? String(t.id)
    if (!wahl) {
      ohneWahl.push(`${t.id} ${name} (${prime.length} Prime-Wege, dub=${s.dub})`)
      continue
    }
    gewaehlt++
    zeilen.push(`${t.id} ${name} | ${s.url} → ${wahl.gti.slice(13)} | ${wahl.angebote.join(', ')} | Ton ${wahl.audio.join('+') || '?'} | dub=${s.dub}`)
  }
}
console.log(`${wege} Prime-Wege, ${gewaehlt} bekämen eine gti-Adresse, ${ohneWahl.length} mit JustWatch-Angebot ohne eindeutige Wahl`)
const alle = process.argv.includes('--alle')
for (const z of alle ? zeilen : zeilen.slice(0, 15)) console.log('  ' + z)
console.log('ohne Wahl:')
for (const z of alle ? ohneWahl : ohneWahl.slice(0, 15)) console.log('  ' + z)
