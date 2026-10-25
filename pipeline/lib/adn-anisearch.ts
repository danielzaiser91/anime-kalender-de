/**
 * **Welche aniSearch-Kennung eine ADN-Serie trägt** (13.10.2026, statt der AniList-Suche `searchMedia`).
 *
 * Suchraum ist aniSearchs Titelliste (`GET /v1/anime/titles`, im Cache), nicht eine Suche. Reine Logik ohne Abruf:
 * `adn-zuordnung-lauf.ts` liefert die Eingaben und schreibt die Ergebnisse.
 *
 * Ein falsch zugeordneter Titel bringt Cover und Beschreibung eines fremden Werks mit, ein fehlender nichts Falsches. Deshalb gilt nur,
 * was eindeutig ist: Der Kandidat trägt denselben normalisierten Namen wie die ADN-Serie, oder er teilt ihre Wörter (`passtZuSerie`) mit
 * mindestens `MINDESTPUNKTE` (`bewerteTreffer`). Der beste Kandidat gewinnt, nicht der erste; steht ein zweiter mit gleichem Rang
 * (gleicher Name, gleiche Punkte) daneben, bleibt die Serie offen — die Liste nennt beide.
 */
import { bewerteTreffer, passtZuSerie, type AdnName } from './adn.ts'
import { normalisiere, vorauswahl, type AsTitel, type Index } from './anisearch-katalog-abgleich.ts'

/**
 * Untergrenze für einen Kandidaten ohne gleichen Namen. Gemessen am 13.10.2026 an den 109 Serien des Katalogs: die richtigen Treffer
 * ohne Namensgleichheit („Norowareta Seiken“ gegen „One Piece Movie 5 : Norowareta Seiken“) liegen bei 7 und 8, die Zufallstreffer
 * (Garfield → Aikatsu-Show, Lucky Luke → „Lucky“, Martin Matin → „Bai Bian Martin“) bei höchstens 3.
 */
export const MINDESTPUNKTE = 5

/** Wie alt die Titelliste höchstens sein darf, bevor ein Lauf mit Token sie neu holt; ältere Namen findet eine neue ADN-Serie nicht. */
export const TITELLISTE_MAX_TAGE = 7

/** Ist eine Titelliste vom Zeitpunkt `geholtAm` am Zeitpunkt `jetzt` noch brauchbar? */
export function titellisteFrisch(geholtAm: string | undefined, jetzt: number): boolean {
  return Boolean(geholtAm) && jetzt - Date.parse(geholtAm!) <= TITELLISTE_MAX_TAGE * 24 * 3600 * 1000
}

export interface AdnKandidat {
  asId: number
  name: string
  jahr?: number
  punkte: number
  /** Ein Name der ADN-Serie stimmt nach Normalisierung mit einer aniSearch-Schreibweise überein. */
  gleich: boolean
}

export type OffenGrund = 'kein-kandidat' | 'mehrdeutig' | 'vergeben' | 'titelliste-fehlt'

export interface AdnOffen {
  showId: number
  title: string
  originalTitle?: string
  grund: OffenGrund
  /** Die besten Kandidaten, die nach Namen in Frage kamen. */
  kandidaten: AdnKandidat[]
}

export type AdnSerie = AdnName & { showId: number }

const alsMedia = (name: string) => ({ title: { romaji: name, english: null, native: null } })

/** Alle zulässigen Kandidaten einer Serie, bester zuerst (gleicher Name vor Punkten). */
export function kandidatenZurSerie(show: AdnName, titel: Map<number, AsTitel>, index: Index): AdnKandidat[] {
  const namen = [show.originalTitle, show.title].filter((n): n is string => Boolean(n))
  const unsere = new Set(namen.map(normalisiere).filter(Boolean))
  const raus: AdnKandidat[] = []
  for (const asId of vorauswahl(namen, index)) {
    const t = titel.get(asId)
    if (!t) continue
    const gleich = t.namen.some((n) => unsere.has(normalisiere(n)))
    const passt = t.namen.some((n) => passtZuSerie(show, alsMedia(n)))
    const punkte = Math.max(0, ...t.namen.map((n) => bewerteTreffer(show, alsMedia(n))))
    if (gleich || (passt && punkte >= MINDESTPUNKTE)) raus.push({ asId, name: t.namen[0] ?? '', jahr: t.jahr, punkte, gleich })
  }
  return raus.sort((a, b) => Number(b.gleich) - Number(a.gleich) || b.punkte - a.punkte || a.asId - b.asId)
}

