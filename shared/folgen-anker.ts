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
    listen.push({ quelle: 'aniSearch', folgen: [...ausAnisearch(anisearch), ...englischeSchreibweisen(anisearch)] })
  }
  if (!tmdb) {
    return { listen, grund: 'keine Folgentitel vorhanden (weder aniSearch noch TMDB)' }
  }
  const staffel = findeStaffel(tmdb.folgen, titel.episodes ?? null, titel.jpYear ?? null)
  if (staffel === null) {
    return { listen, grund: `keine TMDB-Staffel mit ${titel.episodes ?? '?'} Folgen eindeutig` }
  }
  listen.push({ quelle: 'TMDB', folgen: tmdb.folgen.filter((f) => f.s === staffel) })
  return { listen, grund: '' }
}

export interface AnkerPaare {
  paare: Zuordnung[]
  quelle: string
}

/**
 * Der erste Anker mit mindestens einem Treffer gewinnt. Trifft keiner, gilt der erste (sein
 * Name steht im Protokoll). Die Listen werden nicht vermischt: Gleiche Daten in beiden
 * wären sonst mehrdeutig, und `ordneZu` schwiege.
 */
export function ordneUeberAnker(anbieter: AnbieterFolge[], listen: AnkerListe[]): AnkerPaare {
  let erste: AnkerPaare | null = null
  for (const l of listen) {
    const paare = ordneZu(anbieter, l.folgen)
    if (paare.some((p) => p.unsere !== null)) return { paare, quelle: l.quelle }
    erste ??= { paare, quelle: l.quelle }
  }
  return erste ?? { paare: ordneZu(anbieter, []), quelle: '' }
}

export interface GeschwisterTreffer<T extends AnkerTitel> extends AnkerPaare {
  titel: T
  treffer: number
}

/** Dieselbe Schwelle wie bei der Folgentitel-Stufe: mindestens drei und mehr als die Hälfte. */
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
    const n = paare.filter((p) => p.unsere !== null).length
    if (n >= MIN_GESCHWISTER_TREFFER && n > anbieter.length / 2) treffer.push({ titel: t, paare, quelle, treffer: n })
  }
  treffer.sort((a, b) => b.treffer - a.treffer)
  if (!treffer.length) return null
  if (treffer.length > 1 && treffer[0]!.treffer === treffer[1]!.treffer) return null
  return treffer[0]!
}
