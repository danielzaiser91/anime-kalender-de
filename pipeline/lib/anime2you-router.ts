/**
 * Artikel-Router der Anime2You-Auswertung (PR C des Vorrats „ohne Claude“): entscheidet je Artikel, ob die Regel (`anime2you-regel.ts`) ihn vollständig
 * erklärt und Claude ihn nicht mehr lesen muss. Reine Entscheidung, kein Schreiben, kein Abruf.
 *
 * „Vollständig erklärt“ heißt, dass jede Bedingung hält – im Zweifel liest Claude weiter:
 * 1. Die Rubrik (JSON-LD `articleSection`) fehlt nicht und jede steht in `ERLAUBTE_RUBRIKEN` (Streaming-Rubriken; Merchandise, Promo-Video, Japan … sind nie vollständig).
 * 2. Die Regel liefert mindestens eine Behauptung und alle sind Blöcke (»Titel« / Sprache: / Stream:). Sätze bleiben bei Claude: die Satzfamilie ist
 *    mit 15 von 71 Behauptungen zu dünn gemessen (Bericht 07.11.2026, „Offen und Grenzen“).
 * 3. Jeder »Titel« im Artikel hat eine Behauptung (Titel gleich oder einer im anderen enthalten): ein Titel ohne Behauptung ist Inhalt, den die Regel nicht liest.
 * 3b. Kein Block hat ein Feld `Start:`, `Hinweis:`, `Episoden:` oder `Simulcast:` (die Regel liest sie nicht), und im Artikel steht kein Datum und keine Uhrzeit außer dem Tagesdatum der Regel
 *    (Überschrift, Veröffentlicht- und Autorenzeile, Tag vor dem »Titel«); unabhängig von Claude und von der Anführung – „vollständig“ nur gegen Claudes Antwort wäre zirkulär.
 *    Die Regel liest keine Uhrzeit und keinen Rhythmus; ein `Simulcast:`-Block mit „Jeden Samstag um 15:30 Uhr“ geht deshalb an Claude (schon durch 3b).
 * 4. Jede Behauptung besteht dieselbe Prüfung am Artikeltext wie ein Vorschlag von Claude (`pruefeVorschlag`) – sonst wäre `--uebernehmen` der Verwerfer.
 *
 * Von den erklärten Artikeln liest Claude weiter jeden fünften (`istStichprobe`, nach Artikelkennung, damit die Auswahl nicht vom Lauf abhängt),
 * damit die Abweichung Regel gegen Claude weiter gemessen wird (Schattenschritt).
 */
import { decodeEntities } from './feed.ts'
import { leseBehauptungen, MONATE, type Behauptung } from './anime2you-regel.ts'
import { norm } from './anime2you-schatten.ts'
import { pruefeVorschlag } from './anime2you-vorschlag.ts'

/** Jeder wievielte erklärte Artikel (nach Kennung) trotzdem an Claude geht. */
export const STICHPROBE_ALLE = 5

/** Streaming-Rubriken, in denen die Block-Familie vorkommt; gemessen an 232 Artikeln (Bericht 07.11.2026 und `anime2you-router-faelle.json`). */
export const ERLAUBTE_RUBRIKEN = ['Crunchyroll', 'Netflix', 'Prime Video', 'Disney+', 'Paramount+', 'ADN', 'aniverse']

/** Rubriken der Seite: `articleSection` des Artikel-Knotens im JSON-LD (Liste, Entitäten aufgelöst); leer, wenn die Seite keine nennt oder sie sich geändert hat. */
export function rubrikenAusHtml(html: string): string[] {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const wurzel = JSON.parse(m[1]!) as { '@graph'?: unknown[] } & Record<string, unknown>
      const knoten = (Array.isArray(wurzel['@graph']) ? wurzel['@graph'] : [wurzel]) as Record<string, unknown>[]
      const artikel = knoten.find((k) => k['@type'] === 'Article' || k['@type'] === 'NewsArticle')
      const sektion = artikel?.articleSection
      // PHP schreibt eine Liste mit Lücke im Schlüssel als Objekt: {"1":"Netflix"} (Artikel 1062641).
      const liste = typeof sektion === 'string' ? [sektion] : typeof sektion === 'object' && sektion !== null ? Object.values(sektion) : []
      return liste.filter((s): s is string => typeof s === 'string').map((s) => decodeEntities(s).trim()).filter(Boolean)
    } catch {
      continue
    }
  }
  return []
}