const gleichRang = (a: AdnKandidat, b: AdnKandidat): boolean => a.gleich === b.gleich && a.punkte === b.punkte
const staerker = (a: AdnKandidat, b: AdnKandidat): boolean => a.gleich !== b.gleich ? a.gleich : a.punkte > b.punkte

interface Anwaerter {
  show: AdnSerie
  frei: AdnKandidat[]
}

/** Das stärkste noch offene Paar (Serie, nächster freier Kandidat); bei Gleichstand die kleinere Serienkennung, damit der Lauf wiederholbar bleibt. */
function staerkstes(offen: Map<number, AdnKandidat[]>, shows: Map<number, AdnSerie>, vergeben: Map<number, number>): Anwaerter | undefined {
  let beste: Anwaerter | undefined
  for (const [showId, liste] of offen) {
    const frei = liste.filter((k) => !vergeben.has(k.asId))
    if (!frei.length) continue
    const jetzt = { show: shows.get(showId)!, frei }
    if (!beste || staerker(frei[0]!, beste.frei[0]!) || (gleichRang(frei[0]!, beste.frei[0]!) && showId < beste.show.showId)) beste = jetzt
  }
  return beste
}

export interface AdnZuordnung {
  /** Serienkennung → aniSearch-Kennung, nur eindeutige. */
  zuordnung: Map<number, number>
  offen: AdnOffen[]
}

/**
 * Ordnet jede Serie höchstens einem aniSearch-Eintrag zu, und jeden Eintrag höchstens einer Serie (ADN führt „To Love-Ru“ unter zwei Kennungen).
 * Vergabe gierig wie zuvor bei AniList: das stärkste Paar zuerst, wer leer ausgeht, nimmt seinen nächsten Kandidaten.
 */
export function ordneAdnZuAnisearch(serien: AdnSerie[], titel: Map<number, AsTitel>, index: Index): AdnZuordnung {
  const shows = new Map(serien.map((s) => [s.showId, s]))
  const alle = new Map(serien.map((s) => [s.showId, kandidatenZurSerie(s, titel, index)]))
  const offen = new Map([...alle].filter(([, k]) => k.length))
  const vergeben = new Map<number, number>()
  const zuordnung = new Map<number, number>()
  const mehrdeutig = new Set<number>()
  for (let a = staerkstes(offen, shows, vergeben); a; a = staerkstes(offen, shows, vergeben)) {
    offen.delete(a.show.showId)
    if (a.frei[1] && gleichRang(a.frei[0]!, a.frei[1])) {
      mehrdeutig.add(a.show.showId)
      continue
    }
    vergeben.set(a.frei[0]!.asId, a.show.showId)
    zuordnung.set(a.show.showId, a.frei[0]!.asId)
  }
  const grund = (id: number): OffenGrund => (!alle.get(id)!.length ? 'kein-kandidat' : mehrdeutig.has(id) ? 'mehrdeutig' : 'vergeben')
  const rest = serien.filter((s) => !zuordnung.has(s.showId)).sort((a, b) => a.showId - b.showId)
  return {
    zuordnung,
    offen: rest.map((s) => ({ showId: s.showId, title: s.title, originalTitle: s.originalTitle, grund: grund(s.showId), kandidaten: alle.get(s.showId)!.slice(0, 3) })),
  }
}

/**
 * Serien des Kalenders (`data/adn.json`), die weder im Katalog noch in der Liste der offenen stehen. Der Katalog-Lauf ordnet nur Katalogserien zu; eine
 * Kalenderserie, die er (noch) nicht führt, hat keine aniSearch-Kennung und keinen Platz auf der Liste — im Bau fängt sie nur die Namenszuordnung.
 */
export function kalenderOhneNetz(kalender: { showId: number; title: string }[], katalog: { showId: number }[], offen: { showId: number }[]): { showId: number; title: string }[] {
  const bekannt = new Set([...katalog, ...offen].map((s) => s.showId))
  return kalender.filter((s) => !bekannt.has(s.showId))
}
