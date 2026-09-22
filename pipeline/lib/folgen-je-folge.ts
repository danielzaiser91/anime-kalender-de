/**
 * **Stufe 2: Zuordnung je Plattform-Folge** (22.09.2026, `docs/konzept-meldungen-architektur.md`).
 *
 * Schlüssel ist `plattform:kennung` — Prime die Folgen-ASIN, Netflix und Disney+ die gti. Nicht die
 * gemeldete Adresse: Yamada-kun kam über zwei Adressen, dieselben zwölf Folgen standen damit
 * zweimal da.
 *
 * **Kandidaten** sind alle `titel_id`, unter denen die Folge gemeldet wurde, die Titel mit einem Weg
 * zur gemeldeten Adresse und die Titel, denen die Adresse früher zugeordnet war. `titel_id` ist
 * dabei nur ein Kandidat, keine Antwort: Sie beschreibt den Auftrag, und ein Suchauftrag kann auf
 * die Seite einer anderen Staffel führen (Gegenprobe 22.09.2026: 173 Folgen, alle an
 * Staffelgrenzen, in der Stichprobe lag jedes Mal der Anker richtig).
 *
 * **Anker** je Kandidat: aniSearch-Folgentitel, sonst die TMDB-Staffel mit passender Folgenzahl —
 * dieselben Regeln wie `fetch-rohfolgen.ts` (`ordneZu`: Datum, dann Titel, nie die Position).
 *
 * Ergebnis je Folge: `titel` + `folge` (genau ein Kandidat trifft), nur `titel` (einziger
 * Kandidat, kein Anker trifft), sonst offen mit den Kandidaten. Geraten wird nicht.
 */
import { adressKern } from './dub-confirmed.ts'
import {
  ausAnisearch,
  englischeSchreibweisen,
  findeStaffel,
  ordneZu,
  type AsFolgeRoh,
  type TmdbFolge,
} from '../../shared/folgen-zuordnung.ts'
import type { Title } from '../../shared/types.ts'

/** Eine Beobachtung aus `prime_folge`, wie `?rohfolgen=1&alle=1` sie liefert. */
export interface Beobachtung {
  id: number
  plattform: string
  url: string
  asin: string | null
  gti: string | null
  nummer: number | null
  titel: string | null
  erschienen: string | null
  titel_id: number | null
  gemeldet_am: string
}

export interface FolgenZuordnung {
  /** Unser Titel — fehlt, wenn offen. */
  titel?: number
  /** Unsere Folgennummer in diesem Titel — fehlt, wenn nur der Titel feststeht. */
  folge?: number
  /** Woran es festgemacht wurde. */
  grund: 'datum' | 'titel' | 'einziger-kandidat' | 'offen' | 'ohne-kandidat' | 'strittig'
  /** Bei offen und strittig: die Kandidaten, damit die Nachprüfung weiß, wo sie suchen muss. */
  kandidaten?: number[]
  /** Jüngste Beobachtung dieser Folge. */
  gesehen: string
}

export interface Kontext {
  titel: Map<number, Title>
  tmdb: Record<string, { folgen: TmdbFolge[] }>
  asFolgen: Record<string, { folgen: AsFolgeRoh[] }>
  asKennung: Record<string, { anisearchId?: number }>
  /** Adresskern → Titel, aus Wegen des Bestands und früheren Zuordnungen. */
  jeAdresse: Map<string, Set<number>>
}

/**
 * Eine Suchadresse („amazon.de/s?k=…") ist kein Anker — ohne Abfrageteil fallen alle auf
 * „amazon.de/s", und der PoC sammelte darunter rund 90 Titel als Kandidaten jeder Folge.
 */
export function ankerAdresse(u: string | null | undefined): string {
  const k = adressKern(u ?? undefined)
  return /\/s$|\/search$|^[^/:]*$/.test(k) ? '' : k
}

export function adressIndex(
  titel: Map<number, Title>,
  frueher: Iterable<[url: string, titelId: number]>,
): Map<string, Set<number>> {
  const jeAdresse = new Map<string, Set<number>>()
  const dazu = (u: string | undefined, id: number) => {
    const k = ankerAdresse(u)
    if (!k) return
    if (!jeAdresse.has(k)) jeAdresse.set(k, new Set())
    jeAdresse.get(k)!.add(id)
  }
  for (const t of titel.values()) {
    for (const w of [...(t.streams ?? []), ...(t.watchLinks ?? [])] as { url?: string; seite?: string }[]) {
      dazu(w.url, t.id)
      dazu(w.seite, t.id)
    }
  }
  for (const [url, id] of frueher) if (titel.has(id)) dazu(url, id)
  return jeAdresse
}

