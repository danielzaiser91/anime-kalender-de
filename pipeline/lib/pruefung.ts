/**
 * Prüft, was die Pipeline **erzeugt** hat — nicht, was ein Mensch eingetippt
 * hat.
 *
 * Warum es diese Datei gibt: `validate.ts` sicherte bis zum 12.08.2026
 * ausschließlich `data/curated/*.yaml` ab, also den Teil, den ohnehin jemand
 * durchdacht hatte. Alles automatisch Erzeugte — ADN, Crunchyroll, aniSearch —
 * ging ungeprüft nach `public/data/`. Genau dort standen dann 196 von 867
 * Terminen, die es nicht gibt: „Sword Art Online, Folge 62, 12.08.2026",
 * „Sailor Moon, Folge 34, 11.08.2026", wöchentlich weiter bis 2027.
 *
 * Keine dieser Zeilen wäre schwer zu finden gewesen. Ein Release, dessen
 * Termine über sein eigenes Enddatum hinauslaufen, widerspricht sich selbst —
 * das ist ein Dreizeiler. Die Prüfung fehlte, nicht die Möglichkeit.
 *
 * Deshalb steht sie hier und wird am Ende von `build.ts` aufgerufen: Was nicht
 * durchkommt, wird gar nicht erst geschrieben.
 */
import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
import { lastEpisodeDate } from '../../shared/logic.ts'
import { addDays } from '../../shared/time.ts'

export interface Pruefergebnis {
  fehler: string[]
  warnungen: string[]
}

/**
 * Ab welchem Verhältnis eine Folgenzahl nicht mehr zum Werk passen kann.
 *
 * „Sword Art Online" hat 25 Folgen, das Release behauptete 96 — das Vierfache.
 * Sailor Moon: 46 gegen 100. Eine Serie kann ein paar Folgen mehr haben als
 * der AniList-Eintrag (OVAs, Rekapitulationen, eine abweichende Zählung), aber
 * nicht das Doppelte. Wo das passiert, sind mehrere Staffeln in einen Eintrag
 * gerutscht.
 */
const FOLGENZAHL_FAKTOR = 2
const FOLGENZAHL_MINDESTABSTAND = 10

/** Ab wann ein Termin so weit weg ist, dass er einen Beleg braucht. */
const FERNE_ZUKUNFT_TAGE = 550

