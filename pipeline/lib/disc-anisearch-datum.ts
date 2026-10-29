/**
 * **Das neuere belegte Datum gewinnt: Nennt aniSearch für eine Disc einen anderen Tag als unsere Handeinträge und
 * Anime2You-Meldungen, und hat aniSearch ihn später gelesen als die jüngste dieser Meldungen erschien, gilt aniSearch**
 * (29.10.2026, Virgin Road Vol. 1: Anime2You vom 02.10. „30.10.", aniSearch seit dem 12.10. „06.11."; angezeigt blieb der 30.10.).
 *
 * Verknüpft wird wie in `disc-termin.ts` über dieselbe Nummer (Box, Volume) und nur, wenn aniSearch für diese Nummer genau
 * einen Tag nennt — mehrere Tage (DVD und Blu-ray, Neuauflage) sind keine Aussage. Nicht übernommen werden der Platzhalter
 * 31.12. und ein Tag, der schon vorbei ist, während unser Tag noch bevorsteht (Black Butler: eine frühere Ausgabe).
 */
import type { Quelle, Release } from '../../shared/types.ts'
import { discNummer } from './disc-termin.ts'
import { buyUrlNachVerschiebung, discIndexLaden, type DiscIndex } from './disc-ean.ts'
import { quellenName } from './meldungen.ts'
import { readJson } from './util.ts'

export interface AniSearchTermin {
  datum: string
  /** Tag, an dem der aniSearch-Artikel zuletzt gelesen wurde (`fetchedAt`; der älteste, wenn mehrere Ausgaben denselben Tag nennen). */
  gelesen: string
  url: string
}

const ARTIKEL_ID = /article\/(\d+)/
const ohneSchraegstrich = (url: string): string => url.replace(/\/$/, '')

/**
 * „staffel 2", „teil 2" aus einem Namen („Tsubasa Chronicle: Staffel 2 - Vol. 1/3", „Strike Witches (Staffel 2) – Vol. 1"), sonst `''`.
 * Dieselbe Nummer in einer anderen Staffel ist eine andere Ware; „Staffel 1" gilt als keine Angabe, fehlt sie nur auf einer Seite sonst, ist es kein Treffer.
 */
function staffelVon(name: string): string {
  const m = /\b(staffel|season|teil|part|cour)\s*(\d+)/i.exec(name)
  const art = /^(staffel|season)$/i.test(m?.[1] ?? '') ? 'staffel' : (m?.[1] ?? '').toLowerCase()
  /* aniSearch schreibt „Staffel 1" aus, wo unsere Namen die erste Staffel ohne Angabe lassen (Bocchi the Rock!, Spice and Wolf). */
  return !m || (art === 'staffel' && Number(m[2]) === 1) ? '' : `${art} ${m[2]}`
}

/** Der Tag, den aniSearch für die Nummer dieser Disc nennt — nur bei genau einem Tag und gelesenen Artikeln. */
export function aniSearchTermin(r: Pick<Release, 'name' | 'titleId'>, index: DiscIndex): AniSearchTermin | undefined {
  const nummer = discNummer(r.name)
  if (!nummer || r.titleId === undefined) return undefined
  const treffer = (index.ausgaben[String(r.titleId)] ?? []).filter((a) => {
    const n = discNummer(a.kurz ?? '')
    return n && n.art === nummer.art && n.nr === nummer.nr && staffelVon(a.edition ?? '') === staffelVon(r.name)
  })
  if (new Set(treffer.map((a) => a.datum)).size !== 1) return undefined
  const gelesen = treffer.map((a) => index.artikel[ARTIKEL_ID.exec(a.url ?? '')?.[1] ?? '']?.fetchedAt?.slice(0, 10))
  if (gelesen.some((g) => !g)) return undefined
  const ziel = treffer.find((a) => a.format === 'Blu-ray' && a.url) ?? treffer.find((a) => a.url)
  if (!ziel?.url) return undefined
  return { datum: treffer[0]!.datum, gelesen: gelesen.map(String).sort()[0]!, url: ziel.url }
}

/** Adresse → Tag der Veröffentlichung, aus den Anime2You-Vorschlägen. */
export function veroeffentlichungstage(vorschlaege: { articleUrl: string; publishedAt: string }[]): Map<string, string> {
  return new Map(vorschlaege.map((v) => [ohneSchraegstrich(v.articleUrl), v.publishedAt]))
}

