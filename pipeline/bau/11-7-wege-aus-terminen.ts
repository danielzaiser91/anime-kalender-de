import { type PlatformId, type Release, type StreamLink, type Title } from '../../shared/types.ts'
import { zugangsart } from '../../shared/zugangsart.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { log } from '../lib/util.ts'
import { type Ausloeser, ausloeserZeilen } from '../lib/ausloeser-zeilen.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'

/** Der Handbeleg-Leser des Baus (`09-1-belege.ts`). */
type BelegFuer = (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined

/** Anbieter, bei denen man schauen kann; Disc, Kino und Fernsehen sind keine Streaming-Wege. */
const STREAMING = new Set<PlatformId>([
  'crunchyroll',
  'netflix',
  'primevideo',
  'disneyplus',
  'paramountplus',
  'adn',
  'aniverse',
  'wow',
  'joyn',
  'rtlplus',
  'youtube',
])

/** Führt die Adresse auf eine Suche oder die Startseite statt auf eine Titelseite? (Eine Suche ist kein Weg, Daniel 10.09.2026.) */
export function istKeineTitelseite(url: string): boolean {
  try {
    const u = new URL(url)
    const pfad = /\/(search|suche|results)(\/|$)|^\/s$/.test(u.pathname) || u.pathname.replace(/\/+$/, '') === ''
    return pfad || ['k', 'q', 's', 'search', 'search_query'].some((p) => u.searchParams.has(p))
  } catch {
    return true
  }
}

/** Ein sicherer Termin: belegt, nicht geschätzt, bei einem Streaming-Anbieter. */
function istSichererTermin(r: Release): boolean {
  return STREAMING.has(r.platform) && r.releaseType !== 'disc' && !r.schedule?.estimated && (r.sources?.length ?? 0) > 0
}

/** Ein Handbeleg „deutsch" bringt Urteil und Folgenbereiche mit; ohne ihn bleibt der Ton offen, und die Herkunft ist der Termin. */
function tonAusBeleg(beleg: DubCheck | undefined): Pick<StreamLink, 'dub' | 'dubRanges' | 'herkunft'> {
  if (beleg?.dub !== true) return { herkunft: 'termin' }
  const bereiche = beleg.dubRanges?.map((b) => ({ from: b.from, to: b.to, dub: b.dub }))
  return { dub: true, ...(bereiche?.length ? { dubRanges: bereiche } : {}) }
}

/**
 * **Wer einen sicheren Kalendertermin bei einem Anbieter hat, hat dort einen Weg** (11.10.2026).
 *
 * „Tokyo Revengers: War of the Three Titans" läuft laut Disney+ und Anime2You freitags, trug aber
 * `streams: []` — kein Anbieter-Chip im Panel, und die Prüfliste, die nur über Wege mit Adresse
 * läuft, kannte den Titel nicht. Der Weg entsteht hier, ganz am Ende des Wege-Abschlusses:
 * Anbieter aus dem Termin, Adresse nur, wenn der Termin eine Titelseite nennt (keine Suche, keine
 * tote), sonst `url: ''` (Weg ohne Adresse, nur der Anbieter ist bekannt; wie bei den Cartoons, am 18.10.2026
 * 24 Wege bei Disney+, Prime, Netflix, Joyn, RTL+). `dub` bleibt offen — ein Termin ist kein Tonbeleg.
 * Was schon einen Weg zum Anbieter hat oder bewusst entfernt wurde, bleibt unberührt.
 *
 * **Ein Handbeleg gilt vor dem Termin** (11.10.2026: Seit diese Ergänzung läuft, gaben drei Handprüfungen dem Datensatz recht nicht mehr, und der
 * Bau lieferte nichts aus): „nicht verfügbar" oder „ohne deutschen Ton" heißt kein Weg, „deutsch" heißt ein Weg mit dem Urteil und den
 * Folgenbereichen des Belegs, dann ohne Herkunft Termin, denn der Ton ist belegt.
 */
export function ergaenzeWegeAusTerminen({ titles, releases, toteAdressen, verweiseEntfernt, belegFuer }: {
  titles: Map<number, Title>
  releases: Release[]
  toteAdressen: Set<string>
  verweiseEntfernt: EntfernterVerweis[]
  belegFuer: BelegFuer
}): number {
  const entfernt = new Set(verweiseEntfernt.map((v) => `${v.titleId}|${v.plattform}`))
  const handNein = new Set<string>()
  const neu = new Map<string, { titel: Title; weg: StreamLink }>()
  const termine = new Map<string, string | undefined>()
  for (const r of releases) {
    const titel = titles.get(r.titleId)
    const schluessel = `${r.titleId}|${r.platform}`
    if (!titel || !istSichererTermin(r) || entfernt.has(schluessel)) continue
    if (titel.streams?.some((s) => s.platform === r.platform)) continue
    const belegt = r.platformUrl && !istKeineTitelseite(r.platformUrl) && !toteAdressen.has(r.platformUrl)
    const url = belegt ? r.platformUrl! : ''
    if (neu.get(schluessel)?.weg.url) continue
    const beleg = belegFuer(r.titleId, r.platform, url || undefined)
    if (beleg?.available === false || beleg?.dub === false) {
      handNein.add(schluessel)
      continue
    }
    const weg: StreamLink = { platform: r.platform, url, ...tonAusBeleg(beleg), zugang: wegZugang(r.platform, url) }
    if (r.kanal) weg.kanal = r.kanal
    neu.set(schluessel, { titel, weg })
    termine.set(schluessel, r.platformUrl)
  }
  for (const { titel, weg } of neu.values()) titel.streams = [...(titel.streams ?? []), weg]
  if (neu.size) {
    log(`${neu.size} Wege aus sicheren Kalenderterminen ergänzt (Ton nur, wo ein Handbeleg ihn belegt)`)
    for (const z of ausloeserZeilen(wegAusloeser(neu, termine))) log(z)
  }
  bestehe(termineOhneWeg(titles, releases, new Set([...entfernt, ...handNein])), tonOhneBeleg(titles))
  return neu.size
}

/** Auslöser-Angaben je ergänztem Weg; aufgerufen nach dem Anhängen, `wegVorher` ist daher der Bestand ohne den neuen Weg. */
function wegAusloeser(neu: Map<string, { titel: Title; weg: StreamLink }>, termine: Map<string, string | undefined>): Ausloeser[] {
  return [...neu].map(([schluessel, { titel, weg }]) => ({
    titleId: titel.id,
    name: anzeigeName(titel),
    regel: `wegAusTermin:${weg.platform}`,
    terminUrl: termine.get(schluessel),
    wegVorher: (titel.streams ?? []).filter((s) => s !== weg).map((s) => s.url),
    wegNachher: (titel.streams ?? []).map((s) => s.url),
  }))
}

/** Schlüssel `Titel|Anbieter` aller sicheren Termine, zu denen der Titel keinen Weg hat und die nicht bewusst entfernt wurden. */
export function termineOhneWeg(titles: Map<number, Title>, releases: Release[], entfernt: Set<string>): string[] {
  const fehlt = releases.filter((r) => {
    const titel = titles.get(r.titleId)
    return titel && istSichererTermin(r) && !entfernt.has(`${r.titleId}|${r.platform}`) && !titel.streams?.some((s) => s.platform === r.platform)
  })
  return [...new Set(fehlt.map((r) => `${r.titleId}|${r.platform}`))]
}

/** Titel, deren Weg aus einem Termin stammt und trotzdem ein Tonurteil trägt — ein Termin ist kein Tonbeleg. */
export function tonOhneBeleg(titles: Map<number, Title>): number[] {
  return [...titles.values()].filter((t) => t.streams?.some((s) => s.herkunft === 'termin' && s.dub !== undefined)).map((t) => t.id)
}

/** Zusicherung: bricht den Bau ab, statt einen Datensatz mit Lücke oder erfundenem Ton zu schreiben. */
function bestehe(ohneWeg: string[], mitTon: number[]) {
  brichAbBeiWiderspruch([
    ...(ohneWeg.length ? [`sicherer Termin ohne Weg zum Anbieter: ${ohneWeg.slice(0, 10).join(', ')}`] : []),
    ...(mitTon.length ? [`Weg aus einem Termin mit Tonurteil: ${mitTon.slice(0, 10).join(', ')}`] : []),
  ])
}

/** Prime führt Abo und Kauf nebeneinander; was ein Termin kostet, sagt er nicht. */
function wegZugang(platform: PlatformId, url: string): StreamLink['zugang'] {
  return platform === 'primevideo' ? 'unbekannt' : zugangsart(platform, undefined, url)
}