/** Der Vorschlag, wie ihn `pruefeVorschlag` aus einer Claude-Antwort liest. `art` ist „sprachfassung“: die Regel behauptet nur die deutsche Fassung auf dieser Plattform. */
export function alsVorschlag(b: Behauptung): Record<string, unknown> {
  return {
    titel: b.titel,
    art: 'sprachfassung',
    plattform: b.plattform,
    anbieter: null,
    sender: null,
    datum: b.datum ?? null,
    uhrzeit: null,
    wochentage: null,
    sprache: b.sprache,
    folgen: null,
    zitat: b.zitat,
    unsicher: null,
  }
}

/** Ein Titel unter vier Zeichen (auch ein rein japanischer, `norm` = „“) gilt nie als gedeckt, auch nicht durch sich selbst: ein Block mit so einem Titel macht den Artikel zum Rest. */
const gedeckt = (titel: string, behauptungen: Behauptung[]): boolean => {
  const x = norm(titel)
  return x.length >= 4 && behauptungen.some((b) => x.includes(norm(b.titel)) || norm(b.titel).includes(x))
}

/**
 * A1 (Allowlist): Im Block trägt die Regel nur `Sprache:`, `Stream:` und `Laufzeit:` (Laufzeit ohne Aussage). Jede andere Zeile im Zitat nach der Kopfzeile
 * und jede `Name:`-Zeile im Neun-Zeilen-Fenster dahinter (`Neue Folge:`, `Verfügbar bis:`, `Folgen:`, `Start:`, `Hinweis:`, `Episoden:`, `Simulcast:` …) gehört Claude.
 * Episoden und Simulcast: Claude schreibt aus demselben Block uneinheitlich (`art` einmal `start`, einmal `sprachfassung`; `folgen` „12“ gegen „12 (komplett)“, Messung PR-Text 07.11.2026).
 */
const FELD_MIT_REGEL = ['Sprache', 'Stream', 'Laufzeit']
/** Hinter dem Zitat steht in 31 Zeilen der 16 echten Artikel `Handlung:` (Inhaltsangabe; Datum und Uhrzeit darin fängt `datumAusserhalb`): dort Fließtext. */
const FENSTER_ERLAUBT = [...FELD_MIT_REGEL, 'Handlung']
const NAME_ZEILE = /^([^:»«]{1,40}):(?:\s|$)/
const KOPFZEILE = /^(?:(.{0,40}?):\s*)?»([^»«]{2,120})«(.*)$/

/** Die Zeilen des Artikels wie die Regel sie liest (getrimmt, ohne Leerzeilen). */
const artikelZeilen = (text: string): string[] => text.split('\n').map((z) => z.trim()).filter(Boolean)

/** Zeilen hinter dem Zitat bis zum nächsten Kopf, höchstens neun Zeilen unter dem Kopf des Blocks. */
function fensterHinterZitat(zeilen: string[], zitat: string[]): string[] {
  const i = zeilen.findIndex((_, j) => zitat.every((z, k) => zeilen[j + k] === z))
  if (i < 0) return []
  const aus: string[] = []
  for (let j = i + zitat.length; j < zeilen.length && !KOPFZEILE.test(zeilen[j]!) && j - i <= 9; j++) aus.push(zeilen[j]!)
  return aus
}