export function pruefeErgebnis(
  releases: Release[],
  events: ReleaseEvent[],
  titles: Map<number, Title>,
  heute: string,
): Pruefergebnis {
  const fehler: string[] = []
  const warnungen: string[] = []

  const eventsProSlug = new Map<string, ReleaseEvent[]>()
  for (const e of events) {
    const liste = eventsProSlug.get(e.releaseSlug) ?? []
    liste.push(e)
    eventsProSlug.set(e.releaseSlug, liste)
  }

  for (const r of releases) {
    const at = `"${r.slug}"`
    const s = r.schedule

    if (!r.sources?.length) fehler.push(`${at}: keine Quelle angegeben`)

    /**
     * Ein Slug wird zu einer Adresse und zu einem Ordnernamen.
     *
     * Aus `Release.slug` entsteht `/r/<slug>/` — eine echte Datei im Bauwerk, ein
     * Eintrag in der Sitemap, ein geteilter Link. Ein Leerzeichen wird darin zu
     * `%20`, ein Doppelpunkt ist unter Windows überhaupt kein Dateiname.
     *
     * Am 17.08.2026 kam One Piece in den ADN-Katalog, dessen Staffeln „Saga 1 :
     * East Blue" heißen. Der Slug lautete `adn-561-sSaga 1 : East Blue-20190520`,
     * und der Bau der Teilen-Seiten brach mit `ENOENT` ab — eine Fehlermeldung,
     * die nach einem fehlenden Ordner klingt und nichts über die Ursache sagt.
     * Hier fällt es künftig mit Namen und Grund auf.
     *
     * **Großbuchstaben sind erlaubt**, auch wenn sie unschön sind: Die
     * Crunchyroll-Slugs tragen deren Kennung im Original (`cr-GT00371857`), und
     * das sind 21 live erreichbare Adressen. Eine Prüfung, die sie verbietet,
     * verbietet nicht einen Fehler, sondern den Bestand.
     */
    if (!/^[A-Za-z0-9._-]+$/.test(r.slug)) {
      fehler.push(`${at}: der Slug enthält Zeichen, die in einer Adresse nichts zu suchen haben`)
    }

    if (s.lastEpisodeDate && s.lastEpisodeDate < s.firstEpisodeDate) {
      fehler.push(`${at}: lastEpisodeDate ${s.lastEpisodeDate} liegt vor firstEpisodeDate ${s.firstEpisodeDate}`)
    }

    /**
     * Der Prüfsatz, der den ganzen Fehler gefunden hätte.
     *
     * `expandEvents` las das Enddatum nicht, `releaseStatus` schon. Der
     * Datensatz behauptete deshalb gleichzeitig „abgeschlossen seit Juli 2025"
     * und „nächste Folge nächsten Mittwoch".
     */
    for (const e of eventsProSlug.get(r.slug) ?? []) {
      if (s.lastEpisodeDate && e.date > s.lastEpisodeDate) {
        fehler.push(
          `${at}: Termin ${e.date} (Folge ${e.episode ?? '?'}) liegt nach dem belegten Ende ${s.lastEpisodeDate}`,
        )
        break
      }
    }

    const title = titles.get(r.titleId)
    if (title?.episodes && s.episodeCount) {
      const diff = s.episodeCount - title.episodes
      if (
        s.episodeCount > title.episodes * FOLGENZAHL_FAKTOR &&
        diff >= FOLGENZAHL_MINDESTABSTAND &&
        // Ein Release, das ausdrücklich mitten in der Zählung einsetzt oder das
        // seine Abweichung selbst erklärt, ist kein Verdachtsfall. „Steel Ball
        // Run – 2nd & 3rd STAGE" deckt elf Folgen ab, während der
        // AniList-Eintrag der Auftaktfolge auf 1 steht — beides stimmt.
        !s.firstEpisodeNumber &&
        !r.note
      ) {
        fehler.push(
          `${at}: ${s.episodeCount} Folgen für "${title.titleRomaji ?? title.id}", der ${title.episodes} hat — ` +
            `das sieht nach mehreren Staffeln in einem Eintrag aus`,
        )
      } else if (diff > 0 && !s.episodeCountAssumed && !s.firstEpisodeNumber && !r.note) {
        // Nur nach oben: Ein Release, das einen Teil einer langen Serie
        // abdeckt (Disney+ zeigt Naruto in Staffelpaketen), nennt zu Recht
        // weniger Folgen als der Gesamteintrag.
        warnungen.push(
          `${at}: ${s.episodeCount} Folgen gegen ${title.episodes} laut AniList ("${title.titleRomaji ?? title.id}")`,
        )
      }
    }

    const ende = lastEpisodeDate(r)
    if (ende && ende > addDays(heute, FERNE_ZUKUNFT_TAGE)) {
      warnungen.push(`${at}: letzter Termin ${ende} liegt mehr als eineinhalb Jahre in der Zukunft`)
    }
  }

  /**
   * Zwei Releases, die denselben Anime auf derselben Plattform mit
   * unterschiedlicher Folgenzahl führen, können nicht beide stimmen.
   *
   * Real am 12.08.2026 beim ersten Reparaturversuch: „Sailor Moon" stand
   * zweimal auf AniList 530, einmal mit 46 und einmal mit 42 Folgen — die
   * zweite ADN-Staffel war mangels exakter Zuordnung auf den Serientitel
   * zurückgefallen.
   *
   * Zwei Ausnahmen, beide berechtigt: **Discs** — mehrere Ausgaben desselben
   * Werks sind dort der Normalfall — und Releases mit `firstEpisodeNumber`,
   * die ausdrücklich nur einen Abschnitt abdecken.
   *
   * Ausschlaggebend ist nicht, dass die Zahlen verschieden sind, sondern dass
   * sie **zusammen nicht in das Werk passen**: Disney+ zeigt Yu-Gi-Oh in
   * Paketen zu 48 und 40 Folgen — beides Teile derselben 224-teiligen Serie
   * und damit kein Widerspruch. 46 und 42 Folgen für einen 46-teiligen Anime
   * dagegen können nicht beide stimmen.
   */
  const nachTitelUndPlattform = new Map<string, Release[]>()
  for (const r of releases) {
    if (r.titleId < 0 || r.platform === 'disc' || r.schedule.firstEpisodeNumber) continue
    if (!(r.schedule.episodeCount ?? 0)) continue
    const key = `${r.titleId}|${r.platform}`
    const liste = nachTitelUndPlattform.get(key) ?? []
    liste.push(r)
    nachTitelUndPlattform.set(key, liste)
  }
  for (const [key, liste] of nachTitelUndPlattform) {
    if (liste.length < 2) continue
    const summe = liste.reduce((n, r) => n + (r.schedule.episodeCount ?? 0), 0)
    const gesamt = titles.get(liste[0].titleId)?.episodes
    if (gesamt && summe > gesamt) {
      fehler.push(
        `Anime ${key.split('|')[0]} ("${titles.get(liste[0].titleId)?.titleRomaji ?? '?'}") auf ${key.split('|')[1]}: ` +
          `zusammen ${summe} Folgen bei ${gesamt} vorhandenen — ` +
          liste.map((r) => `${r.slug}=${r.schedule.episodeCount}`).join(', '),
      )
    }
  }

  return { fehler, warnungen }
}
