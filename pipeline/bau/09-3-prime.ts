import { readJson, log } from '../lib/util.ts'
import { type PlatformId, type Title } from '../../shared/types.ts'
import { dubKey, adressGleich, adressKern, type DubCheck } from '../lib/dub-confirmed.ts'
import { amazonAdresseRichten, amazonTitelAdresse } from '../lib/amazon-adresse.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { zugangsart, type Zugangsart } from '../../shared/zugangsart.ts'
import { type TmdbTitelEintrag, type AnisearchEintrag } from './01-quellen.ts'

export function uebernehmePrimeUndCrVorschlaege({ titles, checks, alleChecks, lautPruefungTot, tmdbTitles, ytKanal, zugangJeAdresse, joynZugang, ytKauf, geprueft, entfernt, ytAusTonspur, adressen, totEntfernt, ytEntfernt, linkBefunde, checksJePlattform, anisearch, belegFuer }: {
  titles: Map<number, Title>
  checks: Map<string, DubCheck>
  alleChecks: DubCheck[]
  lautPruefungTot: (url: string) => boolean
  tmdbTitles: Record<string, TmdbTitelEintrag>
  ytKanal: Record<string, string>
  zugangJeAdresse: Map<string, "abo" | "kauf">
  joynZugang: Map<string, Zugangsart>
  ytKauf: Set<string>
  geprueft: number
  entfernt: number
  ytAusTonspur: number
  adressen: number
  totEntfernt: number
  ytEntfernt: number
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  checksJePlattform: Map<string, DubCheck[]>
  anisearch: Record<string, AnisearchEintrag>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
}) {
  /**
   * **Was Daniel bei Prime gemeldet hat, wird zum Verweis.**
   *
   * `fetch-rohfolgen.ts` legt die gemeldeten Folgen über unsere Zählung und
   * schreibt das Ergebnis nach `data/prime-zugeordnet.json`. Diese Datei las
   * bis zum 29.08.2026 **niemand** — die ganze Kette von der Erweiterung über
   * den Briefkasten bis zur Zuordnung endete in einer Datei, die nirgends
   * ankam. Der Fund kam aus der ersten echten Messung mit `titel_id`: Zwei
   * Adressen waren sauber zugeordnet, und im Datensatz änderte sich nichts.
   *
   * Zwei Dinge entstehen daraus:
   *
   * - **Die Sprachangabe.** Nennt irgendeine gemeldete Folge „Deutsch", ist
   *   `dub: true` belegt — von einer angemeldeten Sitzung an der Seite selbst,
   *   also der stärkste Beleg, den dieses Projekt kennt.
   * - **Die Adresse.** Gemeldet wird oft von einer **Suchadresse**; die Meldung
   *   bringt die ASIN der Seite mit, auf der Daniel tatsächlich war. Daraus
   *   wird eine echte Titelseite, und die nächste Prüfung beginnt nicht wieder
   *   bei der Suche.
   *
   * **Ein Handbeleg schlägt das trotzdem.** Er ist dieselbe Quelle, nur
   * ausdrücklich eingetragen — und er kann ein Nein enthalten, das eine
   * automatische Ergänzung nicht überschreiben darf (CLAUDE.md, „ein Titel ohne
   * Verweis ist nicht dasselbe wie ein Titel ohne geprüften Verweis").
   */
  {
    const roh = readJson<
      Record<
        string,
        {
          titleId: number
          asin: string | null
          /** Die gemeldete Seite (Migration 030), wenn die Rohfolgen sie tragen. */
          seite?: string | null
          /* Wer gemeldet hat. */
          plattform: string
          folgen: { unsere: number | null; sprachen: string[] }[]
        }
      >
    >('data/prime-zugeordnet.json', {})
    let ausRoh = 0
    let adressen = 0
    /** Meldungen, die einen dritten Prime-Verweis angelegt hätten — siehe unten. */
    let uebersprungen = 0
    /** Zuordnungen, deren Adresse ein Handbeleg einem anderen Titel zuschreibt. */
    let fremdeAdresse = 0
    for (const [schluessel, eintrag] of Object.entries(roh)) {
      const title = titles.get(eintrag.titleId)
      if (!title) continue
      /*
        **Ein Handbeleg gilt seiner Adresse, nicht der ganzen Plattform.**

        Der Riegel stand hier als `checks.has(<titel>|primevideo)` — je Titel
        und Anbieter gibt es genau einen zusammengeführten Beleg, also sperrte
        eine geprüfte Ausgabe jede Meldung zur zweiten. Genau den Fall
        beschreibt der Kommentar unten seit dem 30.08.2026: „My First
        Girlfriend is a Gal" läuft bei Prime als Kauftitel mit elf Folgen (KAZÉ,
        FSK 16, deutsch) **und** über den Crunchyroll-Kanal mit zehn (FSK 18).
        Daniel hatte den Kanal-Titel am 30.08. geprüft; seine Meldung zum
        Kauftitel vom 01.09. lief deshalb ins Leere und lag am 05.09.2026 noch
        unverwertet im Briefkasten.

        **Was der Riegel schützen soll, bleibt geschützt:** Ein Beleg **ohne**
        Adresse ist eine Aussage über den Anbieter — er sperrt weiter alles.
        Einer **mit** Adresse sperrt genau diese Adresse. Ein Nein zur einen
        Ausgabe ist kein Nein zur anderen; sie haben verschiedene Verlage,
        verschiedene Preise und verschiedene Tonspuren.
      */
      /*
        **Der Verweis gehört dem Anbieter, der gemeldet hat.**

        Hier stand dreimal `'primevideo'` fest verdrahtet — aus der Zeit, als nur
        Prime Rohfolgen meldete. Sobald Netflix oder Disney+ dieselbe Route
        gehen (`status.md`, „Sammeln und Zuordnen vollstaendig trennen"), wäre
        daraus ein Prime-Verweis auf eine Netflix-Adresse geworden.

        Alles Amazon-Eigene bleibt an Prime gebunden: die Seite aus der ASIN und
        der Rückfall auf eine vorhandene Suchadresse. Bei den übrigen Anbietern
        ist die gemeldete Adresse die Seite, und eine Suchadresse gibt es dort
        nicht.
      */
      const plattform = eintrag.plattform as PlatformId
      const beleg = checks.get(dubKey(eintrag.titleId, plattform))
      /*
        **Die gemeldete Adresse ist die Seite — die ASIN je Zeile ist die Folge.**

        Der Schlüssel dieser Ablage trägt `url#asin`; `url` ist die Seite, auf
        der Daniel stand. `eintrag.asin` stammt dagegen aus der ersten Zeile der
        Gruppe, und bei einer Folgenliste gehört sie der **ersten Folge**: Die
        Meldung zu `dp/B0GPD4GNLL` (My First Girlfriend Is a Gal, Kauftitel)
        führte elf Zeilen mit elf verschiedenen ASINs, die erste `B0GSSL7BMZ`.
        Ein Verweis darauf führt auf eine einzelne Folge statt auf den Titel.

        Die ASIN bleibt der Weg für Meldungen von einer **Suchadresse** — dort
        gibt es keine Seite, auf die man verweisen könnte, und genau dafür ist
        sie mitgeschickt worden.
      */
      const gemeldeteAdresse = schluessel.split('#')[0]!
      let seite =
        plattform !== 'primevideo'
          ? gemeldeteAdresse
          : /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\//i.test(gemeldeteAdresse)
            ? amazonAdresseRichten(gemeldeteAdresse)
            : eintrag.asin
              ? amazonTitelAdresse(eintrag.asin)
              : null
      if (beleg && (!beleg.url || adressGleich(beleg.url, seite ?? undefined))) continue
      /*
        **Gehört die Adresse laut Handbeleg einem anderen Titel, gilt die Meldung nicht ihr.**

        Rohfolgen tragen die Adresse der Prüfliste, nicht die der Seite, auf der
        gemeldet wurde (die ASIN hier ist die der ersten Folge). Nach einem
        Staffelwechsel landete so die deutsche Staffel 2 von „Vinland Saga"
        unter `B0C55SJB1W` — der Seite von Staffel 1, die laut Meldung vom
        17.09.2026 nur japanischen Ton hat. Im Panel stand „24 Fg. 🇩🇪 ✓" an
        einer Seite ohne Deutsch. Gemessen: sieben Zuordnungen widersprechen so
        einem Handbeleg. Übersprungen statt umgebogen — welche Seite die
        richtige ist, sagt die Rohfolge nicht.
      */
      const fremdBelegt = (adresse: string | null): boolean =>
        Boolean(adresse) &&
        alleChecks.some(
          (c) =>
            c.platform === plattform && c.url && c.anilistId !== eintrag.titleId && adressGleich(c.url, adresse ?? undefined),
        )
      /* Seit Migration 030 kennt die Rohfolge die gemeldete Seite — dann gilt die Meldung ihr. */
      if (fremdBelegt(seite) && plattform === 'primevideo' && eintrag.seite) {
        seite = amazonTitelAdresse(eintrag.seite)
      }
      if (fremdBelegt(seite)) {
        fremdeAdresse++
        continue
      }
      const deutsch = eintrag.folgen.some((f) => f.sprachen.includes('Deutsch'))
      if (!deutsch) continue

      /**
       * **Zwei Ausgaben desselben Titels sind zwei Wege, keine Dublette.**
       *
       * Prime führt „My First Girlfriend is a Gal" als Kauftitel mit 11 Folgen
       * und FSK 16 — die KAZÉ-Fassung samt OVA, mit deutscher Synchro — und
       * über den Crunchyroll-Kanal mit 10 Folgen und FSK 18, mit völlig anderen
       * Folgentiteln, weil zwei Verlage unabhängig übersetzt haben (Daniel,
       * 30.08.2026, mit Bildern; Verlagsangaben bei Anime2You und
       * AnimeNachrichten nachgeschlagen).
       *
       * Bis hierher nahm der Bau je Titel **einen** Prime-Verweis, und die
       * zweite Meldung überschrieb die erste. Für einen Besucher sind es aber
       * zwei Angebote mit verschiedenem Inhalt und verschiedenem Preis — genau
       * die Frage, für die er die Seite aufruft.
       *
       * Gesucht wird deshalb nach **dieser** Adresse. Nur wenn es sie noch nicht
       * gibt, greift der Rückfall auf einen vorhandenen Prime-Verweis mit
       * Suchadresse: Der ist keine eigene Ausgabe, sondern eine offene Frage,
       * und wird von der Titelseite abgelöst.
       *
       * Die Oberfläche trennt beide schon: Sie gruppiert nach Zugangsart, also
       * steht der Kauftitel unter „Kaufen oder leihen" und der Kanal-Titel unter
       * „Im Abo".
       */
      const da =
        (seite ? title.streams.find((x) => x.platform === plattform && x.url === seite) : null) ??
        (plattform === 'primevideo'
          ? title.streams.find((x) => x.platform === 'primevideo' && /amazon\.[a-z.]+\/s\?/i.test(x.url))
          : undefined)
      if (da) {
        if (da.dub !== true) {
          da.dub = true
          ausRoh++
        }
        /* Eine Titelseite schlägt eine Suchadresse — nie umgekehrt. */
        if (seite && /amazon\.[a-z.]+\/s\?/i.test(da.url)) {
          da.url = seite
          adressen++
        }
      } else if (seite) {
        /*
          **Zwei Ausgaben sind zwei Wege — zweiundfünfzig sind ein Fehler.**

          Der Kommentar darüber erlaubt bewusst einen zweiten Prime-Verweis je
          Titel. Wie schnell daraus etwas anderes wird, zeigt der Verlauf von
          `data/prime-zugeordnet.json`: Über alle Fassungen zusammengenommen
          stehen dort **3.136 Adressen**, und die Verteilung sagt, was sie sind
          — 52 für „Niklaas, ein Junge aus Flandern", 51 für „Fullmetal
          Alchemist", 50 für „Digimon Frontier". Eine je Folge, aus der Zeit vor
          dem 02.09.2026, als Prime jeder Folge eine eigene ASIN gab und die
          Gruppierung ihr darin folgte.

          Der Gruppierungsfehler ist behoben, aber die Zahl bleibt der Maßstab:
          Ein Titel hat bei Prime zwei Wege, die ein Besucher unterscheiden kann
          — im Abo und zum Kauf. Genau danach gruppiert die Oberfläche. Ein
          dritter Verweis beantwortet keine Frage mehr, die der zweite offen
          gelassen hätte, und ist viel eher ein Artefakt als eine dritte
          Ausgabe.

          **Der Deckel gilt nur für das Anlegen.** Eine Sprachangabe an einem
          vorhandenen Verweis (oben) und ein Handbeleg gehen ihn nichts an.
        */
        if (title.streams.filter((x) => x.platform === plattform).length >= 2) {
          uebersprungen++
          continue
        }
        /*
          **Und keine Adresse, die die Linkprüfung als tot kennt** (17.09.2026). Die
          gemeldeten Folgen belegen die Sprache der Seite, nicht ihren Fortbestand: Bei
          „Your Name." hat Amazon die Ausgabe nach Daniels Meldung vom 31.08. gelöscht,
          und diese Runde legte den 404 nach jedem Bau erneut an — dieselbe Stelle wie
          bei den Handbelegen eine Runde später.
        */
        if (lautPruefungTot(seite)) continue
        title.streams.push({ platform: plattform, url: seite, dub: true })
        ausRoh++
      }
    }
    if (ausRoh || adressen) {
      log(`${ausRoh} Prime-Verweise aus Daniels Meldungen belegt, ${adressen} Suchadresse(n) durch die Titelseite ersetzt`)
    }
    if (uebersprungen) {
      log(`${uebersprungen} Meldung(en) haetten einen dritten Prime-Verweis angelegt \u2014 uebersprungen`)
    }
    if (fremdeAdresse) log(`${fremdeAdresse} Zuordnung(en) übersprungen: die Adresse gehört laut Handbeleg einem anderen Titel`)
  }

  /**
   * Jedem Verweis seine Zugangsart geben.
   *
   * Steht spät, damit auch die ergänzten und umsortierten Verweise sie bekommen.
   * Was es kostet, entscheidet `shared/zugangsart.ts` aus Name, Adresse und der
   * Angabe des Anbieters selbst — `kind: 'buy'` ist die stärkste davon.
   */
  for (const title of titles.values()) {
    /**
     * Die lizenzierte Angabe von JustWatch (über TMDB) schlägt die Namensliste.
     *
     * Sie gilt für **diesen Titel bei diesem Anbieter**, nicht für den Anbieter
     * im Allgemeinen — und genau daran scheiterte das Raten: Prime Video führt
     * Abo-Titel und Kauftitel nebeneinander. Gemessen am 23.08.2026 betraf das
     * 28 von 774 belegbaren Verweisen, alle bei Prime Video als „abo" geraten.
     *
     * Die Daten lagen die ganze Zeit in `data/tmdb-titles.json`; ausgewertet
     * wurden sie bisher nur für Anbieter **ohne** eigene Plattform.
     */
    const angebote = tmdbTitles[title.id]?.offers ?? []
    const jwArt = (platform: PlatformId) =>
      angebote.find((o) => providerToPlatform(o.name) === platform)?.kind

    for (const s of title.streams ?? []) {
      // Der YouTube-Kanal entscheidet über Kauf oder kostenlos — siehe
      // `zugangsart()`. Er steht in den Befunden, nicht im Verweis selbst.
      const kanal = s.platform === 'youtube' ? ytKanal[s.url] : undefined
      /* Auf der Seite gemessen schlägt JustWatch je Titel — siehe `zugangJeAdresse`. */
      const gemessen =
        s.platform === 'primevideo'
          ? zugangJeAdresse.get(adressKern(s.url))
          : s.platform === 'joyn'
            ? joynZugang.get(s.url)
            : undefined
      s.zugang = gemessen ?? zugangsart(s.platform, undefined, s.url, jwArt(s.platform), kanal, ytKauf.has(s.url))
    }
    for (const w of title.watchLinks ?? []) {
      w.zugang = zugangsart(w.name, w.kind, w.url, jwArt(providerToPlatform(w.name) as PlatformId))
    }
  }

  if (checks.size) {
    log(
      `${geprueft} geprüfte Synchro-Angaben übernommen, ${entfernt} tote Verweise entfernt (${checks.size} Prüfungen)` +
        (ytAusTonspur ? `, ${ytAusTonspur} YouTube-Urteile aus der Tonspur-Angabe` : ''),
    )
  }
  if (adressen) {
    log(`${adressen} Anbieter-Adressen durch die von Hand geprüfte ersetzt`)
  }
  if (totEntfernt) log(`${totEntfernt} Verweise entfernt: die Seite dahinter antwortet mit 404`)
  if (ytEntfernt) log(`${ytEntfernt} YouTube-Verweise entfernt: dort ist in Deutschland kein Video abrufbar`)

  /**
   * Auch Kaufwege können ins Leere führen.
   *
   * Die Bereinigung fasste bis zum 20.08.2026 nur `streams` an. In den
   * `watchLinks` standen daneben **188** Adressen, die mit 404 oder einer
   * Regionssperre antworten — dieselbe Prüfung, dieselben Befunde, nur nie
   * angewendet. Aufgefallen ist es, weil Daniel einen Kaufweg anklickte, der
   * nicht funktionierte.
   */
  let kaufwegeEntfernt = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => {
      const s = linkBefunde[w.url]?.status
      return !(s === 404 || s === 'region')
    })
    kaufwegeEntfernt += vorher - title.watchLinks.length
    if (!title.watchLinks.length) delete title.watchLinks
  }
  if (kaufwegeEntfernt) log(`${kaufwegeEntfernt} Kaufwege entfernt: die Seite dahinter ist weg oder hier gesperrt`)

  /**
   * Ein Suchlink weicht der echten Produktseite.
   *
   * AniList liefert für die meisten Titel keinen Deeplink zu Prime Video,
   * deshalb steht dort eine Suche — am 20.08.2026 bei **225 von 226**
   * Verweisen. Das ist besser als ins Nichts zu schicken, aber schlechter als
   * die Seite selbst: Daniel musste beim Prüfen jedes Mal erst den richtigen
   * Treffer heraussuchen („zu mühselig, alles von Hand zu prüfen").
   *
   * Für 137 dieser Titel steht die echte Adresse längst in unserem
   * aniSearch-Bestand — nur unter dem Anbieternamen `amazon`, der bei uns als
   * **Kauf** gilt. Ob dahinter ein Video oder eine Disc liegt, lässt sich den
   * Daten nicht ansehen; es steht im Seitentitel, und genau den liest
   * `check-links.ts` mit („Amazon.de: … ansehen | Prime Video").
   *
   * Ersetzt wird deshalb nur, was **belegt** ein Prime-Video-Eintrag ist und
   * mit 200 antwortet. Alles andere bleibt die Suche.
   */
  /*
    **Gesucht wird in zwei Beständen, nicht in einem.**

    Bis zum 25.08.2026 sah dieser Block nur in `watchLinks` nach. Dorthin schafft
    es eine aniSearch-Amazon-Adresse aber nur als Kaufweg — und Kaufwege werden
    weiter oben aussortiert, sobald die Seite tot oder hier gesperrt ist. Für
    „The Ghost in the Shell" blieb dadurch die Suchadresse stehen, obwohl
    `amazon.de/dp/B0GZD5N2GP` seit dem aniSearch-Abruf im Haus lag; Daniel
    schickte genau diese Kennung von Hand („führt beim klick auf ‚bei prime
    ansehen' auf die suchseite statt hierhin").

    Der zweite Bestand ist deshalb `data/anisearch.json` selbst. Die Bedingung
    bleibt dieselbe und ist der ganze Punkt: **belegt** ein Prime-Video-Eintrag,
    Status 200. Hinter `/dp/` kann auch eine DVD liegen, und eine Disc als Stream
    auszugeben wäre schlimmer als eine Suche.
  */
  let ersetzt = 0
  for (const title of titles.values()) {
    const prime = title.streams.find((s) => s.platform === 'primevideo')
    if (!prime || !/amazon\.[a-z.]+\/s\?/.test(prime.url)) continue
    const belegt = (u: string | undefined): u is string => {
      if (!u) return false
      const b = linkBefunde[u]
      return b?.prime === true && b.status === 200
    }
    /**
     * **Die zweite Quelle für „diese Seite gibt es": Daniels eigene Notiz.**
     *
     * Der Riegel darüber verlangt einen Link-Befund mit Status 200. Den gibt es
     * für Amazon nur in Losen — der Prüflauf kommt nach rund 660 Abrufen in die
     * Abwehr und bucht danach `unklar` (623 Adressen am 07.09.2026). Deshalb
     * stand am 10.09.2026 für 33 Titel eine Amazon-**Suche** im Kalender,
     * obwohl aniSearch die Titelseite kennt und Daniel sie beim Prüfen selbst
     * offen hatte.
     *
     * Genau das ist der Beleg: Seine Notiz nennt die Kennung, auf der er
     * nachgesehen hat („Amazon-Seite B0F2GXP162 … Seitenadresse: B0DXS2THFS").
     * Steht **dieselbe** Kennung auch in aniSearchs Quellenliste, haben zwei
     * unabhängige Stellen dieselbe Seite genannt — ein Mensch mit der Seite vor
     * Augen schlägt einen HTTP-Statuscode.
     *
     * Gemessen: 19 der 33 tragen das. Die übrigen 14 bleiben bei der Suche —
     * entweder kennt aniSearch keine Kennung (7) oder die Notiz nennt eine
     * andere Seite als aniSearch (7), und dann entscheidet nichts.
     */
    const ausNotiz = (): string | undefined => {
      const notizen = (checksJePlattform.get(dubKey(title.id, 'primevideo')) ?? [])
        .map((c) => c.note ?? '')
        .join(' ')
      if (!notizen) return undefined
      for (const quelle of anisearch[title.id]?.streams ?? []) {
        const kennung = /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,})/i.exec(
          String(quelle.url ?? ''),
        )?.[1]
        if (kennung && notizen.includes(kennung)) return amazonTitelAdresse(kennung)
      }
      return undefined
    }
    const echt =
      (title.watchLinks ?? []).find((w) => belegt(w.url))?.url ??
      (anisearch[title.id]?.streams ?? [])
        .map((s) => s.url?.split('?')[0])
        .find((u) => belegt(u)) ??
      ausNotiz()
    /*
      **Auch hier keine Adresse, die die Linkprüfung als tot kennt** (18.09.2026,
      Mob Psycho 100 und Horimiya). `ausNotiz()` baut die Adresse aus der Kennung
      neu (`amazonTitelAdresse`) und fragt dabei nicht nach, ob sie noch lebt.
      Ein zweiter, per `verweise-von-hand.yaml` angelegter Verweis auf dieselbe
      — lebende — Kennung wurde danach als Dublette verworfen, und übrig blieb
      die hier neu eingesetzte tote Adresse. Dieselbe Stelle wie bei den
      Handbelegen und den Rohfolgen: Der Riegel gehört vor jede Zuweisung.
    */
    if (!echt || lautPruefungTot(echt)) continue
    /*
      **Und keine Adresse, die ein Handbeleg als nicht verfügbar führt** (21.09.2026).
      Golden Wind stand mit einer Prime-Suche im Bestand; der Belegfilter weiter oben lief
      über die Suchadresse und fand nichts. Erst hier wurde daraus B0CG7KDCTS — der Kopf
      der JoJo-Sammelseite, den ein Handbeleg am selben Morgen mit `available: false`
      ausgetragen hatte. `check:handbelege` brach den Bau ab (Lauf 35566086288), und
      gefunden hat es eine Instrumentierung, die jede Änderung an den Streams des Titels
      mitschrieb. Dritte Stelle dieser Art nach dem 26.08. und dem 17.09.2026: Jede
      Zuweisung einer Adresse fragt den Beleg zu genau dieser Adresse.
    */
    const belegZurAdresse = belegFuer(title.id, 'primevideo', echt, 2)
    if (belegZurAdresse?.available === false || belegZurAdresse?.dub === false) continue
    prime.url = echt
    ersetzt++
  }
  if (ersetzt) log(`${ersetzt} Prime-Suchlinks durch die echte Produktseite ersetzt`)

  /**
   * Was auf Crunchyrolls Serienseiten steht — als Beleg, nicht als Vorbild.
   *
   * Der Scraper liest dort je Folge, ob eine deutsche Tonspur vorliegt.
   * Übernommen wird ausschließlich diese Auskunft; Crunchyrolls
   * Staffeleinteilung bleibt draußen. Sie enthält Folgendoppelungen, mehrfache
   * Wähler-Einträge zur selben Staffel und Blöcke, die zwei unserer Staffeln
   * zusammenfassen (Daniel, 12.08.2026). Unsere Einteilung kommt von AniList
   * und bleibt maßgeblich.
   *
   * Handgeprüftes schlägt auch das: Der Block läuft **vor** dem Einlesen von
   * `dub-confirmed.yaml`, damit ein Mensch das letzte Wort behält.
   */
  /*
    **Titel ohne Verweis, für die der deutsche Crunchyroll-Katalog Deutsch führt.**

    1.331 Titel im Bestand haben keinen einzigen Verweis. Für 101 nannte TMDB
    Crunchyroll als Anbieter; `tools/cr-vorschlaege-pruefen.mjs` hat sie am
    28.08.2026 einzeln in der Suche nachgeschlagen — von einer deutschen Leitung,
    weil Crunchyroll die Region aus der IP ableitet.

    Sieben davon führen `de-DE` in ihren Tonspuren. Das ist ein **Beleg**, keine
    Vermutung: Die Angabe steht am Werk selbst und kommt aus dem Katalog, den ein
    Besucher hier sieht.

    **Ein Handbeleg schlägt sie trotzdem.** Wer in `dub-confirmed.yaml` steht,
    wurde angesehen — auch wenn dort ein Nein steht. Das ist die Regel, an der
    am 25.08.2026 ein Lauf fünf geprüfte Neins überschrieben hat.
  */
  const crVorschlaege = readJson<
    Record<string, { gefunden?: boolean; seriesId?: string; crTitel?: string; deutsch?: boolean }>
  >('data/cr-vorschlaege.json', {})
  let crErgaenzt = 0
  for (const [id, v] of Object.entries(crVorschlaege)) {
    if (!v.deutsch || !v.seriesId) continue
    const title = titles.get(Number(id))
    if (!title) continue
    if (title.streams.some((x) => x.platform === 'crunchyroll')) continue
    /* Ein Handbeleg — auch ein verneinender — hat Vorrang. */
    if (checks.has(dubKey(Number(id), 'crunchyroll'))) continue
    title.streams.push({
      platform: 'crunchyroll',
      url: `https://www.crunchyroll.com/de/series/${v.seriesId}`,
      dub: true,
    })
    crErgaenzt++
  }
  if (crErgaenzt) log(`${crErgaenzt} Crunchyroll-Verweise aus der Suche ergänzt (deutscher Katalog nennt de-DE)`)
}