export function ordneFolgenZu(
  beobachtungen: Beobachtung[],
  k: Kontext,
  bisher: Record<string, FolgenZuordnung> = {},
): Record<string, FolgenZuordnung> {
  const ankerCache = new Map<number, TmdbFolge[] | null>()
  const anker = (id: number): TmdbFolge[] | null => {
    if (ankerCache.has(id)) return ankerCache.get(id)!
    const t = k.titel.get(id)
    let a: TmdbFolge[] | null = null
    const asId = k.asKennung[String(id)]?.anisearchId
    const as = asId ? k.asFolgen[String(asId)] : undefined
    if (as?.folgen?.length) a = [...ausAnisearch(as.folgen), ...englischeSchreibweisen(as.folgen)]
    else if (t && k.tmdb[String(id)]) {
      const s = findeStaffel(k.tmdb[String(id)]!.folgen, t.episodes ?? null, t.jpYear ?? null)
      if (s !== null) a = k.tmdb[String(id)]!.folgen.filter((f) => f.s === s)
    }
    ankerCache.set(id, a)
    return a
  }

  const jeFolge = new Map<string, Beobachtung[]>()
  for (const b of beobachtungen) {
    const kennung = b.asin ?? b.gti
    if (!kennung) continue
    const s = `${b.plattform}:${kennung}`
    jeFolge.set(s, [...(jeFolge.get(s) ?? []), b])
  }

  const aus: Record<string, FolgenZuordnung> = {}
  for (const [schluessel, liste] of jeFolge) {
    const jung = liste.reduce((a, b) => (b.gemeldet_am > a.gemeldet_am ? b : a))
    const kandidaten = new Set<number>()
    for (const b of liste) {
      if (b.titel_id != null && k.titel.has(b.titel_id)) kandidaten.add(b.titel_id)
      for (const id of k.jeAdresse.get(ankerAdresse(b.url)) ?? []) kandidaten.add(id)
    }
    const treffer: { id: number; folge: number; grund: 'datum' | 'titel' }[] = []
    for (const id of kandidaten) {
      const a = anker(id)
      if (!a) continue
      const [p] = ordneZu([{ nummer: jung.nummer, titel: jung.titel, datum: jung.erschienen?.slice(0, 10) ?? null, minuten: null }], a)
      if (p?.unsere != null && (p.grund === 'datum' || p.grund === 'titel')) treffer.push({ id, folge: p.unsere, grund: p.grund })
    }
    let z: FolgenZuordnung
    if (treffer.length === 1) z = { titel: treffer[0]!.id, folge: treffer[0]!.folge, grund: treffer[0]!.grund, gesehen: jung.gemeldet_am }
    else if (treffer.length > 1) z = { grund: 'strittig', kandidaten: treffer.map((t) => t.id), gesehen: jung.gemeldet_am }
    else if (kandidaten.size === 1) z = { titel: [...kandidaten][0]!, grund: 'einziger-kandidat', gesehen: jung.gemeldet_am }
    else if (kandidaten.size) z = { grund: 'offen', kandidaten: [...kandidaten], gesehen: jung.gemeldet_am }
    else z = { grund: 'ohne-kandidat', gesehen: jung.gemeldet_am }
    /*
      **Eine Zuordnung wird festgehalten** (erster Schnitt, 22.09.2026): Wege ändern sich, und eine
      Beobachtung, deren Adresse nicht mehr im Bestand steht, verlöre sonst ihren Titel. Fällt der
      neue Lauf hinter die frühere Zuordnung zurück (kein Titel mehr), bleibt die frühere stehen.
    */
    const alt = bisher[schluessel]
    if (!z.titel && alt?.titel) z = { ...alt, gesehen: jung.gemeldet_am }
    aus[schluessel] = z
  }
  /* Was diesmal nicht vorkam (Zeile gelöscht), bleibt stehen — ein Lauf löscht keine Zuordnung. */
  for (const [s, z] of Object.entries(bisher)) if (!aus[s]) aus[s] = z
  return aus
}
