/**
 * **Deutsch laut JustWatch, je Seite** (Entscheidung Daniel 16.10.2026). Maßstab ist die Seite beim Anbieter, nicht die
 * Zugangsart: Prime, Prime mit Werbung, Amazon-Kanäle, Kauf und Leihe auf derselben gti zeigen dasselbe Video mit denselben
 * Tonspuren. Eine andere gti ist eine andere Ausgabe oder Staffel und zählt nicht. Bei Crunchyroll und Disney+ gilt dieselbe
 * Kennung in der Adresse. Abschnitt „JustWatch-Ton je Seite“ in `docs/wissen/quellen.md`.
 */
import { BEFUND_MAX_TAGE, type JwBefund } from './jw-vertrauen.ts'
import type { JwAngebot } from './amazon-gti.ts'
import type { StreamLink } from '../../shared/types.ts'

/** Ab diesem Anteil Widersprüche (eigene Messung „nein“ gegen JustWatch „de“) gilt JustWatch bei einem Anbieter nur als Hinweis. */
export const WAECHTER_GRENZE = 0.02

const SCHLUESSEL: [RegExp, string][] = [
  [/[?&]gti=(amzn1\.dv\.gti\.[0-9a-f-]{36})/, 'amazon'],
  [/crunchyroll\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:series|watch)\/([A-Z0-9]{6,})/, 'crunchyroll'],
  [/disneyplus\.com\/.*?(entity-[0-9a-f-]{36})/, 'disney'],
  [/disneyplus\.com\/(?:[a-z]{2}-[a-z]{2}\/)?(?:series|movies)\/[^/]+\/([A-Za-z0-9]+)/, 'disney'],
]

/** Die Kennung der Seite: gti bei Amazon, Serien- oder Folgenkennung bei Crunchyroll, Kennung bei Disney+; sonst `undefined`. */
export function seitenSchluessel(url: string | undefined): string | undefined {
  for (const [muster, art] of SCHLUESSEL) {
    const treffer = muster.exec(url ?? '')
    if (treffer) return `${art}:${treffer[1]}`
  }
  return undefined
}

/** Ein Befund, der etwas über heute sagt: gefunden, nicht verfehlt, jünger als `BEFUND_MAX_TAGE`. */
export function befundGilt(befund: JwBefund | undefined, heute: string): befund is JwBefund {
  if (!befund?.jwId || befund.ohneTreffer || befund.verfehltAm) return false
  return (Date.parse(heute) - Date.parse(befund.geprueftAm)) / 86_400_000 < BEFUND_MAX_TAGE
}

/** Alle Angebote des Befunds samt der Staffel-Angebote (dieselbe Seite kann nur in einer Staffel stehen). */
function alleAngebote(befund: JwBefund): JwAngebot[] {
  return [...befund.angebote, ...(befund.staffeln ?? []).flatMap((s) => s.angebote)]
}

export interface SeitenTon {
  stand: string
  deutsch: boolean
}

/** Was JustWatch über den Ton genau dieser Seite sagt; `undefined`, wenn der Befund nicht gilt oder kein Angebot dort Ton nennt. */
export function jwTonAnSeite(befund: JwBefund | undefined, url: string | undefined, heute: string): SeitenTon | undefined {
  const schluessel = seitenSchluessel(url)
  if (!schluessel || !befundGilt(befund, heute)) return undefined
  const mitTon = alleAngebote(befund).filter((a) => (a.audio ?? []).length && seitenSchluessel(a.url) === schluessel)
  if (!mitTon.length) return undefined
  return { stand: befund.geprueftAm, deutsch: mitTon.some((a) => a.audio!.includes('de')) }
}

/** Die Seiten, an denen JustWatch deutschen Ton nennt, mit dem Anbieternamen des ersten Angebots. */
export function deutscheSeiten(befund: JwBefund | undefined, heute: string): Map<string, string> {
  const seiten = new Map<string, string>()
  if (!befundGilt(befund, heute)) return seiten
  for (const a of alleAngebote(befund)) {
    const schluessel = seitenSchluessel(a.url)
    if (schluessel && (a.audio ?? []).includes('de') && !seiten.has(schluessel)) seiten.set(schluessel, a.anbieter)
  }
  return seiten
}

/** Warum die Serienangabe nicht für genau unseren Titel spricht; `undefined`, wenn sie es tut. */
export type NurSerie = 'Mehrteiler' | 'mehrere Staffeln' | 'Staffeln unbekannt'

/**
 * JustWatchs Ton an einem Serien-Angebot fasst alle Staffeln dieses Anbieters zusammen: „de“ heißt nur „irgendeine Staffel hat
 * Deutsch“ (Fruits Basket 2019, 16.10.2026: Crunchyroll „de“, Staffel 1 nur Englisch). Eindeutig ist die Angabe deshalb nur bei
 * Filmen und bei Serien mit genau einer Staffel, die kein anderer unserer Titel teilt — auch eine Staffel-gti ändert daran nichts.
 * `eigeneStaffeln`: Staffeln laut unserem Bestand (Cartoons), zählen zusätzlich.
 */
export function nurSerie(befund: JwBefund, titelJeJwId: number, eigeneStaffeln = 0): NurSerie | undefined {
  if (befund.jwPfad?.startsWith('/de/Film')) return undefined
  if (titelJeJwId > 1) return 'Mehrteiler'
  const { staffeln } = befund
  if (eigeneStaffeln > 1 || (staffeln && staffeln.length > 1)) return 'mehrere Staffeln'
  return staffeln ? undefined : 'Staffeln unbekannt'
}

export interface WaechterZahl {
  gemessen: number
  widerspruch: number
}

/** Anbieter, bei denen mehr als `WAECHTER_GRENZE` der selbst gemessenen JustWatch-„de“-Fälle widersprechen. */
export function abgeschalteteAnbieter(zaehlung: Map<string, WaechterZahl>): Set<string> {
  const aus = new Set<string>()
  for (const [anbieter, z] of zaehlung) if (z.gemessen && z.widerspruch / z.gemessen > WAECHTER_GRENZE) aus.add(anbieter)
  return aus
}

/**
 * Was an der JustWatch-Kennzeichnung eines gebauten Wegs nicht stimmt, sonst `undefined`. Flagge (ohne `dubHintOnly`) nur an
 * einer Seite mit Kennung und nie an einem Staffel-Teilweg; ein Staffel-Hinweis nur, wenn die Staffeln von JustWatch stammen.
 */
export function jwKennzeichnungFehler(staffelnQuelle: string | undefined, s: StreamLink): string | undefined {
  if (!s.dubQuelle) return undefined
  if (s.dub !== undefined) return 'Kennzeichnung und Urteil zugleich'
  if (!/^\d{4}-\d\d-\d\d$/.test(s.dubStand ?? '')) return 'Kennzeichnung ohne Datum'
  if (s.teilBereich) return s.dubHintOnly && staffelnQuelle === 'justwatch' ? undefined : 'Staffel-Kennzeichnung ohne JustWatch-Staffeln oder als Flagge'
  if (!s.dubHintOnly && !seitenSchluessel(s.url)) return 'Flagge ohne Seitenkennung'
  return undefined
}
