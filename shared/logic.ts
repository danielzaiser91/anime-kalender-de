import type { Release, ReleaseEvent, ReleaseStatus, Title } from './types.ts'
import { addDays, todayIso, berlinToUtc } from './time.ts'

/**
 * Beobachtete Folgen als Stützpunkte, aufsteigend nach Folgennummer.
 *
 * Steht an einer Stelle im Code und wird von beiden Rechnungen benutzt, weil
 * ein Auseinanderlaufen genau die Art Widerspruch erzeugt, an der der Kalender
 * schon einmal zerbrochen ist: hier „letzte Folge am 18.11.", darunter eine
 * Terminliste, die am 04.11. endet.
 */
function stuetzpunkte(s: Release['schedule']): { episode: number; date: string }[] {
  return Object.entries(s.observed ?? {})
    .map(([episode, date]) => ({ episode: Number(episode), date }))
    .filter((a) => a.episode > 0 && a.date)
    .sort((a, b) => a.episode - b.episode)
}

/**
 * Letzter Termin eines Releases im deutschen Dub.
 * Bei `weekly` aus Startdatum + Folgenzahl + Sendepausen berechnet,
 * sonst identisch mit dem Startdatum.
 *
 * Gerechnet wird ab der letzten Beobachtung, nicht ab dem Start: Erschienen
 * drei Folgen an einem Tag, ist die Reihe zwei Wochen früher durch, als der
 * reine Wochentakt ausrechnet.
 */
export function lastEpisodeDate(release: Release): string | undefined {
  const s = release.schedule
  if (s.lastEpisodeDate) return s.lastEpisodeDate
  if (release.releaseType !== 'weekly') return s.firstEpisodeDate
  if (!s.episodeCount || s.episodeCount < 1) return undefined
  const skips = new Set(s.skipDates ?? [])
  const first = Math.max(1, s.firstEpisodeNumber ?? 1)
  const letzte = first + s.episodeCount - 1
  const anker = stuetzpunkte(s).filter((a) => a.episode >= first && a.episode <= letzte).at(-1)
  let date = anker?.date ?? s.firstEpisodeDate
  let produced = anker?.episode ?? first
  let guard = 0
  while (produced < letzte && guard++ < 400) {
    date = addDays(date, 7)
    if (!skips.has(date)) produced++
  }
  return date
}

/**
 * Status nach Definition aus dem Auftrag:
 * airing         — heute liegt zwischen erster und letzter Dub-Folge
 * abgeschlossen  — letzte Dub-Folge liegt vor heute
 * tba            — erste Dub-Folge liegt in der Zukunft
 */
export function releaseStatus(release: Release, today = todayIso()): ReleaseStatus {
  const s = release.schedule
  if (!s?.firstEpisodeDate) return 'unbekannt'
  if (s.firstEpisodeDate > today) return 'tba'
  const last = lastEpisodeDate(release)
  if (!last) return 'airing'
  if (last < today) return 'abgeschlossen'
  return 'airing'
}

/**
 * Status eines Anime über alle seine Releases hinweg.
 * Läuft irgendetwas gerade, gewinnt „airing"; sonst zählt der nächste Termin.
 *
 * Ohne erfassten deutschen Termin hilft die japanische Ausstrahlung weiter:
 * Ist die längst vorbei und eine Synchro belegt, dann ist sie erschienen —
 * „Termin unbekannt" wäre für einen Titel von 2003 unsinnig.
 */
/**
 * Wie lange nach dem japanischen Ende eine deutsche Fassung als „erschienen"
 * gilt, wenn kein Termin bekannt ist.
 *
 * Der Status stützt sich auf einen Schluss, der bei alten Katalogtiteln trägt:
 * Cowboy Bebop lief 1998, es gibt eine deutsche Fassung, also ist sie längst
 * draußen — nur das Datum kennen wir nicht. Bei einer Serie, die vor fünf
 * Wochen in Japan endete, trägt derselbe Schluss nicht mehr.
 *
 * Real am 10.08.2026: „Mushoku Tensei Staffel 3" (japanisches Ende 04.07.2026)
 * stand auf der Seite mit „Die deutsche Fassung ist erschienen." Es gibt sie
 * nicht, nicht einmal die erste Folge. 96 Titel trugen dieselbe Behauptung.
 *
 * Ein Jahr ist bewusst großzügig: Eine Synchro entsteht nicht über Nacht, und
 * wer im letzten Jahr lief und bei uns keinen Termin hat, ist entweder noch
 * nicht vertont oder von uns nicht erfasst. In beiden Fällen ist „unbekannt"
 * die ehrliche Antwort.
 */
