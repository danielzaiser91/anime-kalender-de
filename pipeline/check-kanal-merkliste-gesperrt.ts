/**
 * Zusicherung: **Die Kanal-Merkliste enthält keine gesperrte Kennung@Adresse** (30.10.2026).
 *
 * Der Schreibweg der Merkliste (`data/kanal-seiten.json`) filtert gegen `data/belege-entfernt.yaml`, entfernt aber keine
 * Altzeilen: Wird eine Seite gesperrt, die schon in der Merkliste steht, bleibt die Zeile liegen (der Leser blendet sie aus).
 * Dieser Wächter zählt solche Reste mit derselben Regel wie der Bau (`istEntfernt`) und nennt sie als Kennung@Adresse.
 * Läuft in `check:bestand` (liest nur `data/`).
 *
 * Aufruf: npx tsx pipeline/check-kanal-merkliste-gesperrt.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { istEntfernt, ladeBelegeEntfernt } from './lib/belege-entfernt.ts'
import type { BelegEntfernt } from './lib/belege-entfernt.ts'
import { ROOT } from './lib/util.ts'

type Zeile = { anilistId?: number; url?: string }

/** Die Merkliste-Zeilen, die die Sperrliste trifft, als `Kennung@Adresse`. */
export function gesperrteZeilen(merkliste: readonly Zeile[], gesperrt: readonly BelegEntfernt[]): string[] {
  return merkliste.filter((z) => istEntfernt(gesperrt, z.anilistId, z.url)).map((z) => `${z.anilistId}@${z.url}`)
}

function main(): number {
  const datei = join(ROOT, 'data', 'kanal-seiten.json')
  if (!existsSync(datei)) {
    console.error('✖ data/kanal-seiten.json fehlt')
    return 1
  }
  const merkliste = JSON.parse(readFileSync(datei, 'utf8')) as Zeile[]
  const treffer = gesperrteZeilen(merkliste, ladeBelegeEntfernt(join(ROOT, 'data', 'belege-entfernt.yaml')))
  for (const t of treffer) console.error(`✖ Merkliste führt gesperrte Seite: ${t}`)
  if (treffer.length > 0) return 1
  console.log(`✓ Kanal-Merkliste: ${merkliste.length} Zeilen, 0 gesperrt`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main())