export function feldOhneRegel(text: string, behauptungen: Behauptung[]): string | undefined {
  const zeilen = artikelZeilen(text)
  for (const b of behauptungen) {
    const zitat = b.zitat.split('\n')
    for (const zeile of zitat.slice(1)) {
      const name = NAME_ZEILE.exec(zeile)?.[1]
      if (name === undefined || !FELD_MIT_REGEL.includes(name)) return name ?? zeile.slice(0, 40)
    }
    for (const zeile of fensterHinterZitat(zeilen, zitat)) {
      const name = NAME_ZEILE.exec(zeile)?.[1]
      if (name !== undefined && !FENSTER_ERLAUBT.includes(name)) return name
    }
  }
  return undefined
}

const MONAT = `(?:${MONATE.join('|')})`
const DATUM = new RegExp(`\\b\\d{1,2}\\.\\s*${MONAT}\\b|\\b(?:Anfang|Mitte|Ende)\\s+${MONAT}\\b|\\b\\d{1,2}\\.\\d{1,2}\\.|\\b\\d{4}-\\d{2}-\\d{2}\\b`, 'i')
const UHRZEIT = /\b\d{1,2}[:.]\d{2}\s*Uhr\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*Uhr\b/i

/** Der Text ohne die Stellen, deren Datum die Regel liest: Überschrift, Veröffentlicht-Zeile, Autorenzeile und je Block das Tagesdatum vor dem »Titel«. Alles andere (auch `Sprache:`, `Stream:`, Simulcast) bleibt; unabhängig von jeder Anführung. */
export function ausserhalbDerRegel(text: string, behauptungen: Behauptung[]): string {
  // Wie die Regel: Zeilen getrimmt, Leerzeilen weg (ein Zitat besteht aus solchen Zeilen).
  const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean)
  const [jahr, monat, tag] = (/^Veröffentlicht:\s*(\d{4}-\d{2}-\d{2})/.exec(zeilen[1] ?? '')?.[1] ?? '').split('-').map(Number)
  let rest = zeilen.slice(2)
  // Die Zeitangabe der Autorenzeile („24. Oktober 2026 um 17:54 Uhr“, Tag = Veröffentlicht) ist Vorspann, keine Aussage; nur die erste Zeile genau dieser Form.
  const autorZeile = new RegExp(`^${tag}\\. ${MONATE[(monat ?? 1) - 1]} ${jahr} um \\d{1,2}:\\d{2} Uhr$`)
  const autor = jahr ? rest.findIndex((z) => autorZeile.test(z)) : -1
  if (autor >= 0) rest = rest.filter((_, i) => i !== autor)
  for (const b of behauptungen) {
    const zitat = b.zitat.split('\n')
    const i = rest.findIndex((_, j) => zitat.every((z, k) => rest[j + k] === z))
    if (i < 0) continue
    rest[i] = zitat[0]!.slice(zitat[0]!.indexOf('»'))
  }
  return rest.join('\n')
}

/** A2: Datum oder Uhrzeit außerhalb der von der Regel gelesenen Stellen (erste Fundstelle) – dort steht eine Aussage, die die Regel verliert. */
export function datumAusserhalb(text: string, behauptungen: Behauptung[]): string | undefined {
  const rest = ausserhalbDerRegel(text, behauptungen)
  return DATUM.exec(rest)?.[0] ?? UHRZEIT.exec(rest)?.[0]
}

export interface Entscheidung {
  id: string
  /** `regel`: vollständig erklärt; `claude`: bleibt bei Claude. */
  weg: 'regel' | 'claude'
  /** Bei `claude` der erste Grund, sonst fehlt er. */
  grund?: string
  /** Bei `regel`: die Rohvorschläge, die als Antwortdatei geschrieben werden. */
  vorschlaege?: Record<string, unknown>[]
}

export interface RouterArtikel {
  id: string
  /** Inhalt von `artikel/<id>.txt`: Titel, `Veröffentlicht: <Tag>`, Leerzeile, Text. */
  text: string
  rubriken: string[]
}

