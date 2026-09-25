/**
 * Angekündigte Simulcasts aus `data/ankuendigungen.yaml` — je Titel, geprüft beim Laden.
 *
 * Ein Eintrag ist eine Auskunft fürs Detail-Panel („Simulcast ab …, Synchro angekündigt"),
 * kein Termin. Deshalb liegt die Datei nicht in `data/curated/`, das der Bau als Termine liest.
 * Ein Fehler in der Datei bricht den Bau ab, statt still einen halben Eintrag zu zeigen.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { PlatformId, Title } from '../../shared/types.ts'
import { PLATFORMS } from '../../shared/types.ts'

type Ankuendigung = NonNullable<Title['ankuendigung']>

interface Roh {
  quellen?: Record<string, string>
  eintraege?: {
    anilistId?: number
    platform?: string
    omuAb?: string
    synchro?: string
    stand?: string
    quellen?: string[]
  }[]
}

export function ankuendigungenLaden(wurzel: string): Map<number, Ankuendigung> {
  const roh = yaml.load(readFileSync(resolve(wurzel, 'data/ankuendigungen.yaml'), 'utf8')) as Roh
  const kurz = roh?.quellen ?? {}
  const raus = new Map<number, Ankuendigung>()
  for (const [i, e] of (roh?.eintraege ?? []).entries()) {
    const wo = `data/ankuendigungen.yaml, Eintrag ${i + 1} (${e?.anilistId ?? '?'})`
    if (!Number.isInteger(e?.anilistId)) throw new Error(`${wo}: anilistId fehlt`)
    if (!e.platform || !(e.platform in PLATFORMS)) throw new Error(`${wo}: unbekannte platform ${e.platform}`)
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(String(e.omuAb ?? ''))) throw new Error(`${wo}: omuAb ist kein JJJJ-MM(-TT)`)
    if (e.synchro !== 'angekuendigt' && e.synchro !== 'offen') throw new Error(`${wo}: synchro muss angekuendigt oder offen sein`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.stand ?? ''))) throw new Error(`${wo}: stand ist kein Datum`)
    const quellen = (e.quellen ?? []).map((q) => kurz[q] ?? q)
    if (!quellen.length || quellen.some((q) => !/^https:\/\//.test(q))) throw new Error(`${wo}: quellen fehlen oder sind keine Adressen`)
    if (raus.has(e.anilistId!)) throw new Error(`${wo}: Titel steht doppelt`)
    raus.set(e.anilistId!, {
      platform: e.platform as PlatformId,
      omuAb: String(e.omuAb),
      synchro: e.synchro,
      quellen,
      stand: String(e.stand),
    })
  }
  return raus
}
