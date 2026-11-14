import { type PlatformId, type Release, type Title } from '../../shared/types.ts'
import { type CrunchyrollEntry } from '../lib/crunchyroll.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { ergaenzeVerweiseVonHand } from '../lib/verweise-von-hand.ts'
import { crNamensindexAusDatei, crAdresseZu as crAdresseNachName } from '../lib/cr-katalog-adresse.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'
import { todayIso } from '../../shared/time.ts'
import type { CrDubData } from '../lib/crunchyroll-dub.ts'
import { deutschGeplantLautAnisearch } from './ohne-beleg.ts'
import { serienkennungenMitNullBlock, slotBelegt } from '../lib/cr-ja-deckung.ts'
import { ergaenzeJoynAusJustwatch } from './09-1-0-joyn-justwatch.ts'
import { belegFuerAus, checksNachPlattform, ergaenzeZweiteAusgaben, kanalUndZugangJeAdresse } from './09-1-1-beleg-index.ts'
import { crKatalogUndUsNein } from './09-1-2-cr-katalog-deutsch.ts'
import { reparierePfadloseWege } from './09-1-3-pfadlose-wege.ts'
import { checksUndYoutube } from './09-1-4-checks-youtube.ts'

/**
 * Ein Termin, der noch aussteht, ist kein Beleg für eine Synchro von heute: geschätzt ist er der Untertitel-Start, und wo aniSearch Deutsch als „Geplant“ führt,
 * ist er der Start der Synchro (Reincarnated as a Dragon Hatchling: ADN zeigt bis zum 22.10.2026 nur Untertitel).
 */
export function terminBelegtNichts(release: Release, heute: string): boolean {
  if (release.titleId < 0) return true
  if (release.sprache) return true // omu/offen: der Termin belegt keine Synchro (Super Beerus, Netflix, 13.10.2026)
  const kommt = release.schedule.firstEpisodeDate > heute
  return kommt && (Boolean(release.schedule.estimated) || deutschGeplantLautAnisearch(release.titleId))
}

