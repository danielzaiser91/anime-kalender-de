import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './util.ts'

/**
 * **Welche Meldungen sind schon eingearbeitet?** Alle Adressen, die in den Handdateien stehen — nicht nur in `data/curated/`.
 *
 * Der Bericht „was noch fehlt" kannte bis zum 06.10.2026 nur die `sources` der kuratierten Termine. Ankündigungen, Kino-Ankündigungen,
 * Erstausgaben, Handbelege und Wege lagen daneben, und so stand der Rascal-Kinostart weiter als offen im Bericht, obwohl er seit Tagen
 * im Kalender war (74 offene Meldungen, die meisten längst erledigt — der Bericht wurde deshalb nicht mehr gelesen).
 */
const DATEIEN = [
  'data/ankuendigungen.yaml',
  'data/kino-ankuendigungen.yaml',
  'data/erstausgabe-von-hand.yaml',
  'data/ohne-synchro-von-hand.yaml',
  'data/watch-links.yaml',
  'data/reihen-von-hand.yaml',
  'data/dub-confirmed.yaml',
]

export const adressenIn = (text: string): string[] => (text.match(/https?:\/\/[^\s"'<>)\]}]+/g) ?? []).map((u) => u.replace(/[,.;]+$/, '').replace(/\/$/, ''))

export function eingearbeiteteAdressen(): Set<string> {
  const raus = new Set<string>()
  const ordner = resolve(ROOT, 'data/curated')
  const pfade = [...readdirSync(ordner).filter((f) => /\.ya?ml$/.test(f)).map((f) => resolve(ordner, f)), ...DATEIEN.map((f) => resolve(ROOT, f))]
  for (const pfad of pfade) if (existsSync(pfad)) for (const u of adressenIn(readFileSync(pfad, 'utf8'))) raus.add(u)
  return raus
}
