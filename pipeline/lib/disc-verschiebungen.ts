/**
 * Anime2You-Sammelartikel „25 Blu-ray-Termine … verschoben": je Zeile Titel, alter und neuer Tag.
 *
 * Die Handeinträge in `data/curated/disc-*.yaml` stammen aus denselben Artikeln (Monatsübersicht)
 * und tragen deren Namen — ein Name ist hier also eine Kennung, keine Ähnlichkeit. Übernommen
 * wird trotzdem nur, wenn unser Termin in der Kette der Verschiebungen steht; sonst kennt eine
 * andere Quelle etwas, das diese Tabelle nicht weiß. Hintergrund: docs/wissen/quellen.md,
 * „Disc-Verschiebungen aus Anime2You".
 */
import type { Quelle, Release } from '../../shared/types.ts'
import { addDays } from '../../shared/time.ts'
import { quellenName } from './meldungen.ts'

export interface Verschiebung {
  /** Wie im Artikel, samt Ausgabe in Klammern. */
  titel: string
  alt: string
  neu: string
}

/** Der Vorschlag, wie ihn `scrape-anime2you.ts` speichert — nur, was hier gebraucht wird. */
export interface VerschiebungsArtikel {
  articleUrl: string
  publishedAt: string
  verschiebungen?: Verschiebung[]
}

/** Überschriften der Sammelartikel: „30 Blu-ray-Termine von Crunchyroll und AniMoon verschoben". */
export const SAMMELARTIKEL = /termine\b.*\bverschoben/i

const ENTITAETEN: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"' }
function klartext(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, n: string) => ENTITAETEN[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * „dd.mm." zum ISO-Tag. Die Tabellen nennen kein Jahr: Ein neuer Termin liegt nie vor dem Artikel
 * (sonst im Folgejahr), ein alter höchstens ein halbes Jahr davor.
 */
function tagZuIso(ddmm: string, am: string, spielraum: number): string | undefined {
  const m = /^(\d\d)\.(\d\d)\.$/.exec(ddmm)
  if (!m) return undefined
  const iso = `${am.slice(0, 4)}-${m[2]}-${m[1]}`
  return iso < addDays(am, -spielraum) ? `${Number(am.slice(0, 4)) + 1}${iso.slice(4)}` : iso
}

/** Liest alle Tabellenzeilen „Titel | Alt | Neu" eines Sammelartikels. */
export function leseVerschiebungstabelle(html: string, am: string): Verschiebung[] {
  const zeilen: Verschiebung[] = []
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const zellen = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => klartext(m[1]!))
    if (zellen.length < 3) continue
    const alt = tagZuIso(zellen[1]!, am, 183)
    const neu = tagZuIso(zellen[2]!, am, 0)
    if (alt && neu && zellen[0]) zeilen.push({ titel: zellen[0], alt, neu })
  }
  return zeilen
}

/** Vergleichsform eines Namens: ohne Ausgabe in Klammern, ohne Satzzeichen, „&" = „and". */
export function discSchluessel(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9äöüß'.]+/g, ' ')
    .trim()
}

interface Kettenglied {
  alt: string
  neu: string
  url: string
}

/** Je Name alle Verschiebungen, älteste zuerst. */
function ketten(artikel: VerschiebungsArtikel[]): Map<string, Kettenglied[]> {
  const nachName = new Map<string, Kettenglied[]>()
  for (const a of [...artikel].sort((x, y) => x.publishedAt.localeCompare(y.publishedAt)))
    for (const v of a.verschiebungen ?? []) {
      const k = discSchluessel(v.titel)
      nachName.set(k, [...(nachName.get(k) ?? []), { alt: v.alt, neu: v.neu, url: a.articleUrl }])
    }
  return nachName
}

/** Die Belege nach der Verschiebung: jeder Artikel der Kette mit seinem Tag, nur der letzte gilt. */
function belege(r: Release, kette: Kettenglied[], heute: string): Quelle[] {
  const ziel = kette.at(-1)!.neu
  const grund = `Termin verschoben auf: ${ziel}`
  const bisher: Quelle[] = (r.quellen ?? r.sources.map((url) => ({ url, name: quellenName(url), gesehenAm: heute, sagt: r.schedule.firstEpisodeDate })))
    .map((q) => (q.sagt === ziel ? q : { ...q, stand: 'ueberholt' as const, grund }))
  const neu = kette.map((g, i): Quelle => ({
    url: g.url,
    name: quellenName(g.url),
    gesehenAm: heute,
    sagt: g.neu,
    ...(i === kette.length - 1 ? { stand: 'aktuell' as const } : { stand: 'ueberholt' as const, grund }),
  }))
  const urls = new Set(neu.map((q) => q.url))
  return [...bisher.filter((q) => !urls.has(q.url)), ...neu]
}

/**
 * Zieht Disc-Termine nach, die ein Sammelartikel verschoben hat. Ersetzt die betroffenen Releases
 * im Array und gibt zurück, was sich geändert hat.
 */
export function verschiebungenAnwenden(
  releases: Release[],
  artikel: VerschiebungsArtikel[],
  heute: string,
): { name: string; von: string; nach: string }[] {
  const nachName = ketten(artikel)
  const geaendert: { name: string; von: string; nach: string }[] = []
  releases.forEach((r, i) => {
    const kette = r.releaseType === 'disc' ? nachName.get(discSchluessel(r.name)) : undefined
    const von = r.schedule.firstEpisodeDate
    if (!kette || !von) return
    const nach = kette.at(-1)!.neu
    if (von === nach || !kette.some((g) => g.alt === von || g.neu === von)) return
    const sources = [...new Set([...r.sources, ...kette.map((g) => g.url)])]
    releases[i] = { ...r, schedule: { ...r.schedule, firstEpisodeDate: nach }, year: Number(nach.slice(0, 4)), sources, quellen: belege(r, kette, heute) }
    geaendert.push({ name: r.name, von, nach })
  })
  return geaendert
}
