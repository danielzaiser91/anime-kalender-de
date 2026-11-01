/**
 * Zusicherung am gebauten Bestand: Kein Titel im aniSearch-Sammeleintrag (n:1) trägt „Deutsch synchronisiert“, wenn nur aniSearchs Marke es sagt
 * (Anlass Crown Handler 4–6, 31.10.2026). Die Regel selbst läuft auf Fixtures in `check-sammeleintrag-synchro.ts` (`check:logic`).
 * Läuft in `check:bestand` (nach dem Bau): liest `public/data/titles.json` und die Brücke zu aniSearch.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { anisearchBruecke } from './lib/anisearch-katalog-ids.ts'
import { ladeBelegsignale } from './lib/belegstaerke.ts'
import { ladeErstausgabeVonHand } from './lib/erstausgabe-von-hand.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import { ladeJustwatchDeutsch, sammeleintragTitel, synchroNurAusSammeleintrag } from './lib/anisearch-sammeleintrag.ts'
import type { Release, Title } from '../shared/types.ts'

const OUT = 'public/data/titles.json'
if (!existsSync(OUT)) {
  console.error(`FEHLER: ${OUT} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const titel = readJson<Title[]>(OUT, [])
const signale = ladeBelegsignale(readJson<Release[]>('public/data/releases.json', []))
const sammel = sammeleintragTitel(anisearchBruecke(), titel.map((t) => t.id), ladeJustwatchDeutsch())
const handErstausgabe = new Set(ladeErstausgabeVonHand().flatMap((e) => (e.anilistId ? [e.anilistId] : [])))
const verletzt = new Set(synchroNurAusSammeleintrag(titel, sammel, { handbelegt: signale.handbelegt, kartei: signale.kartei, handErstausgabe, tv: signale.tv }).map((t) => t.id))
const treffer = meldeVerletzte(titel, 'sammeleintrag-synchro-bestand', 'Synchro nur aus einem aniSearch-Sammeleintrag', (t) => verletzt.has(t.id))

console.log(`Sammeleintrag: ${sammel.size} Titel teilen sich einen aniSearch-Eintrag, ${treffer.length} davon tragen Synchro nur aus der Marke`)
if (treffer.length) {
  console.error(`FEHLER: Synchro nur aus einem Sammeleintrag: ${treffer.map((t) => t.id).join(', ')}`)
  console.log(`VERSTÖSSE: ${treffer.length}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
