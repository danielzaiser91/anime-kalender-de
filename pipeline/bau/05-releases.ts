import { schreibeCartoons } from './nebendateien.ts'
import { type Release, type Title } from '../../shared/types.ts'
import { warn } from '../lib/util.ts'
import { verpassteTermine, CR_CALENDAR_URL } from './grundlagen.ts'
import { pickPlatformUrl, derivedStart, observedEpisodes, overlapsWindow, werkTitel } from './titel-hilfen.ts'
import {
  normalizeTitle,
  beobachtungenZusammenfuehren,
  durchlaufendeZaehlung,
  type CrunchyrollEntry,
  type CrunchyrollData,
} from '../lib/crunchyroll.ts'
import { todayIso } from '../../shared/time.ts'
import { amazonSearchUrl } from '../../shared/mappings.ts'
import { type TmdbInfo } from '../lib/tmdb.ts'
import type { CuratedEntry } from '../lib/curated.ts'

export function baueReleases({
  curated,
  curatedIds,
  titles,
  tmdb,
  anisearchEpisodes,
  findCrunchyroll,
  crKalenderBis,
  crunchyroll,
}: {
  curated: CuratedEntry[]
  curatedIds: Record<string, number>
  titles: Map<number, Title>
  tmdb: Record<string, TmdbInfo>
  anisearchEpisodes: (titleId: number | undefined) => { count: number; estimated: boolean; } | undefined
  findCrunchyroll: (entryUrl: string | undefined, name: string) => CrunchyrollEntry | undefined
  crKalenderBis: string | undefined
  crunchyroll: CrunchyrollData
}) {
  /*
    **Der westliche Bestand — früh, weil er vom Anime-Bestand nichts braucht.**

    Er wird nicht in `titles.json` gemischt: Das ist die Datei, die jeder
    Besucher lädt, und 906 Titel darin kosteten jeden von ihnen Ladezeit. Wie
    `ohne-synchro.json` wird sie nachgeladen — nur eben immer, weil Daniel sie
    sichtbar haben will.

    **Vor dem Riegel**, der einen Titelschwund abfängt: Bricht der Bau dort ab,
    hat das mit diesen Titeln nichts zu tun, und sie sollen nicht mit ihm
    ausfallen.
  */
  schreibeCartoons()

  const releases: Release[] = []
  const seenSlugs = new Set<string>()
  const usedCrKeys = new Set<string>()
  // Kuratierte Termine, die der Crunchyroll-Kalender nicht bestätigt.
  const unverified: string[] = []

  for (const entry of curated) {
    if (seenSlugs.has(entry.slug)) {
      warn(`Doppelter Slug "${entry.slug}" — zweiter Eintrag ignoriert`)
      continue
    }
    if (!entry.schedule?.firstEpisodeDate) {
      warn(`"${entry.slug}" hat kein firstEpisodeDate — übersprungen`)
      continue
    }
    seenSlugs.add(entry.slug)

    const titleId = entry.anilistId ?? curatedIds[entry.slug]
    const title = titleId ? titles.get(titleId) : undefined
    if (!title) warn(`"${entry.slug}": kein AniList-Titel verknüpft — läuft ohne Metadaten`)

    const info = tmdb[entry.slug]
    const schedule = { ...entry.schedule }
    /*
      **Was der Anbieter nicht eingehalten hat, steht am Termin.**

      `pipeline/termine-pruefen.ts` schreibt die Fälle nach
      `data/termine-verpasst.json`; hier wandern sie an den Sendeplan, damit
      `expandEvents()` sie an das jeweilige Ereignis hängt. Ein Termin, an dem
      nichts erschien, verschwindet damit nicht — er sagt es (Daniel,
      31.08.2026: „falsche infos auf der webseite sind unbedingt zu vermeiden").
    */
    /*
      Aufsteigend nach Termin: Fällt eine Folge zweimal aus (am alten Tag und
      am recherchierten Ersatztermin), gilt der jüngere Vermerk.
    */
    const verpasstHier = verpassteTermine
      .filter((v) => v.slug === entry.slug && v.episode != null)
      .sort((a, b) => a.erwartetAm.localeCompare(b.erwartetAm))
    if (verpasstHier.length) {
      schedule.verpasst = Object.fromEntries(
        verpasstHier.map((v) => [
          v.episode as number,
          {
            erwartetAm: v.erwartetAm,
            ...(v.erschienenAm ? { erschienenAm: v.erschienenAm } : {}),
            ...(v.verzugStunden != null ? { verzugStunden: v.verzugStunden } : {}),
            ...(v.folgenVerfuegbar != null ? { folgenVerfuegbar: v.folgenVerfuegbar } : {}),
            ...(v.neuErwartet ? { neuErwartet: v.neuErwartet } : {}),
            ...(v.recherche ? { recherche: v.recherche } : {}),
            ...(v.recherche && v.rechercheQuelle ? { rechercheQuelle: v.rechercheQuelle } : {}),
            ...(v.rechercheAm ? { rechercheAm: v.rechercheAm } : {}),
            ...(v.geprueftAm ? { geprueftAm: v.geprueftAm } : {}),
            ...(v.newsGeprueftAm ? { newsGeprueftAm: v.newsGeprueftAm } : {}),
            ...(v.hinweise?.length ? { hinweise: v.hinweise } : {}),
          },
        ]),
      )
    }
    const releaseYear = Number(entry.schedule.firstEpisodeDate.slice(0, 4))
    if (!schedule.episodeCount && entry.releaseType === 'weekly') {
      // Folgenzahl nur übernehmen, wenn der verknüpfte AniList-Eintrag zeitlich
      // zum deutschen Termin passt — sonst stammt sie aus der falschen Staffel.
      const jpYear = title?.jpYear
      if (title?.episodes && jpYear && Math.abs(jpYear - releaseYear) <= 1) {
        schedule.episodeCount = title.episodes
      } else if (title?.episodes) {
        warn(
          `"${entry.slug}": Folgenzahl von AniList verworfen (Titel von ${jpYear}, Release ${releaseYear})`,
        )
      }
      // Zweiter Versuch bei aniSearch, bevor geraten wird.
      const ausAnisearch = schedule.episodeCount ? undefined : anisearchEpisodes(title?.id)
      if (ausAnisearch) {
        schedule.episodeCount = ausAnisearch.count
        schedule.episodeCountSource = 'anisearch'
        if (ausAnisearch.estimated) schedule.episodeCountAssumed = true
      }
      // Ohne belegte Folgenzahl wird eine Standardstaffel angenommen — das steht
      // als Flag im Datensatz, damit die Oberfläche es nicht als Fakt ausgibt.
      if (!schedule.episodeCount) {
        schedule.episodeCount = 12
        schedule.episodeCountAssumed = true
      }
    }

    const name = entry.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? entry.slug
    const fsk = entry.fsk ?? info?.fsk ?? title?.fsk
    const platformUrl = pickPlatformUrl(entry, title)

    // Angaben aus dem Crunchyroll-Kalender einsetzen. Sie kommen direkt vom
    // Anbieter und schlagen deshalb jede abgeleitete Angabe.
    const sources = [...(entry.sources ?? [])]
    let durchzaehlungHinweis: string | undefined
    if (entry.platform === 'crunchyroll') {
      const slot = findCrunchyroll(platformUrl, entry.titleDe ?? name)
      if (slot) {
        usedCrKeys.add(normalizeTitle(slot.rawTitle))
        if (!entry.schedule.time) schedule.time = slot.time

        // Der wichtigste Teil: Die deutsche Synchro startet oft Wochen NACH
        // dem Simulcast. Die kuratierten Daten stammen aus Saisonübersichten
        // und nennen nur den Simulcast-Start — real gemessen bis zu drei
        // Wochen zu früh (08.08.2026 vom Nutzer gemeldet: „Though I Am an
        // Inept Villainess" stand auf dem 12.07., Folge 1 lief am 02.08.).
        // Ist der Termin nur abgeleitet, gewinnt der beobachtete Sendeplan.
        const observed = derivedStart(slot)
        if (observed && entry.schedule.estimated) {
          schedule.firstEpisodeDate = observed.date
          schedule.estimated = observed.assumed
          if (!observed.assumed) delete schedule.estimated
        }
        // Gesehene Einzeltermine gewinnen gegen jede Hochrechnung — und der
        // Mensch gegen den Kalender, der von einem Mehrfachstart nur eine
        // Kachel zeigt.
        const seen = beobachtungenZusammenfuehren(observedEpisodes(slot), entry.schedule.observed)
        if (seen) schedule.observed = seen
        /**
         * Dieselbe durchlaufende Zählung wie unten bei den automatisch
         * ergänzten Simuldubs — und aus demselben Grund angefasst: Ein Start,
         * der ohnehin nur abgeleitet ist (`estimated`), darf nicht auf einer
         * Folge 1 stehen, die es in diesem Release gar nicht gibt.
         *
         * Angerührt wird nur, was der Kalender selbst hergeleitet hat. Eine von
         * Hand gesetzte Startnummer bleibt, wie überall in diesem Projekt.
         */
        if (entry.schedule.estimated && !entry.schedule.firstEpisodeNumber) {
          const durchgezaehlt = durchlaufendeZaehlung(
            seen,
            schedule.episodeCountAssumed ? undefined : schedule.episodeCount,
            crKalenderBis,
          )
          if (durchgezaehlt) {
            schedule.firstEpisodeNumber = durchgezaehlt.firstEpisodeNumber
            schedule.firstEpisodeDate = durchgezaehlt.firstEpisodeDate
            schedule.episodeCount = durchgezaehlt.episodeCount
            delete schedule.episodeCountAssumed
            delete schedule.episodeCountSource
            durchzaehlungHinweis = durchgezaehlt.note
          }
        }
        sources.push(CR_CALENDAR_URL)
      } else if (
        entry.schedule.estimated &&
        crunchyroll.window &&
        overlapsWindow(schedule, crunchyroll.window) &&
        (schedule.firstEpisodeDate ?? '') <= todayIso()
      ) {
        // Die Serie müsste im abgesuchten Zeitraum laufen, und der Kalender
        // führt dort keine deutsche Folge. Dann gibt es die Synchro nicht —
        // ein erfundener Sendeplan wäre schlimmer als gar keiner.
        //
        // **Aber nur für einen Start, der schon war** (21.09.2026). Das
        // Kalenderfenster reicht zwei Wochen in die Zukunft, und Crunchyroll
        // trägt deutsche Termine oft erst kurz vorher ein. In der Nacht zum
        // 21.09. brachen deshalb zwei Bauläufe ab: „Black Clover" Staffel 2
        // (Start 03.10.) und „Die Tagebücher der Apothekerin" Staffel 3 (Start
        // 01.10.) standen noch nicht im Kalender, wurden verworfen und fielen
        // aus dem Datensatz. Ein künftiger Termin, den noch niemand zeigt, ist
        // nicht widerlegt — er bleibt als Schätzung stehen, bis der Kalender
        // ihn bestätigt oder sein Tag ohne Eintrag verstreicht.
        warn(
          `"${entry.slug}": kein deutscher Eintrag bei Crunchyroll im Zeitraum ` +
            `${crunchyroll.window.from}…${crunchyroll.window.to} (Start ${schedule.firstEpisodeDate}) — verworfen`,
        )
        unverified.push(entry.slug)
        continue
      }
    }

    if (title && fsk !== undefined && title.fsk === undefined) title.fsk = fsk
    if (title && entry.titleDe && !title.titleDe) title.titleDe = werkTitel(entry.titleDe)

    releases.push({
      slug: entry.slug,
      titleId: titleId ?? -1,
      name,
      platform: entry.platform,
      ...(entry.sender ? { sender: entry.sender } : {}),
      platformUrl,
      buyUrl:
        entry.buyUrl ?? (entry.releaseType === 'disc' ? amazonSearchUrl(name) : undefined),
      releaseType: entry.releaseType,
      fsk,
      publisher: entry.publisher,
      edition: entry.edition,
      note: entry.note,
      ...(entry.schnitt ? { schnitt: entry.schnitt } : {}),
      herkunft: entry.herkunft ?? durchzaehlungHinweis,
      disputedDates: entry.disputedDates,
      schedule,
      // Aus dem Termin, der am Ende dasteht — nicht aus dem kuratierten. Der
      // Kalender kann ihn verschoben haben, und über den Jahresfilter der
      // Oberfläche entscheidet der ausgelieferte Termin.
      year: Number(schedule.firstEpisodeDate.slice(0, 4)),
      sources: [...new Set(sources)],
    })
  }
  return { usedCrKeys, seenSlugs, releases, unverified }
}
