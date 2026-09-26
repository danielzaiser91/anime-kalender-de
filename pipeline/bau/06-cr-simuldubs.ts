import { slugify, log, warn } from '../lib/util.ts'
import { werkTitel, derivedStart, observedEpisodes } from './titel-hilfen.ts'
import {
  normalizeTitle,
  durchlaufendeZaehlung,
  beobachtungenZusammenfuehren,
  type CrunchyrollData,
} from '../lib/crunchyroll.ts'
import { CR_CALENDAR_URL } from './grundlagen.ts'
import { type Title, type Release } from '../../shared/types.ts'

export function ergaenzeCrSimuldubs({
  crunchyroll,
  usedCrKeys,
  titleForCalendarName,
  titleFromSeries,
  titelAusKatalog,
  seenSlugs,
  releases,
  anisearchEpisodes,
  crKalenderBis,
  unverified,
}: {
  crunchyroll: CrunchyrollData
  usedCrKeys: Set<string>
  titleForCalendarName: (name: string) => Title | undefined
  titleFromSeries: (seriesId: string, calendarName: string, year: number) => Title | undefined
  titelAusKatalog: (name: string) => Title | undefined
  seenSlugs: Set<string>
  releases: Release[]
  anisearchEpisodes: (titleId: number | undefined) => { count: number; estimated: boolean; } | undefined
  crKalenderBis: string | undefined
  unverified: string[]
}) {
  // Alles, was der Kalender von Crunchyroll als „(Deutsch)" führt und noch
  // nicht kuratiert ist, wird selbsttätig aufgenommen. Der Staffelstart wird
  // aus der frühesten gesehenen Folgennummer zurückgerechnet.
  let autoAdded = 0
  for (const [key, slot] of Object.entries(crunchyroll.german)) {
    if (usedCrKeys.has(key)) continue
    if (!slot.earliest?.date) continue

    const name = slot.rawTitle.replace(/\s*\(Deutsch\)\s*$/i, '').trim()
    // Erst über den vollen Namen, dann über die Serien-ID.
    //
    // Der Kalender nennt bei Specials die Serie UND den Untertitel — „My Hero
    // Academia I am a hero too". Dafür gibt es bei AniList einen eigenen
    // Eintrag, und der normalisierte Name trifft ihn genau. Die Serien-ID
    // dagegen zeigt bei Crunchyroll für alle Staffeln und Specials auf
    // dieselbe Serie; welcher AniList-Titel dahinter landete, entschied die
    // Reihenfolge in der Map. So wurde aus dem Special die sechste Staffel.
    const title =
      titleForCalendarName(name) ??
      (slot.seriesId
        ? titleFromSeries(slot.seriesId, name, Number(slot.earliest.date.slice(0, 4)))
        : undefined) ??
      // Zuletzt der Katalog: Was wir haben, geht nicht verloren, nur weil die
      // Namenssuche über den Bestand nichts fand.
      titelAusKatalog(name)
    const slug = `cr-${slot.seriesId ?? slugify(key)}`
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    /**
     * Der deutsche Name, den Crunchyroll selbst verwendet, gehört an den Titel.
     *
     * Er war die ganze Zeit da — als Name des Releases — aber nicht am Anime,
     * und deshalb nicht durchsuchbar: Eine Suche nach „Meine Wiedergeburt als
     * Schleim" fand nichts, obwohl der Kalender genau diesen Namen anzeigt
     * (aufgefallen 12.08.2026 beim Bau der Suche). Nur 84 von 2.753 Titeln
     * hatten überhaupt einen deutschen Namen, und alle aus Handarbeit.
     *
     * Bedingung: Es darf noch keiner da sein — Handarbeit gewinnt — und der
     * Name muss sich vom englischen unterscheiden, sonst behaupten wir eine
     * Übersetzung, wo Crunchyroll nur den Originaltitel führt.
     */
    if (title && !title.titleDe) {
      const werk = werkTitel(name)
      if (werk && normalizeTitle(werk) !== normalizeTitle(title.titleEn ?? '') && normalizeTitle(werk) !== normalizeTitle(title.titleRomaji ?? '')) {
        title.titleDe = werk
      }
    }

    // Ein einziger Termin ist kein Beleg für einen Wochentakt.
    //
    // Im selben Kalender stehen Specials, Filmpremieren und die Anime Awards.
    // Sie sehen dort aus wie eine Serienfolge; der einzige Unterschied ist,
    // dass es bei ihnen bei einem Termin bleibt. Ohne diese Unterscheidung
    // wurde aus jedem davon eine Reihe von mindestens zwölf Folgen, und der
    // Kalender behauptete Woche für Woche eine Folge, die es nicht gibt.
    // Genau so kam „I am a hero too" zu elf erfundenen Terminen.
    //
    // Der eine Termin allein reicht als Merkmal aber nicht: Eine Serie, die
    // gerade erst anläuft, hat im Kalenderfenster ebenfalls nur einen. Deshalb
    // zählt zusätzlich, was AniList über die Folgenzahl sagt — steht dort eine
    // belegte Zahl über eins, ist es eine Reihe, egal wie viele Termine das
    // Fenster gerade zeigt.
    const seenDates = [...new Set(slot.dates ?? [])]
    const knownEpisodes =
      title?.episodes && title.jpYear
        ? Math.abs(title.jpYear - Number(slot.earliest.date.slice(0, 4))) <= 1
          ? title.episodes
          : undefined
        : undefined
    if (seenDates.length < 2 && (knownEpisodes ?? 1) === 1) {
      const date = slot.earliest.date
      releases.push({
        slug,
        titleId: title?.id ?? -1,
        name,
        platform: 'crunchyroll',
        platformUrl: slot.seriesUrl,
        releaseType: 'batch',
        fsk: title?.fsk,
        herkunft: 'Crunchyroll führt dazu bisher genau einen deutschen Termin.',
        schedule: { firstEpisodeDate: date, time: slot.time, episodeCount: 1 },
        year: Number(date.slice(0, 4)),
        sources: [CR_CALENDAR_URL],
      })
      autoAdded++
      continue
    }

    const derived = derivedStart(slot)
    if (!derived) continue
    let firstEpisodeDate = derived.date
    let releaseYear = Number(firstEpisodeDate.slice(0, 4))

    let episodeCount = title?.episodes
    let episodeCountAssumed = false
    let episodeCountSource: 'anisearch' | undefined
    if (!episodeCount || !title?.jpYear || Math.abs(title.jpYear - releaseYear) > 1) {
      // Die Reihe läuft, aber wie lang sie wird, sagt der Kalender nicht.
      // aniSearch pflegt die Zahl — sonst bleibt zwölf als übliche Cour-Länge.
      // Die Untergrenze ist in beiden Fällen das, was tatsächlich gesehen
      // wurde: sonst fielen belegte Termine hinten heraus.
      const mindestens = (slot.earliest.episode ?? 1) + seenDates.length
      const ausAnisearch = anisearchEpisodes(title?.id)
      episodeCount = Math.max(ausAnisearch?.count ?? 12, mindestens)
      // Nicht mehr geraten, sobald aniSearch die Zahl bestätigt — und sie
      // durch die Untergrenze nicht nach oben korrigiert werden musste.
      episodeCountAssumed =
        !ausAnisearch || ausAnisearch.estimated || episodeCount !== ausAnisearch.count
      if (ausAnisearch && episodeCount === ausAnisearch.count) episodeCountSource = 'anisearch'
    }

    /**
     * Crunchyroll zählt die Reihe durch, AniList je Staffel.
     *
     * Steht die kleinste gesehene Folgennummer über dem, was die Staffel
     * hergibt, gehört sie zu keiner Zählung ab Folge 1 — dann ist der oben
     * zurückgerechnete Start eine Erfindung. Als belegte Staffellänge zählt
     * dabei nur eine, die nicht selbst geraten ist; die Untergrenze aus den
     * Beobachtungen wäre ein Zirkelschluss.
     */
    const beobachtet = observedEpisodes(slot)
    let note: string | undefined
    let firstEpisodeNumber: number | undefined
    const durchgezaehlt = durchlaufendeZaehlung(
      beobachtet,
      episodeCountAssumed ? undefined : episodeCount,
      crKalenderBis,
    )
    if (durchgezaehlt) {
      firstEpisodeNumber = durchgezaehlt.firstEpisodeNumber
      firstEpisodeDate = durchgezaehlt.firstEpisodeDate
      releaseYear = Number(firstEpisodeDate.slice(0, 4))
      episodeCount = durchgezaehlt.episodeCount
      episodeCountAssumed = false
      episodeCountSource = undefined
      note = durchgezaehlt.note
    }

    releases.push({
      slug,
      titleId: title?.id ?? -1,
      name,
      platform: 'crunchyroll',
      platformUrl: slot.seriesUrl,
      releaseType: 'weekly',
      fsk: title?.fsk,
      herkunft: note,
      schedule: {
        firstEpisodeDate,
        firstEpisodeNumber,
        time: slot.time,
        episodeCount,
        episodeCountAssumed,
        episodeCountSource,
        // Uhrzeit und Wochentag sind belegt; nur der zurückgerechnete Start
        // bleibt eine Annahme, solange die Wochentaktung nicht bestätigt ist.
        estimated: derived.assumed,
        // Hier gibt es nichts zusammenzuführen: In diese Schleife kommt nur,
        // wozu kein kuratierter Eintrag existiert (`usedCrKeys`). Der Aufruf
        // steht trotzdem hier, damit ohne nummerierte Kachel kein leeres Feld
        // im Datensatz landet — und damit die Regel an beiden Stellen dieselbe
        // ist, falls je ein kuratierter Eintrag hierher durchfällt.
        observed: beobachtungenZusammenfuehren(beobachtet, undefined),
      },
      year: releaseYear,
      sources: [CR_CALENDAR_URL],
    })
    autoAdded++
  }
  log(`${autoAdded} Simuldubs automatisch aus dem Crunchyroll-Kalender ergänzt`)
  if (unverified.length) log(`${unverified.length} kuratierte Termine verworfen (unbestätigt): ${unverified.join(', ')}`)

  // Abgeleitete Termine, für die es keine maschinelle Gegenprüfung gibt.
  //
  // Für Crunchyroll und ADN lesen wir den Kalender und können eine behauptete
  // Synchro widerlegen. Für Netflix, Prime Video und Disney+ gibt es diese
  // Möglichkeit nicht — dort bleibt ein `estimated: true` für immer stehen, und
  // niemand merkt, wenn die angekündigte Fassung nie erscheint. Genau so kam
  // „Mushoku Tensei Staffel 3" in den Kalender (10.08.2026): Die Quelle war
  // eine Simulcast-Übersicht, und ein Simulcast sagt nur, wann eine Folge
  // zeitgleich mit Japan läuft — nicht, ob sie deutsch vertont ist.
  const ungeprueft = releases.filter(
    (r) => r.schedule.estimated && !['crunchyroll', 'adn'].includes(r.platform),
  )
  if (ungeprueft.length) {
    warn(
      `${ungeprueft.length} abgeleitete Termine ohne Gegenprüfung (Plattform hat keinen Kalender, den wir lesen) — ` +
        `von Hand belegen oder streichen: ${ungeprueft.map((r) => r.slug).join(', ')}`,
    )
  }
}