/** Der erste Grund, warum die Regel den Artikel nicht allein trägt; `vorschlaege` sonst. */
export function pruefeArtikel(a: RouterArtikel): { grund: string } | { vorschlaege: Record<string, unknown>[] } {
  if (!a.rubriken.length) return { grund: 'keine Rubrik' }
  const fremd = a.rubriken.find((r) => !ERLAUBTE_RUBRIKEN.includes(r))
  if (fremd !== undefined) return { grund: `Rubrik ${fremd}` }
  const behauptungen = leseBehauptungen(a.text)
  if (!behauptungen.length) return { grund: 'keine Behauptung' }
  if (behauptungen.some((b) => b.familie !== 'block')) return { grund: 'Satz-Behauptung' }
  const ohne = [...a.text.matchAll(/»([^»«]{2,100})«/g)].map((m) => m[1]!).find((t) => !gedeckt(t, behauptungen))
  if (ohne) return { grund: `Titel ohne Behauptung: ${ohne}` }
  const feld = feldOhneRegel(a.text, behauptungen)
  if (feld) return { grund: `Feld ohne Regel: ${feld}` }
  const datum = datumAusserhalb(a.text, behauptungen)
  if (datum) return { grund: `Datum oder Uhrzeit außerhalb der Regel: ${datum}` }
  // Ohne Artikeltitel geprüft: der Block-Titel steht im Zitat, und was so besteht, besteht auch in `--uebernehmen` (dort kommt der Artikeltitel nur dazu).
  const veroeffentlicht = /^Veröffentlicht:\s*(\d{4}-\d{2}-\d{2})/.exec(a.text.split('\n')[1] ?? '')?.[1] ?? ''
  const bezug = { text: a.text, veroeffentlicht }
  const vorschlaege = behauptungen.map(alsVorschlag)
  for (const v of vorschlaege) {
    const r = pruefeVorschlag(v, bezug)
    if ('grund' in r) return { grund: `Prüfung: ${r.grund}` }
  }
  return { vorschlaege }
}

export function entscheide(a: RouterArtikel): Entscheidung {
  const r = pruefeArtikel(a)
  return 'grund' in r ? { id: a.id, weg: 'claude', grund: r.grund } : { id: a.id, weg: 'regel', vorschlaege: r.vorschlaege }
}

/** Jeder `STICHPROBE_ALLE`-te nach Kennung; eine Kennung ohne Zahl geht immer an Claude. */
export function istStichprobe(id: string): boolean {
  const n = Number(id)
  return !Number.isInteger(n) || n % STICHPROBE_ALLE === 0
}

export interface Plan {
  entscheidungen: Entscheidung[]
  /** Erklärt und nicht in der Stichprobe: Claude würde sie nicht mehr lesen. */
  erspart: string[]
  /** Erklärt, aber Stichprobe: Claude liest sie weiter. */
  stichprobe: string[]
  /** Bleibt bei Claude. */
  rest: string[]
}

/** Eine Zeile je Lauf für Protokoll und Schattendatei. `scharf`: ob der Plan angewendet wurde (sonst nur, was er Claude ersparen würde). */
export interface RouterZeile {
  scharf: boolean
  artikel: number
  erspart: number
  stichprobe: number
  rest: number
}

export const zeileVon = (p: Plan, scharf: boolean): RouterZeile => ({
  scharf,
  artikel: p.entscheidungen.length,
  erspart: p.erspart.length,
  stichprobe: p.stichprobe.length,
  rest: p.rest.length,
})

export function plane(artikel: RouterArtikel[]): Plan {
  const entscheidungen = artikel.map(entscheide)
  const regel = entscheidungen.filter((e) => e.weg === 'regel').map((e) => e.id)
  return {
    entscheidungen,
    erspart: regel.filter((id) => !istStichprobe(id)),
    stichprobe: regel.filter(istStichprobe),
    rest: entscheidungen.filter((e) => e.weg === 'claude').map((e) => e.id),
  }
}
