import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Kennung der Datendateien: Hash über alle `*.json` direkt in `public/data`, also auch bei Handänderung ohne neues `generatedAt` (Sortierung macht ihn deterministisch). */
export function datenKennung(ordner: string): string {
  const hash = createHash('sha1')
  for (const name of readdirSync(ordner).filter((n) => n.endsWith('.json')).sort()) {
    hash.update(name).update(readFileSync(join(ordner, name)))
  }
  return hash.digest('hex').slice(0, 14)
}
