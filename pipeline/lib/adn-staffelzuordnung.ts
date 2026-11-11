/** `data/adn-staffelzuordnung.yaml`: je AniList-Kennung die ADN-Staffel, belegt über die Folgenzahl (Begründung in der Datei). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'

export function ladeAdnStaffelzuordnung(): Record<number, string> {
  try {
    const roh = yaml.load(readFileSync(resolve(ROOT, 'data/adn-staffelzuordnung.yaml'), 'utf8'))
    const raus: Record<number, string> = {}
    for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
      if (!Number.isFinite(Number(k)) || !Number.isFinite(Number(v))) continue
      raus[Number(k)] = String(v)
    }
    return raus
  } catch {
    return {}
  }
}
