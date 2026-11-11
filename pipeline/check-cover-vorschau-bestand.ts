/**
 * Bestandswache: Titel mit Cover, deren Link-Vorschau das Standardbild wäre, dürfen nicht mehr werden (Ratsche, darf nur sinken).
 * Rechnung und Anlass in `lib/cover-vorschau-bestand.ts`; Grenze 10.11.2026 (Datenstand 2fca63758, vorher 170 bei 158 am 06.11.): 99 Titel ohne
 * Termin (83 AniList-Cover über 250 KB, 16 aniSearch-Kopien, die im Bucket fehlen und deshalb nicht messbar sind); 11 Luft für Titel, deren
 * Cover der nächste Messlauf (`lib/anilist-cover-lauf.ts`) erst nachträgt. Die Grenze wird nachgezogen, sobald der Bestand darunter liegt.
 * Rot bei Überschreitung und bei leerem Bestand (dann prüft die Wache nichts). Test: `check-cover-vorschau-bestand-lauf.ts`.
 */
import { pathToFileURL } from 'node:url'
import type { Release, Title } from '../shared/types.ts'
import { readJson } from './lib/util.ts'
import { ladeVorschauMasse } from './lib/vorschau-masse.ts'
import { coverVorschauBestandMangel, standardTrotzCoverTitel } from './lib/cover-vorschau-bestand.ts'

export const HOECHSTENS = 110

export function main(): number {
  const titel = readJson<Title[]>('public/data/titles.json', [])
  const mitTermin = new Set(readJson<Release[]>('public/data/releases.json', []).filter((r) => r.slug).map((r) => r.titleId))
  const mitCover = titel.filter((t) => t.coverImage).length
  if (mitCover === 0) {
    console.error('  ✖ Cover-Vorschau: kein Titel mit Cover in public/data/titles.json, die Wache prüft nichts')
    console.error('VERSTÖSSE: 1')
    return 1
  }
  const treffer = standardTrotzCoverTitel(titel, mitTermin, ladeVorschauMasse())
  const mangel = coverVorschauBestandMangel(treffer, HOECHSTENS)
  console.log(`  ${mangel ? '✖' : '✓'} Cover-Vorschau: ${mitCover} Titel mit Cover, ${treffer.length} mit Standardbild als Vorschau ohne Termin (höchstens ${HOECHSTENS})`)
  if (mangel) {
    console.error(`  ✖ ${mangel}`)
    console.error('VERSTÖSSE: 1')
    return 1
  }
  console.log('VERSTÖSSE: 0')
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
