/**
 * Bestandswache: Prime-Meldungen mit `seite` ≠ Ablage-Adresse, deren Titel diese Seite nicht als Weg führt, dürfen nicht mehr werden
 * (Ratsche, darf nur sinken; Ziel 0). Rechnung in `lib/prime-seite-ohne-weg.ts`. Grenze 13.11.2026 (Datenstand 55f5e141b): 424 gemessen
 * (der Vorrat-Auftrag nannte 551 am 12.11. ohne Rechenweg), 26 Luft für Meldungen eines Tages; nachziehen, sobald der Bestand darunter liegt.
 * Rot bei Überschreitung und bei leerer Ablage (dann prüft die Wache nichts). Test: `check-prime-seite-ohne-weg-bestand-lauf.ts`.
 */
import { pathToFileURL } from 'node:url'
import { readJson } from './lib/util.ts'
import { leseZugeordnet } from './lib/prime-meldung-riegel.ts'
import type { BesitzTitel } from './lib/handbeleg-notizseite.ts'
import { meldungenSeiteOhneWeg, seiteOhneWegMangel, type ZugeordneteMeldung } from './lib/prime-seite-ohne-weg.ts'

export const HOECHSTENS = 450

export function main(): number {
  const zugeordnet = leseZugeordnet<ZugeordneteMeldung>()
  const titel = readJson<BesitzTitel[]>('public/data/titles.json', [])
  if (Object.keys(zugeordnet).length === 0 || titel.length === 0) {
    console.error('  ✖ Prime-Seite ohne Weg: Ablage oder Bestand leer, die Wache prüft nichts')
    console.error('VERSTÖSSE: 1')
    return 1
  }
  const treffer = meldungenSeiteOhneWeg(zugeordnet, titel)
  const mangel = seiteOhneWegMangel(treffer.length, HOECHSTENS)
  console.log(`  ${mangel ? '✖' : '✓'} Prime-Seite ohne Weg: ${treffer.length} Meldungen mit abweichender Seite ohne Weg (höchstens ${HOECHSTENS})`)
  if (mangel) {
    console.error(`  ✖ ${mangel}`)
    console.error('VERSTÖSSE: 1')
    return 1
  }
  console.log('VERSTÖSSE: 0')
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