const ERSCHIENEN_MINDESTABSTAND_TAGE = 365

export function titleStatus(
  releases: Release[],
  today = todayIso(),
  title?: Pick<Title, 'jpEnd' | 'jpYear' | 'dubConfidence' | 'streams'>,
): ReleaseStatus {
  if (releases.length > 0) {
    const all = releases.map((r) => releaseStatus(r, today))
    if (all.includes('airing')) return 'airing'
    if (all.includes('tba')) return 'tba'
    if (all.includes('abgeschlossen')) return 'abgeschlossen'
  }

  /**
   * Wer die deutsche Fassung schon anbietet, hat sie veröffentlicht.
   *
   * Das ist die stärkste Auskunft, die es hier gibt, und sie stand bis zum
   * 24.08.2026 hinter zwei schwächeren: Der Status hing allein am japanischen
   * Enddatum und einem Jahr Abstand. „Der Held ohne Klasse: Der Aufstieg eines
   * Talentlosen" stand deshalb auf **„Termin unbekannt"**, obwohl ADN alle
   * zwölf Folgen mit deutscher Tonspur führt und das Panel sie eine Zeile
   * tiefer auch anzeigt — mit einem grünen „DE ✓".
   *
   * Daniel dazu: „es ist erschienen, mach den bereich deutlicher, es gibt
   * deutsche synchro." Der Widerspruch war für den Leser nicht auflösbar: oben
   * eine Fehlanzeige, unten das Angebot.
   *
   * Ein belegter Verweis schlägt hier auch `dubConfidence: 'low'`. Die
   * Einstufung sagt, wie gut die **Terminlage** belegt ist; ob die Fassung
   * existiert, beantwortet der Anbieter selbst.
   */
  if ((title?.streams ?? []).some((s) => s.dub === true)) return 'erschienen'

  const ended = title?.jpEnd ?? (title?.jpYear ? `${title.jpYear}-12-31` : undefined)
  // Ohne einen belegten Verweis reicht eine einzige Quelle für den Satz „die
  // deutsche Fassung ist erschienen" nicht.
  if (ended && title?.dubConfidence !== 'low' && ended < addDays(today, -ERSCHIENEN_MINDESTABSTAND_TAGE)) {
    return 'erschienen'
  }
  return 'unbekannt'
}

/** Erzeugt aus der Termin-Regel eines Releases die einzelnen Kalender-Einträge. */
/**
 * Ist dieser Termin schon durch — nach Datum **und** Uhrzeit?
 *
 * Daniel am 23.08.2026: „um 16:59 sollte im panel 4 stehen, ab 17:00 uhr
 * (release zeitpunkt) sollte dort 5 stehen." Ein Vergleich über das Datum
 * allein zählt die heutige Folge ab Mitternacht mit — bei einer Serie, die um
 * 17:00 erscheint, siebzehn Stunden zu früh.
 *
 * Fehlt die Uhrzeit, gilt der Tag als abgeschlossen: Wir wissen dann nicht,
 * wann sie kam, aber dass sie kam. Ein „noch nicht" wäre die schlechtere
 * Auskunft — die Oberfläche schreibt bei fehlender Uhrzeit ohnehin „Zeit
 * offen".
 */
export function istErschienen(
  ereignis: { date: string; time?: string },
  jetzt: Date = new Date(),
): boolean {
  return berlinToUtc(ereignis.date, ereignis.time ?? '23:59').getTime() <= jetzt.getTime()
}

