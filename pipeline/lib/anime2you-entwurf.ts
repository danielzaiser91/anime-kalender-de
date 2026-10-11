/**
 * Vom Vorschlag zum Entwurf eines Handeintrags: Aus dem Bestand der Claude-Extraktion (`data/proposals/anime2you-extraktion.json`) wählt
 * dieses Modul die belastbaren Vorschläge (Tag, Weg und deutsche Fassung belegt, nichts Widersprüchliches) und schreibt sie als YAML-Entwurf
 * für `data/curated/*.yaml`. Es übernimmt nichts: Der Entwurf liegt in `data/proposals/` und wird im Pull Request gegengelesen.
 */
import { slugify } from './util.ts'
import { genannteTage } from './anime2you-vorschlag.ts'
import type { GespeicherterVorschlag } from './anime2you-bestand.ts'

export interface Urteil {
  v: GespeicherterVorschlag
  status: 'neu' | 'schon drin' | 'nicht belastbar'
  grund: string
  /** Gesetzt, wo ein Bestandseintrag verwandt ist: Der Entwurf trägt ihn als „Achtung“-Kommentar. */
  hinweis?: string
}

const TERMIN_ARTEN = ['start', 'folgen', 'disc', 'kino']
/** Warnungen, die Tag oder Uhrzeit betreffen: Der Vorschlag ist dann erst nach Klärung ein Termin. */
const TERMIN_WARNUNG = /ist ein |widerspricht/

export const artikelNummer = (adresse: string): string | undefined => /\/news\/(\d+)/.exec(adresse)?.[1]

const URTEILE: [(v: GespeicherterVorschlag) => boolean, string][] = [
  [(v) => !TERMIN_ARTEN.includes(v.art), 'Art ist kein Termin (Ankündigung, Pause, Sprachfassung, Abgang)'],
  [(v) => !v.datum, 'kein Tag im Zitat'],
  [(v) => !v.sprache.startsWith('deutsch'), 'deutsche Fassung nicht belegt'],
  [(v) => !v.plattform, 'Anbieter nicht im Datenmodell'],
  [(v) => v.warnungen.some((w) => TERMIN_WARNUNG.test(w)), 'Warnung zu Tag oder Uhrzeit'],
]

/** Der Slug, unter dem ein Handeintrag zu diesem Vorschlag stünde (Titel, bei Fernsehen der Sender). */
export const entwurfSlug = (v: GespeicherterVorschlag): string => slugify(`${v.titel} ${v.plattform === 'tv' ? (v.sender ?? '') : ''}`)

/** Ein Eintrag aus `data/curated/`, soweit der Abgleich ihn braucht. */
export interface Bestandseintrag {
  slug: string
  /** `search` und `titleDe`. */
  titel: string[]
  platform: string
  sender?: string
  /** `schedule.firstEpisodeDate`. */
  datum?: string
  /** Kennungen der Anime2You-Artikel in `sources`. */
  artikel: string[]
}

const glatt = (s: string): string => s.toLowerCase().replace(/[^\p{L}\d]+/gu, '')

/** Gleicher Weg (bei Fernsehen gleicher Sender) wie der Vorschlag. */
const gleicherWeg = (v: GespeicherterVorschlag, e: Bestandseintrag): boolean =>
  e.platform === v.plattform && (v.plattform !== 'tv' || glatt(e.sender ?? '') === glatt(v.sender ?? ''))
const gleicherTitel = (v: GespeicherterVorschlag, e: Bestandseintrag): boolean => e.titel.some((t) => glatt(t) === glatt(v.titel))

/**
 * Steht der Vorschlag schon im Bestand? Titelebene: gleicher Titel (`search`/`titleDe`), gleicher Weg und gleicher Starttag. Ein Artikel oder
 * Slug allein genügt nicht: Sammelartikel nennen mehrere Titel, und „one-piece“ ist auch „one-piece-film-…“.
 */
export function bestandsTreffer(v: GespeicherterVorschlag, bestand: Bestandseintrag[]): Bestandseintrag | undefined {
  return bestand.find((e) => gleicherWeg(v, e) && gleicherTitel(v, e) && e.datum === v.datum)
}

/** Ein Eintrag, der nicht als Treffer zählt, aber zum Gegenlesen gehört: derselbe Titel an anderem Tag, oder derselbe Artikel, Weg und Tag unter anderem Namen. */
function verwandterEintrag(v: GespeicherterVorschlag, bestand: Bestandseintrag[]): string | undefined {
  const andererTag = bestand.find((e) => gleicherWeg(v, e) && gleicherTitel(v, e))
  if (andererTag) return `${andererTag.slug} besteht mit Tag ${andererTag.datum ?? '–'} – anderer Termin oder Korrektur?`
  const andererName = bestand.find((e) => gleicherWeg(v, e) && e.datum === v.datum && e.artikel.includes(v.artikelId))
  return andererName ? `${andererName.slug} hat denselben Artikel, Weg und Tag unter anderem Titel – vermutlich derselbe, gegenlesen` : undefined
}


