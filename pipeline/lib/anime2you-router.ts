/**
 * Artikel-Router der Anime2You-Auswertung (PR C des Vorrats „ohne Claude“): entscheidet je Artikel, ob die Regel (`anime2you-regel.ts`) ihn vollständig
 * erklärt und Claude ihn nicht mehr lesen muss. Reine Entscheidung, kein Schreiben, kein Abruf.
 *
 * „Vollständig erklärt“ heißt, dass jede Bedingung hält – im Zweifel liest Claude weiter:
 * 1. Die Rubrik (JSON-LD `articleSection`) fehlt nicht und jede steht in `ERLAUBTE_RUBRIKEN` (Streaming-Rubriken; Merchandise, Promo-Video, Japan … sind nie vollständig).
 * 2. Die Regel liefert mindestens eine Behauptung und alle sind Blöcke (»Titel« / Sprache: / Stream:). Sätze bleiben bei Claude: die Satzfamilie ist
 *    mit 15 von 71 Behauptungen zu dünn gemessen (Bericht 07.11.2026, „Offen und Grenzen“).
 * 3. Jeder »Titel« im Artikel hat eine Behauptung (Titel gleich oder einer im anderen enthalten): ein Titel ohne Behauptung ist Inhalt, den die Regel nicht liest.
 * 4. Jede Behauptung besteht dieselbe Prüfung am Artikeltext wie ein Vorschlag von Claude (`pruefeVorschlag`) – sonst wäre `--uebernehmen` der Verwerfer.
 *
 * Von den erklärten Artikeln liest Claude weiter jeden fünften (`istStichprobe`, nach Artikelkennung, damit die Auswahl nicht vom Lauf abhängt),
 * damit die Abweichung Regel gegen Claude weiter gemessen wird (Schattenschritt).
 */
import { decodeEntities } from './feed.ts'
import { leseBehauptungen, type Behauptung } from './anime2you-regel.ts'
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
  const zeilen = a.text.split('\n')
  const bezug = { text: a.text, titel: zeilen[0] ?? '', veroeffentlicht: /^Veröffentlicht:\s*(\d{4}-\d{2}-\d{2})/.exec(zeilen[1] ?? '')?.[1] ?? '' }
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
