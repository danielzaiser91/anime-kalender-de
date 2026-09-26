import { anisearchHand, kinoFeld, OUT, NEIN_GILT_TAGE, type EntfernterVerweis } from './grundlagen.ts'
import { writeJson, readJson, warn, log } from '../lib/util.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { adressKern } from '../lib/dub-confirmed.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'
import { type SynopsisEintrag } from './13-1-anreichern.ts'

/** Ein Titel, wie er ausgeliefert wird (`titles.json`). */
export type SlimTitel = ReturnType<typeof baueAuslieferung>['slim'][number]

export function baueAuslieferung({
  allTitles,
  anisearch,
  tmdbTitles,
  trenneQuelle,
  synopses,
  mitStimmen,
  annKennungen,
  trailer,
  releases,
  verschoben,
  verweiseEntfernt,
}: {
  allTitles: Title[]
  anisearch: Record<string, AnisearchEintrag>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  trenneQuelle: (text: string) => { text: string; url?: string; }
  synopses: Record<number, SynopsisEintrag>
  mitStimmen: Set<number>
  annKennungen: Record<string, number>
  trailer: Record<string, { video: string; titel: string; sprache?: 'de' | 'en' | 'ja'; }>
  releases: Release[]
  verschoben: Title[]
  verweiseEntfernt: EntfernterVerweis[]
}) {
  const slim = allTitles.map((t) => {
    const ausAnisearch = anisearch[t.id]?.descriptionDe
    const ausTmdb = tmdbTitles[t.id]
    if (t.synopsis || ausAnisearch || ausTmdb?.overviewDe) {
      const eintrag: SynopsisEintrag = { en: t.synopsis }
      if (ausAnisearch) {
        const { text, url } = trenneQuelle(ausAnisearch)
        eintrag.de = text
        /*
          **Ein Quellenverweis führt zum Werk, nicht in ein Verzeichnis.**

          Der Rückfall lautete `anisearch.de/anime/` — die Anime-Übersicht der
          ganzen Seite, für 221 von 2.497 Verweisen (gemessen 12.09.2026). Wer
          dort klickt, sucht danach von Hand weiter; die Angabe „Quelle:
          aniSearch" wird damit unüberprüfbar.

          Die Kennung liegt im Haus: 2.621 Titel tragen `anisearchId`. Wo auch
          die fehlt, geht es zur Suche mit dem Titel — `/search?q=`, denn
          `/anime/index?text=` antwortet mit „Deine Suchanfrage ist ungültig"
          (Daniel, 12.09.2026, mit Bild: „die anisearch verlinkung läuft ins
          leere … pack auf die todo diese stelle und alle anderen zu
          verbessern").
        */
        eintrag.deSource = {
          name: 'anisearch.de',
          url:
            url ??
            (t.anisearchId
              ? `https://www.anisearch.de/anime/${t.anisearchId}`
              : `https://www.anisearch.de/search?q=${encodeURIComponent(
                  t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
                )}`),
        }
      } else if (ausTmdb?.overviewDe) {
        eintrag.de = ausTmdb.overviewDe
        eintrag.deSource = {
          name: 'themoviedb.org',
          url: ausTmdb.tmdbId
            ? `https://www.themoviedb.org/${ausTmdb.kind === 'movie' ? 'movie' : 'tv'}/${ausTmdb.tmdbId}`
            : 'https://www.themoviedb.org/',
        }
      }
      synopses[t.id] = eintrag
    }
    const { synopsis: _drop, ...rest } = t
    /*
      **Die Kennungen der Quellen gehören an den Titel.**

      Sie kosten je Titel wenige Bytes und beantworten eine Frage, die die
      Quellenübersicht sonst offen lässt: „und wo steht das?". aniSearch führt
      den deutschen Titel und die Beschreibung, ANN die deutschen Sprechrollen —
      beide Kennungen lagen im Bestand und erreichten die Seite nie.

      `annId` nur, wo auch Stimmen belegt sind: Ohne sie führt der Verweis auf
      eine Seite, die zu unserer Frage nichts sagt.
    */
    const asId = anisearchHand[t.id] ?? anisearch[t.id]?.anisearchId
    const annId = mitStimmen.has(t.id) ? annKennungen[String(t.id)] : undefined
    return {
      ...rest,
      ...(mitStimmen.has(t.id) ? { hasVoices: true as const } : {}),
      ...(Number.isFinite(asId) ? { anisearchId: asId } : {}),
      ...(Number.isFinite(annId) ? { annId } : {}),
      /* Nur die beiden Felder, die die Oberfläche braucht — Herkunft und Prüfdatum bleiben in der Quelle. */
      ...(trailer[String(t.id)]
        ? {
            trailer: {
              video: trailer[String(t.id)]!.video,
              titel: trailer[String(t.id)]!.titel,
              /* Ältere Einträge kannten das Feld nicht — sie stammen aus der deutschen Erstfassung. */
              sprache: trailer[String(t.id)]!.sprache ?? ('de' as const),
            },
          }
        : {}),
      ...kinoFeld(t.id),
    }
  })

  // Der Kalender braucht nur die Titel, zu denen es einen Termin gibt. Die
  // vollständige Liste (mehrere Megabyte) lädt erst die Datenbank-Ansicht nach.
  const referenced = new Set(releases.map((r) => r.titleId))
  writeJson(`${OUT}/titles-core.json`, slim.filter((t) => referenced.has(t.id)))
  /**
   * Kein Titel geht verloren — der Build bricht lieber ab.
   *
   * Gemessen am 24.08.2026: Ein Bau mit aeltererem `data/cache/` erzeugte
   * 2.752 statt 2.762 Titeln. Die zehn fehlenden waren nicht falsch, sie
   * waren nur im lokalen Cache nicht vorhanden -- darunter "Kill Ao" und
   * "Mononoke Chapter III", beide mit Termin im Kalender.
   *
   * Ein verlorener Titel faellt nicht auf: Der Termin bleibt stehen, das
   * Detail-Panel sagt "keine Metadaten". So hat Daniel es am 23.08. entdeckt,
   * nicht der Lauf.
   */
  {
    /** Ein einzelner Wegfall ist erklaerbar, mehrere sind ein Symptom. */
    const ERLAUBTER_VERLUST = 1
    let vorher: number[] = []
    try {
      const alt = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
      vorher = (Array.isArray(alt) ? alt : Object.values(alt)).map((t) => t.id)
    } catch {
      /* Kein voriger Stand — dann gibt es nichts zu verlieren. */
    }
    if (vorher.length) {
      const jetzt = new Set(slim.map((t) => t.id))
      /**
       * **Wer hinter den Toggle verschoben wurde, ist kein Verlust** (PR #187, Issue #186).
       *
       * `schreibeOhneSynchro` trägt jeden Titel aus `verschoben` nachweislich in
       * `ohne-synchro.json` nach — genau die Zusicherung aus dem Fix vom 17.08.2026 („Ein
       * Vorfilter verschiebt, er löscht nicht"). Der Riegel kannte sie nicht: Am 21.09.2026
       * verloren „Black Clover 2nd Season" (195604) und „Kusuriya no Hitorigoto 3rd Season"
       * (195516) ihren einzigen, unbestätigten Crunchyroll-Termin, wanderten korrekt hinter
       * den Toggle — und der Bau brach ab, obwohl nichts verloren war (Lauf 35550446358).
       *
       * Der Pull Request lag seit dem 21.09. offen und ließ sich nach den Änderungen vom
       * 23.09. nicht mehr sauber zusammenführen; die Zeile steht deshalb direkt hier.
       */
      const hinterToggle = new Set(verschoben.map((t) => t.id))
      const verloren = vorher.filter((id) => !jetzt.has(id) && !hinterToggle.has(id))
      if (verloren.length > ERLAUBTER_VERLUST) {
        warn(
          `ABBRUCH: ${verloren.length} Titel wuerden aus dem Datensatz fallen ` +
            `(${vorher.length} → ${slim.length}).`,
        )
        warn(`   Betroffen: ${verloren.slice(0, 10).join(', ')}`)
        warn(
          '   Meist ist der lokale data/cache/ aelter als der des letzten Laufs. Datenlaeufe gehoeren nach GitHub — siehe CLAUDE.md.',
        )
        process.exit(1)
      }
      if (verloren.length) {
        warn(`${verloren.length} Titel faellt aus dem Datensatz: ${verloren.join(', ')}`)
      }
    }
  }

  /*
    **Das Gedächtnis wird erst geschrieben, wenn der Lauf gültig ist.**

    `data/verweise-entfernt.json` hält fest, was frühere Läufe als belegtes Nein
    entfernt haben — ohne diese Datei legt der nächste Bau alles wieder an. Sie
    stand bis zum 06.09.2026 rund 430 Zeilen weiter oben, also **vor** dem
    Riegel darüber. Ein lokaler Lauf mit älterem `data/cache/` brach dort ab
    („2 Titel würden aus dem Datensatz fallen") — und die Datei war da bereits
    von 782 Zeilen auf zwei geschrumpft, weil dieser Lauf weniger entfernte
    Verweise gesehen hatte.

    Gefangen hat es `git status` vor dem Commit. Ein Riegel, der den Datensatz
    schützt und die Nebendatei daneben unbeschädigt lässt, schützt aber nur die
    Hälfte: Wer den Diff nicht durchsieht, committet ein leeres Gedächtnis.
  */
  /*
    **Was das Gedächtnis gesperrt hat, schreibt es auch wieder mit.**

    Bis zum 17.09.2026 enthielt die Datei nur, was **dieser** Lauf entfernt hat.
    Ein Verweis, den aniSearch ergänzt und der Bau als belegtes Nein wieder
    entfernt, stand danach drin — der nächste Lauf ergänzte ihn deshalb nicht,
    entfernte ihn also auch nicht, und schrieb ihn nicht mehr. Der übernächste
    legte ihn wieder an. 78 Crunchyroll-Adressen (One Piece, DearS …) flatterten
    so von Bau zu Bau, sichtbar in `data/bestand-historie.jsonl` als 836 ↔ 769.
    Übernommen wird ein alter Eintrag, solange seine Frist läuft, dieser Lauf
    ihn nicht selbst neu geschrieben hat und kein Verweis mit dieser Adresse im
    Datensatz steht.
  */
  if (verweiseEntfernt.length) {
    const grenze = addDays(todayIso(), -NEIN_GILT_TAGE)
    const schluessel = (e: { titleId?: number; plattform?: string; url?: string }) =>
      `${e.titleId}|${e.plattform}|${adressKern(e.url)}`
    const schonDa = new Set(verweiseEntfernt.map(schluessel))
    const imBestand = new Set<string>()
    for (const t of allTitles) for (const st of t.streams ?? []) imBestand.add(adressKern(st.url))
    const uebernommen = (
      readJson<{ verweise?: EntfernterVerweis[] }>('data/verweise-entfernt.json', {}).verweise ?? []
    ).filter(
      (e) => (e.entferntAm ?? '') >= grenze && !schonDa.has(schluessel(e)) && !imBestand.has(adressKern(e.url)),
    )
    if (uebernommen.length) log(`${uebernommen.length} gesperrte Verweise aus dem Gedächtnis übernommen`)
    writeJson(
      'data/verweise-entfernt.json',
      { stand: new Date().toISOString(), verweise: [...verweiseEntfernt, ...uebernommen] },
      true,
    )
  }
  return { slim }
}