export function expandEvents(release: Release): ReleaseEvent[] {
  const s = release.schedule
  if (!s?.firstEpisodeDate) return []

  const base = {
    releaseSlug: release.slug,
    titleId: release.titleId,
    time: s.time,
    releaseType: release.releaseType,
    platform: release.platform,
    name: release.name,
    estimated: s.estimated,
  }

  if (release.releaseType !== 'weekly') {
    return [
      {
        ...base,
        id: `${release.slug}@${s.firstEpisodeDate}`,
        date: s.firstEpisodeDate,
        episodeCount: s.episodeCount,
      },
    ]
  }

  /**
   * Ohne belegte Folgenzahl wird **eine** Folge erzeugt, nicht zwölf.
   *
   * Hier stand `?? 12`. Das ist derselbe geratene Standardwert, den CLAUDE.md
   * unter „Keine Folgenzahl erfinden, auch nicht als Rückfall" verbietet — nur
   * eine Ebene tiefer, wo ihn die Kuratierung nicht mehr sieht. Ein einzelner
   * belegter Termin ist ein Termin, keine Staffel.
   */
  const count = s.episodeCount ?? 1
  const skips = new Set(s.skipDates ?? [])

  /**
   * Bei welcher Folgennummer dieses Release einsetzt — und bis zu welcher die
   * Reihe insgesamt läuft. Beides fällt nur dann zusammen, wenn ein Release
   * die ganze Staffel abdeckt; bei einem geteilten Start (siehe
   * `firstEpisodeNumber`) beginnt der zweite Teil mitten in der Zählung.
   */
  const first = Math.max(1, s.firstEpisodeNumber ?? 1)
  const last = first + count - 1

  /**
   * Beobachtete Folgen, aufsteigend. Sie sind die Stützpunkte des Sendeplans:
   * Jede Folge rechnet ab der jüngsten Beobachtung **vor** ihr weiter.
   *
   * Der Unterschied ist keine Kleinigkeit. Vorher lief die Rechnung stur ab
   * Folge 1 durch, und eine einzige Sendepause verschob alles Weitere um eine
   * Woche: Bei „Ascendance of a Bookworm" pausierte die Staffel am 25.07., die
   * echte Folge 14 lief am 08.08. — der Kalender setzte dorthin Folge 15 und
   * behauptete damit eine deutsche Fassung, die es noch gar nicht gab.
   *
   * Ein Stützpunkt hinter sich zu haben heißt: Der Takt ab dort ist gemessen,
   * nicht geraten. Alles jenseits der letzten Beobachtung bleibt Fortschreibung
   * und wird als solche gekennzeichnet.
   */
  const anchors = stuetzpunkte(s)
  const lastAnchor = anchors[anchors.length - 1]

  const dateOf = (episode: number): string => {
    let anchor: { episode: number; date: string } | undefined
    let danach: { episode: number; date: string } | undefined
    for (const candidate of anchors) {
      if (candidate.episode > episode) {
        danach = candidate
        break
      }
      anchor = candidate
    }

    /**
     * Liegt eine **höhere** Folge bereits belegt vor, wird zwischen den beiden
     * Messpunkten geteilt statt darüber hinaus gerechnet.
     *
     * Der Anlass (Daniel, 23.08.2026, mit zwei Bildern): Bei „Mushoku Tensei"
     * Staffel 3 kennt der Bestand die Folgen 1–3 vom 19.08. und Folge **5**
     * vom 23.08.; Folge 4 fehlt, weil sie kein Abruf gesehen hat. Die stumme
     * Wochenrechnung setzte sie auf den 26.08. — hinter eine Folge, die es
     * längst gibt. Die Karte zeigte „Ep 5/14", das Panel darunter „4/14".
     *
     * Zwischen zwei Messpunkten zu teilen ist keine Erfindung, sondern die
     * einzige Lage, die beide Messungen achtet. Sie kann daneben liegen, wenn
     * genau in dieser Lücke eine Sendepause lag — aber sie kann nicht die
     * Reihenfolge verletzen, und **das** ist der Fehler, der dem Leser auffällt.
     */
    /**
     * **Nur wenn die Folge selbst kein Stuetzpunkt ist.**
     *
     * Ist sie einer, steht ihr Termin fest und wird unten unveraendert
     * zurueckgegeben. Ohne diese Bedingung schob der erste Versuch auch
     * belegte Folgen auf den naechsten Termin: Folge 3 lag am 19.08. und
     * landete auf dem 23.08. -- eine Messung durch eine Ableitung ersetzt,
     * der schlimmste Tausch, den dieses Projekt kennt.
     */
    if (danach && anchor && anchor.episode !== episode) {
      /**
       * **Auf den naechsten belegten Termin, nicht in die Mitte.**
       *
       * Die erste Fassung teilte die Spanne gleichmaessig auf: Bei Folge 3 am
       * 19.08. und Folge 5 am 23.08. landete Folge 4 auf dem 21.08. Das sah
       * vernuenftig aus und war falsch -- Crunchyroll hat die Folgen 4 und 5
       * am selben Tag veroeffentlicht (Daniel, 24.08.2026: "i dont remember
       * watching ep 4 yesterday, so it must be correct that it released
       * today").
       *
       * Der Grund liegt auf der Hand, sobald man ihn sieht: Eine Folge fehlt
       * in unseren Daten nicht zufaellig, sondern weil kein Abruf sie als
       * eigenen Termin gesehen hat. Am haeufigsten, weil sie gar keinen
       * eigenen hatte -- Nachzuegler kommen gebuendelt.
       *
       * Die Mitte zu raten ist eine Erfindung mit vernuenftigem Anstrich. Der
       * naechste belegte Termin ist dagegen eine **Obergrenze**: Sie kann zu
       * spaet liegen, aber sie behauptet nie eine Folge, die es noch nicht
       * gibt. Fuer einen Kalender, der vorhersagt, ist das die richtige
       * Richtung.
       */
      return danach.date
    }

    /**
     * Kein Stützpunkt davor, aber einer dahinter: rückwärts rechnen.
     *
     * Sonst käme die Folge auf den Starttermin plus Wochen und läge damit
     * ebenfalls hinter der belegten.
     */
    if (danach && !anchor) {
      return addDays(danach.date, -7 * (danach.episode - episode))
    }

    return anchor
      ? addDays(anchor.date, 7 * (episode - anchor.episode))
      : addDays(s.firstEpisodeDate, 7 * (episode - first))
  }

  const events: ReleaseEvent[] = []
  for (let episode = first; episode <= last; episode++) {
    const date = dateOf(episode)
    if (skips.has(date)) continue
    /**
     * Ein belegtes Enddatum beendet die Reihe — auch wenn die Folgenzahl noch
     * mehr hergäbe.
     *
     * Genau hier entstand der schlimmste Fehler, den die Seite je hatte: ADN
     * nahm „Sword Art Online" am 11.06. und 17.07.2025 als Komplettabwurf ins
     * Angebot, 96 Folgen an zwei Tagen. Weil der Eintrag fälschlich als
     * wöchentlich galt (siehe fetch-adn.ts), rechnete diese Schleife 96
     * Wochentermine bis zum 07.04.2027 aus — und das, obwohl `lastEpisodeDate`
     * mit dem 17.07.2025 daneben stand und `releaseStatus()` in derselben
     * Datei brav „Abgeschlossen" meldete. Der Datensatz widersprach sich
     * selbst, und der Kalender kündigte Woche für Woche eine Folge an, die es
     * nicht gibt (gemeldet von Daniel, 12.08.2026).
     *
     * Die Abbruchbedingung ist billiger als jede Rhythmus-Reparatur: Was
     * hinter dem letzten belegten Termin liegt, ist keine Fortschreibung mehr,
     * sondern eine Erfindung.
     */
    if (s.lastEpisodeDate && date > s.lastEpisodeDate) break
    events.push({
      ...base,
      id: `${release.slug}@${date}`,
      date,
      episode,
      episodeCount: last,
      // Gesehen ist gesehen; fortgeschrieben bleibt eine Annahme, auch wenn
      // der Start selbst belegt ist.
      estimated: s.observed?.[episode] ? undefined : lastAnchor ? true : s.estimated,
      /* Ein Termin, an dem nichts erschien, sagt das — er verschwindet nicht. */
      verpasst: s.verpasst?.[episode],
    })
  }

  /**
   * Mehrere Folgen an einem Tag brauchen unterscheidbare Kennungen.
   *
   * Der Wochentakt ist ein guter Vorgabewert, aber Abweichungen sind der
   * Normalfall — Pausen, Verschiebungen, und ein Auftakt mit mehreren Folgen auf
   * einmal. Bei „Mushoku Tensei" Staffel 3 erschienen am 19.08.2026 die ersten
   * **drei** Folgen zusammen (Daniel, 21.08.2026); über `observed` lässt sich das
   * eintragen, nur trugen die drei Termine dann dieselbe Kennung
   * `slug@datum` — dieselbe React-Kennung in der Liste und dieselbe UID im
   * Kalender-Abo, wo drei Einträge zu einem verschmolzen wären.
   *
   * Angehängt wird die Folgennummer **nur dort, wo sie gebraucht wird**. Jede
   * Kennung, die schon eindeutig ist, bleibt unverändert — sonst bekäme jeder
   * Abonnent seinen gesamten Kalender neu eingetragen, weil eine geänderte UID
   * für sein Programm ein anderer Termin ist.
   */
  const proDatum = new Map<string, number>()
  for (const ev of events) proDatum.set(ev.date, (proDatum.get(ev.date) ?? 0) + 1)
  for (const ev of events) {
    if ((proDatum.get(ev.date) ?? 0) > 1) ev.id = `${ev.id}#${ev.episode}`
  }

  return events
}
