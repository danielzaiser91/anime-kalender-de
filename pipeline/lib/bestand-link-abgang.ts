/**
 * Synchro-Belege (`dub === true`), die seit dem vorigen Bestand fehlen, getrennt in begründet und unerklärt.
 * Begründet: die Linkprüfung (`data/link-check.json`) führt die Adresse mit 404 oder „region"; `09-2-linkpruefung.ts`
 * nimmt den Weg dann vorgesehen heraus (Anlass: Naruto Shippuden, Prime B084DBMYFX, 04.11.2026).
 */
import { execFileSync } from 'node:child_process'
import type { Title } from '../../shared/types.ts'
import { anzeigeName } from '../../shared/titles.ts'

export type LinkBefunde = Record<string, { status?: number | string; geprueftAm?: string } | undefined>
type MitStreams = Pick<Title, 'id' | 'titleDe' | 'titleEn' | 'titleRomaji' | 'streams'>

export interface LinkAbgang {
  anbieter: string
  /** „Titel (Kennung): Adresse" */
  text: string
  /** Eintrag aus link-check.json, falls vorhanden. */
  befund?: string
}
export interface LinkAbgaenge {
  begruendet: LinkAbgang[]
  unerklaert: LinkAbgang[]
}

/** Ein Befund, der den Weg entfernt: hartes 404 oder „region" (wie in der Linkprüfung). */
export const entferntDurchLink = (status: number | string | undefined): boolean => status === 404 || status === 'region'

export function linkAbgaenge(vorher: readonly MitStreams[], jetzt: readonly MitStreams[], link: LinkBefunde): LinkAbgaenge {
  const neu = new Map(jetzt.map((t) => [t.id, new Set((t.streams ?? []).filter((s) => s.dub === true).map((s) => s.url))]))
  const aus: LinkAbgaenge = { begruendet: [], unerklaert: [] }
  for (const t of vorher) {
    for (const s of t.streams ?? []) {
      if (s.dub !== true || neu.get(t.id)?.has(s.url)) continue
      const b = link[s.url]
      const eintrag: LinkAbgang = {
        anbieter: s.platform,
        text: `${anzeigeName(t)} (${t.id}): ${s.url}`,
        befund: b ? `link-check: ${JSON.stringify(b)}` : undefined,
      }
      if (entferntDurchLink(b?.status)) aus.begruendet.push(eintrag)
      else aus.unerklaert.push(eintrag)
    }
  }
  return aus
}

/** Der Hauptbestand eines Commits samt Streams; ohne Git oder Datei leer (dann erklärt die Wache nichts). */
export function bestandAusCommit(wurzel: string, stand = 'HEAD'): MitStreams[] {
  try {
    const text = execFileSync('git', ['show', `${stand}:public/data/titles.json`], {
      cwd: wurzel,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const roh = JSON.parse(text) as MitStreams[] | Record<string, MitStreams>
    return Array.isArray(roh) ? roh : Object.values(roh)
  } catch {
    return []
  }
}
