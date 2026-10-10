import { existsSync } from 'node:fs'
import type { Release, Title } from '../../shared/types.ts'

export const ARCHIV_DIR = 'data/anisearch-raw'

type KatalogZeile = { id: number; titleDe?: string; dubConfidence?: string }
type Cache = Record<string, { info?: unknown; fetchedAt?: string }>

/**
 * Die Abrufliste von `fetch-anisearch.ts`: erst der Hauptbestand (Neues vor Auffrischung, Titel mit Termin vor dem Rest), dann — nur mit
 * `--katalog` (`katalogListe` gesetzt) — die Katalogtitel. Aus `main()` herausgelöst (10.10.2026), damit die Vorrangregel dort wachsen kann.
 */
export function baueWarteschlange(e: {
  ids: Record<number, number>
  titles: Title[]
  releases: Release[]
  cache: Cache
  katalogListe?: KatalogZeile[]
  force: boolean
  limit: number
  veraltet: (eintrag: { fetchedAt?: string }) => boolean
}): { queue: Title[]; katalogAngehaengt: number; katalogOffen: number } {
  const { ids, titles, releases, cache, force: FORCE, limit: LIMIT, veraltet } = e
  /**
   * **`--katalog` nimmt auch die Titel hinter dem Toggle mit.**
   *
   * Die Warteschlange bestand bis zum 06.09.2026 nur aus dem Hauptbestand —
   * also aus Titeln, für die eine deutsche Synchro schon belegt ist. Gemessen
   * an diesem Tag: 2.619 aniSearch-Einträge, davon **2.461 mit `dubbed: true`**,
   * und **null** davon fehlt im Hauptbestand. Die Quelle wird für das, wofür sie
   * bisher benutzt wird, restlos ausgeschöpft.
   *
   * Daneben stehen **11.607 Katalogtitel mit aniSearch-Kennung, von denen noch
   * kein einziger geholt wurde**. Für jeden davon sagt aniSearch dasselbe wie
   * für die anderen: ob es eine deutsche Fassung gibt, seit wann, von welchem
   * Verlag. Das ist genau die Frage, für die es dieses Projekt gibt — nur
   * ungestellt.
   *
   * **Zuerst gemessen, dann geholt.** 11.607 Seiten sind bei 6 Sekunden Abstand
   * gut 19 Stunden; ob sich das lohnt, entscheidet die Trefferquote einer
   * Stichprobe, nicht die Hoffnung. Deshalb der Schalter statt einer Umstellung.
   *
   * Der Hauptbestand behält den Vortritt: Katalogtitel hängen sich hinten an,
   * und die Auffrischung der belegten Titel läuft weiter wie bisher.
   */
  const katalog = e.katalogListe
    ? e.katalogListe
        .filter((k) => ids[k.id] && !cache[k.id])
        /*
          **Die aussichtsreichen zuerst — sonst misst eine Stichprobe nichts.**

          Der Katalog steht in AniList-Reihenfolge, und die sagt über eine
          deutsche Fassung nichts. Zwei Merkmale sagen etwas: ein **deutscher
          Titel** (1.992 der 15.118 tragen einen — den hat jemand vergeben, weil
          es eine deutsche Veröffentlichung gab) und `dubConfidence`.

          Die erste Stichprobe über 59 Titel in Dateireihenfolge ergab **null**
          Treffer. Das ist ein Befund über die Reihenfolge, nicht über den
          Katalog — deshalb steht die Sortierung hier, bevor jemand aus dem
          Ergebnis schließt, dort sei nichts zu holen.
        */
        .sort(
          (a, b) =>
            Number(Boolean(b.titleDe)) - Number(Boolean(a.titleDe)) ||
            Number(b.dubConfidence === 'high') - Number(a.dubConfidence === 'high'),
        )
    : []

  // Titel mit Termin zuerst — das sind die, die tatsächlich jemand aufschlägt.
  const withRelease = new Set(releases.map((r) => r.titleId))
  const queue = titles
    .filter((t) => ids[t.id])
    /**
     * Geholt wird, was fehlt **oder was zu alt ist**.
     *
     * Sonst wäre jeder Titel nach dem ersten erfolgreichen Abruf dauerhaft
     * erledigt, und sein Bestand an Anbietern fröre ein. Das ist genau
     * dort falsch, wo sich am meisten ändert: Verliert ein Dienst die
     * Lizenzrechte, nimmt er die deutsche Fassung wieder aus dem Angebot —
     * Crunchyroll führt aus diesem Grund keine erste Staffel von „Attack on
     * Titan" mehr. Ein Bestand, der nur wachsen kann,
     * behauptet solche Angebote weiter.
     *
     * Vierzehn Tage sind der Kompromiss: aniSearch gehört einer kleinen
     * Redaktion, jeder Abruf kostet dort Last, und Lizenzen wechseln nicht
     * wöchentlich. Bei 2.612 Einträgen bedeutet das rund 190 Abrufe je Nacht,
     * verteilt über die ohnehin laufende Warteschlange.
     */
    /*
      **Eine fehlende Archivdatei ist ein Grund zum Nachholen — auch bei
      frischem Abrufdatum.**

      Am 29.08.2026 gemessen: 2.616 Titel haben einen vollständigen Eintrag mit
      `info` und einem Abrufdatum von heute — und **1.660 davon haben keine
      Archivdatei**. Das Archiv ist irgendwann verlorengegangen, vermutlich beim
      Aufräumen der verschachtelten Ordner am 24.08.2026 (13.458 Dateien).

      Gemerkt hat es niemand, denn die Warteschlange fragte nur nach dem Alter,
      und das war in Ordnung. Der Lauf meldete „nichts nachzuladen", während
      zwei Drittel des Archivs fehlten.

      **Was daran hängt:** Aus dem Archiv kommen seit dem 29.08. die deutschen
      Disc-Ausgaben — der einzige Bezugsweg für 173 Titel, die sonst keinen
      zeigen. Ohne Archivdatei ist ein Titel dort unsichtbar, egal wie frisch
      sein Eintrag aussieht.

      Das ist dieselbe Lehre wie „Ein Abruf, der nur ergänzt, veraltet
      zwangsläufig" (CLAUDE.md), eine Ebene tiefer: **Ein Abruf, der nur nach
      dem Alter fragt, merkt einen Datenverlust nicht.**
    */
    .filter(
      (t) =>
        FORCE ||
        !cache[t.id] ||
        !cache[t.id].info ||
        veraltet(cache[t.id]) ||
        !existsSync(`${ARCHIV_DIR}/${ids[t.id]}.html.gz`),
    )
    /*
      **Wer noch nie geholt wurde, kommt vor jeder Auffrischung.**

      Bis zum 04.09.2026 sortierte hier nur ein Kriterium: Titel mit Termin
      zuerst. In derselben Gruppe standen damit zwei sehr verschiedene Fälle —
      ein Titel ohne **jede** Angabe und 1.660 Titel, die nur ihre Archivdatei
      nachholen (siehe den Absatz darüber). Bei 200 Abrufen je Lauf heißt das:
      Der Neue wartet acht Läufe lang hinter Einträgen, die bereits vollständig
      sind.

      Genau so geschehen bei „Die Tagebücher der Apothekerin: Staffel 3": Die
      ID-Brücke kannte die Zuordnung seit dem 31.08. (AniList 195516 → aniSearch
      20704), der Titel lief am 01.10. an, und im Bestand stand weder eine
      aniSearch-Kennung noch eine deutsche Beschreibung — die Seite zeigte
      englischen AniList-Text. Er hatte recht: aniSearch führt die Seite,
      wir hatten sie nur nie abgerufen.

      Fehlt ein Eintrag ganz, kostet sein Abruf dasselbe wie eine Auffrischung
      und bringt ungleich mehr — also zuerst.
    */
    .sort(
      (a, b) =>
        Number(!cache[b.id]) - Number(!cache[a.id]) ||
        Number(withRelease.has(b.id)) - Number(withRelease.has(a.id)),
    )
    .slice(0, LIMIT)

  /*
    Die Katalogtitel füllen auf, was der Hauptbestand vom Kontingent übrig
    lässt. Sie tragen nur ihre Kennung — mehr braucht `fetchTitle` nicht.
  */
  const platz = Math.max(0, LIMIT - queue.length)
  const angehaengt = katalog.slice(0, platz)
  for (const k of angehaengt) queue.push({ id: k.id } as Title)
  return { queue, katalogAngehaengt: angehaengt.length, katalogOffen: katalog.length }
}
