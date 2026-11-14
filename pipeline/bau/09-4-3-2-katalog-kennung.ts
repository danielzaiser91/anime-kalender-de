import { readJson, log } from '../lib/util.ts'
import { type KennungsAdressen, kennungMitAdressgedaechtnis, kennungAusPfad } from '../lib/cr-kennung-gedaechtnis.ts'
import { gruppiereJeKennung } from '../lib/je-kennung.ts'
import { type Title } from '../../shared/types.ts'
import { alleHinterDemEnde } from '../lib/cr-hinter-dem-ende.ts'
import { serienBesitz, istFremd, entferneFremdeCrWege, entferneFremdeNachStaffeln } from './cr-serie-geteilt.ts'
import { katalogSerieIstEinWerk } from '../lib/cr-katalog-ein-werk.ts'
import { vorDemStart } from '../lib/crunchyroll-vollstaendig.ts'
import { juengstePruefungJeKennung } from '../lib/cr-nein-ueberholt.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'

/**
 * **Achte Runde: die Serienkennung aus der Adresse gegen den Katalog.**
 *
 * Die Runde darüber gleicht **Namen** ab und ist deshalb streng gefiltert —
 * ein Namensteil trifft immer den Reihennamen. Wo der Verweis aber selbst
 * eine Serienkennung trägt (`crunchyroll.com/de/series/GXXXXXXXX/…`),
 * braucht es keinen Namensabgleich: Die Kennung steht in beiden Beständen,
 * und `data/cr-katalog-de.json` nennt zu ihr die Tonspuren.
 *
 * Das ist derselbe Unterschied, der die RTL+-Umstellung am 07.09.2026
 * tragfähig gemacht hat: **Zeichenkette gegen Zeichenkette statt Name gegen
 * Name.** An den Fällen, an denen dieses Projekt gescheitert ist
 * (`To Love-Ru`, `Wolf's Rain OVA`, die 16 Katalogzuordnungen vom
 * 29.08.2026), war der Name jedes Mal das einzige Merkmal.
 *
 * **Der Katalog ist der deutsche** — er entsteht mit einem anonymen Token,
 * dessen Region die der abrufenden IP ist, und läuft deshalb von Daniels
 * Rechner (siehe `refresh-weekly.yml`). Damit gilt hier die Regel aus
 * `CLAUDE.md`: Aus **diesem** Katalog ist auch ein fehlendes `de-DE` ein
 * Beleg — anders als aus dem US-Katalog, wo es gar nichts heißt.
 *
 * **Eine Serie ohne Folgen wird übersprungen.** `folgen: 0` steht im
 * Katalog für Einträge ohne abrufbare Folgen; über deren Tonspuren sagt die
 * Liste nichts Belastbares.
 *
 * Gemessen am 07.09.2026: vier der 52 offenen Crunchyroll-Verweise tragen
 * eine Kennung, die der Katalog führt — drei mit `de-DE`, einer ohne.
 */
