/**
 * Welche Anker einer Adresse zur Verfügung stehen — und die Geschwister-Probe.
 *
 * Herkunft: `daniel-zum-abarbeiten/berichte/d1-rest-ursachen-2026-10-16.md`. Rohfolgen, die der
 * Zuordner nicht zuordnet, werden nie abgehakt und bei jedem Lauf neu aus D1 gelesen (Kontingent).
 * Zwei Lücken waren schuld: TMDB wurde nie befragt, sobald aniSearch irgendwelche Folgen führt,
 * und die Meldung wurde nur gegen den einen gemeldeten Titel geprüft, nicht gegen seine Staffeln.
 */
import {
  ausAnisearch,
  englischeSchreibweisen,
  findeStaffel,
  ordneZu,
  type AnbieterFolge,
  type AsFolgeRoh,
  type TmdbFolge,
  type Zuordnung,
} from './folgen-zuordnung.ts'

/** Eine Folgenliste, gegen die verglichen wird, samt Herkunft fürs Protokoll. */
export interface AnkerListe {
  quelle: 'aniSearch' | 'TMDB'
  folgen: TmdbFolge[]
}

/** Was von einem Titel für die Ankersuche gebraucht wird. */
export interface AnkerTitel {
  id: number
  episodes?: number | null
  jpYear?: number | null
  franchiseId?: number | null
}

export interface AnkerErgebnis {
  listen: AnkerListe[]
  /** Nur gesetzt, wenn `listen` leer ist: warum. */
  grund: string
}

/**
 * „Folge 3“, „Episode 3“, „Ep. 3“, „E3“, „#3“: Zählung statt Titel. Als Anker träfe „Folge 3“ jede
 * dritte Folge jeder Staffel — die Probe wählte so Staffel 1 für eine Staffel-3-Seite. Gemessen
 * 16.10.2026: 9.930 von 35.439 TMDB-Folgen (125 von 875 Titeln überwiegend), 136 aniSearch-Folgen.
 */
