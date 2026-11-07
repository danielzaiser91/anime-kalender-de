import type { Title } from '../../shared/types.ts'

/** Marken, die „deutsche Fassung vorhanden“ heißen: `d` vertont, `c` abgebrochen (trotzdem teilweise vertont). `p` (geplant) belegt noch nichts. */
const DEUTSCH_MARKEN = new Set(['d', 'c'])

export interface SynchroBelege {
  /** aniSearch-Kennung → Marke (`data/anisearch-dub-ids.json`; Schlüssel sind aniSearch-Kennungen, nicht Titel-Kennungen). */
  nachAnisearch: Record<string, string>
  /** Titel-Kennung → Marke (`data/anisearch-dubs.json` samt Brücke, `dubsNachTitel`). */
  nachTitel: Record<string, string>
  /** Titel-Kennungen mit Handbeleg `dub: true`. */
  handJa: ReadonlySet<number>
}

/** Der Grund, warum der Titel Synchro haben müsste, oder `undefined`. */
export function synchroBeleg(t: Pick<Title, 'id' | 'anisearchId'>, b: SynchroBelege): string | undefined {
  const marke = b.nachTitel[String(t.id)] ?? (t.anisearchId ? b.nachAnisearch[String(t.anisearchId)] : undefined)
  if (marke && DEUTSCH_MARKEN.has(marke)) return `aniSearch-Marke „${marke}“`
  if (b.handJa.has(t.id)) return 'Handbeleg dub: true'
  return undefined
}

/** Titel hinter dem Toggle „ohne deutsche Synchro“, für die ein Beleg Synchro sagt. */
export function widerspruechlich(ohneSynchro: Title[], b: SynchroBelege): { titel: Title; grund: string }[] {
  return ohneSynchro.flatMap((titel) => {
    const grund = synchroBeleg(titel, b)
    return grund ? [{ titel, grund }] : []
  })
}

export function widerspruchText(t: Title, grund: string): string {
  const name = t.titleDe ?? t.titleEn ?? t.titleRomaji ?? ''
  return `${name} (Titel ${t.id}, aniSearch ${t.anisearchId ?? '-'}) steht in ohne-synchro.json, obwohl ${grund} Synchro belegt. `
    + 'Zu tun: Bindung Titel↔aniSearch in data/ prüfen (fehlende oder doppelte Kennung, MAL-/AniList-Dublette) oder den Handbeleg widerrufen; nicht den Titel ausblenden.'
}
