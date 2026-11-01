/**
 * Bestandswache: Kein Titel der Handliste `data/shop-wege-falsches-ziel.yaml` trägt im gebauten Bestand (`public/data/titles.json`) noch einen
 * „über TMDB"-Weg bei einem dort genannten Anbieter (Crown Handler 3 bis 6 × maxdome, freenet meinVOD; Daniel, 31.10.2026).
 * Das Soll kommt aus der Liste samt Beleg, nicht aus der Entfernungsfunktion des Baus. Ein Eintrag, dessen Titel nicht im Bestand steht,
 * ist nur eine Warnung (Exit 0): Rot stoppt den ganzen Bestandsbau. Test: `check-kapitel-shop-wege.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Title } from '../shared/types.ts'
import { ladeShopWegeFalsch } from './lib/kapitel-shop-wege.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'

export function main(wurzel: string): number {
  const liste = ladeShopWegeFalsch(join(wurzel, 'data/shop-wege-falsches-ziel.yaml'))
  if (!liste.length) {
    console.error('  ✖ Handliste data/shop-wege-falsches-ziel.yaml ist leer oder ohne gültigen Eintrag')
    console.log('VERSTÖSSE: 1')
    return 1
  }
  const titel = JSON.parse(readFileSync(join(wurzel, 'public/data/titles.json'), 'utf8')) as Title[]
  const fehlen = liste.filter((e) => !titel.some((t) => t.id === e.anilistId))
  if (fehlen.length) console.log(`  ⚠ WARNUNG Shop-Wege: ${fehlen.length} Eintrag/Einträge der Handliste ohne Titel im Bestand (Eintrag prüfen): ${fehlen.map((e) => e.anilistId).join(', ')}`)
  const verletzt = meldeVerletzte(
    titel.filter((t) => liste.some((e) => e.anilistId === t.id)),
    'shop-wege-falsches-ziel-bestand',
    'Weg über TMDB mit belegt falschem Ziel steht noch im Bestand',
    (t) =>
      liste
        .filter((e) => e.anilistId === t.id)
        .some((e) => (t.watchLinks ?? []).some((w) => /themoviedb\.org/.test(w.url) && e.anbieter.some((a) => a.toLowerCase() === w.name.toLowerCase()))),
  )
  if (verletzt.length) {
    console.error(`  ✖ Shop-Wege: ${verletzt.length} Titel tragen noch einen Weg der Handliste: ${verletzt.map((t) => t.id).join(', ')}`)
    console.log(`VERSTÖSSE: ${verletzt.length}`)
    return 1
  }
  console.log(`  ✓ Shop-Wege: ${liste.length} Handlisten-Einträge, keiner trägt im Bestand noch einen Weg über TMDB`)
  console.log('VERSTÖSSE: 0')
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url))))
}