export function belegeUeberSerienkennung({ crDub, titles }: {
  crDub: CrDubData
  titles: Map<number, Title>
}) {
  let ausKennung = 0
  {
    const katalog = readJson<{
      geholtAm?: string
      eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
    }>('data/cr-katalog-de.json', {})
    const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
    /**
     * **Die Kennung steht nicht immer in der Adresse — dann steht sie im Gedächtnis.**
     *
     * Crunchyrolls alte Slug-Form (`/de/<name>`) trägt keine Serienkennung,
     * und diese Runde stieg dort bisher aus. Gemessen am 07.09.2026: **43
     * der 44 offenen Crunchyroll-Verweise** haben genau diese Form.
     *
     * `data/crunchyroll-series-ids.json` löst sie längst auf — jede der 396
     * betroffenen Adressen steht dort, mit Kennung und Prüfdatum. Gelesen hat
     * die Datei nur `scrape-crunchyroll-dub.ts`, also der Abruf, der sie
     * schreibt. Wieder der Fall aus `CLAUDE.md`: „Eine Datei zu schreiben ist
     * nicht dasselbe wie sie zu benutzen."
     *
     * Der Gewinn ist heute klein — drei Verweise, alle mit belegtem Nein —
     * und wächst mit jeder Serie, die der Katalog künftig führt. Die übrigen
     * 29 hängen am Franchise-Problem: Ihre Kennung nennt mehrere Blöcke, und
     * welcher unsere Staffel ist, sagt die Serienebene nicht.
     */
    const kennungsGedaechtnis = readJson<{ adressen?: KennungsAdressen }>('data/crunchyroll-series-ids.json', {}).adressen
    // auch die Adressen ohne Kennung (der Bau normalisiert sie erst später)
    const kennungVon = kennungMitAdressgedaechtnis(kennungsGedaechtnis ?? {}, kennungAusPfad)
    /*
      Eine Staffel im Katalog kann trotzdem zwei Werke tragen: Captain Tsubasa
      2018 und „Junior Youth" liegen unter `GZJH3D7G9` in einem Block, deutsch
      sind nur die laufenden Nummern 53–91 (17.09.2026). Die laufende Nummer
      aus dem Prüflauf sperrt das Ja. Gemessen über 106 Kandidaten dieser
      Runde: genau dieser eine Fall. Die breitere Regel „Katalog hat mehr
      Folgen als der Titel" träfe 24, fast alle zu Recht deutsch (geteilte
      Cours wie 86 oder Dead Mount Death Play).
    */
    const crSerienGruppen = gruppiereJeKennung(crDub.serien, (s) => s.seriesId)
    const hinterDemEnde = (kennung: string, title: Title): boolean =>
      alleHinterDemEnde(crSerienGruppen.get(kennung), title.episodes)
    if (nachKennung.size) { const besitz = serienBesitz(titles, kennungVon, nachKennung)
      for (const title of titles.values()) {
        for (const stream of title.streams) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const kennung = kennungVon(stream.url)
          if (!kennung) continue
          const eintrag = nachKennung.get(kennung)
          if (!eintrag || !eintrag.folgen) continue
          if (hinterDemEnde(kennung, title)) continue
          /*
            **Nur wo die Serie genau ein Werk ist.**

            Der Katalog antwortet auf **Serienebene**, und eine Serienkennung
            bei Crunchyroll ist ein Franchise: `GRDQV2VWY` heißt „Free! -
            Iwatobi Swim Club" und führt **neun** Staffeln mit 51 Folgen. Ein
            `de-DE` dort sagt nichts über „Free! Take Your Marks", einen Film
            — genau dieses falsche Ja hätte die erste Fassung dieser Runde am
            07.09.2026 gesetzt.

            Widerlegt hat es Bofuri: Der Katalog meldet `de-DE` für die Serie,
            der Prüflauf fand **12 deutsche Folgen in Staffel 1 und null in
            Staffel 2** — und unser Titel ist Staffel 2. Dieselbe Lehre steht
            seit dem 25.08.2026 in `CLAUDE.md` („Eine Serie ist bei
            Crunchyroll kein Block"); sie beim Bauen nicht angewandt zu haben,
            war der Fehler.

            **Bei genau einer Staffel fallen Serie und Werk zusammen**, und
            dann trägt die Angabe. 321 der 1.589 Katalogeinträge (20 %) tun
            das nicht — für sie bleibt der Verweis offen, bis der Prüflauf je
            Folge antwortet.
          */
          if (!katalogSerieIstEinWerk(crDub, kennung, eintrag, title) || vorDemStart(title, katalog.geholtAm) || istFremd(besitz, kennung, title.id, eintrag.folgen)) continue
          stream.dub = (eintrag.audio ?? []).includes('de-DE')
          ausKennung++
        }
      }
      /**
       * **Der jüngere Katalog überstimmt ein älteres Nein.**
       *
       * Das ist Daniels eigentliche Kill-Blue-Meldung vom 07.09.2026: „im
       * anime-kalender hat dieser eintrag gar keine crunchy-pill, also
       * behaupten wir es wäre nicht synchronisiert auf crunchy."
       *
       * Die Runde darüber fasst nur unbeurteilte Verweise an, und der von
       * Kill Blue war beurteilt — mit einem **16 Tage alten** Befund:
       *
       * | Quelle | Stand | Aussage |
       * |---|---|---|
       * | `crunchyroll-dub.json`, Serie `GT00371896` | **22.08.2026** | `deutschImAngebot: true`, Staffel 1 mit **0** deutschen Folgen |
       * | `cr-katalog-de.json`, derselbe Eintrag | **07.09.2026, 06:44** | `audio` enthält **`de-DE`** |
       *
       * Der ältere Befund gewann, der Verweis flog mit „belegtes Nein" heraus
       * — und der Kalender behauptete das Gegenteil der Wirklichkeit. Am
       * 06.09. sind dort die Folgen 1–8 auf Deutsch erschienen.
       *
       * Damit ist es derselbe Fehler wie beim Gedächtnis der entfernten
       * Verweise (Frist von 28 Tagen, weiter unten): **Ein Nein ist eine
       * Aussage über einen Tag, nicht über alle Zeit.** Nur steht hier eine
       * jüngere Messung daneben, die es widerlegt — es braucht also gar keine
       * Frist, sondern nur den Blick auf das Datum.
       *
       * **Nur in diese Richtung.** Ein `de-DE` im Katalog hebt ein Nein auf;
       * ein fehlendes `de-DE` hebt umgekehrt **kein** Ja auf. Der Katalog
       * antwortet auf Serienebene, und die Trennung „Serie ist kein Block"
       * gilt unverändert — deshalb weiterhin nur bei genau einer Staffel.
       */
      const dubStand = crDub.scrapedAt?.slice(0, 10) ?? ''
      const katalogStand = (katalog.geholtAm ?? '').slice(0, 10)
      let ausKatalogNeuer = 0
      const geprueftJe = juengstePruefungJeKennung(crSerienGruppen, dubStand)
      for (const title of titles.values()) {
        for (const stream of title.streams) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== false) continue
          const kennung = /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1]
          if (!kennung) continue
          const eintrag = nachKennung.get(kennung)
          if (!eintrag?.folgen || !katalogSerieIstEinWerk(crDub, kennung, eintrag, title) || vorDemStart(title, katalogStand) || istFremd(besitz, kennung, title.id, eintrag.folgen)) continue
          if (!(eintrag.audio ?? []).includes('de-DE')) continue
          if (hinterDemEnde(kennung, title)) continue
          /* Nur wenn der Katalog wirklich jünger ist als die Messung, die das Nein trug. */
          if (katalogStand <= (geprueftJe.get(kennung) ?? '')) continue
          stream.dub = true
          ausKatalogNeuer++
          log(
            `  ${title.titleDe ?? title.id}: Nein vom ${geprueftJe.get(kennung)} durch den Katalog vom ${katalogStand} überholt`,
          )
        }
      }
      if (ausKatalogNeuer)
        log(`${ausKatalogNeuer} Nein(s) vom Katalog überholt: er ist jünger und führt de-DE`)
    }
    if (ausKennung) log(`${ausKennung} über die Serienkennung im deutschen Katalog belegt`); { const fremd = entferneFremdeCrWege(titles, nachKennung, serienBesitz(titles, kennungVon, nachKennung), kennungVon) + entferneFremdeNachStaffeln(titles, kennungVon); if (fremd) log(`${fremd} Crunchyroll-Wege auf eine Serie entfernt, die nicht zu ihnen gehört (Folgensumme übersteigt die Serie)`) }
  }
}