/** „Ab sofort“ ist kein Erscheinungstag; es belegt nur, dass der Titel am Tag des Artikels schon im Angebot war. */
const AB_SOFORT = /\bab sofort\b|\bseit heute\b/i

function ohneTag(v: GespeicherterVorschlag, grund: string): string {
  return !v.datum && AB_SOFORT.test(v.zitat) ? `${grund}; im Angebot spätestens seit ${v.veroeffentlicht}` : grund
}

/** Jeden Vorschlag einordnen; `bestand` sind die Einträge von `data/curated/`. */
export function urteile(liste: GespeicherterVorschlag[], bestand: Bestandseintrag[]): Urteil[] {
  return liste.map((v) => {
    const unbelastbar = URTEILE.find(([trifft]) => trifft(v))
    if (unbelastbar) return { v, status: 'nicht belastbar', grund: ohneTag(v, unbelastbar[1]) }
    const treffer = bestandsTreffer(v, bestand)
    if (treffer) return { v, status: 'schon drin', grund: `Eintrag ${treffer.slug}: Titel, Weg und Starttag gleich` }
    const verwandt = verwandterEintrag(v, bestand)
    return { v, status: 'neu', grund: verwandt ?? 'kein Eintrag mit Titel, Weg und Starttag', hinweis: verwandt }
  })
}

const tage = (v: GespeicherterVorschlag): number[] => [...genannteTage(v.zitat)].sort((a, b) => a - b).map((i) => i + 1)

/** `780–877` → Beginn und Anzahl; undefined, wo `folgen` kein Bereich ist. */
function folgenBereich(folgen: string | null): { ab: number; anzahl: number } | undefined {
  const m = /^(\d+)\s*[–-]\s*(\d+)$/.exec(folgen ?? '')
  return m && Number(m[2]) >= Number(m[1]) ? { ab: Number(m[1]), anzahl: Number(m[2]) - Number(m[1]) + 1 } : undefined
}

/** Der Entwurf eines Eintrags im Format von `data/curated/_SCHEMA.md`; Unbekanntes steht als Kommentar, nie als erfundener Wert. */
export function eintragEntwurf(v: GespeicherterVorschlag, hinweis?: string): string {
  const q = (s: string): string => JSON.stringify(s)
  const disc = v.plattform === 'disc'
  const zeilen = [
    ...(hinweis ? [`# Achtung: ${hinweis}`] : []),
    `# Anime2You ${v.artikelId} (${v.veroeffentlicht}): ${q(v.zitat)}`,
    ...v.warnungen.map((w) => `# Warnung: ${w}`),
    `- slug: ${entwurfSlug(v)}`,
    `  ${disc ? 'titleDe' : 'search'}: ${q(v.titel)}`,
    ...(disc ? [] : ['  # anilistId fehlt: Treffer der Suche prüfen (npx tsx pipeline/qa-resolve.ts)']),
    `  platform: ${v.plattform}`,
    ...(v.plattform === 'tv' ? [`  sender: ${q(v.sender ?? '')}`] : []),
    `  releaseType: ${disc ? 'disc' : 'weekly'}`,
    ...(disc ? ['  # publisher und edition nennt das Zitat nicht: aus dem Artikel ergänzen'] : []),
    '  schedule:',
    `    firstEpisodeDate: "${v.datum}"`,
    ...(v.uhrzeit ? [`    time: "${v.uhrzeit}"`] : []),
    ...(tage(v).length > 1 ? [`    wochentage: [${tage(v).join(', ')}]`] : []),
  ]
  const bereich = folgenBereich(v.folgen)
  if (bereich) zeilen.push(`    firstEpisodeNumber: ${bereich.ab}`, `    episodeCount: ${bereich.anzahl}`)
  zeilen.push('  sources:', `    - ${v.quelle}`)
  return zeilen.join('\n')
}

const zelle = (s: string): string => s.replace(/\|/g, '/')

/** Alle Urteile als Tabelle für die Beschreibung des Pull Requests. */
export function tabelle(liste: Urteil[]): string {
  const kopf = '| Artikel | Titel | Art | Weg | Tag | Sprache | Urteil | Beleg (wörtlich) |\n|---|---|---|---|---|---|---|---|'
  const zeilen = liste.map(({ v, status, grund }) => {
    const weg = v.plattform === 'tv' ? `${v.sender} (tv)` : (v.plattform ?? v.anbieter ?? '–')
    const urteil = grund ? `${status}: ${grund}` : status
    return `| ${v.artikelId} | ${zelle(v.titel)} | ${v.art} | ${weg} | ${v.datum ?? '–'}${v.uhrzeit ? ` ${v.uhrzeit}` : ''} | ${v.sprache} | ${zelle(urteil)} | „${zelle(v.zitat)}“ |`
  })
  return [kopf, ...zeilen].join('\n')
}
