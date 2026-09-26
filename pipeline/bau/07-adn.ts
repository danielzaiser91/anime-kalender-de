import {
  type AdnData,
  passtZuSerie,
  staffelBloecke,
  staffelnDesFranchise,
  ordneBloeckeZuStaffeln,
  alsEinBlock,
} from '../lib/adn.ts'
import { readJson, log, warn } from '../lib/util.ts'
import { normalizeTitle } from '../lib/crunchyroll.ts'
import { adnSlug, adnBlockName, fskFromAdnAge, adnHinweis, werkTitel } from './titel-hilfen.ts'
import { ADN_CALENDAR_URL } from './grundlagen.ts'
import { type Title, type Release } from '../../shared/types.ts'

export function ergaenzeAdnTitel({ titles, releases, titleByName, seenSlugs }: {
  titles: Map<number, Title>
  releases: Release[]
  titleByName: Map<string, Title>
  seenSlugs: Set<string>
}) {
  /** ADN-Verweise, die aus einem ADN-Termin entstehen (der Termin belegt die Synchro). */
  let adnVerweiseErgaenzt = 0
  // ADN nennt in seiner Schnittstelle je Folge die Sprachfassung. Was dort als
  // `vde` steht, ist eine belegte deutsche Synchro mit belegter Uhrzeit — hier
  // muss nichts abgeleitet werden. Kuratierte Einträge haben Vorrang: Wer eine
  // ADN-Adresse von Hand gepflegt hat, will keinen zweiten Eintrag daneben.
  const leer: AdnData = { scrapedAt: '', window: { from: '', to: '' }, shows: [] }
  const adnKalender = readJson<AdnData>('data/adn.json', leer)
  // Der Katalog-Lauf (`data:adn -- --catalog`) findet Serien, die vollständig
  // im Angebot liegen und deshalb in keinem Kalenderfenster mehr auftauchen.
  // Er läuft selten; fehlt die Datei, ändert sich nichts.
  const adnKatalog = readJson<AdnData>('data/adn-catalog.json', leer)
  /* Eine Katalogzuordnung muss den Namen tragen, nicht nur ein Werkwort — siehe `WERKWOERTER`
     in lib/adn.ts. Der Katalog wird nur alle paar Wochen neu nachgeschlagen; bis dahin
     fängt der Bau die falschen Zuordnungen selbst ab. */
  for (const show of adnKatalog.shows) {
    const t = show.anilistId ? titles.get(show.anilistId) : undefined
    if (!t || passtZuSerie(show, { title: { romaji: t.titleRomaji, english: t.titleEn, native: t.titleNative } })) continue
    log(`ADN-Katalog ${show.showId} („${show.title}“) gehört nicht zu AniList ${t.id} („${t.titleRomaji}“) — Zuordnung verworfen`)
    show.anilistId = undefined
  }
  const adn: AdnData = {
    ...adnKalender,
    shows: [
      ...adnKalender.shows,
      // Der Kalender ist die frischere Quelle — was dort schon steht, gewinnt.
      ...adnKatalog.shows.filter((k) => !adnKalender.shows.some((s) => s.showId === k.showId)),
    ],
  }
  const curatedAdnShows = new Set(
    releases
      .filter((r) => r.platform === 'adn')
      .map((r) => normalizeTitle(r.name)),
  )
  let adnAdded = 0
  let adnBloecke = 0
  /**
   * Kein Anime zweimal aus ADN — **über alle Serien hinweg**.
   *
   * Diese Sperre stand bis zum 17.08.2026 innerhalb der Schleife und wirkte
   * deshalb nur je Serienkennung. Über zwei Kennungen hinweg griff sie nicht,
   * und genau das brach den Wochenlauf: ADN führt „To Love-Ru" unter zwei
   * Kennungen (217 und 670), beide mit 26 Folgen, und beide ordneten sich
   * demselben AniList-Eintrag 3455 zu. Die Prüfung im Build meldete zu Recht
   * „zusammen 52 Folgen bei 26 vorhandenen" und brach ab — womit der ganze
   * Wochenlauf nichts schrieb, dreimal in Folge seit dem 10.08.2026.
   *
   * Der Kommentar an der Sperre war immer richtig: Ein Titel mit zwei
   * widersprüchlichen Folgenzahlen ist schlimmer als ein fehlender Eintrag. Nur
   * der Gültigkeitsbereich war zu eng.
   */
  const belegteTitel = new Set<number>()
  /**
   * Wem ein Titel aus eigener Kennung zusteht — der starke Anspruch.
   *
   * Zwei Wege führen im Folgenden zu einem Titel: die im Katalogabruf
   * nachgeschlagene `anilistId` der Serie, und ein Treffer über die Folgenzahl
   * innerhalb der Reihe. Der erste ist eine Zuordnung, der zweite eine Schätzung
   * — und die Schätzung einer Serie darf der Zuordnung einer anderen nicht
   * zuvorkommen.
   *
   * Genau das passierte am 17.08.2026: Ein Ein-Folgen-Block landete über die
   * Folgenzahl auf „ONE PIECE", und als die echte One-Piece-Serie an die Reihe
   * kam, war ihr eigener Titel vergeben — alle sieben Sagas fielen heraus.
   */
  const starkerAnspruch = new Map<number, number>()
  for (const show of adn.shows) {
    const eigen = show.anilistId ? titles.get(show.anilistId) : undefined
    if (eigen && !starkerAnspruch.has(eigen.id)) starkerAnspruch.set(eigen.id, show.showId)
  }
  for (const show of adn.shows) {
    if (!show.episodes.length) continue
    if (curatedAdnShows.has(normalizeTitle(show.title))) continue

    // Die im Katalog-Lauf nachgeschlagene Kennung zuerst — sie trifft auch,
    // wo der Namensabgleich an Schreibweisen scheitert.
    const serienTitel =
      (show.anilistId ? titles.get(show.anilistId) : undefined) ??
      titleByName.get(normalizeTitle(show.title)) ??
      titleByName.get(normalizeTitle(show.originalTitle ?? ''))
    // Aus dem Katalogdurchlauf nur, was sich einem Anime zuordnen lässt: Der
    // Katalog führt den französischen Bestand, und ohne Zuordnung bliebe der
    // französische Name stehen, dazu ohne Cover, Genres und Beschreibung.
    // Beim Kalender-Weg ist der Name belegt, dort bleibt der Eintrag auch ohne
    // Treffer.
    if (!serienTitel && show.fromCatalog) continue

    /**
     * Eine ADN-Serienkennung ist ein Franchise, keine Staffel.
     *
     * Bis zum 12.08.2026 wurde je Serie **ein** Release gebaut. Für „Sword Art
     * Online" hieß das: ein Eintrag mit 96 Folgen, deren Nummern zweimal bei 1
     * neu anfangen, unter dem Namen der ersten Staffel — und, weil zwei
     * Abwurftermine nicht als Komplettabwurf erkannt wurden, mit 96
     * Wochenterminen bis 2027. Neun der 37 ADN-Serien führen mehrere Staffeln
     * unter einer Kennung.
     */
    let bloecke = staffelBloecke(show)
    /**
     * Ein einzelner Block braucht keine Staffelsuche — er **ist** die Serie.
     *
     * `ordneBloeckeZuStaffeln` ordnet über die Folgenzahl innerhalb der Reihe zu,
     * und das ist für einen Film die falsche Frage. Die acht One-Piece-Filme haben
     * je eine Folge; die Suche fand darum bei allen achten denselben Reihenteil
     * mit einer Folge — „MONSTERS: Ippaku Sanjou Hiryuu Jigoku", den Pilotfilm von
     * 1998 — und überschrieb damit die Zuordnung, die der Katalogabruf für jeden
     * Film einzeln und richtig nachgeschlagen hatte (17.08.2026).
     *
     * Steht die Kennung fest, gibt es nur einen Block, **und passt dessen
     * Folgenzahl in den Titel**, dann gewinnt die Kennung. Alle drei Bedingungen
     * sind nötig: „To Love-Ru - Darkness" kommt bei ADN als **ein** Block mit 26
     * Folgen, während der AniList-Eintrag 12 hat — dort umfasst ein einzelner
     * Block eben doch mehrere Staffeln, und die Suche muss laufen, sonst behauptet
     * der Datensatz 26 Folgen für einen Zwölfteiler.
     */
    const passtInDenTitel =
      bloecke.length === 1 &&
      serienTitel?.episodes !== undefined &&
      bloecke[0].episodes.length <= serienTitel.episodes
    const staffeln =
      !passtInDenTitel && serienTitel?.franchiseId
        ? staffelnDesFranchise(titles.values(), serienTitel.franchiseId)
        : []
    let zuordnungen = ordneBloeckeZuStaffeln(bloecke, staffeln)
    /**
     * Lieferwellen sind keine Staffeln.
     *
     * Findet die Suche für **keinen** Block einen eigenen Reihenteil, dann haben
     * die Schnitte nichts bedeutet — alle Blöcke zeigen auf denselben Titel, und
     * die Sperre gegen doppelte Titel behält den ersten und wirft den Rest weg.
     * Bei One Piece kostete das 505 der 515 belegten deutschen Folgen: ADN teilt
     * sie in zwölf „Sagas", AniList kennt für die Serie einen einzigen Eintrag.
     *
     * Ein Release über alles ist dann die ehrlichere Auskunft als eines über den
     * ersten Zehntel. Der Slug bleibt dabei `adn-<id>` — dieselbe Adresse wie bei
     * jeder anderen einblockigen Serie.
     */
    if (bloecke.length > 1 && zuordnungen.every((z) => !z.teile.length)) {
      bloecke = [alsEinBlock(show)]
      zuordnungen = ordneBloeckeZuStaffeln(bloecke, staffeln)
    }
    adnBloecke += bloecke.length
    // Nur wenn es bei einem einzigen Block bleibt, behält das Release seinen
    // alten Slug — geteilte Links und Merklisten sollen nicht ins Leere laufen.
    const einBlock = bloecke.length === 1
    /**
     * Kein Anime zweimal in derselben ADN-Serie.
     *
     * Ohne diese Sperre landete „Sailor Moon" doppelt im Datensatz: Staffel 1
     * mit 46 Folgen und Staffel 2 mit 42, beide auf AniList 530 gezeigt, weil
     * der Rückfall auf den Serientitel keine Rücksicht darauf nahm, dass der
     * längst vergeben war. Ein Titel mit zwei widersprüchlichen Folgenzahlen
     * ist schlimmer als ein fehlender Eintrag.
     */

    for (const { block, teile, unscharf } of zuordnungen) {
      // Ohne aufgehende Rechnung deckt der Block genau einen Titel ab: den der
      // Serie. Lieber eine gröbere Zuordnung als eine falsche.
      const abschnitte = teile.length
        ? teile
        : [{ title: serienTitel, adnVon: block.nummern[0] ?? 1, adnBis: block.nummern.at(-1) ?? block.episodes.length }]

      for (const abschnitt of abschnitte) {
        const title = abschnitt.title
        if (title && belegteTitel.has(title.id)) {
          warn(
            `ADN ${show.showId} (${show.title}): Staffel ${block.season ?? '?'} mit ${block.episodes.length} Folgen ` +
              `zeigt auf "${title.titleRomaji ?? title.id}", der schon aus einer anderen ADN-Serie stammt — übersprungen.`,
          )
          continue
        }
        // Der Titel gehört einer anderen Serie aus deren eigener Kennung. Ihn
        // über einen Folgenzahl-Treffer wegzunehmen hieße, eine Schätzung gegen
        // eine Zuordnung zu stellen.
        const inhaber = title ? starkerAnspruch.get(title.id) : undefined
        if (inhaber !== undefined && inhaber !== show.showId) {
          warn(
            `ADN ${show.showId} (${show.title}): Staffel ${block.season ?? '?'} mit ${block.episodes.length} Folgen ` +
              `zeigt auf "${title!.titleRomaji ?? title!.id}", der laut Katalog zu ADN ${inhaber} gehört — übersprungen.`,
          )
          continue
        }
        if (title) belegteTitel.add(title.id)
        const slug = adnSlug(show.showId, block, teile.length > 1 ? title?.id : undefined, einBlock)
        if (seenSlugs.has(slug)) continue
        seenSlugs.add(slug)

        // Der Ton ist deutsch — der Name von ADN oft nicht. „One Piece Film 3 •
        // Le Royaume de Chopper" heißt hier „One Piece – Chopper auf der Insel
        // der seltsamen Tiere". Für Katalogtitel gewinnt deshalb der
        // Anime-Eintrag; er nennt außerdem die Staffel beim Namen, während ADN
        // nur „3" schreibt.
        const anzeigename =
          (show.fromCatalog || teile.length) && title
            ? (title.titleDe ?? title.titleEn ?? title.titleRomaji ?? show.title)
            : adnBlockName(show.title, block, bloecke.length)

        const folgen = block.episodes.filter(
          (e) => !teile.length || ((e.episode ?? 0) >= abschnitt.adnVon && (e.episode ?? 0) <= abschnitt.adnBis),
        )
        if (!folgen.length) continue
        const first = folgen[0]
        const letzte = folgen.at(-1)!
        const anzahl = new Set(folgen.map((e) => e.episode ?? e.url)).size

        releases.push({
          slug,
          titleId: title?.id ?? -1,
          name: anzeigename,
          platform: 'adn',
          platformUrl: first.url,
          releaseType: block.rhythm === 'weekly' ? 'weekly' : 'batch',
          /**
           * Was das Datum bedeutet — und was es ausdrücklich nicht bedeutet.
           *
           * Bei einem Wochentakt ist der Termin der Sendeplan, also die
           * Erstveröffentlichung. Bei einem Komplettabwurf weiß ADN nur, wann
           * der Titel ins Angebot kam: „Sword Art Online" am 11.06.2025,
           * obwohl es die deutsche Fassung seit 2013 gibt. „Im Angebot seit"
           * ist in beiden Fällen wahr, „erschienen am" wäre geraten.
           */
          dateMeaning: block.rhythm === 'weekly' ? undefined : 'available-from',
          fsk: title?.fsk ?? fskFromAdnAge(show.age),
          herkunft: adnHinweis(block, abschnitt, teile.length, anzahl, title, unscharf),
          schedule: {
            firstEpisodeDate: first.date,
            time: first.time,
            episodeCount: anzahl,
            lastEpisodeDate: letzte.date,
          },
          year: Number(first.date.slice(0, 4)),
          sources: [ADN_CALENDAR_URL],
        })
        /*
          **Ein ADN-Termin belegt die Synchro — also gehört ein ADN-Verweis dazu.** Der Termin
          entsteht nur aus Folgen mit `vde`. „Undefeated Bahamut Chronicle" hatte trotzdem keinen
          Verweis: Das Panel zeigte „Noch keine deutsche Fassung" und darunter eine Termin-Pille
          mit dem Seriennamen, die auf Folge 1 führte (Daniel, 16.09.2026). Der Verweis zeigt auf
          die Serienseite, nicht auf die Folge; Handbelege greifen weiter unten wie bei jedem
          anderen Verweis.
        */
        if (title && !title.streams.some((s) => s.platform === 'adn')) {
          title.streams.push({ platform: 'adn', url: first.url.replace(/(\/video\/[^/]+)\/\d+-[^/]*$/, '$1'), dub: true })
          adnVerweiseErgaenzt++
        }
        /**
         * ADNs Titel ist der deutsche — er wird zum Suchbegriff.
         *
         * Seit dem 24.08.2026 fragt `fetch-adn.ts` mit `Accept-Language: de`,
         * und seither heißt Serie 1331 nicht mehr „Hero Without a Class: Who
         * Even Needs Skills?!", sondern „Der Held ohne Klasse: Der Aufstieg
         * eines Talentlosen". Genau danach hat Daniel gesucht und nichts
         * gefunden — der Titel stand im Kalender, aber unter seinem japanischen
         * Namen, und `titleDe` war leer.
         *
         * Die Suche im Frontend liest `titleDe` bereits (`web/src/lib/filters.ts`).
         * Es fehlte nur der Wert: 99 von 2.762 Titeln hatten einen.
         *
         * **Ein vorhandener Wert wird nicht angetastet.** Ein von Hand oder aus
         * einer kuratierten Quelle gesetzter Titel ist verlässlicher als der
         * eines Anbieters, der ihn nach eigenem Geschmack schreibt.
         */
        if (title && show.title && !title.titleDe) title.titleDe = werkTitel(show.title)
        adnAdded++
      }
    }
  }
  if (adn.shows.length)
    log(
      `${adnAdded} ADN-Releases aus ${adnBloecke} Staffelblöcken ergänzt (${adn.shows.length} Serien gefunden)`,
    )

  /**
   * **Ist der Teil selbst der Eintrag, gehört seine Nummer in den Namen** (22.09.2026).
   *
   * `werkTitel()` schneidet „– Teil N" ab, damit ein Block nicht wie das Werk heißt. Führt AniList
   * den Teil aber als eigenen Eintrag („Girls und Panzer das Finale - Part 4", „BEASTARS Final
   * Season Part 2"), ist die Nummer der Name des Werks. Gemessen am selben Tag: 20 Titel verloren
   * sie, darunter zweimal „Pretty Guardian Sailor Moon Eternal: Der Film" und zweimal „Beastars
   * Letzte Staffel" — zwei Einträge, ein Name. Anlass: Teil 4 von Girls und Panzer: Das Finale
   * hieß ohne Nummer neben „Teil 1" bis „Teil 3" (Daniel an der Videoload-Suche).
   */
  let teilNamen = 0
  for (const title of titles.values()) {
    if (!title.titleDe) continue
    const quelle = [title.titleEn, title.titleRomaji].find((s) => /(?:part|teil|vol\.?|volume)\s*\d+\s*$/i.test(s ?? ''))
    const nr = quelle?.match(/(\d+)\s*$/)?.[1]
    if (!nr || new RegExp(`\\b${nr}\\b`).test(title.titleDe)) continue
    title.titleDe = `${title.titleDe} – Teil ${nr}`
    teilNamen++
  }
  if (teilNamen) log(`${teilNamen} deutsche Namen um ihre Teilnummer ergänzt (der Teil ist der Eintrag)`)
  return { adnKatalog, adnVerweiseErgaenzt }
}
