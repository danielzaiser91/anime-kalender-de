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

/**
 * Jeden Vorschlag einordnen. `artikel` sind die Kennungen der Artikel, die schon als Quelle in den Handdateien stehen, `slugs` die Slugs von `data/curated/`.
 */
export function urteile(liste: GespeicherterVorschlag[], artikel: Set<string>, slugs: string[]): Urteil[] {
  return liste.map((v) => {
    const unbelastbar = URTEILE.find(([trifft]) => trifft(v))
    if (unbelastbar) return { v, status: 'nicht belastbar', grund: unbelastbar[1] }
    if (artikel.has(v.artikelId)) return { v, status: 'schon drin', grund: `Artikel ${v.artikelId} ist schon Quelle` }
    const slug = entwurfSlug(v)
    const gleich = slugs.find((s) => s === slug || s.startsWith(`${slug}-`))
    return gleich ? { v, status: 'schon drin', grund: `Slug ${gleich} besteht` } : { v, status: 'neu', grund: '' }
  })
}

const tage = (v: GespeicherterVorschlag): number[] => [...genannteTage(v.zitat)].sort((a, b) => a - b).map((i) => i + 1)

/** `780–877` → Beginn und Anzahl; undefined, wo `folgen` kein Bereich ist. */
function folgenBereich(folgen: string | null): { ab: number; anzahl: number } | undefined {
  const m = /^(\d+)\s*[–-]\s*(\d+)$/.exec(folgen ?? '')
  return m && Number(m[2]) >= Number(m[1]) ? { ab: Number(m[1]), anzahl: Number(m[2]) - Number(m[1]) + 1 } : undefined
}

/** Der Entwurf eines Eintrags im Format von `data/curated/_SCHEMA.md`; Unbekanntes steht als Kommentar, nie als erfundener Wert. */
export function eintragEntwurf(v: GespeicherterVorschlag): string {
  const q = (s: string): string => JSON.stringify(s)
  const disc = v.plattform === 'disc'
  const zeilen = [
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
