/**
 * Welche Folge eines Anbieters ist welche unserer Folgen?
 *
 * **Warum das nicht über die Nummer geht.** Jeder Anbieter zählt anders, und
 * manche zählen in derselben Liste zweierlei:
 *
 * - Prime führt bei Detektiv Conan die deutsche Zählung (149–151) neben der
 *   japanischen Gesamtzählung (1146–1148)
 * - Amazon zeigt bei InuYasha Staffel 4 die Nummern 26, 27, 28 — und dann 105
 * - Haikyu Staffel 1 hat bei Amazon 44 Folgen, bei uns 25
 * - Crunchyroll vergibt Staffelnummern der Form `S00095473`
 *
 * **Was nicht wandert, ist der Sendetermin.** Die japanische Erstausstrahlung
 * vergibt keine Plattform neu; sie ist der gemeinsame Anker zwischen TMDB,
 * AniList und jedem Anbieter. Der Folgentitel ist der zweite: Er ändert sich mit
 * der Tonspur nicht.
 *
 * **Diese Datei ordnet zu, sie urteilt nicht.** Was sich nicht zuordnen lässt,
 * kommt als `offen` zurück, mit Grund — geraten wird nichts. Das ist der
 * Unterschied zur Erweiterung, die bis 3.76 auf der Seite entscheiden musste und
 * daran 39 Fassungen an einem Abend gekostet hat.
 */

/** Eine Folge, wie TMDB sie führt. */
export interface TmdbFolge {
  s: number
  e: number
  titel: string | null
  datum: string | null
  minuten: number | null
}

/** Eine Folge, wie ein Anbieter sie zeigt — Nummer und Titel sind beide unsicher. */
export interface AnbieterFolge {
  nummer: number | null
  titel: string | null
  /** Erscheinungsdatum beim Anbieter, `YYYY-MM-DD`. Nicht die Erstausstrahlung. */
  datum: string | null
  minuten: number | null
}

export interface Zuordnung {
  /** Position in der Anbieterliste. */
  index: number
  /** Unsere Folgennummer innerhalb der Staffel, 1-basiert. */
  unsere: number | null
  /** Woran es festgemacht wurde — steht im Protokoll, nicht in der Oberfläche. */
  grund: 'datum' | 'titel' | 'position' | 'offen'
}

/**
 * Titel auf ihren Kern bringen — dieselbe Kürzung wie beim Serienabgleich.
 *
 * Anbieter schreiben Folgentitel unterschiedlich: „1. Ende und Anfang" gegen
 * „Ende und Anfang", „Folge 01 – Ein aufblühender Tauchstart" gegen „Ein
 * aufblühender Tauchstart". Die führende Nummer fällt weg, ebenso alles, was
 * kein Buchstabe oder keine Ziffer ist.
 */
export function folgenKern(t: string | null | undefined): string {
  return (t ?? '')
    .toLowerCase()
    .replace(/^\s*(?:folge\s*)?\d+\s*[.:–-]\s*/, '')
    .replace(/[^a-z0-9äöüß]/g, '')
}

/**
 * **Welche TMDB-Staffel meint unser Eintrag?**
 *
 * Entschieden wird über die Folgenzahl: Unser Bestand führt je Staffel einen
 * eigenen Titel mit eigener Folgenzahl, und TMDB tut dasselbe. Wo beide
 * übereinstimmen und die Zahl eindeutig ist, ist die Staffel gefunden.
 *
 * Staffel 0 (TMDBs Sammelplatz für Specials) zählt nicht mit — sie enthält
 * Sonderfolgen aus allen Staffeln und würde jede Zahl zufällig treffen.
 *
 * Gibt es mehrere Staffeln mit derselben Folgenzahl, entscheidet das Jahr. Bleibt
 * es mehrdeutig, kommt `null` zurück: Eine geratene Staffel ist schlimmer als
 * keine.
 */
export function findeStaffel(
  folgen: TmdbFolge[],
  unsereFolgen: number | null,
  unserJahr: number | null,
): number | null {
  if (!unsereFolgen || unsereFolgen < 1) return null

  const jeStaffel = new Map<number, TmdbFolge[]>()
  for (const f of folgen) {
    if (f.s === 0) continue
    const liste = jeStaffel.get(f.s) ?? []
    liste.push(f)
    jeStaffel.set(f.s, liste)
  }

  const passend = [...jeStaffel.entries()].filter(([, liste]) => liste.length === unsereFolgen)
  if (passend.length === 1) return passend[0]![0]
  if (!passend.length) return null

  if (!unserJahr) return null
  /* Mehrere gleich lange Staffeln: Das Startjahr entscheidet. */
  const mitJahr = passend.filter(([, liste]) => {
    const erstes = liste.map((f) => f.datum).filter(Boolean).sort()[0]
    return erstes ? Number(erstes.slice(0, 4)) === unserJahr : false
  })
  return mitJahr.length === 1 ? mitJahr[0]![0] : null
}

