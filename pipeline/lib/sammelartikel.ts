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
import { addDays, weekdayIndex } from '../../shared/time.ts'

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
  /** true, wenn `datum` nur der Meldetag („Ab sofort bei Netflix:“) oder der letzte Wochentag davor ist, kein genannter Starttag. */
  datumGeschaetzt?: boolean
  deutsch: boolean
  /** Die Anbieter laut „Stream:" — im Klartext. */
  stream: string[]
}

/** Überschriften der Anbieter-Sammelartikel: „Netflix: Alle Anime-Neuzugänge im Oktober 2026" u. ä. */
export const ANBIETER_SAMMELARTIKEL = /Disney\+.{0,60}(?:ergänzt|und mehr|weitere)|Neuzugänge|Neuzugang|Katalogtitel|Simulcasts (?:und|für)|neue (?:Herbst|Winter|Frühlings|Sommer)-Simulcasts|Simulcast-Lizenzen/i

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
  /^\s*(?:Ab\s+)?(?:(\d{1,2})\.\s*(?:([A-Za-zÄÖÜäöü]+)|(\d{1,2})\.)|(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)|sofort):\s*»(.+?)«\s*(?:[–-]\s*([^()]+?))?\s*(?:\(([^()]+)\))?\s*$/

/** Jahr zum Monat: Ein Artikel vom Dezember, der Januar nennt, meint das nächste Jahr. */
function iso(tag: number, monat: number, veroeffentlicht: string): string {
  const jahrPub = Number(veroeffentlicht.slice(0, 4))
  const monatPub = Number(veroeffentlicht.slice(5, 7))
  const jahr = monat < monatPub - 6 ? jahrPub + 1 : jahrPub
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

interface Kopf {
  tag?: number
  monat?: number
  abSofort: boolean
  titel: string
  zusatz?: string
  klammer?: string
}

/** Eintragsfelder unter der Kopfzeile. */
const FELD = /^(Simulcast|Episoden|Sprache|Stream|Hinweis|Start|Laufzeit):\s*(.+)$/
/** Kopfzeile ohne Tag: nur „»Titel« – Zusatz“ — sie zählt erst, wenn gleich darunter ein Feld folgt (die Titelliste oben im Artikel hat keins). */
const KOPF_OHNE_TAG = /^»(.+?)«\s*(?:[–-]\s*([^()]+?))?\s*(?:\(([^()]+)\))?\s*$/

/** Erkennt die Kopfzeile eines Eintrags („1. Oktober: »Titel« – Staffel 2 (Simulcast)“ oder ohne Tag, dann mit Feld darunter). */
function liesKopf(zeilen: string[], i: number): Kopf | undefined {
  const zeile = zeilen[i]!
  const k = KOPF.exec(zeile)
  if (!k) {
    const o = KOPF_OHNE_TAG.exec(zeile)
    if (!o || !FELD.test(zeilen[i + 1] ?? '')) return undefined
    return { abSofort: false, titel: o[1]!.trim(), ...(o[2]?.trim() ? { zusatz: o[2].trim() } : {}), ...(o[3] ? { klammer: o[3] } : {}) }
  }
  const monat = k[2] ? MONATE[k[2].toLowerCase()] : k[3] ? Number(k[3]) : undefined
  return {
    ...(k[1] ? { tag: Number(k[1]) } : {}),
    ...(monat ? { monat } : {}),
    abSofort: !k[1] && /^\s*Ab\s+sofort:/i.test(zeile),
    titel: k[4]!.trim(),
    ...(k[5]?.trim() ? { zusatz: k[5].trim() } : {}),
    ...(k[6] ? { klammer: k[6] } : {}),
  }
}

const WOCHENTAG: Record<string, number> = { montag: 0, dienstag: 1, mittwoch: 2, donnerstag: 3, freitag: 4, samstag: 5, sonntag: 6 }
const pad = (n: number | string): string => String(n).padStart(2, '0')

/**
 * Starttag eines Eintrags, dessen Kopfzeile keinen nennt (Artikel „… ab sofort auf Netflix verfügbar“, 10.10.2026: „Start: 4. Oktober 2026“
 * oder gar kein Tag). Ohne Starttag gilt unter einer „Ab sofort …:“-Liste der Meldetag; bei „Jeden Sonntag“ und genau einer verfügbaren Folge
 * der letzte Sonntag bis zum Meldetag. Mehrere Folgen auf einmal lassen den ersten Tag offen — dann kein Datum, nie ein geratenes.
 */
function startOhneKopfTag(feld: { start?: string; simulcast?: string; episoden?: string; bleibt?: boolean }, abSofortListe: boolean, veroeffentlicht: string): Pick<SammelEintrag, 'datum' | 'datumGeschaetzt'> {
  const d = feld.start ? /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)(?:\s+(\d{4}))?/.exec(feld.start) : null
  const monat = d ? MONATE[d[2]!.toLowerCase()] : undefined
  /* „Start: 3. Oktober“ ohne Jahr: das Jahr der Meldung (`iso`), als geschätzt. */
  if (d && monat) return d[3] ? { datum: `${d[3]}-${pad(monat)}-${pad(d[1]!)}` } : { datum: iso(Number(d[1]), monat, veroeffentlicht), datumGeschaetzt: true }
  /* „Serie sollte am 30. September entfernt werden“: sie war schon da, der Meldetag wäre kein Start. */
  if (!abSofortListe || feld.bleibt) return {}
  const tag = veroeffentlicht.slice(0, 10)
  const wochentag = /Jeden\s+(\p{L}+tag)/iu.exec(feld.simulcast ?? '')?.[1]?.toLowerCase()
  if (wochentag === undefined || WOCHENTAG[wochentag] === undefined) return { datum: tag, datumGeschaetzt: true }
  if (!/^1(?:\s+von\s+\d+)?(?:\s+verfügbar)?$/.test(feld.episoden ?? '')) return {}
  return { datum: addDays(tag, -((weekdayIndex(tag) - WOCHENTAG[wochentag] + 7) % 7)), datumGeschaetzt: true }
}

