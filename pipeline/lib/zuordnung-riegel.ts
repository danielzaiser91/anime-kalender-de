import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { streamAdressen } from './fremde-adressen.ts'
import { findeFremdZugeordnete, type ZuordnungEintrag } from './zuordnung-fremd.ts'
import type { BelegAdresse } from './handbeleg-fremde-adresse.ts'
import type { Offen } from './rohfolgen-abschluss.ts'

type Meldung = ZuordnungEintrag & { folgen: unknown[] }

/**
 * **Riegel am Zuordner** (29.10.2026): Eine neue Zuordnung an eine Adresse, die ein Cartoon, ein Titel ohne Synchro oder ein
 * Handbeleg einer anderen Kennung führt, kommt nicht in `prime-zugeordnet.json`, sondern als „offen, mit Grund" in
 * `prime-unzugeordnet.json`. Die Entscheidung trifft `findeFremdZugeordnete` (dieselbe wie der Bestandswächter), je Eintrag allein
 * geprüft, damit die Zuordnung zum Schlüssel bleibt. Der Container-Schlüssel (`…#0`) zählt nicht: dort gilt die `seite`.
 */
export function trenneFremdZugeordnete<T extends Meldung>(
  zugeordnet: Record<string, T>,
  streams: ReadonlyMap<string, string[]>,
  belege: readonly BelegAdresse[],
): { eigene: Record<string, T>; abgewiesen: Offen[] } {
  const eigene: Record<string, T> = {}
  const abgewiesen = new Map<string, Offen>()
  for (const [schluessel, e] of Object.entries(zugeordnet)) {
    const [fremd] = findeFremdZugeordnete([[schluessel, e]], streams, belege)
    if (!fremd) {
      eigene[schluessel] = e
      continue
    }
    const url = schluessel.split('#')[0]!
    const bisher = abgewiesen.get(url)
    abgewiesen.set(url, {
      url,
      titel: null,
      grund: `Adresse gehört ${fremd.besitzer.join(', ')}: Zuordnung zu ${fremd.titleId} abgewiesen`,
      folgen: (bisher?.folgen ?? 0) + e.folgen.length,
    })
  }
  return { eigene, abgewiesen: [...abgewiesen.values()] }
}

/** Liest Streams und Handbelege aus `ROOT` (wie der Bestandswächter) und trennt die Zuordnungen dieses Laufs. */
export function trenneFremdImBestand<T extends Meldung>(zugeordnet: Record<string, T>): { eigene: Record<string, T>; abgewiesen: Offen[] } {
  const belege = (yaml.load(readFileSync(resolve(ROOT, 'data/dub-confirmed.yaml'), 'utf8')) as BelegAdresse[] | null) ?? []
  return trenneFremdZugeordnete(zugeordnet, streamAdressen(ROOT), belege)
}
