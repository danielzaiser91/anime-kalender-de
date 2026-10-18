import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { schluesselAdresse } from './zuordnung.ts'

type MitStreams = { id: number; streams?: { url?: string; seite?: string }[] }

/**
 * **Adressen, die ein Eintrag außerhalb von `titles.json` führt**, als Schlüssel wie `schluesselAdresse` (18.10.2026):
 * Streams der Cartoons und der Titel ohne Synchro, Prime-Zuordnungen und Handbelege fremder Kennungen. Eine Meldung dort
 * gehört diesem Eintrag und darf über ihren Namen keinem Anime zufallen (`titelDerMeldung`): Die Meldungen zum Cartoon
 * „Heidi“ (2015, -62475) bei Disney+ und Prime landeten so beim Anime „Heidi“ (1974, 2225).
 */
export function fremdeAdressen(wurzel: string, bestand: Set<number>): Set<string> {
  const json = (datei: string) => JSON.parse(readFileSync(resolve(wurzel, datei), 'utf8'))
  const fremd = new Set<string>()
  const dazu = (url: string | undefined) => {
    if (url) fremd.add(schluesselAdresse(url))
  }
  for (const datei of ['public/data/cartoons.json', 'public/data/ohne-synchro.json'])
    for (const t of json(datei) as MitStreams[]) for (const s of t.streams ?? []) [s.url, s.seite].forEach(dazu)
  for (const [url, z] of Object.entries(json('data/prime-zugeordnet.json') as Record<string, { titleId?: number }>))
    if (z.titleId && !bestand.has(z.titleId)) dazu(url)
  const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) as { anilistId?: number; url?: string }[]
  for (const b of belege ?? []) if (b.anilistId && !bestand.has(b.anilistId)) dazu(b.url)
  return fremd
}