const PLATZHALTER = /^\s*(?:folge|episode|ep\.?|e|#)\s*\d+\s*$/i

function ohnePlatzhalter(folgen: TmdbFolge[]): TmdbFolge[] {
  return folgen.map((f) => (f.titel && PLATZHALTER.test(f.titel) ? { ...f, titel: null } : f))
}

/**
 * Alle Anker eines Titels in der Reihenfolge, in der sie befragt werden: aniSearch (wie unser
 * Bestand aufgeteilt, deutsch), danach die TMDB-Staffel mit unserer Folgenzahl.
 */
export function sammleAnker(
  anisearch: AsFolgeRoh[] | undefined,
  tmdb: { folgen: TmdbFolge[] } | undefined,
  titel: AnkerTitel,
): AnkerErgebnis {
  const listen: AnkerListe[] = []
  if (anisearch?.length) {
    const folgen = [...ausAnisearch(anisearch), ...englischeSchreibweisen(anisearch)]
    listen.push({ quelle: 'aniSearch', folgen: ohnePlatzhalter(folgen) })
  }
  if (!tmdb) {
    return { listen, grund: 'keine Folgentitel vorhanden (weder aniSearch noch TMDB)' }
  }
  const staffel = findeStaffel(tmdb.folgen, titel.episodes ?? null, titel.jpYear ?? null)
  if (staffel === null) {
    return { listen, grund: `keine TMDB-Staffel mit ${titel.episodes ?? '?'} Folgen eindeutig` }
  }
  listen.push({ quelle: 'TMDB', folgen: ohnePlatzhalter(tmdb.folgen.filter((f) => f.s === staffel)) })
  return { listen, grund: '' }
}

/**
 * Die TMDB-Folgen für einen Titel: seine eigenen, sonst die des Reihenkopfs (`franchiseId`), wenn dort genau eine
 * Staffel zu Folgenzahl und Startjahr passt (höchstens ein Jahr Abstand). TMDB führt eine Reihe unter einer Serie;
 * Staffeln wie "Dorohedoro Staffel 2" haben keinen eigenen Eintrag. Gemessen 16.10.2026: 164 von 2.921 Titeln
 * gewinnen so einen Anker; ohne die Jahresprobe käme "Full Metal Panic? Fumoffu" (2003) in die Staffel von 2018.
 */
export function tmdbFuerTitel(
  titel: AnkerTitel,
  tmdbAlle: Record<string, { folgen: TmdbFolge[] }>,
): { folgen: TmdbFolge[] } | undefined {
  const eigene = tmdbAlle[String(titel.id)]
  if (eigene || !titel.franchiseId) return eigene
  const kopf = tmdbAlle[String(titel.franchiseId)]
  if (!kopf || !titel.jpYear) return undefined
  const staffel = findeStaffel(kopf.folgen, titel.episodes ?? null, titel.jpYear)
  if (staffel === null) return undefined
  const erstes = kopf.folgen.filter((f) => f.s === staffel && f.datum).map((f) => f.datum!).sort()[0]
  const abstand = erstes ? Math.abs(Number(erstes.slice(0, 4)) - titel.jpYear) : Infinity
  return abstand <= 1 ? kopf : undefined
}

export interface AnkerPaare {
  paare: Zuordnung[]
  quelle: string
}

/**
 * Der Anker mit den meisten verschiedenen Treffern gewinnt, bei Gleichstand der frühere. Trifft
 * keiner, gilt der erste (sein Name steht im Protokoll). Die Listen werden nicht vermischt:
 * Gleiche Daten in beiden wären sonst mehrdeutig, und `ordneZu` schwiege. Der erste mit einem
 * Treffer genügte nicht: Dorohedoro Staffel 2 trifft in aniSearch 1 von 11, in TMDB 8 (16.10.2026).
 */
export function ordneUeberAnker(anbieter: AnbieterFolge[], listen: AnkerListe[]): AnkerPaare {
  const eindeutig = ohneGeteiltesDatum(anbieter)
  let beste: (AnkerPaare & { n: number }) | null = null
  for (const l of listen) {
    const paare = ordneZu(eindeutig, l.folgen)
    const n = verschiedeneZiele(paare)
    if (!beste || n > beste.n) beste = { paare, quelle: l.quelle, n }
  }
  return beste ? { paare: beste.paare, quelle: beste.quelle } : { paare: ordneZu(anbieter, []), quelle: '' }
}

/**
 * Ein Datum, das mehrere Anbieter-Folgen tragen, belegt keine davon: Prime setzt bei Kauftiteln
 * allen Folgen dasselbe Datum („My First Girlfriend Is a Gal“, 11× 12.07.2017), und über den
 * Anker landeten alle elf auf unserer Folge 1. Der Titel bleibt als Weg.
 */
function ohneGeteiltesDatum(anbieter: AnbieterFolge[]): AnbieterFolge[] {
  const wieOft = new Map<string, number>()
  for (const a of anbieter) if (a.datum) wieOft.set(a.datum, (wieOft.get(a.datum) ?? 0) + 1)
  return anbieter.map((a) => (a.datum && wieOft.get(a.datum)! > 1 ? { ...a, datum: null } : a))
}

/** Verschiedene unserer Folgen, die getroffen wurden — zwölf Zeilen auf Folge 1 sind ein Treffer. */
function verschiedeneZiele(paare: Zuordnung[]): number {
  return new Set(paare.map((p) => p.unsere).filter((u) => u !== null)).size
}

export interface GeschwisterTreffer<T extends AnkerTitel> extends AnkerPaare {
  titel: T
  treffer: number
}

/**
 * Dieselbe Schwelle wie bei der Folgentitel-Stufe: mindestens drei und mehr als die Hälfte —
 * gezählt werden verschiedene unserer Folgen, nicht Zeilen.
 */
export const MIN_GESCHWISTER_TREFFER = 3

/**
 * **Geschwister-Probe.** Passt keine Folge zum gemeldeten Titel, gelten die anderen Staffeln
 * derselben Reihe (`franchiseId`) als Kandidaten. Der beste Treffer gewinnt, nicht der erste; bei
 * Gleichstand an der Spitze bleibt es offen (wie `bewerteTreffer`: geraten wird nicht).
 *
 * `ausgenommen` schließt Kandidaten aus, die nicht gemeint sein können (Reihenkopf bei
 * gemeldeter Staffel ab 2).
 */
export function probeGeschwister<T extends AnkerTitel>(
  anbieter: AnbieterFolge[],
  gemeldet: T,
  alle: T[],
  listenFuer: (t: T) => AnkerListe[],
  ausgenommen: (t: T) => boolean,
): GeschwisterTreffer<T> | null {
  if (!gemeldet.franchiseId) return null
  const treffer: GeschwisterTreffer<T>[] = []
  for (const t of alle) {
    if (t.id === gemeldet.id || t.franchiseId !== gemeldet.franchiseId || ausgenommen(t)) continue
    const { paare, quelle } = ordneUeberAnker(anbieter, listenFuer(t))
    const n = verschiedeneZiele(paare)
    if (n >= MIN_GESCHWISTER_TREFFER && n > anbieter.length / 2) treffer.push({ titel: t, paare, quelle, treffer: n })
  }
  treffer.sort((a, b) => b.treffer - a.treffer)
  if (!treffer.length) return null
  if (treffer.length > 1 && treffer[0]!.treffer === treffer[1]!.treffer) return null
  return treffer[0]!
}

export type Entscheid<T> =
  | { art: 'folgen'; ziel: T; paare: Zuordnung[]; quelle: string }
  | { art: 'titel' }
  | { art: 'offen'; grund: string }

/**
 * **Reihenfolge der Belege einer Adresse.** Erst die Folgen des gemeldeten Titels; trifft keine,
 * der Beleg ohne Folgennummer, wenn er trägt (Kennung, Adresse oder genauer Name, einheitliche
 * Tonspuren); erst danach die Geschwister-Probe. Die Probe füllt nur, was sonst offen bliebe —
 * sie überstimmt keinen Beleg, den der Lauf ohne sie abgelegt hätte. Ohne eigenen Anker darf sie
 * trotzdem ran (16.10.2026: 176 von 2.921 Titeln haben keinen, aber ein Geschwister mit Anker).
 */
export function entscheideZuordnung<T extends AnkerTitel>(
  anbieter: AnbieterFolge[],
  gemeldet: T,
  ak: AnkerErgebnis,
  titelBelegTraegt: boolean,
  probe: () => GeschwisterTreffer<T> | null,
): Entscheid<T> {
  const eigen = ordneUeberAnker(anbieter, ak.listen)
  if (eigen.paare.some((p) => p.unsere !== null)) return { art: 'folgen', ziel: gemeldet, ...eigen }
  if (ak.listen.length && titelBelegTraegt) return { art: 'titel' }
  const p = probe()
  if (p) return { art: 'folgen', ziel: p.titel, paare: p.paare, quelle: p.quelle }
  if (!ak.listen.length) return { art: 'offen', grund: ak.grund }
  return { art: 'offen', grund: `keine einzige Folge zuzuordnen (Anker: ${eigen.quelle})` }
}