export function sammleBelege({
  releases,
  titles,
  crBySeriesId,
  tmdbMehrdeutig,
  tmdbTitles,
  tvJeTmdb,
  toteAdressen,
  crDub,
}: {
  releases: Release[]
  titles: Map<number, Title>
  crBySeriesId: Map<string, CrunchyrollEntry>
  tmdbMehrdeutig: Set<string>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  tvJeTmdb: Set<string>
  toteAdressen: Set<string>
  crDub: CrDubData
}) {
  // Ein Stream-Link sagt nichts über die Sprache — belegt ist nur, was nachgewiesen wurde.
  const dubByTitle = new Map<number, Set<PlatformId>>()
  for (const release of releases) {
    if (terminBelegtNichts(release, todayIso())) continue
    const set = dubByTitle.get(release.titleId) ?? new Set<PlatformId>()
    set.add(release.platform)
    dubByTitle.set(release.titleId, set)
  }
  const serienMitNullBlock = serienkennungenMitNullBlock(crDub)
  for (const title of titles.values()) {
    const confirmed = dubByTitle.get(title.id)
    for (const stream of title.streams) {
      if (confirmed?.has(stream.platform)) {
        stream.dub = true
        continue
      }
      if (stream.platform === 'crunchyroll' && slotBelegt(stream.url, crBySeriesId, serienMitNullBlock)) stream.dub = true
    }
  }

  /**
   * **Verweise, die kein Sammellauf findet — von Hand belegt.**
   *
   * Die Erweiterung meldet Seiten, die unser Datensatz gar nicht kennt: Ein
   * Anbieter führt denselben Anime unter mehreren Kennungen, und aniSearch
   * nennt nur eine. Solche Meldungen landen in
   * `daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md` — und blieben dort
   * liegen, weil es **keinen Weg gab, die Adresse einzutragen**. Am 10.09.2026
   * warteten so 54 Meldungen zu drei Haikyu!!-Staffeln, zwei davon für Titel
   * ohne einen einzigen Prime-Verweis.
   *
   * `data/adn-adressen.yaml` und `data/rtlplus-adressen.yaml` **ersetzen** eine
   * vorhandene Adresse; diese Datei **legt eine an**. Deshalb die dritte.
   *
   * **Der Eintrag urteilt nicht.** Er sagt „dort gibt es diesen Titel", nicht
   * „dort ist er auf Deutsch" — das Sprachurteil kommt weiter aus den
   * Meldungen. Steht die Adresse erst im Datensatz, findet `fetch-pruefungen.ts`
   * sie über `nachUrl` und ordnet die Folgenbefunde zu.
   *
   * Ein Verweis, der schon dasteht, wird nicht verdoppelt: Verglichen wird über
   * denselben Adresskern wie überall.
   */
  /** Adresskern → `belegtAm` der von Hand bestätigten Wege (für `handSticht`, 22.09.2026). */
  const vonHandBelegtAm = ergaenzeVerweiseVonHand(titles)

  const { joynZugang } = ergaenzeJoynAusJustwatch({ titles, tmdbMehrdeutig, tmdbTitles, tvJeTmdb, toteAdressen })

  /**
   * Was ein Mensch nachgesehen hat, schlägt jede Ableitung.
   *
   * Für YouTube, Netflix, Prime Video, RTL+ und Joyn gibt es keine Quelle, die
   * die Tonspur nennt — 3.021 Verweise standen deshalb dauerhaft auf „🇩🇪 ?".
   * `data/dub-confirmed.yaml` löst das auf dem einzigen Weg, der zum
   * Projektgrundsatz passt: durch tatsächliches Nachsehen. Ein Eintrag dort ist
   * ein Beleg, kein Vorschlag, und gilt deshalb auch gegen ein automatisch
   * gesetztes `true`.
   */
  // `loadDubChecks()` führt mehrere Zeilen zu einem Verweis bereits zusammen und
  // lässt dabei den jüngeren Befund gewinnen — hier liegt je Schlüssel genau
  // einer vor.
  /**
   * **Der Beleg zur Adresse schlägt den Beleg zur Plattform.**
   *
   * `loadDubChecks()` hält seit dem 07.09.2026 je Ausgabe einen eigenen Eintrag
   * — vorher verschmolzen zwei Prime-Ausgaben desselben Titels zu einem, und
   * ein `dub: true` für die eine färbte die andere (Date a Live IV: Prime-Abo
   * mit Deutsch, Crunchyroll-Kanal ohne). Hier wird ausgewählt, welcher gilt:
   *
   * 1. der Beleg mit **derselben** Adresse wie der Verweis,
   * 2. sonst der Beleg **ohne** Adresse — er gilt der Plattform,
   * 3. sonst keiner. Ein Beleg zu einer fremden Ausgabe sagt nichts über diese.
   *
   * Punkt 3 ist der eigentliche Fix. Er ist streng, und das muss er sein: Ein
   * Ja für die falsche Ausgabe ist genau die Behauptung, die diese Seite nicht
   * machen darf.
   */
  const alleChecks = loadDubChecks()
  const { zugangJeAdresse, kanalJeAdresse } = kanalUndZugangJeAdresse({ alleChecks })
  const { checksJePlattform } = checksNachPlattform({ alleChecks })

  ergaenzeZweiteAusgaben({ checksJePlattform, titles })
  const { belegFuer } = belegFuerAus({ checksJePlattform, alleChecks })
  /* Rückwärtsverträglich für die Stellen, die keine Adresse zur Hand haben. */
  /**
   * **Eine nackte Domain ist kein Weg zu einem Titel.**
   *
   * Gemessen am 07.09.2026: Zwei Crunchyroll-Verweise trugen als Adresse
   * schlicht `https://crunchyroll.com` — einer davon mit großem C, beide ohne
   * Pfad. Sie stammen aus einer Quelle, die statt einer Titelseite ihre eigene
   * Startseite gemeldet hat.
   *
   * Für einen Besucher ist das die schlechteste Art von Verweis: Er sieht aus
   * wie eine Auskunft („dort läuft es"), führt aber auf eine Startseite, auf
   * der er den Titel selbst suchen muss. Ein Fragezeichen wäre ehrlicher
   * gewesen, gar kein Verweis noch mehr.
   *
   * **Ins Gedächtnis kommt das nicht**: Es ist kein belegtes Nein, sondern eine
   * kaputte Adresse. Taucht dieselbe Serie später mit einer echten Adresse auf,
   * soll sie kommen dürfen.
   */

  /**
   * **Eine Suchadresse ist kein Weg — auch nicht als Notbehelf.**
   *
   * Bis zum 10.09.2026 hat genau diese Stelle aus einer pfadlosen Adresse eine
   * Crunchyroll-Suche gemacht, mit unserem Titel als Suchbegriff. Der Gedanke
   * war, dem Besucher wenigstens etwas zu geben. Gemessen an dem, was dabei
   * herauskam, war es weniger als nichts: Für „Kaiju No. 8 Narumi's Week at
   * Work" antwortet Crunchyroll mit **„Es konnte nichts gefunden werden"**
   * (Daniel, 10.09.2026, mit Bild). Unser Titel ist dort der Name eines
   * Staffelblocks, kein Suchbegriff.
   *
   * Daniels Ansage: „alle links die auf such query gehen, statt direkt auf
   * treffer, müssen entfernt werden von der webseite."
   *
   * **Die echte Adresse lag die ganze Zeit im Repo.** Der deutsche Katalog
   * (`data/cr-katalog-de.json`, 1.656 Serien) führt „Kaiju No. 8" unter
   * `GG5H5XQ7D`/`kaiju-no-8` — Zeichen für Zeichen die Adresse, die Daniel
   * von Hand herausgesucht hat. Dieselbe Klasse wie die fünf Fälle vom
   * 06./07.09.2026: geschrieben, committet, nie gelesen.
   *
   * **Gefragt wird nur nach der Adresse, nicht nach dem Ob.** Der Verweis
   * steht bereits — mitsamt seinem Sprachurteil; hier wird ausschließlich
   * seine kaputte Adresse ersetzt. Deshalb genügt ein Namensabgleich, wo er
   * sonst zu Recht als unzuverlässig gilt: Er beantwortet die Frage „wo genau
   * liegt das beim Anbieter", nicht „läuft das dort" (dieselbe Trennung wie
   * bei JustWatch, 10.09.2026).
   *
   * Und weil eine Crunchyroll-Serienseite alle Staffeln und Nebenausgaben
   * einer Reihe führt (Daniels Bildschirmabzug zeigt „Season 1 · Mission
   * Recon · Season 2 · Narumi's Week at Work" unter einer Adresse), ist der
   * Reihenkopf für ein Special die **richtige** Antwort, nicht die zweitbeste.
   *
   * **Warum die Reparatur hier steht und das Entfernen ganz unten:** Eine
   * pfadlose Adresse überlebt die nachfolgenden Runden nicht — sie fliegt als
   * kaputter Verweis heraus, und dann gibt es nichts mehr zu reparieren.
   * Umgekehrt ersetzen spätere Runden Suchadressen noch durch echte
   * Titelseiten (Daniels Prime-Meldungen); wer sie hier wegwirft, nimmt ihnen
   * die Gelegenheit. Zwei Aufgaben, zwei Stellen.
   */
  const crNamen = crNamensindexAusDatei()
  const crAdresseZu = (name: string): string | undefined => crAdresseNachName(crNamen, name)
  const { usNeinWiderlegt, crKatalogDeutsch } = crKatalogUndUsNein({ crDub })

  const { beantworteteSuchen, suchOffen } = reparierePfadloseWege({ alleChecks, titles, crAdresseZu })

  const { ytKanal, ytKauf, youtubeBefunde, checks } = checksUndYoutube({ alleChecks })
  return {
    ytKanal,
    ytKauf,
    checksJePlattform,
    youtubeBefunde,
    belegFuer,
    vonHandBelegtAm,
    checks,
    alleChecks,
    zugangJeAdresse,
    joynZugang,
    usNeinWiderlegt,
    crAdresseZu,
    crKatalogDeutsch,
    beantworteteSuchen,
    suchOffen,
    kanalJeAdresse,
  }
}
