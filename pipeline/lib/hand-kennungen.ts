import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './util.ts'

/** Eine Zeile, die eine Titelkennung nennt: `anilistId: 8408` oder `- id: 8408`. */
const KENNUNG = /^\s*(?:-\s*)?(?:anilistId|id):\s*(\d+)/gm

/**
 * Kennungen, die eine Handdatei unter `data/` oder `data/curated/` nennt (Handbelege, Termine, Verweise, Texte). Ein Titel mit so einer Zeile
 * wird nicht von selbst entfernt oder umgehängt, sondern bleibt stehen und wird gemeldet (`bau/mal-teilung.ts`).
 */
export function handKennungen(wurzel: string = ROOT): Set<number> {
  const ids = new Set<number>()
  for (const ordner of [join(wurzel, 'data'), join(wurzel, 'data', 'curated')]) {
    for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.yaml'))) {
      for (const treffer of readFileSync(join(ordner, datei), 'utf8').matchAll(KENNUNG)) ids.add(Number(treffer[1]))
    }
  }
  return ids
}