/**
 * **Ordnet die Folgen eines Anbieters unseren zu.**
 *
 * Drei Wege, in dieser Reihenfolge — jeder spätere greift nur, wo der frühere
 * schweigt:
 *
 * 1. **Datum.** Trifft der Anbieter-Termin genau eine TMDB-Folge dieser Staffel,
 *    ist sie es. Der stärkste Anker, weil ihn niemand neu vergibt.
 * 2. **Titel.** Nach `folgenKern()` normalisiert. Trägt, wo der Anbieter das
 *    Erscheinungsdatum seiner eigenen Aufnahme führt statt der Erstausstrahlung.
 * 3. **Position.** Nur, wenn die Anbieterliste genau so lang ist wie die Staffel
 *    — dann ist die Reihenfolge die Zuordnung. Bei jeder Abweichung schweigt sie:
 *    Genau hier entstand der Fehler, den Amazon mit seinen 44 statt 25 Folgen
 *    provoziert.
 */
export function ordneZu(anbieter: AnbieterFolge[], staffel: TmdbFolge[]): Zuordnung[] {
  const nachDatum = new Map<string, TmdbFolge[]>()
  const nachTitel = new Map<string, TmdbFolge[]>()
  for (const f of staffel) {
    if (f.datum) {
      const l = nachDatum.get(f.datum) ?? []
      l.push(f)
      nachDatum.set(f.datum, l)
    }
    const k = folgenKern(f.titel)
    if (k.length >= 4) {
      const l = nachTitel.get(k) ?? []
      l.push(f)
      nachTitel.set(k, l)
    }
  }

  return anbieter.map((a, index) => {
    const perDatum = a.datum ? nachDatum.get(a.datum) : undefined
    if (perDatum?.length === 1) return { index, unsere: perDatum[0]!.e, grund: 'datum' as const }

    const perTitel = nachTitel.get(folgenKern(a.titel))
    if (perTitel?.length === 1) return { index, unsere: perTitel[0]!.e, grund: 'titel' as const }

    /*
      **Die Position ist gestrichen — sie war der Notausgang, der falsch lag.**

      Daniel am 28.08.2026: „nur einfache logik, keine komplexe … nur simple
      staffel zuordnungen." Eine Zuordnung nach Reihenfolge ist genau das
      Gegenteil: Sie sieht einfach aus und ist eine Behauptung. Sie greift, wenn
      Titel und Datum **beide** versagt haben — also genau dann, wenn nichts
      dafür spricht, dass die n-te Folge dort die n-te hier ist.

      Prime führt in einer Liste die deutsche Zählung neben der japanischen
      (149–151 neben 1146–1148), Crunchyroll stellt Rückblick-Specials voran,
      aniSearch trennt nach Arc. Gleiche Länge heißt in keinem dieser Fälle
      gleiche Reihenfolge.

      Was offen bleibt, bleibt offen. Das ist kein Verlust, sondern der Messwert
      dafür, wie gut die Anker sind — und er steht in
      `data/prime-unzugeordnet.json`.
    */
    return { index, unsere: null, grund: 'offen' as const }
  })
}

/**
 * Die Folgen eines Titels, wie aniSearch sie führt.
 *
 * Bewusst dieselbe Form wie `TmdbFolge`, damit `ordneZu` nicht wissen muss,
 * woher die Anker kommen.
 */
export interface AsFolgeRoh {
  nr: number
  datum?: string
  minuten?: number
  de?: string
  en?: string
  ja?: string
}

/**
 * **aniSearch-Folgen als Anker — und warum sie die besseren sind.**
 *
 * Drei Gründe, alle gemessen:
 *
 * 1. **Sie sind auf Deutsch.** 7.109 von 8.702 geholten Folgen tragen einen
 *    deutschen Titel (Stand 29.08.2026). Prime, Netflix und Crunchyroll nennen
 *    ihre Folgen ebenfalls deutsch — TMDB überwiegend englisch, und 50 seiner
 *    594 Titel haben nur Platzhalter („Folge 1").
 * 2. **Sie sind wie unser Bestand aufgeteilt.** aniSearch führt „Danganronpa 3 —
 *    Despair Arc" als eigenen Eintrag mit eigener Folgenzählung ab 1, genau wie
 *    wir. Bei TMDB muss dafür erst die richtige Staffel gefunden werden
 *    (`findeStaffel`), und das ist die Stelle, an der es schiefgeht.
 * 3. **Sie tragen die japanische Erstausstrahlung**, nicht das Datum einer
 *    Plattform-Aufnahme. 7.453 der 8.702 Folgen haben eines.
 *
 * Der englische Titel kommt als zweite Schreibweise mit: Prime führt manche
 * Folgen englisch, auch auf der deutschen Seite.
 */
export function ausAnisearch(folgen: AsFolgeRoh[]): TmdbFolge[] {
  return folgen.map((f) => ({
    s: 1,
    e: f.nr,
    titel: f.de ?? f.en ?? null,
    datum: f.datum ?? null,
    minuten: f.minuten ?? null,
  }))
}

/**
 * Zweite Schreibweise je Folge — für den Titelabgleich.
 *
 * `ordneZu` vergleicht einen Titel je Folge. Wo aniSearch beide führt, ist der
 * englische ein zweiter Versuch, der nichts kostet: Er wird nur gebraucht, wenn
 * der deutsche nicht traf.
 */
export function englischeSchreibweisen(folgen: AsFolgeRoh[]): TmdbFolge[] {
  return folgen
    .filter((f) => f.en && f.en !== f.de)
    .map((f) => ({ s: 1, e: f.nr, titel: f.en!, datum: f.datum ?? null, minuten: f.minuten ?? null }))
}
