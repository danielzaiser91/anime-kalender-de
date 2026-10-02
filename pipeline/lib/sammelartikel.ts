/**
 * **Sammelartikel lesen: die Monats-Neuzugänge der Anbieter** (Daniel, 02.10.2026: „ich will nicht
 * dass wir irgendwas verpassen").
 *
 * Die Übernahme aus Anime2You (`releasesAus`) liest nur Überschriften — „Netflix: Alle
 * Anime-Neuzugänge im Oktober 2026" nennt keinen Titel und fiel durch. Im Artikel steht aber je
 * Titel eine feste Vorlage:
 *
 *   1. Oktober: »The Ramparts of Ice« – Staffel 2 (Simulcast)
 *   Simulcast: Jeden Donnerstag
 *   Sprache: Deutsch, Japanisch (UT)
 *   Stream: Netflix
 *
 * ADN-Artikel führen dazu eine Kurzliste „Ab 08.10.: »86 EIGHTY-SIX« (Dub + Sub)". Weitergegeben
 * wird **nur, was deutschen Ton nennt** — ein OmU-Simulcast ist kein deutscher Termin, und
 * „Deutsche Synchronisation noch nicht bestätigt" heißt genau das.
 */
import type { Vorschlag } from './meldungen.ts'

export interface SammelEintrag {
  titel: string
  /** Was hinter dem Titel steht: „Staffel 2", „Part 1", „Sonderfolgen". */
  zusatz?: string
  /** ISO-Datum des Starts, wo der Artikel einen Tag nennt. */
  datum?: string
  /** Wöchentlicher Simulcast. */
  woechentlich?: boolean
  /** „Episoden: 13 (komplett)" — alle Folgen an einem Tag. */
  folgen?: number
  deutsch: boolean
  /** Die Anbieter laut „Stream:" — im Klartext. */
  stream: string[]
}

/** Überschriften der Anbieter-Sammelartikel: „Netflix: Alle Anime-Neuzugänge im Oktober 2026" u. ä. */
export const ANBIETER_SAMMELARTIKEL = /Neuzugänge|Neuzugang|Katalogtitel|Simulcasts (?:und|für)|neue (?:Herbst|Winter|Frühlings|Sommer)-Simulcasts|Simulcast-Lizenzen/i