/** Liest die Einträge eines Sammelartikels; die ausführliche Fassung eines Titels schlägt die Kurzliste. */
export function leseSammelartikel(text: string, veroeffentlicht: string): SammelEintrag[] {
  const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean)
  const nachTitel = new Map<string, SammelEintrag & { felder: number }>()
  const abSofortListe = zeilen.some((z) => /^Ab sofort(?:\s[^»]{0,40})?:$/i.test(z))
  for (let i = 0; i < zeilen.length; i++) {
    const k = liesKopf(zeilen, i)
    if (!k) continue
    const e: SammelEintrag & { felder: number } = {
      titel: k.titel,
      ...(k.zusatz ? { zusatz: k.zusatz } : {}),
      ...(k.tag && k.monat ? { datum: iso(k.tag, k.monat, veroeffentlicht) } : {}),
      /* „Ab sofort: »Tokyo Revengers …«" (Disney+, 02.10.2026): der Tag der Meldung. */
      ...(k.abSofort ? { datum: veroeffentlicht.slice(0, 10) } : {}),
      deutsch: /\b(Dub|Synchro)\b/i.test(k.klammer ?? ''),
      woechentlich: /simulcast/i.test(k.klammer ?? ''),
      stream: [],
      felder: 0,
    }
    const feld: { start?: string; simulcast?: string; episoden?: string; bleibt?: boolean } = {}
    for (let j = i + 1; j < zeilen.length && !liesKopf(zeilen, j); j++) {
      const z = zeilen[j]!
      const f = FELD.exec(z)
      if (!f) continue
      e.felder++
      if (f[1] === 'Start') feld.start = f[2]
      if (f[1] === 'Simulcast') {
        e.woechentlich = true
        feld.simulcast = f[2]
      }
      if (f[1] === 'Episoden') {
        feld.episoden = f[2]
        const n = /(\d+)\s*\(komplett\)/.exec(f[2]!)
        if (n) e.folgen = Number(n[1])
      }
      if (f[1] === 'Sprache') e.deutsch = /\bDeutsch\b/.test(f[2]!)
      if (f[1] === 'Hinweis' && /entfernt werden/i.test(f[2]!)) feld.bleibt = true
      if (f[1] === 'Hinweis' && /Synchronisation noch nicht bestätigt/i.test(f[2]!)) e.deutsch = false
      if (f[1] === 'Stream') e.stream = f[2]!.split(/,\s*/).filter((s) => !/noch nicht verfügbar/i.test(s))
    }
    if (!e.datum) Object.assign(e, startOhneKopfTag(feld, abSofortListe, veroeffentlicht))
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
    return vorschlaegeAusSammelartikel({ url: p.articleUrl, publishedAt: p.publishedAt }, p.sammel, anbieter.length === 1 ? anbieter[0] : undefined, p.platforms?.includes('aniverse') ? 'Aniverse' : undefined)
  })
}

