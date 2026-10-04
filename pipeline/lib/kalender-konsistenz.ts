/**
 * Vier Regeln, die der erzeugte Kalender selbst verletzen kann — gefunden an
 * echten Fehlern (`docs/wissen/befund-2026-10-02.md`, B-02 bis B-06).
 *
 * Anders als `pruefung.ts` bricht diese Datei nichts ab: Sie **meldet** nur, was
 * sich widerspricht. Der Aufrufer entscheidet, ob daraus ein Fehler wird
 * (`pipeline/kalender-befund.ts` misst, `check-logic.ts` stellt Fälle nach).
 *
 * Jede Regel ist eine eigene kleine Funktion mit einem Rückgabewert — keine
 * geteilten Zustände, damit `check:logic` sie einzeln nachstellen kann.
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'

/** Eine Regelverletzung: welche Regel, wo (Slug), und was genau dasteht. */
type Befund = { regel: string; wo: string; text: string }

/**
 * Prüft den erzeugten Kalender auf die vier Widersprüche aus dem Befund vom 02.10.2026.
 *
 * @param releases  `public/data/releases.json`
 * @param events    `public/data/events.json`
 * @param titelIds  alle bekannten Titel-IDs (`titles.json`)
 */
export function pruefeKalenderKonsistenz(
  releases: Release[],
  events: ReleaseEvent[],
  titelIds: Set<number>,
): { regel: string; wo: string; text: string }[] {
  return [
    ...doppelteSlugs(releases),
    ...releasesOhneTitel(releases, titelIds),
    ...doppelteFolgennummern(events),
    ...nichtMonotoneDaten(releases),
  ]
}

/**
 * a. Zwei Releases mit demselben Slug (Pokémon Reisen, `auto-112153-tv-toggo-plus`).
 *
 * Ein Slug wird zu `/r/<slug>/` und zu einem Dateinamen; ein zweiter Eintrag
 * darunter überschreibt den ersten, und beide Terminlisten mischen sich.
 */
function doppelteSlugs(releases: Release[]): Befund[] {
  const jeSlug = new Map<string, Release[]>()
  for (const r of releases) jeSlug.set(r.slug, [...(jeSlug.get(r.slug) ?? []), r])
  const befunde: Befund[] = []
  for (const [slug, liste] of jeSlug) {
    if (liste.length < 2) continue
    befunde.push({
      regel: 'slug',
      wo: slug,
      text: `Slug ${liste.length}× vergeben: ${liste.map((r) => r.name).join(' | ')}`,
    })
  }
  return befunde
}

/**
 * b. Ein Release, dessen `titleId` auf keinen Titel zeigt (Crunchyroll Anime
 * Awards 2021, `cr-GR3K50PZR` mit `titleId -1`).
 *
 * Solche Karten stehen im Kalender, das Panel weiß aber nichts über sie. Der
 * Bau überspringt `titleId < 0` bisher ausdrücklich — hier fallen sie auf.
 */
function releasesOhneTitel(releases: Release[], titelIds: Set<number>): Befund[] {
  const befunde: Befund[] = []
  for (const r of releases) {
    if (!(r.titleId < 0 || !titelIds.has(r.titleId))) continue
    befunde.push({
      regel: 'titel',
      wo: r.slug,
      text: `titleId ${r.titleId} ${r.titleId < 0 ? 'ist negativ' : 'steht in keiner Titelliste'} — „${r.name}"`,
    })
  }
  return befunde
}

/**
 * c. Eine Folgennummer doppelt in den Terminen **eines** Releases (Pokémon
 * Reisen: „Folge 6" zweimal, ohne Ausfall).
 *
 * Ein ausgebliebener Termin zählt nicht mit: Der Kalender zeigt die Folge an
 * ihrem Ersatztermin erneut (Polar Opposites S2, Folge 8 dreimal, 04.10.2026)
 * — die Wiederholung ist der Vermerk, nicht eine zweite Folge.
 */
function doppelteFolgennummern(events: ReleaseEvent[]): Befund[] {
  const jeRelease = new Map<string, Map<number, number>>()
  for (const e of events) {
    if (e.episode == null) continue
    if (e.verpasst && !e.verpasst.erschienenAm) continue
    const zaehler = jeRelease.get(e.releaseSlug) ?? new Map<number, number>()
    zaehler.set(e.episode, (zaehler.get(e.episode) ?? 0) + 1)
    jeRelease.set(e.releaseSlug, zaehler)
  }
  const befunde: Befund[] = []
  for (const [slug, zaehler] of jeRelease)
    for (const [folge, anzahl] of zaehler)
      if (anzahl > 1) befunde.push({ regel: 'folgennummer', wo: slug, text: `Folge ${folge} steht ${anzahl}× im Kalender` })
  return befunde
}

/**
 * d. Ein Datum sinkt mit steigender Folgennummer (Lycoris Recoil: Folge 6 trägt
 * den 06.08.2022, den Tag von Folge 3).
 *
 * Geprüft wird `schedule.observed` — die Beobachtung schlägt jede Rechnung, ein
 * Tippfehler darin verschiebt deshalb den ganzen Terminplan.
 */
function nichtMonotoneDaten(releases: Release[]): Befund[] {
  const befunde: Befund[] = []
  for (const r of releases) {
    const folgen = Object.entries(r.schedule?.observed ?? {})
      .map(([nr, datum]) => [Number(nr), datum] as const)
      .filter(([, datum]) => Boolean(datum))
      .sort((a, b) => a[0] - b[0])
    for (let i = 1; i < folgen.length; i++) {
      const [vorher, vorherDatum] = folgen[i - 1]!
      const [jetzt, jetztDatum] = folgen[i]!
      if (jetztDatum >= vorherDatum) continue
      befunde.push({
        regel: 'monotonie',
        wo: r.slug,
        text: `Folge ${jetzt} trägt ${jetztDatum}, liegt aber vor Folge ${vorher} (${vorherDatum})`,
      })
      break
    }
  }
  return befunde
}
