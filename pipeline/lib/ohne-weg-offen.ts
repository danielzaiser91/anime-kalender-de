/**
 * **Warum ein Titel in `ohne-weg.json` auf `offen` steht** (19.11.2026, Messwerkzeug `tools/ohne-weg-gruende.ts`). Spiegelt die Reihenfolge von
 * `grundVon` in `ohne-weg.ts`: Ein Handbeleg „deutsch“ geht vor, dann kommt der JustWatch-Befund. Nur Messung, der Bau liest das nicht.
 *
 * **Doppelpflege:** Ändert sich eine Regel in `grundVon`, `jwZugeordnet` oder `jwOhneStream`, gehört diese Zuordnung mit (`check-ohne-weg-ursachen.ts`
 * hält die Randfälle fest). `jw-mehrdeutig` gilt nur bei `namenTreffer.gleicherName` (19.11.2026: 10 von 117 Namenstreffern, der Rest Suchrauschen). `jw-gilt-*` und `jw-kein-treffer` sind die Fälle, in denen nur ein Beleg fehlt (z. B. die erschienene Disc für `nur-disc`).
 */
import type { Title } from '../../shared/types.ts'
import { urteilVon } from './dub-confirmed.ts'
import { geteilteJwKennungen } from './jw-kennung-fremd.ts'
import { BEFUND_MAX_TAGE } from './jw-vertrauen.ts'
import { alleAngebote } from './jw-seite.ts'
import type { OhneWegEingabe } from './ohne-weg.ts'

export const OFFEN_URSACHEN = [
  'handbeleg-deutsch',
  'jw-kein-befund',
  'jw-kein-treffer',
  'jw-mehrdeutig',
  'jw-fremd',
  'jw-verfehlt',
  'jw-abgelaufen',
  'jw-gilt-abo-mit-deutsch',
  'jw-gilt-abo-ton-unbekannt',
  'jw-gilt-sonst',
] as const
export type OffenUrsache = (typeof OFFEN_URSACHEN)[number]

const tage = (heute: string, am: string) => (Date.parse(heute) - Date.parse(am)) / 86_400_000

/** Die Ursache eines offenen Titels; `fremd` = die Kennung gehört schon einer zweiten TMDB-Reihe, `mehrdeutig` = gleichnamiger Kandidat mit anderer Kennung (ein Namenstreffer ohne `gleicherName` ist Suchrauschen). */
export function offenUrsache(
  t: Pick<Title, 'id'>,
  e: { eingabe: OhneWegEingabe; geteilt: ReadonlySet<string> },
): OffenUrsache {
  const { eingabe } = e
  if (eingabe.handbelege.some((c) => c.anilistId === t.id && urteilVon(c) === 'ja')) return 'handbeleg-deutsch'
  const b = eingabe.justwatch[t.id]
  if (!b) return 'jw-kein-befund'
  const alt = tage(eingabe.heute, b.geprueftAm) >= BEFUND_MAX_TAGE
  if (b.ohneTreffer) return b.verfehltAm ? 'jw-verfehlt' : b.namenTreffer?.gleicherName ? 'jw-mehrdeutig' : alt ? 'jw-abgelaufen' : 'jw-kein-treffer'
  if (b.verfehltAm) return 'jw-verfehlt'
  if (b.jwId && e.geteilt.has(b.jwId)) return 'jw-fremd'
  if (alt) return 'jw-abgelaufen'
  const abo = alleAngebote(b).filter((a) => a.art !== 'BUY' && a.art !== 'RENT' && a.art !== 'CINEMA')
  if (abo.some((a) => a.audio?.includes('de'))) return 'jw-gilt-abo-mit-deutsch'
  if (abo.some((a) => !(a.audio ?? []).length)) return 'jw-gilt-abo-ton-unbekannt'
  return 'jw-gilt-sonst'
}

/** Kennung → Ursache für alle Titel, die `eintraege` als `offen` führt. */
export function offenUrsachen(eingabe: OhneWegEingabe, eintraege: Record<number, { reason: string }>): Map<number, OffenUrsache> {
  const geteilt = new Set(geteilteJwKennungen(eingabe.justwatch).keys())
  const aus = new Map<number, OffenUrsache>()
  for (const [id, x] of Object.entries(eintraege)) if (x.reason === 'offen') aus.set(Number(id), offenUrsache({ id: Number(id) }, { eingabe, geteilt }))
  return aus
}