/** Artikel-HTML → Text mit einer Zeile je Absatz, Listenpunkt und Umbruch — die Vorlage ist zeilenweise. */
export function artikelZeilen(html: string): string {
  const start = html.indexOf('<article')
  const ende = html.indexOf('</article>')
  return (start >= 0 && ende > start ? html.slice(start, ende) : html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<(?:br|\/p|\/li|\/h\d|\/tr|\/td)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8211;/g, '–')
    .replace(/&#187;/g, '»')
    .replace(/&#171;/g, '«')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
}

const MONATE: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, dezember: 12,
}
const KOPF =
  /^\s*(?:Ab\s+)?(?:(\d{1,2})\.\s*(?:([A-Za-zÄÖÜäöü]+)|(\d{1,2})\.)|(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)):\s*»(.+?)«\s*(?:[–-]\s*([^()]+?))?\s*(?:\(([^()]+)\))?\s*$/

/** Jahr zum Monat: Ein Artikel vom Dezember, der Januar nennt, meint das nächste Jahr. */
function iso(tag: number, monat: number, veroeffentlicht: string): string {
  const jahrPub = Number(veroeffentlicht.slice(0, 4))
  const monatPub = Number(veroeffentlicht.slice(5, 7))
  const jahr = monat < monatPub - 6 ? jahrPub + 1 : jahrPub
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

/** Liest die Einträge eines Sammelartikels; die ausführliche Fassung eines Titels schlägt die Kurzliste. */
export function leseSammelartikel(text: string, veroeffentlicht: string): SammelEintrag[] {
  const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean)
  const nachTitel = new Map<string, SammelEintrag & { felder: number }>()
  for (let i = 0; i < zeilen.length; i++) {
    const k = KOPF.exec(zeilen[i]!)
    if (!k) continue
    const monat = k[2] ? MONATE[k[2].toLowerCase()] : k[3] ? Number(k[3]) : undefined
    const e: SammelEintrag & { felder: number } = {
      titel: k[4]!.trim(),
      ...(k[5]?.trim() ? { zusatz: k[5].trim() } : {}),
      ...(k[1] && monat ? { datum: iso(Number(k[1]), monat, veroeffentlicht) } : {}),
      deutsch: /\b(Dub|Synchro)\b/i.test(k[6] ?? ''),
      woechentlich: /simulcast/i.test(k[6] ?? ''),
      stream: [],
      felder: 0,
    }
    for (let j = i + 1; j < zeilen.length && !KOPF.test(zeilen[j]!); j++) {
      const z = zeilen[j]!
      const f = /^(Simulcast|Episoden|Sprache|Stream|Hinweis):\s*(.+)$/.exec(z)
      if (!f) continue
      e.felder++
      if (f[1] === 'Simulcast') e.woechentlich = true
      if (f[1] === 'Episoden') {
        const n = /(\d+)\s*\(komplett\)/.exec(f[2]!)
        if (n) e.folgen = Number(n[1])
      }
      if (f[1] === 'Sprache') e.deutsch = /\bDeutsch\b/.test(f[2]!)
      if (f[1] === 'Hinweis' && /Synchronisation noch nicht bestätigt/i.test(f[2]!)) e.deutsch = false
      if (f[1] === 'Stream') e.stream = f[2]!.split(/,\s*/).filter((s) => !/noch nicht verfügbar/i.test(s))
    }
    const schluessel = `${e.titel}|${e.zusatz ?? ''}`
    const alt = nachTitel.get(schluessel)
    if (!alt || e.felder > alt.felder) nachTitel.set(schluessel, { ...e, ...(alt && !e.datum && alt.datum ? { datum: alt.datum } : {}) })
  }
  return [...nachTitel.values()].map(({ felder: _f, ...e }) => e)
}

const ANBIETER: Record<string, string> = {
  netflix: 'netflix', adn: 'adn', crunchyroll: 'crunchyroll', 'prime video': 'primevideo', aniverse: 'primevideo',
  'disney+': 'disneyplus', joyn: 'joyn', 'rtl+': 'rtlplus',
}

/**
 * Zusätze, die keine einzelne Staffel benennen — dort wäre jede Zuordnung geraten: „Sonderfolgen"
 * (My Happy Marriage landete so an Staffel 1), „Staffel 1 und 2" (MHA Vigilantes landete am
 * Haupt-MHA), „Part 1" (Berserk 1997 oder 2016?).
 */
const UNKLARER_TEIL = /sonderfolge|special|ova|oad|film|movie|part|teil|\bund\b|episode\s*\d+\s*bis/i

/** Alle gelesenen Sammelartikel als einzelne Vorschläge; der Anbieter der Überschrift gilt, wo der Eintrag keinen nennt. */
export function vorschlaegeAusAllenSammelartikeln(vorschlaege: Vorschlag[]): Vorschlag[] {
  return vorschlaege.flatMap((p) => {
    if (!p.sammel?.length) return []
    const anbieter = [...new Set((p.platforms ?? []).map((x) => (x === 'aniverse' ? 'primevideo' : x)))]
    return vorschlaegeAusSammelartikel({ url: p.articleUrl, publishedAt: p.publishedAt }, p.sammel, anbieter.length === 1 ? anbieter[0] : undefined)
  })
}

/**
 * Macht aus den deutschen Einträgen eines Sammelartikels Vorschläge für `releasesAus` — dieselbe
 * Titel- und Staffelzuordnung wie bei einer Einzelmeldung („»Blue Box« – Staffel 2").
 */
export function vorschlaegeAusSammelartikel(
  artikel: { url: string; publishedAt: string },
  eintraege: SammelEintrag[],
  anbieterDesArtikels?: string,
): Vorschlag[] {
  const raus: Vorschlag[] = []
  for (const e of eintraege) {
    if (!e.deutsch || !e.datum || (e.zusatz && UNKLARER_TEIL.test(e.zusatz))) continue
    const platforms = [...new Set([...e.stream.map((s) => ANBIETER[s.toLowerCase()]), anbieterDesArtikels].filter((p): p is string => Boolean(p)))]
    if (!platforms.length) continue
    raus.push({
      articleTitle: `»${e.titel}«${e.zusatz ? ` – ${e.zusatz}` : ''}`,
      articleUrl: artikel.url,
      publishedAt: artikel.publishedAt,
      category: 'streaming',
      platforms,
      dates: [{ iso: e.datum, context: 'Sammelartikel' }],
      dub: 'zugesagt',
      ...(e.folgen ? { folgen: e.folgen } : {}),
      ...(e.woechentlich ? { woechentlich: true } : {}),
    })
  }
  return raus
}
