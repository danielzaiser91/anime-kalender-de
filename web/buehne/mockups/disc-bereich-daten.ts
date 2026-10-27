import type { DiscAusgabe, Release, Title } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { kurzeAusgabe } from '../../src/components/detail/disc-ausgabe.ts'

/*
  Datenmodell des Mockups `disc-bereich`: **eine Ausgabe, eine Zeile** — gleich, ob sie als aniSearch-Artikel
  (`DiscAusgabe`) oder als Termin des Bestands (`Release`) bekannt ist. Die Formate (Blu-ray, DVD, 4K) hängen an der
  Ausgabe, die Händler stehen dahinter. Daniel (26.10.2026): „type der disc im vordergrund, anbieter im hintergrund …
  die disc selber wird einen release date haben, das sich bei allen anbieter ähnelt oder gleich ist.“
*/

export type Format = DiscAusgabe[1]
export const FORMATE: Format[] = ['b', 'd', 'u']
export const FORMAT_NAME: Record<Format, string> = { b: 'Blu-ray', d: 'DVD', u: '4K UHD' }
export const FORMAT_KURZ: Record<Format, string> = { b: 'BD', d: 'DVD', u: '4K' }

export interface Haendler {
  name: string
  url: string
}

export interface Ausgabe {
  schluessel: string
  name: string
  formate: Format[]
  /** ISO-Datum oder leer, wenn keine Quelle eins nennt. */
  datum: string
  gesamt: boolean
  /** Je Format die aniSearch-Artikelkennung (Raster-Zellen verlinken je Format). */
  artikel: Partial<Record<Format, number>>
  haendler: Haendler[]
  /** Der Termin aus dem Bestand, falls es einen gibt — Kalenderknopf und Verlag hängen daran. */
  release?: Release
}

export const artikelUrl = (artikel: number): string => `https://www.anisearch.de/article/${artikel}`

/** Formate aus der Editionsangabe eines Termins („Limited Edition, DVD & Blu-ray“); ohne Angabe gilt Blu-ray. */
function formateAus(edition = ''): Format[] {
  const gefunden: Format[] = []
  if (/4k|uhd/i.test(edition)) gefunden.push('u')
  if (/blu-?ray/i.test(edition)) gefunden.push('b')
  if (/\bdvd\b/i.test(edition)) gefunden.push('d')
  return gefunden.length ? gefunden : ['b']
}

/** „Sakamoto Days – Vol. 1“ → „Vol. 1“: der Serienname steht schon im Kopf des Panels; bleibt nichts, bleibt nichts. */
function ohneTitel(name: string, titel: string): string {
  const rest = name.replace(titel, '').replace(/^[\s–\-:]+/, '').trim()
  return rest.length >= 3 ? rest : ''
}

/** „Amazon“ aus `amazon.de`; ohne Adresse kein Händler. */
function haendlerAus(url: string): Haendler {
  const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
  return { name: host.charAt(0).toUpperCase() + host.slice(1), url }
}

/** Die aniSearch-Ausgaben: gleicher Name und gleiches Datum sind eine Ausgabe in mehreren Formaten. */
function ausgabenVonAniSearch(ausgaben: DiscAusgabe[]): Ausgabe[] {
  const nachSchluessel = new Map<string, Ausgabe>()
  for (const [kurz, format, art, datum, artikel] of ausgaben) {
    const schluessel = `${kurz}|${datum}`
    const eintrag = nachSchluessel.get(schluessel) ?? {
      schluessel: `as-${artikel}`,
      name: kurz,
      formate: [],
      datum,
      gesamt: art === 'g',
      artikel: {},
      haendler: [{ name: 'aniSearch', url: artikelUrl(artikel) }],
    }
    if (!eintrag.formate.includes(format)) eintrag.formate.push(format)
    eintrag.artikel[format] = artikel
    nachSchluessel.set(schluessel, eintrag)
  }
  return [...nachSchluessel.values()].map((a) => ({ ...a, formate: FORMATE.filter((f) => a.formate.includes(f)) }))
}

/** Ein Termin gehört zu der aniSearch-Ausgabe, auf deren Artikel er verweist; sonst wird er eine eigene Zeile. */
function mitTerminen(liste: Ausgabe[], releases: Release[], titel: string): Ausgabe[] {
  const ergebnis = liste.map((a) => ({ ...a, haendler: [...a.haendler] }))
  for (const r of releases) {
    const artikel = r.sources.map((s) => Number(/article\/(\d+)/.exec(s)?.[1])).filter(Boolean)
    const shop = r.buyUrl && !/anisearch\./i.test(r.buyUrl) ? haendlerAus(r.buyUrl) : undefined
    const treffer = ergebnis.find((a) => Object.values(a.artikel).some((n) => artikel.includes(n)))
    if (treffer) {
      treffer.release = r
      if (shop) treffer.haendler.unshift(shop)
      continue
    }
    ergebnis.push({
      schluessel: `t-${r.slug}`,
      /* Ein Termin ohne Editionsangabe (Dan Da Dan, 30.09.2026) heißt schlicht „Ausgabe“ — der Titel steht im Kopf. */
      name: [ohneTitel(r.name, titel), kurzeAusgabe(r.edition)].filter(Boolean).join(' · ') || 'Ausgabe',
      formate: formateAus(r.edition),
      datum: r.schedule?.firstEpisodeDate ?? '',
      gesamt: /gesamt|komplett/i.test(r.edition ?? ''),
      artikel: {},
      haendler: shop ? [shop] : [],
      release: r,
    })
  }
  return ergebnis
}

/** Alle Ausgaben eines Titels, älteste zuerst (die Reihenfolge der Bände); ohne Datum ans Ende. */
export function discAusgabenVon({ discAusgaben, discReleases, title }: { discAusgaben: DiscAusgabe[]; discReleases: Release[]; title: Title }): Ausgabe[] {
  return mitTerminen(ausgabenVonAniSearch(discAusgaben), discReleases, anzeigeName(title)).sort(
    (a, b) => (a.datum || '9999').localeCompare(b.datum || '9999') || a.name.localeCompare(b.name),
  )
}

export const istKommend = (a: Ausgabe, today: string): boolean => a.datum > today

/** Kommende zuerst (die nächste oben), dann die erschienenen, jüngste oben. */
export function geteilt(liste: Ausgabe[], today: string): { kommend: Ausgabe[]; erschienen: Ausgabe[] } {
  return {
    kommend: liste.filter((a) => istKommend(a, today)),
    erschienen: liste.filter((a) => !istKommend(a, today)).reverse(),
  }
}

/** Der Verlag, wenn ein Termin ihn nennt — er steht einmal über allem, nicht an jeder Zeile. */
export function verlagVon(releases: Release[]): string | undefined {
  return releases.map((r) => r.publisher).find(Boolean)
}

/** Die Formate, die bei diesem Titel vorkommen, in fester Reihenfolge — Spalten des Rasters. */
export function formateVon(liste: Ausgabe[]): Format[] {
  return FORMATE.filter((f) => liste.some((a) => a.formate.includes(f)))
}

/** Erster Händler ist das Ziel der Zeile: ein Shop vor aniSearch. */
export function zielVon(a: Ausgabe): string | undefined {
  return a.haendler[0]?.url
}
