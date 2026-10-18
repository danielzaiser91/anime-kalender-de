import { pruefeVerlust } from './verlust-riegel.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import { schreibeKern } from './cartoon-kern.ts'
import { kinoFeld, NEIN_GILT_TAGE, type EntfernterVerweis } from './grundlagen.ts'
import { neuerStand, uebernommeneVerweise } from './verweise-gedaechtnis.ts'
import { writeJson, readJson, log } from '../lib/util.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { synopseVon } from './synopse-von.ts'
import { archivTexte } from '../lib/anisearch-archiv-text.ts'
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
  const kennungen = anisearchKennungen(allTitles.map((t) => ({ id: t.id, mal: t.malId })))
  const archiv = archivTexte(kennungen, (id) => !!anisearch[id]?.descriptionDe || !!tmdbTitles[id]?.overviewDe)
  const slim = allTitles.map((t) => {
    const ausAnisearch = anisearch[t.id]?.descriptionDe ?? archiv.get(t.id)
    const ausTmdb = tmdbTitles[t.id]
    const asId = kennungen.get(t.id)
    const synopse = synopseVon({ t, asId, ausAnisearch, ausTmdb, trenneQuelle })
    if (synopse) synopses[t.id] = synopse
    const { synopsis: _drop, jpStartTag: _jpStart, ...rest } = t
    /*
      **Die Kennungen der Quellen gehören an den Titel.**

      Sie kosten je Titel wenige Bytes und beantworten eine Frage, die die
      Quellenübersicht sonst offen lässt: „und wo steht das?". aniSearch führt
      den deutschen Titel und die Beschreibung, ANN die deutschen Sprechrollen —
      beide Kennungen lagen im Bestand und erreichten die Seite nie.

      `annId` nur, wo auch Stimmen belegt sind: Ohne sie führt der Verweis auf
      eine Seite, die zu unserer Frage nichts sagt.
    */
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
  schreibeKern(slim, referenced)
  pruefeVerlust(slim, verschoben)

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
    const alt = readJson<{ stand?: string; verweise?: EntfernterVerweis[] }>('data/verweise-entfernt.json', {})
    const uebernommen = uebernommeneVerweise(alt.verweise ?? [], verweiseEntfernt, allTitles, grenze)
    if (uebernommen.length) log(`${uebernommen.length} gesperrte Verweise aus dem Gedächtnis übernommen`)
    const verweise = [...verweiseEntfernt, ...uebernommen]
    writeJson('data/verweise-entfernt.json', { stand: neuerStand(alt, verweise), verweise }, true)
  }
  return { slim }
}
