import { readJson, log } from '../lib/util.ts'
import { kapitelImBlock, deutscheFolgenNachDemEnde, type CrDubData } from '../lib/crunchyroll-dub.ts'
import { type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

export function ordneCrKatalogZu({ titles, crDub, verweiseEntfernt }: {
  titles: Map<number, Title>
  crDub: CrDubData
  verweiseEntfernt: EntfernterVerweis[]
}) {
    /**
     * **Fünfte Runde: Filme und Specials, die der Katalog einzeln führt.**
     *
     * Die Suche nach Serienkennungen läuft mit `type=series` — Filme findet sie
     * nie. Am 29.08.2026 hatten 26 der 56 offenen Verweise deshalb keine
     * Kennung, davon 18 Filme. `data:cr-einzelwerke` sucht ohne Typ-Filter und
     * findet sie als `movie_listing`, mit ihren Tonspuren.
     *
     * **Der Beleggrad ist derselbe wie bei einer Serie:** Der deutsche Katalog
     * nennt für diesen Titel `de-DE`. Der Namensvergleich ist exakt (nach
     * Kleinschreibung ohne Sonderzeichen) — ein Film hat keinen zweiten
     * Prüfstein, keine Folgenzahl und keine Staffelstruktur, deshalb wird hier
     * nichts geraten.
     *
     * **Nur Ja, kein Nein.** Findet der Katalog den Film nicht, heißt das „hier
     * nicht geführt" — und daraus wird kein `dub: false` (CLAUDE.md).
     */
    let einzeln = 0
    for (const eintrag of readJson<
      { id: number; treffer?: { audio?: string[] } | null }[]
    >('data/cr-einzelwerke.json', [])) {
      if (!eintrag.treffer?.audio?.includes('de-DE')) continue
      const title = titles.get(eintrag.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      einzeln++
    }
    if (einzeln) log(`${einzeln} Filme/Specials über den deutschen Katalog belegt (Einzelwerk-Suche)`)

    /**
     * **Sechste Runde: der Film hat einen eigenen Block in einer Filmreihe.**
     *
     * Crunchyroll führt Filmreihen als eigene Serie — „Fairy Tail Movies" mit
     * je einem Block pro Film, jeder mit eigener Sprachangabe. Unser Eintrag
     * „Fairy Tail: The Movie - Phoenix Priestess" findet dort seinen Block; die
     * Serie „Fairy Tail" mit ihren 175 deutschen Folgen sagt über ihn nichts.
     *
     * Verglichen wird das **Kennwort** — „Phoenix Priestess" —, nicht der ganze
     * Name: Reihenname und Nummerierung schreibt jede Seite anders.
     *
     * Auch hier nur Ja: Wird kein Block gefunden, heißt das „nicht gefunden".
     */
    let filmbloecke = 0
    for (const eintrag of readJson<{ id: number; treffer?: { audio?: string[] } | null }[]>(
      'data/cr-filmbloecke.json',
      [],
    )) {
      if (!eintrag.treffer?.audio?.includes('de-DE')) continue
      const title = titles.get(eintrag.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      filmbloecke++
    }
    if (filmbloecke) log(`${filmbloecke} Filme/Specials über ihren eigenen Block in einer Filmreihe belegt`)

    /**
     * **Ein Kapitel ist eine Folge im Block der Filmreihe.**
     *
     * Crunchyroll führt „Princess Principal: Crown Handler" als **einen** Block
     * mit vier Folgen („Crown Handler I" bis „IV"), unser Bestand vier Filme
     * „… - Chapter 1" bis „4". Deutsch sind nur I und II (17.09.2026, deutscher
     * Katalog, je Folge). Zugeordnet wird, wenn der Name ohne „Chapter N" genau
     * einen Block derselben Adresse benennt und N in dessen Folgenzahl liegt.
     * Gemessen über den Bestand: genau diese vier Filme, das Kurz-OVA „Chapter
     * 1: BUSY EASY MONEY" fällt zu Recht heraus. Nur aus dem deutschen Katalog
     * wird daraus ein Nein.
     */
    {
      let kapitel = 0
      const crNachAdresse = new Map(crDub.serien.map((s) => [s.url, s]))
      for (const title of titles.values()) {
        for (const stream of title.streams) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const serie = crNachAdresse.get(stream.url)
          const urteil = serie ? kapitelImBlock(serie, title) : undefined
          if (urteil === undefined) continue
          stream.dub = urteil
          kapitel++
        }
      }
      if (kapitel) log(`${kapitel} Kapitel einer Filmreihe über ihre Folge im Block beurteilt`)
    }

    /**
     * **Siebte Runde: der Abgleich gegen den vollständigen deutschen Katalog.**
     *
     * `discover/browse` gibt ihn ganz heraus — 1.591 Einträge in 16 Abrufen.
     * Danach braucht es keine Suchanfrage mehr, und Titel, die dort völlig
     * anders heißen, finden trotzdem ihren Eintrag: „Fruits Basket: Prelude"
     * steht im Katalog als **„-prelude-"**.
     *
     * **Der Filter ist streng, und das ist der Kern.** Ein Namensteil trifft
     * immer den Reihennamen; ein erster Versuch ordnete 16 von 30 zu, davon die
     * Mehrzahl falsch („One Punch Man OVAs" → „One-Punch Man"). Verlangt wird
     * deshalb ein zweites, **zählbares** Merkmal: die Folgenzahl, bei einem Film
     * 0 oder 1. Übrig bleibt einer — und der ist richtig.
     */
    let ausKatalog = 0
    for (const z of readJson<{ id: number; audio?: string[] }[]>('data/cr-katalog-zuordnung.json', [])) {
      if (!z.audio?.includes('de-DE')) continue
      const title = titles.get(z.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      ausKatalog++
    }
    if (ausKatalog) log(`${ausKatalog} über den vollständigen deutschen Katalog belegt`)

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
      const kennungsGedaechtnis = readJson<{ adressen?: Record<string, { seriesId?: string }> }>(
        'data/crunchyroll-series-ids.json',
        {},
      ).adressen
      const kernVon = (u: string): string =>
        u
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('?')[0]!
          .replace(/\/$/, '')
          .toLowerCase()
      const kennungJeAdresse = new Map(
        Object.entries(kennungsGedaechtnis ?? {})
          .filter(([, v]) => v.seriesId)
          .map(([u, v]) => [kernVon(u), v.seriesId as string]),
      )
      /*
        Eine Staffel im Katalog kann trotzdem zwei Werke tragen: Captain Tsubasa
        2018 und „Junior Youth" liegen unter `GZJH3D7G9` in einem Block, deutsch
        sind nur die laufenden Nummern 53–91 (17.09.2026). Die laufende Nummer
        aus dem Prüflauf sperrt das Ja. Gemessen über 106 Kandidaten dieser
        Runde: genau dieser eine Fall. Die breitere Regel „Katalog hat mehr
        Folgen als der Titel" träfe 24, fast alle zu Recht deutsch (geteilte
        Cours wie 86 oder Dead Mount Death Play).
      */
      const crBloeckeJeKennung = new Map(
        crDub.serien.filter((s) => s.seriesId).map((s) => [s.seriesId as string, s.staffeln ?? []]),
      )
      const hinterDemEnde = (kennung: string, title: Title): boolean =>
        deutscheFolgenNachDemEnde(crBloeckeJeKennung.get(kennung) ?? [], title.episodes)
      if (nachKennung.size) {
        for (const title of titles.values()) {
          for (const stream of title.streams) {
            if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
            const kennung =
              /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1] ?? kennungJeAdresse.get(kernVon(stream.url))
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
            if ((eintrag.staffeln ?? 0) !== 1) continue
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
        const geprueftJe = new Map(
          crDub.serien.filter((s) => s.seriesId).map((s) => [s.seriesId as string, s.geprueftAm ?? dubStand]),
        )
        for (const title of titles.values()) {
          for (const stream of title.streams) {
            if (stream.platform !== 'crunchyroll' || stream.dub !== false) continue
            const kennung = /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1]
            if (!kennung) continue
            const eintrag = nachKennung.get(kennung)
            if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
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
      if (ausKennung) log(`${ausKennung} über die Serienkennung im deutschen Katalog belegt`)
    }

    /**
     * **Die Verweise, die alle Runden davor nicht beurteilen konnten.**
     *
     * Daniel am 07.09.2026: „39 Fragezeichen? wir haben crunchyroll
     * automatisiert, es sollte 0 fragezeichen geben." Gemessen am 09.09.2026
     * blieben 34 übrig, und keiner davon aus einem Fehler: 27 tragen eine
     * Adresse im alten Format ohne Serienkennung, der Rest sind Filme und OVAs,
     * die eine Serienrunde bauartbedingt nicht beurteilt.
     *
     * `pipeline/fetch-crunchyroll-offene.ts` geht sie einzeln an — Kennung aus
     * der Adresse auflösen, sonst die Serie im Katalog suchen und ihre
     * **Staffelliste** lesen. Hier wird nur angewandt, was dort belegt wurde.
     *
     * **Ein `tot` ist kein Sprachurteil.** Die Videokennung ist abgelaufen, die
     * Adresse führt ins Leere; der Verweis fliegt weiter unten über dieselbe
     * Regel wie jede andere tote Adresse. Ihn hier auf `dub: false` zu setzen
     * hieße, ein fehlendes Angebot als „ohne deutschen Ton" auszugeben — die
     * Unterscheidung, die `DubCheck.available` seit dem 12.08.2026 zieht.
     */
    {
      const offene = readJson<Record<string, { herkunft?: string; dub?: boolean; grund?: string }>>(
        'data/crunchyroll-offene.json',
        {},
      )
      let ausOffenen = 0
      let toteOffene = 0
      for (const title of titles.values()) {
        for (const stream of [...title.streams]) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const b = offene[stream.url]
          if (!b) continue
          /**
           * **Ein `tot` wurde gezählt und nie angewandt — 11 Verweise standen so
           * dauerhaft auf „🇩🇪 ?".**
           *
           * Der Kommentar darüber sagte, der Verweis fliege „weiter unten über
           * dieselbe Regel wie jede andere tote Adresse". Die Regel gibt es, nur
           * kennt sie diese Adressen nicht: Sie läuft über `crDub.serien`, also
           * über die Serien, die der wöchentliche Lauf geprüft hat. Was
           * `fetch-crunchyroll-offene.ts` als tot belegt, steht dort nicht.
           *
           * Gemessen am 10.09.2026: 28 Verweise ohne Sprachurteil im Datensatz,
           * 17 davon beim Lauf offen — und **11 als tot beurteilt**, ohne jede
           * Wirkung. Die Erklärung vom Vortag („das macht die aniSearch-Nachrunde
           * wieder auf") war falsch: Dem Lauf war keine einzige dieser Adressen
           * unbekannt.
           *
           * Entfernt wird, nicht auf `dub: false` gesetzt: Es fehlt das Angebot,
           * nicht die deutsche Fassung — dieselbe Unterscheidung wie bei
           * „Videos dieser Serie nicht mehr verfügbar".
           */
          if (b.herkunft === 'tot') {
            title.streams = title.streams.filter((s) => s !== stream)
            toteOffene++
            verweiseEntfernt.push({
              titleId: title.id,
              titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
              plattform: 'crunchyroll',
              url: stream.url,
              seriesId: null,
              grund: b.grund ?? 'Adresse führt ins Leere (fetch-crunchyroll-offene)',
              geprueftAm: null,
              entferntAm: todayIso(),
              letzterWeg: title.streams.length === 0,
            })
            continue
          }
          if (typeof b.dub !== 'boolean') continue
          stream.dub = b.dub
          ausOffenen++
        }
      }
      if (ausOffenen)
        log(`${ausOffenen} Crunchyroll-Verweise über Videokennung oder Staffelliste beurteilt`)
      if (toteOffene)
        log(`${toteOffene} Crunchyroll-Verweise entfernt: die Adresse führt ins Leere (abgelaufene Videokennung oder im deutschen Katalog nicht geführt)`)
    }
}