/** Die jüngste bekannte Veröffentlichung unter den Quellen des Releases; `undefined`, wenn keine bekannt ist. */
function juengsteMeldung(r: Release, veroeffentlicht: Map<string, string>): string | undefined {
  const tage = r.sources.map((u) => veroeffentlicht.get(ohneSchraegstrich(u))).filter((t): t is string => Boolean(t))
  return tage.sort().at(-1)
}

/** Gilt der aniSearch-Tag für dieses Release? */
export function aniSearchGewinnt(r: Release, termin: AniSearchTermin, veroeffentlicht: Map<string, string>, heute: string): boolean {
  const unserer = r.schedule.firstEpisodeDate
  if (!unserer || termin.datum === unserer || termin.datum.endsWith('-12-31')) return false
  if (termin.datum <= heute && unserer > heute) return false
  const meldung = juengsteMeldung(r, veroeffentlicht)
  return Boolean(meldung) && termin.gelesen > meldung!
}

function mitAniSearchBeleg(r: Release, termin: AniSearchTermin, heute: string): Quelle[] {
  const grund = `Termin laut aniSearch: ${termin.datum}`
  const bisher: Quelle[] = r.quellen ?? r.sources.map((url) => ({ url, name: quellenName(url), gesehenAm: heute, sagt: r.schedule.firstEpisodeDate }))
  const alt = bisher.filter((q) => q.url !== termin.url).map((q) => (q.sagt === termin.datum ? q : { ...q, stand: 'ueberholt' as const, grund }))
  return [...alt, { url: termin.url, name: quellenName(termin.url), gesehenAm: heute, sagt: termin.datum, stand: 'aktuell' }]
}

export interface DiscPruefQuellen {
  index: DiscIndex
  veroeffentlicht: Map<string, string>
}

export function discPruefQuellenLaden(): DiscPruefQuellen {
  const vorschlaege = readJson<{ proposals?: { articleUrl: string; publishedAt: string }[] }>('data/proposals/anime2you.json', {})
  return { index: discIndexLaden(), veroeffentlicht: veroeffentlichungstage(vorschlaege.proposals ?? []) }
}

/** Wächter (`pruefeErgebnis`): Disc-Releases, deren angezeigter Tag älter belegt ist als ein abweichender aniSearch-Tag. */
export function discTerminFehler(releases: Release[], heute: string, quellen?: DiscPruefQuellen): string[] {
  const discs = releases.filter((r) => r.releaseType === 'disc')
  if (!discs.length) return []
  const q = quellen ?? discPruefQuellenLaden()
  return discs.flatMap((r) => {
    const termin = aniSearchTermin(r, q.index)
    if (!termin || !aniSearchGewinnt(r, termin, q.veroeffentlicht, heute)) return []
    return [`Disc „${r.name}": angezeigt ${r.schedule.firstEpisodeDate}, aniSearch nennt ${termin.datum} (gelesen ${termin.gelesen}, nach der jüngsten Meldung) — das neuere belegte Datum muss gelten (lib/disc-anisearch-datum.ts)`]
  })
}

/**
 * Setzt bei Disc-Releases den neueren aniSearch-Tag. Ersetzt die Releases im Array und gibt zurück, was sich geändert hat.
 * `veroeffentlicht`: Adresse einer Meldung → Tag ihrer Veröffentlichung (aus den Anime2You-Vorschlägen).
 */
export function aniSearchDatumAnwenden(
  releases: Release[],
  index: DiscIndex,
  veroeffentlicht: Map<string, string>,
  heute: string,
): { name: string; von: string; nach: string }[] {
  const geaendert: { name: string; von: string; nach: string }[] = []
  releases.forEach((r, i) => {
    if (r.releaseType !== 'disc') return
    const termin = aniSearchTermin(r, index)
    if (!termin || !aniSearchGewinnt(r, termin, veroeffentlicht, heute)) return
    const buyUrl = buyUrlNachVerschiebung(r.buyUrl, r.titleId, termin.datum, index)
    const sources = [...new Set([...r.sources, termin.url])]
    const schedule = { ...r.schedule, firstEpisodeDate: termin.datum }
    releases[i] = { ...r, ...(buyUrl ? { buyUrl } : {}), schedule, year: Number(termin.datum.slice(0, 4)), sources, quellen: mitAniSearchBeleg(r, termin, heute) }
    geaendert.push({ name: r.name, von: r.schedule.firstEpisodeDate!, nach: termin.datum })
  })
  return geaendert
}