export type SammelVerwurf = 'kein deutscher Ton' | 'kein Starttag' | 'Staffel unklar' | 'kein Anbieter'

/** Warum ein Eintrag kein Vorschlag wird — oder `undefined`, wenn er einer wird. Eine Quelle für Übernahme und Protokoll. */
export function sammelVerwurf(e: SammelEintrag, anbieterDesArtikels?: string): SammelVerwurf | undefined {
  if (!e.deutsch) return 'kein deutscher Ton'
  if (!e.datum) return 'kein Starttag'
  if (e.zusatz && UNKLARER_TEIL.test(e.zusatz)) return 'Staffel unklar'
  return sammelAnbieter(e, anbieterDesArtikels).length ? undefined : 'kein Anbieter'
}

const sammelAnbieter = (e: SammelEintrag, anbieterDesArtikels?: string): string[] =>
  [...new Set([...e.stream.map((s) => ANBIETER[s.toLowerCase()]), anbieterDesArtikels].filter((p): p is string => Boolean(p)))]

/** Zählt je Grund, wie viele Einträge eines Sammelartikels nicht übernommen werden (fürs Laufprotokoll). */
export function zaehleSammelVerwurf(eintraege: SammelEintrag[], anbieterDesArtikels?: string): Partial<Record<SammelVerwurf, number>> {
  const zaehler: Partial<Record<SammelVerwurf, number>> = {}
  for (const e of eintraege) {
    const grund = sammelVerwurf(e, anbieterDesArtikels)
    if (grund) zaehler[grund] = (zaehler[grund] ?? 0) + 1
  }
  return zaehler
}

/**
 * Macht aus den deutschen Einträgen eines Sammelartikels Vorschläge für `releasesAus` — dieselbe
 * Titel- und Staffelzuordnung wie bei einer Einzelmeldung („»Blue Box« – Staffel 2").
 */
export function vorschlaegeAusSammelartikel(
  artikel: { url: string; publishedAt: string },
  eintraege: SammelEintrag[],
  anbieterDesArtikels?: string,
  kanal?: string,
): Vorschlag[] {
  const raus: Vorschlag[] = []
  for (const e of eintraege) {
    if (sammelVerwurf(e, anbieterDesArtikels)) continue
    raus.push({
      articleTitle: `»${e.titel}«${e.zusatz ? ` – ${e.zusatz}` : ''}`,
      articleUrl: artikel.url,
      publishedAt: artikel.publishedAt,
      category: 'streaming',
      platforms: sammelAnbieter(e, anbieterDesArtikels),
      dates: [{ iso: e.datum, context: 'Sammelartikel', ...(e.datumGeschaetzt ? { geschaetzt: true } : {}) }],
      dub: 'zugesagt',
      ...(e.folgen ? { folgen: e.folgen } : {}),
      /* Ausdrücklich auch `false`: Ein Eintrag ohne „Simulcast“-Zeile ist kein Wochenstart (`zeitplanAusVorschlag`). */
      woechentlich: Boolean(e.woechentlich),
      ...(kanal ? { kanal } : {}),
    })
  }
  return raus
}

/**
 * Muss ein gespeicherter Sammelartikel erneut gelesen werden? Nie gelesen: ja. Ein junger (45 Tage) mit Einträgen alle drei Tage
 * („Wir aktualisieren diese Liste“), leer gelesen höchstens einmal am Tag — Ankündigungen ohne Liste bleiben legitim leer.
 */
export function sammelFaellig(p: { publishedAt: string; sammelGelesen?: string; sammel?: unknown[] }, heute: string): boolean {
  if (!p.sammelGelesen) return true
  return p.publishedAt >= addDays(heute, -45) && p.sammelGelesen <= addDays(heute, p.sammel?.length ? -3 : -1)
}
