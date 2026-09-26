import { readJson, log } from '../lib/util.ts'
import { adressKern, loadDubChecks, dubKey, adressGleich, type DubCheck } from '../lib/dub-confirmed.ts'
import { zugangsart } from '../../shared/zugangsart.ts'
import { type WatchLink, type StreamLink, type Title, type Release } from '../../shared/types.ts'
import { providerName, stripAffiliate } from '../../shared/mappings.ts'
import { plattformVon } from '../lib/cartoons.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { schreibeSuchadressen } from './nebendateien.ts'
import { type JwAngebot, gtiAus, amazonGtiWahl } from '../lib/amazon-gti.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type AnisearchEintrag } from './01-quellen.ts'

export function schliesseWegeAb({
  titles,
  anisearch,
  releases,
  zugangJeAdresse,
  tmdbMehrdeutig,
  toteAdressen,
  linkBefunde,
  verweiseEntfernt,
  crAdresseZu,
  beantworteteSuchen,
  suchOffen,
  alleChecks,
  lautPruefungTot,
  checksJePlattform,
}: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  releases: Release[]
  zugangJeAdresse: Map<string, "abo" | "kauf">
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  verweiseEntfernt: EntfernterVerweis[]
  crAdresseZu: (name: string) => string | undefined
  beantworteteSuchen: Set<string>
  suchOffen: { id: number; titel: string; plattform: string; url: string; }[]
  alleChecks: DubCheck[]
  lautPruefungTot: (url: string) => boolean
  checksJePlattform: Map<string, DubCheck[]>
}) {
  /*
    **Alles, was Verweise ändert, muss vor dieser Zeile stehen.**

    `allTitles` ist der Ausgangspunkt der Auslieferung: `slim` baut daraus flache
    Kopien. Eine **Mutation** an einem vorhandenen Objekt wirkt dort noch durch
    (die `streams`-Arrays sind dieselben Referenzen), eine **Zuweisung** wie
    `title.watchLinks = […]` nicht — die Kopie trägt dann den alten Wert.

    Am 29.08.2026 zweimal in einer Stunde erlebt: erst standen die Disc-Wege zu
    früh (vor den Bereinigungen, 87 statt 176 kamen an), dann zu spät (hinter
    `slim`, **null** kamen an). Dazwischen liegt genau ein richtiger Platz.
  */

  /**
   * **Deutsche Disc-Ausgaben aus dem aniSearch-Archiv.**
   *
   * Für einen Anime von 2002 ist „Kein Anbieter bekannt" richtig und trotzdem
   * eine Sackgasse: Er lief nie bei einem Streamingdienst, es gab ihn auf DVD.
   * Am 29.08.2026 stand das bei **1.041 Titeln**, 693 davon mit belegter
   * deutscher Synchro.
   *
   * `extract-disc-ausgaben.ts` liest die Ausgaben aus dem Archiv, das der
   * aniSearch-Lauf ohnehin anlegt — kein zusätzlicher Abruf. 584 Titel haben
   * eine deutsche Ausgabe, **176 davon zeigen sonst keinen einzigen Weg**.
   *
   * **Ohne Sprachaussage.** Eine deutsche Disc kann untertitelt sein; im Archiv
   * steht wörtlich „Saber Marionette J (OmU)". Der Eintrag ist deshalb ein
   * `watchLink` vom Typ `buy` wie jeder andere und trägt kein `dub`.
   *
   * **Die Stelle im Bau entscheidet mit — sie steht deshalb hier hinten.**
   * Beim ersten Einbau am 29.08.2026 lief der Block **vor** den Bereinigungen:
   * Er sah 176 wegelose Titel, die Crunchyroll-Bereinigung machte danach
   * weitere wegelos, und die gingen leer aus. Gemessen kamen 87 statt 176 an.
   * Dieselbe Reihenfolge-Falle wie bei der Zugangsart darunter, und dieselbe
   * Antwort: Wer den Endzustand braucht, läuft am Ende.
   *
   * **Und nur, wo sonst nichts steht** (so bis 16.09.2026, siehe unten). Wer einen Stream hat, braucht keinen
   * Hinweis auf eine womöglich vergriffene DVD von 2005 — der Verweis wäre dort
   * Rauschen statt Auskunft.
   */
  {
    const discAusgaben = readJson<Record<string, { edition: string; datum: string; url?: string }[]>>(
      'data/disc-ausgaben.json',
      {},
    )
    let discWege = 0
    for (const title of titles.values()) {
      /*
        **Überholt am 16.09.2026: auch neben anderen Wegen.** Der Riegel „nur, wo
        sonst nichts steht" stammt aus der Zeit vor dem Disc-Reiter. Seit Stream
        und Disc getrennt stehen, ist eine Disc kein Rauschen neben einem Stream.
        Anlass: „Dragon Quest: The Adventure of Dai" zeigte nur die Animeversand-DVD
        (Folgen 1–75), während aniSearch vier Blu-ray-Boxen und ein Komplettset von
        Kazé führt — dazu der Hinweis, 76–100 biete niemand an (Daniel, mit Bild).
        Gemessen: 1.073 Titel mit belegter deutscher Disc-Ausgabe und einem anderen
        Weg bekamen bisher keine.
      */
      if ((title.watchLinks ?? []).some((w) => w.name === 'aniSearch')) continue
      const ausgaben = discAusgaben[String(title.id)]
      if (!ausgaben?.length) continue
      const erste = ausgaben[0]!
      title.watchLinks = [
        ...(title.watchLinks ?? []),
        {
          /*
            **Der Name ist konstant, die Zahl nicht.** Die „Wo?"-Ansicht buendelt
            ueber den Anbieternamen; „aniSearch — 6 Disc-Ausgaben" und
            „aniSearch — 2 Disc-Ausgaben" waeren dort zwei verschiedene
            Anbieter, und aus 176 Titeln wuerden Dutzende Einzelgruppen.
            Beinahe eingebaut am 29.08.2026, gefangen beim Nachlesen.
          */
          /*
            **Das Wort „Disc" ist weg, das Zeichen sagt es besser.** Daniel am
            07.09.2026: „füg ein cd icon links in die pill statt disc zu
            schreiben. einfach icon + anisearch". Die Pille trägt seither ein
            Silberscheiben-Zeichen; der Name nennt nur noch die Quelle.
          */
          name: 'aniSearch',
          url: erste.url ?? `https://www.anisearch.de/anime/${title.id}`,
          kind: 'buy',
        },
      ]
      discWege++
    }
    if (discWege) log(`${discWege} Titel haben jetzt ihre deutsche Disc-Ausgabe als Bezugsweg`)
  }

  /**
   * **Zweite Stufe: die deutsche Veröffentlichung aus dem Sprachblock.**
   *
   * Der Block darüber liest `<section id="items">` aus dem HTML-Archiv — die
   * **kaufbaren Artikel**. Bei älteren Titeln steht dort nichts, obwohl es die
   * deutsche Ausgabe gab: Gemessen am 07.09.2026 führte
   * `data/disc-ausgaben.json` **keinen einzigen** der 489 weglosen Titel,
   * während aniSearchs Sprachblock für 360 von ihnen eine deutsche
   * Veröffentlichung nennt — mit Zeitraum, Status und Verlag:
   *
   *     School Rumble    Abgeschlossen  23.01.2006 - 26.10.2007
   *                      Tokyopop GmbH, Nipponart GmbH        dubbed: true
   *
   * Diese Angabe liegt in `data/anisearch.json` und wurde bisher von niemandem
   * für die Wegfrage gelesen. Sie halbiert die Lücke: **246 Titel** bekommen so
   * einen belegten Bezugsweg, die weglosen fallen von 489 auf 243.
   *
   * **Drei Riegel, jeder mit Grund:**
   *
   * - **Nur mit Verlag.** Ein Block ohne Verlag kann eine Ankündigung sein; mit
   *   Verlag ist es eine Veröffentlichung, die es gegeben hat. 252 der 360
   *   tragen einen.
   * - **Nur erschienene Status.** „Zukünftig" ist kein Bezugsweg, sondern ein
   *   Termin — und der gehört in den Kalender, nicht in die Wegliste.
   * - **Kein Synchro-Beleg.** Der Block trägt zwar `dubbed`, und das ist laut
   *   `CLAUDE.md` das belastbare Signal (917 von 967 Handbelegen). Der Weg hier
   *   sagt trotzdem nichts über die Sprache — genau wie der Disc-Weg darüber.
   *   Eine Auskunft nach der anderen; wer beides in einem Schritt macht, kann
   *   hinterher nicht sagen, worauf ein Urteil beruht.
   *
   * **Und der Name bleibt konstant**, aus demselben Grund wie oben: Die
   * „Wo?"-Ansicht bündelt über ihn.
   */
  {
    let ausgabeWege = 0
    for (const title of titles.values()) {
      if (title.streams.length || (title.watchLinks ?? []).length) continue
      const block = (anisearch[title.id]?.info?.languages ?? []).find(
        (l) => l.language === 'Deutsch',
      )
      if (!block?.publisher?.length) continue
      if (!['Abgeschlossen', 'Abgebrochen', 'Laufend'].includes(String(block.status))) continue
      /*
        **Ein Kinostart ist keine Ausgabe** (Daniel, 19.09.2026, „Detektiv Conan: Der gefallene
        Engel des Highways“: „diese disc pill führt auf die titelseite … ich seh dort auch keine
        disc“). aniSearchs deutscher Block trug „Laufend, 25.08.2026, Crunchyroll“ — das ist der
        Kinostart mit dem Verleih, und der Bau machte daraus „Ausgabe bei aniSearch“ unter Disc.
        Liegt das Datum des Blocks auf einem Kinotermin desselben Titels (±3 Tage), ist es keine.
      */
      const blockTag = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(block.released ?? ''))
      const blockIso = blockTag ? `${blockTag[3]}-${blockTag[2]}-${blockTag[1]}` : undefined
      const imKino =
        blockIso &&
        releases.some(
          (r) =>
            r.titleId === title.id &&
            r.platform === 'kino' &&
            Math.abs(Date.parse(r.schedule.firstEpisodeDate) - Date.parse(blockIso)) <= 3 * 86_400_000,
        )
      if (imKino) continue
      const as = anisearch[title.id]?.anisearchId
      title.watchLinks = [
        {
          /*
            **Der Name behauptet keine Sprachfassung** (Stichprobe 17.09.2026). Er hieß
            „Deutsche Ausgabe bei aniSearch" und stand bei allen 186 Titeln unter der
            Überschrift „Noch keine deutsche Fassung" — zwei Sätze, die sich für den
            Leser widersprechen. Der Sprachblock belegt eine Veröffentlichung hier, nicht
            ihre Tonspur; ohne Synchro-Marke kann es eine untertitelte Ausgabe sein.
          */
          name: 'Ausgabe bei aniSearch',
          url: as ? `https://www.anisearch.de/anime/${as}` : `https://www.anisearch.de/anime/${title.id}`,
          kind: 'buy',
        },
      ]
      ausgabeWege++
    }
    if (ausgabeWege)
      log(`${ausgabeWege} Titel ohne Weg haben jetzt eine belegte deutsche Veröffentlichung als Bezugsweg`)
  }

  /**
   * **Nachhut: kein Verweis verlässt den Bau ohne Zugangsart.**
   *
   * Die Hauptrunde dafür steht rund tausend Zeilen weiter oben — bewusst spät,
   * damit sie die ergänzten und umsortierten Verweise mitnimmt. Trotzdem wurde
   * sie seither dreimal überholt: am 25.08.2026 von drei Verweisen (Gintama,
   * DEATH NOTE Rewrite, Durarara!!), am 29.08.2026 von einem weiteren
   * (Kickers, Crunchyroll aus der Suchergänzung). Jedes Mal wurde die neue
   * Stelle einzeln nachgezogen, und jedes Mal kam die nächste.
   *
   * **Eine Reihenfolge, die man beim Einbau mitdenken muss, hält nicht** — das
   * steht für die Handbelege längst in CLAUDE.md und gilt hier genauso. Diese
   * Schleife braucht niemand mitzudenken: Sie läuft nach der letzten Stelle,
   * die Verweise anlegt, und füllt nur, was noch leer ist. Ein bereits
   * gesetzter Wert wird nicht angefasst — die Hauptrunde kennt die
   * JustWatch-Angabe und den YouTube-Kanal, hier fehlen beide.
   *
   * Wird sie einmal überflüssig, meldet sie es selbst: Sie zählt, was sie
   * nachträgt, und schweigt bei null.
   */
  let nachgetragen = 0
  for (const title of titles.values()) {
    for (const s of title.streams ?? []) {
      if (s.zugang) continue
      s.zugang = (s.platform === 'primevideo' ? zugangJeAdresse.get(adressKern(s.url)) : undefined) ?? zugangsart(s.platform, undefined, s.url)
      nachgetragen++
    }
    for (const w of title.watchLinks ?? []) {
      if (w.zugang) continue
      w.zugang = zugangsart(w.name, w.kind, w.url)
      nachgetragen++
    }
  }
  if (nachgetragen) {
    log(`${nachgetragen} Verweis(e) nachträglich mit Zugangsart versehen — sie entstanden nach der Hauptrunde`)
  }

  /**
   * **Bei YouTube gilt eine Pille erst ab einer belegten Synchro.**
   *
   * Daniel am 07.09.2026 an „Kill Blue": „youtube hat nur untertitel, also weg
   * damit, wir führen nur >1 folge synchro pillen dort."
   *
   * YouTube ist der einzige Anbieter im Bestand, bei dem ein Verweis meist auf
   * eine **Playlist** zeigt, und was darin liegt, ist überwiegend untertitelt —
   * Trailer, Werbefolgen, ganze Staffeln mit Untertiteln. Ein „🇩🇪 ?" behauptet
   * dort nichts Falsches und ist trotzdem irreführend: Es sieht aus wie ein
   * Weg zur deutschen Fassung, und in aller Regel ist es keiner.
   *
   * Bei jedem anderen Anbieter bleibt das Fragezeichen richtig, und diese
   * Regel gilt ausdrücklich nur für YouTube. Der Unterschied ist die
   * Trefferquote: Bei Netflix oder Prime führt ein unbeantworteter Verweis in
   * aller Regel zu einer Seite, auf der es die Serie wirklich gibt.
   *
   * **Ins Gedächtnis der entfernten Verweise kommt das nicht.** Es ist kein
   * belegtes Nein, sondern eine fehlende Auskunft — sobald eine Prüfung sie
   * liefert, gehört der Weg zurück.
   */
  /**
   * **Ein Titel ohne jeden Bezugsweg — was JustWatch dazu kennt.**
   *
   * 243 Titel im Hauptbestand hatten am 07.09.2026 keinen einzigen Weg. Für
   * sie beantwortet der Kalender Punkt 4 des Projektziels gar nicht („Nicht
   * nur wann, auch wo"), und das ist bei den meisten Titeln **die** Frage: Nur
   * gut hundert haben überhaupt einen anstehenden Termin.
   *
   * `data/justwatch-audio.json` nennt zu jedem Angebot eine Adresse. Sie
   * kommen hier als **Bezugswege** an, nicht als Verweise mit Sprachurteil:
   * Die Tonspurangabe gilt der Serie, nicht der Folge, und daraus wird
   * grundsätzlich kein `dub`.
   *
   * Vier Riegel, jeder mit belegtem Anlass:
   *
   * | Riegel | warum |
   * |---|---|
   * | nur Titel **ohne** jeden Weg | wo schon einer steht, ist die Frage beantwortet — und unsere Adresse ist die geprüfte |
   * | nichts, was einmal entfernt wurde | sonst kommt ein belegtes Nein über die Hintertür zurück |
   * | „JustWatch TV" fliegt raus | die Eigenwerbung des Dienstes, führt zurück auf justwatch.com |
   * | höchstens vier je Titel | eine Liste von zwölf Amazon-Varianten beantwortet keine Frage |
   */
  /**
   * Händler, die bei JustWatch eine **Disc** verkaufen oder verleihen. Alle übrigen
   * Kauf- und Leihangebote dort sind digital. Belegt an den Anbietern im Bestand vom
   * 16.09.2026; Videobuster steht hier, weil es vor allem Discs per Post verleiht.
   */
  const PHYSISCHE_SHOPS =
    /amazon dvd|blu-ray|thalia|hugendubel|buecher|zavvi|jpc|zoxs|medimops|verleihshop|behind the tree|videobuster/i
  let jwWege = 0
  {
    const jw = readJson<
      Record<string, { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string }[] }>
    >('data/justwatch-audio.json', {})
    for (const title of titles.values()) {
      if ((title.streams ?? []).length || (title.watchLinks ?? []).length) continue
      /* JustWatch findet den Titel über dieselbe TMDB-Kennung — mehrdeutig heißt auch hier: nicht verwenden. */
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const b = jw[String(title.id)]
      if (!b || b.ohneTreffer || !b.angebote?.length) continue
      const wege: WatchLink[] = []
      for (const a of b.angebote) {
        if (!a.url || /^justwatch/i.test(a.anbieter)) continue
        if (toteAdressen.has(a.url)) continue
        const name = providerName(a.anbieter)
        if (!name || wege.some((w) => w.name === name)) continue
        /*
          **Ein Kino ist kein Bezugsweg** (Daniel, 19.09.2026: Cinestar führte nach Leipzig,
          Filmspiegel nach Essen). JustWatch kennzeichnet Kinoangebote selbst mit `art: CINEMA`
          (gemessen: Cinestar 3, UCI 2, Filmspiegel 1) — das ist sicherer als eine Namensliste,
          die „Netzkino" (ein Streamingdienst) mitgeschluckt hat. Die Spielzeiten stehen im
          Kinobanner, bundesweit über kinoheld.
        */
        if (a.art === 'CINEMA') continue
        /*
          JustWatch führt Disc-Händler und Online-Videotheken in derselben Liste. Ein
          Disc-Händler bleibt ein Kaufweg; alles andere ist digital und zählt zum
          Streamen — gemessen an 3.279 Kauf- und Leihangeboten im Bestand vom 16.09.2026.
        */
        const physisch = PHYSISCHE_SHOPS.test(a.anbieter)
        wege.push({
          name,
          /* JustWatch hängt an Amazon-Links seine Partnerkennung (`tag=movie0c6-21`). */
          url: stripAffiliate(a.url),
          kind: physisch ? 'buy' : 'stream',
          ...(physisch
            ? {}
            : { zugang: a.art === 'FLATRATE' ? 'abo' : a.art === 'FREE' || a.art === 'ADS' ? 'kostenlos' : 'kauf' }),
        } as WatchLink)
        if (wege.length >= 4) break
      }
      if (!wege.length) continue
      title.watchLinks = wege
      jwWege += wege.length
    }
  }
  if (jwWege) log(`${jwWege} Bezugswege aus JustWatch für Titel ohne jeden Weg ergänzt`)

  /**
   * **Ein Abo-Angebot mit belegtem deutschem Ton kommt auch dazu, wenn der Titel schon Wege
   * hat** (Daniel, 23.09.2026: „ja").
   *
   * Die Runde darüber ergänzt nur Titel **ohne jeden** Weg — eine Regel gegen Listen von zwölf
   * Amazon-Varianten. Sie ließ 40 Angebote liegen, bei denen JustWatch die deutsche Tonspur je
   * Angebot ausweist: One Piece bei Disney+, Naruto Shippuden und Trigun bei Prime, Dragon Ball
   * Super: Broly bei Disney+, wo wir nur Crunchyroll und Prime zeigen (gemessen 23.09.2026:
   * 24 Prime, 9 Crunchyroll, 7 Disney+).
   *
   * Drei Riegel halten die Pillenreihe schmal und die Aussage belegt:
   *
   * 1. Nur **Abo** (`FLATRATE`/`ADS`) — Kauf und Leihe stehen weiter in `watchLinks`.
   * 2. Nur mit `audio`, das `de` enthält. Ein Angebot ohne Sprachangabe belegt nichts
   *    (CLAUDE.md: „Eine Zahl am Weg braucht einen Beleg an genau diesem Weg").
   * 3. Nur Anbieter, die wir als Plattform führen, und höchstens **zwei** je Titel.
   *
   * Der Weg trägt `dub: true` — die Tonspur ist die Auskunft, wegen der er überhaupt dazukommt.
   */
  {
    const jw = readJson<
      Record<string, { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string; audio?: string[] }[] }>
    >('data/justwatch-audio.json', {})
    /**
     * **Eine Handprüfung hat das letzte Wort** (Lauf 35900967510, 23.09.2026).
     *
     * Der erste Anlauf dieser Runde legte vier Wege an, die jemand von Hand geprüft und
     * verneint hatte: Free! und Free!: Eternal Summer bei Crunchyroll („ohne deutsche
     * Tonspur"), AIR GEAR Special und Girls und Panzer Specials bei Prime („nicht
     * verfügbar"). `check:handbelege` hat den Bau dafür zu Recht rot gemacht — genau dafür
     * gibt es die Prüfung.
     *
     * JustWatch weiß, was ein Anbieter **listet**. Wer nachgesehen hat, weiß, was dort
     * wirklich läuft. Bei einem Widerspruch gewinnt das Nachsehen.
     */
    const handNein = new Set<string>()
    for (const b of loadDubChecks()) {
      if (b.dub === false || b.available === false) handNein.add(`${b.anilistId}|${b.platform}`)
    }
    let ergaenzt = 0
    for (const title of titles.values()) {
      const b = jw[String(title.id)]
      if (!b || b.ohneTreffer || !b.angebote?.length) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const vorhanden = new Set((title.streams ?? []).map((x) => x.platform))
      let neueHier = 0
      for (const a of b.angebote) {
        if (neueHier >= 2) break
        if (a.art !== 'FLATRATE' && a.art !== 'ADS') continue
        if (!(a.audio ?? []).includes('de')) continue
        if (!a.url || toteAdressen.has(a.url)) continue
        /*
          **Ein Amazon-Kanal ist nicht der Anbieter selbst** (gemessen 23.09.2026, bevor das
          live ging): `plattformVon()` vergleicht mit `startsWith`, und „RTL+ Max Amazon
          Channel" beginnt nun einmal mit „RTL+". Von 112 Kandidaten waren 68 solche Kanäle —
          ihre Adresse führt zu `watch.amazon.de`, die Pille hätte „RTL+" behauptet und Amazon
          geöffnet. Wer den Kanal gebucht hat, sieht den Weg ohnehin über Prime.
        */
        if (/Amazon Channel/i.test(a.anbieter)) continue
        const plattform = plattformVon(a.anbieter)
        if (!plattform || vorhanden.has(plattform)) continue
        if (handNein.has(`${title.id}|${plattform}`)) continue
        title.streams = [
          ...(title.streams ?? []),
          {
            platform: plattform,
            url: stripAffiliate(a.url),
            dub: true,
            ...(a.art === 'ADS' ? { zugang: 'kostenlos' as const } : { zugang: 'abo' as const }),
          } as StreamLink,
        ]
        vorhanden.add(plattform)
        neueHier++
        ergaenzt++
      }
    }
    if (ergaenzt) log(`${ergaenzt} Abo-Weg(e) aus JustWatch ergänzt (deutsche Tonspur belegt)`)
  }

  /*
    **Ein Bezugsweg führt zum Anbieter, nicht zu einer Datenbank.**

    Die Pille „maxdome · 2 Angebote" öffnete `themoviedb.org/movie/347200-3/watch`
    statt `store.maxdome.de/mo45163184` (Daniel, 16.09.2026, mit drei Bildern:
    „stattdessen direkt zu maxdome leiten → generisch fixen"). Der Kommentar an
    der erzeugenden Stelle nennt den Grund und war bis heute richtig: „Einen Link
    je Anbieter liefert TMDB nicht, nur eine Übersichtsseite."

    **JustWatch liefert ihn** — dieselbe Datenbasis, eine Ebene tiefer:
    `data/justwatch-audio.json` führt je Angebot eine Adresse beim Anbieter
    selbst. Gemessen am 16.09.2026: 1.187 Bezugswege zeigen auf themoviedb.org
    (Apple TV 248, freenet 213, MagentaTV 168, Videoload 148, maxdome 97 …),
    verteilt auf 364 Titel. Von den zehn, die JustWatch schon kennt, ließen sich
    16 von 20 Wegen ersetzen.

    Ersetzt wird nur, was zum selben Anbieter gehört. **Überholt am 22.09.2026:**
    Bis dahin blieb die Übersichtsseite stehen, wo JustWatch schwieg. Seitdem fällt
    sie weg (Videoload über die MagentaTV-Kennung ausgenommen) — siehe den Block
    „Kein Weg auf eine Datenbank" weiter unten.
  */
  let jwDirekt = 0
  let jwNeu = 0
  {
    const jw = readJson<
      Record<string, { angebote?: { anbieter: string; art?: string; url?: string; audio?: string[] }[] }>
    >('data/justwatch-audio.json', {})
    const kern = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const title of titles.values()) {
      const wege = title.watchLinks
      if (!wege?.length) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const angebote = jw[String(title.id)]?.angebote ?? []
      if (!angebote.length) continue
      for (const w of wege) {
        if (!/themoviedb.org/.test(w.url)) continue
        const treffer = angebote.find(
          (a) => a.url && (kern(a.anbieter).includes(kern(w.name)) || kern(w.name).includes(kern(a.anbieter))),
        )
        if (!treffer?.url || toteAdressen.has(treffer.url)) continue
        w.url = stripAffiliate(treffer.url)
        delete w.ueberTmdb
        jwDirekt++
      }
    }
    /*
      **Auch Titel mit Wegen bekommen JustWatchs übrige Angebote** (Daniel, 17.09.2026,
      zu Apple TV). TMDBs Anbieterliste ist dieselbe Datenbasis, aber je Titel teils
      Wochen alt; JustWatch fragt der Wochenlauf jetzt reihum. Übernommen wird nur,
      was keine eigene Plattform hat (die haben Verweise mit Sprachurteil) und noch
      nicht als Weg dasteht — dieselben Regeln wie für Titel ohne jeden Weg.
    */
    for (const title of titles.values()) {
      if (!(title.streams ?? []).length && !(title.watchLinks ?? []).length) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const angebote = jw[String(title.id)]?.angebote ?? []
      if (!angebote.length) continue
      const wege = title.watchLinks ?? []
      for (const a of angebote) {
        if (!a.url || /^justwatch/i.test(a.anbieter) || toteAdressen.has(a.url)) continue
        if (providerToPlatform(a.anbieter)) continue
        const name = providerName(a.anbieter)
        if (!name || wege.some((w) => w.name === name)) continue
        /*
          Nur digital. Gemessen am 17.09.2026: 728 der 781 zusätzlichen Wege wären
          Disc-Händler gewesen (bücher.de, Thalia, Zavvi …) — ohne Angabe zur Ausgabe,
          Zavvi verkauft UK-Importe. Kinos sind keine Bezugswege.
        */
        if (PHYSISCHE_SHOPS.test(a.anbieter) || a.art === 'CINEMA') continue
        wege.push({
          name,
          url: stripAffiliate(a.url),
          kind: 'stream',
          zugang: a.art === 'FLATRATE' ? 'abo' : a.art === 'FREE' || a.art === 'ADS' ? 'kostenlos' : 'kauf',
        } as WatchLink)
        jwNeu++
      }
      if (wege.length) title.watchLinks = wege.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'stream' ? -1 : 1))
    }
    /*
      **Bei einem Film ist JustWatchs Tonspur eine Aussage über das Werk** (17.09.2026).

      Für Serien gilt sie nicht als Beleg, und das bleibt so: Sie hängt am Titel, unsere
      Frage hängt an der Folge (07.09.2026). Ein Film hat genau eine Einheit — damit
      entfällt der Grund. Daniel an „Your Name.": „maxdome hat nachweislich deutsche
      synchro", während die Pille „DE ?" trug, obwohl JustWatch für dieses Angebot
      `audio: de` meldet.

      Gewertet wird nur das Angebot **dieses** Anbieters, und nur das Ja: Ein Angebot
      ohne deutschen Ton kann eine Ausgabe unter mehreren sein, und ein fehlendes „de"
      bleibt Schweigen. Gemessen: 435 Bezugswege in 231 Filmen.
    */
    let jwFilmDe = 0
    for (const title of titles.values()) {
      if (title.format !== 'MOVIE') continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const angebote = jw[String(title.id)]?.angebote ?? []
      if (!angebote.length) continue
      for (const w of title.watchLinks ?? []) {
        if (w.dubRanges?.length) continue
        const passend = angebote.filter(
          (a) => kern(a.anbieter).includes(kern(w.name)) || kern(w.name).includes(kern(a.anbieter)),
        )
        if (!passend.some((a) => (a.audio ?? []).includes('de'))) continue
        w.dubRanges = [{ from: 1, to: 1, dub: true }]
        jwFilmDe++
      }
    }
    if (jwFilmDe) log(`${jwFilmDe} Film-Bezugswege mit deutschem Ton belegt (JustWatch je Angebot)`)
  }
  if (jwNeu) log(`${jwNeu} Bezugswege aus JustWatch bei Titeln ergänzt, die schon Wege hatten`)
  if (jwDirekt)
    log(`${jwDirekt} Bezugswege zeigen jetzt direkt zum Anbieter statt auf die TMDB-Übersicht`)

  /**
   * **Kein Weg auf eine Datenbank — Videoload über die MagentaTV-Kennung, der Rest fällt weg.**
   *
   * Daniel am 22.09.2026 an „Ame & Yuki": „videoload linkt auf tmdb, das ist falsch, es muss
   * direkt zum anbieter linken." Das kehrt die Entscheidung vom 16.09.2026 um („wo JustWatch
   * schweigt, bleibt die Übersichtsseite stehen").
   *
   * Gemessen am selben Tag: 389 Pillen bei 202 Titeln zeigten auf themoviedb.org (Videoload 146,
   * YouTube 100, Google Play 97, …). JustWatch hatte alle 202 Titel geprüft und nannte **keinen**
   * dieser Anbieter dafür — Videoload führt es gar nicht, obwohl es den Dienst gibt.
   *
   * **Videoload und MagentaTV sind derselbe Telekom-Katalog mit derselben Gracenote-Kennung:**
   * `magenta.tv/film/ame-and-yuki-die-wolfskinder/GN_MV026220360000` ↔
   * `videoload.de/film/ame-and-yuki-die-wolfskinder/GN_MV026220360000`. So ließen sich 136 der
   * 146 Videoload-Pillen richten. Die Seite ist eine Browser-Anwendung und antwortet auch auf
   * erfundene Kennungen mit 200 — belegt hat es deshalb Daniel von Hand, 4 von 4 (Wolfskinder,
   * Der Junge und der Reiher, Cowboy Bebop: Der Film, Final Fantasy VII: Advent Children).
   * **Videoload gilt als deutsch** — dieselbe Regel wie bei Joyn. Daniel am 22.09.2026:
   * „videoload hat .de als domain, und es ist telekom deutschland, und ich hab katalog
   * durchstöbert, wir können annehmen das alle de sind, bis wir irgendwann ein gegenteil
   * beweisen." Ein Weg mit eigener Angabe (`dubRanges`) behält sie.
   *
   * **Was danach noch auf TMDB zeigt, bleibt — gekennzeichnet** (`ueberTmdb`, Pille „… (über TMDB)").
   * Die Angebote sind echt: TMDBs Liste ist JustWatchs Partner-Export und vollständiger als unsere
   * JustWatch-Abfrage; nur die Adresse gibt TMDBs API nicht heraus, und die Übersichtsseite sperrt
   * Claude per robots.txt (docs/wissen/quellen.md). Daniel am 22.09.2026: „anbieter info haben wir,
   * also das als ersten weg umsetzen … youtube im label lassen, aber in klammern (über tmdb)".
   * Zuerst die direkte Adresse, erst dann der gekennzeichnete Umweg.
   */
  let videoloadDirekt = 0
  let youtubeDirekt = 0
  let videoloadDeutsch = 0
  let datenbankWege = 0
  {
    const jwAlle = readJson<Record<string, { angebote?: { url?: string }[] }>>('data/justwatch-audio.json', {})
    /* YouTube-Kaufangebote aus `fetch-youtube-kauf.ts` — nur genaue Treffer („YouTube Movies", gleicher Titel). */
    const ytKaufListe = readJson<Record<string, { video?: string }>>('data/youtube-kauf.json', {})
    for (const title of titles.values()) {
      const wege = title.watchLinks
      if (!wege?.length) continue
      for (const w of wege) {
        const ytVideo = ytKaufListe[String(title.id)]?.video
        if (w.name === 'YouTube' && ytVideo && /themoviedb\.org/.test(w.url)) {
          w.url = `https://www.youtube.com/watch?v=${ytVideo}`
          /* Ein Video von „YouTube Movies" ist Kauf oder Leihe (`zugangsart.ts`), auch wo TMDB „Abo" meldete. */
          w.zugang = 'kauf'
          delete w.ueberTmdb
          youtubeDirekt++
          continue
        }
        if (w.name !== 'Videoload' || !/themoviedb\.org/.test(w.url)) continue
        /*
          Film: `magenta.tv/film/<slug>/GN_MV…`. Serie: `magenta.tv/serie/<slug>/staffel-1/GN_SEASON_…`
          — der Staffelteil geht mit (Evangelion von Hand belegt, 22.09.2026; Videoload schreibt
          selbst auf `staffel-01` um). Ohne ihn liefen die 7 Serien als „ohne Kennung" durch.
        */
        const magenta = [...wege.map((x) => x.url), ...(jwAlle[String(title.id)]?.angebote ?? []).map((a) => a.url ?? '')]
          .map((u) => /magenta\.tv\/((?:film|serie)\/[^/?#]+(?:\/staffel-\d+)?\/GN_[A-Z0-9_]+)/i.exec(u))
          .find(Boolean)
        if (!magenta) continue
        w.url = `https://www.videoload.de/${magenta[1]}`
        delete w.ueberTmdb
        videoloadDirekt++
      }
      /* Neben einem direkten Weg desselben Anbieters ist der TMDB-Weg doppelt (Videoload von Hand). */
      const direkt = new Set(wege.filter((w) => !/themoviedb\.org/.test(w.url)).map((w) => w.name))
      title.watchLinks = wege.filter((w) => !/themoviedb\.org/.test(w.url) || !direkt.has(w.name))
      for (const w of title.watchLinks) {
        if (!/themoviedb\.org/.test(w.url)) continue
        w.ueberTmdb = true
        datenbankWege++
      }
      for (const w of title.watchLinks) {
        if (w.name !== 'Videoload' || w.dubRanges?.length) continue
        w.dubRanges = [{ from: 1, to: title.format === 'MOVIE' ? 1 : Math.max(1, title.episodes ?? 1), dub: true }]
        videoloadDeutsch++
      }
    }
  }
  if (videoloadDirekt) log(`${videoloadDirekt} Videoload-Wege über die MagentaTV-Kennung direkt verlinkt`)
  if (youtubeDirekt) log(`${youtubeDirekt} YouTube-Wege direkt zum Kaufangebot verlinkt (data/youtube-kauf.json)`)
  if (videoloadDeutsch) log(`${videoloadDeutsch} Videoload-Wege als deutsch gesetzt — deutscher Anbieter`)
  if (datenbankWege) log(`${datenbankWege} Wege ohne direkte Anbieteradresse als „über TMDB" gekennzeichnet`)

  /**
   * **Und dieselbe Frage an aniSearch — sie kennt Wege, die JustWatch nicht hat.**
   *
   * Gemessen am 10.09.2026: 236 Titel zeigen keinen einzigen Weg, und zu zwölf
   * davon führt `data/anisearch.json` eine Quelle. JustWatch kennt nur einen
   * einzigen davon — seine Datei deckt 351 Titel ab, unser Bestand 2.768.
   *
   * Die Riegel sind dieselben wie beim Block darüber, und der wichtigste ist
   * der erste: **nur wo gar nichts steht.** Wo ein geprüfter Verweis existiert,
   * ist er die bessere Auskunft; hier geht es um die Titel, bei denen der
   * Kalender auf „wo läuft das" nichts antwortet.
   *
   * **YouTube bleibt draußen**, und das ist kein Versehen: Ein Kanal zeigt dort
   * regelmäßig die untertitelte Fassung, und ein Weg ohne Sprachurteil ist
   * genau die Halbwahrheit, gegen die Punkt 1 des Projektziels steht (16 solche
   * Verweise sind am 07.09.2026 entfernt worden). Sieben der zwölf sind
   * YouTube-Fälle — sie bleiben ungezeigt, bis eine Tonspur belegt ist.
   */
  let asWege = 0
  for (const title of titles.values()) {
    if ((title.streams ?? []).length || (title.watchLinks ?? []).length) continue
    const quellen = anisearch[title.id]?.streams ?? []
    if (!quellen.length) continue
    const wege: WatchLink[] = []
    for (const quelle of quellen) {
      const url = (quelle.url ?? '').split('?')[0]
      const anbieter = String(quelle.provider ?? '')
      if (!url || /youtube/i.test(anbieter)) continue
      if (toteAdressen.has(url)) continue
      /* Die aniSearch-Kennung trägt ein `-de` am Ende, das `providerName()` nicht kennt. */
      const name = providerName(anbieter.replace(/-de$/, ''))
      if (!name || /^Primevideo/i.test(name) || wege.some((w) => w.name === name)) continue
      wege.push({ name, url, kind: 'stream' })
      if (wege.length >= 4) break
    }
    if (!wege.length) continue
    title.watchLinks = wege
    asWege += wege.length
  }
  if (asWege) log(`${asWege} Bezugswege aus aniSearch für Titel ohne jeden Weg ergänzt`)

  /*
    **Dieselbe Prüfung ein zweites Mal — nach der letzten Runde, die Wege anlegt.**

    Der Filter gegen tote Adressen steht rund 2.500 Zeilen weiter oben und
    arbeitet dort richtig. Nur entstehen Bezugswege danach noch dreimal: aus
    aniSearchs Kanal-Angeboten, aus JustWatch und aus aniSearch für Titel ohne
    jeden Weg. Was dort neu dazukommt, hat der Filter nie gesehen.

    Gemessen am 16.09.2026: **96 Bezugswege** zeigten auf Adressen, die
    data/link-check.json als 404 führt — der von Daniel gemeldete seit dem
    20.08.2026. Er klickte bei „Code Geass" auf „Amazon Prime (Crunchyroll)"
    und landete auf Amazons Fehlerseite: „fix das generisch."

    Das ist der Fall, den diese Akte unter „Wer unten ergänzt, muss unten auch
    beurteilen" führt (06.09.2026) — hier zum dritten Mal, diesmal für die
    Bezugswege. Die frühe Filterung bleibt trotzdem stehen: Ohne sie gälte ein
    toter Weg zwischenzeitlich als Weg, und die Runden für „Titel ohne jeden
    Weg" sprängen nicht an.
  */
  /*
    **Ein Werk ohne jedes Datum läuft noch nirgends.** Princess Principal: Crown
    Handler, Kapitel 5 und 6, tragen bei AniList weder Start noch Jahr, standen
    aber mit „Crunchyroll DE ?" im Datensatz: Crunchyroll führt alle Kapitel
    unter der Adresse der Reihe, und die Adresse wandert von Titel zu Titel
    (Stichprobe 17.09.2026). Ein Verweis ohne belegtes Deutsch fällt hier weg;
    ein angekündigter Titel **mit** Termin bleibt unberührt, denn dessen Seite
    gibt es beim Anbieter oft schon vor dem Start.
  */
  let ohneDatumWeg = 0
  for (const title of titles.values()) {
    if (title.jpStart || title.jpYear) continue
    const vorher = title.streams.length
    title.streams = title.streams.filter((s) => s.dub === true)
    ohneDatumWeg += vorher - title.streams.length
  }
  if (ohneDatumWeg) log(`${ohneDatumWeg} Verweise ohne Sprachbeleg bei Titeln ohne jedes Datum entfernt`)

  let toteWegeSpaet = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => {
      const status = linkBefunde[w.url]?.status
      return !(status === 404 || status === 'region')
    })
    toteWegeSpaet += vorher - title.watchLinks.length
    if (!title.watchLinks.length) delete title.watchLinks
  }
  if (toteWegeSpaet)
    log(`${toteWegeSpaet} Bezugswege entfernt, die nach der ersten Prüfung dazukamen und ins Leere führen`)

  /*
    **Ein digitaler Shop ist ein Stream, egal welche Runde ihn angelegt hat.** Die
    TMDB- und JustWatch-Runden ordnen seit dem 16.09.2026 richtig ein; aniSearchs
    Bezugsquellen und `watch-links.yaml` legten maxdome, Sky Store, Videoload und
    Apple TV weiter als `buy` an — 218 Wege im Disc-Reiter (gemessen am selben Tag,
    „Final Fantasy VII: Advent Children"). „Amazon" bleibt Kauf: Hinter `/dp/` kann
    eine Disc liegen.
  */
  const DIGITALE_SHOPS = /^(maxdome|sky store|videoload|apple tv|google play|rakuten tv|magentatv|freenet meinvod|chili|youtube|amazon video)$/i
  let digitalUmgeordnet = 0
  for (const title of titles.values()) {
    for (const w of title.watchLinks ?? []) {
      if (w.kind !== 'buy' || !DIGITALE_SHOPS.test(w.name ?? '')) continue
      w.kind = 'stream'
      w.zugang ??= 'kauf'
      digitalUmgeordnet++
    }
  }
  if (digitalUmgeordnet) log(`${digitalUmgeordnet} Kaufwege digitaler Shops als Stream eingeordnet`)

  /**
   * **Prime Video führen wir über amazon.de — `primevideo.com` fliegt raus.**
   *
   * Daniel am 07.09.2026 an „City The Animation", mit vier Bildern: Der Titel
   * stand in der „Wo sehen?"-Liste zweimal mit Prime Video, einmal als „DE ✓"
   * (amazon.de) und einmal als „DE ?" (primevideo.com). „entfern alle links /
   * pills / verweise / etc. zu primevideo.com. diese domain unterstützen wir
   * nicht, nur amazon.de wird als ‚prime video' von uns unterstützt".
   *
   * Die Regel gibt es seit dem 08.08.2026 als `isUnusablePrimeLink()`, und sie
   * greift bei den **Verweisen**. Die **Bezugswege** liefen daran vorbei: Sie
   * entstehen aus aniSearchs Quellenliste, und die führt beide Domains. Ein
   * Titel bekam so zwei Prime-Zeilen, von denen die zweite nichts wusste — für
   * einen Besucher sieht das aus wie zwei Angebote.
   *
   * Der Grund für die Regel ist unverändert: Eine ASIN gilt nicht
   * marktübergreifend, und `amazon.de` ist die vertrautere Adresse zur selben
   * Inhalteseite.
   */

  let primeFremd = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => !/(^|\/\/|\.)primevideo\.com\//.test(w.url))
    primeFremd += vorher - title.watchLinks.length
  }
  if (primeFremd) log(`${primeFremd} Bezugswege auf primevideo.com entfernt — Prime Video führen wir über amazon.de`)

  /**
   * **Was als belegtes Nein aus den Verweisen flog, kommt nicht als Bezugsweg zurück.**
   *
   * Gefunden am 07.09.2026 an „7th Time Loop": Der Prime-Verweis wurde wegen
   * des Handbelegs „kein deutscher Ton" entfernt — und derselbe Weg stand als
   * Bezugsweg weiter da, mit „🇩🇪 ?" daneben. Für einen Besucher ist das
   * dieselbe Zeile, nur ohne Wissen; Daniels Punkt war genau diese Pille.
   *
   * Verglichen wird über den Adresskern, denn beide Listen führen dieselbe
   * Adresse mal mit und mal ohne Parameter.
   *
   * **Nur belegte Neins, keine Frist.** Ein Weg, den ein Mensch als „dort
   * nicht auf Deutsch" geprüft hat, gehört nicht in die Antwort auf „wo läuft
   * es auf Deutsch" — und wenn sich das ändert, ändert sich der Handbeleg.
   */
  /**
   * **Eine Adresse, eine Pille.**
   *
   * Daniel am 07.09.2026 an „Kill Blue": „aniverse button führt auf tote seite
   * -> entfernen". Er führte nicht ins Leere — er führte auf **dieselbe**
   * Amazon-Seite wie die Prime-Video-Pille daneben (`B0GTN94C9M`). Wer dort
   * den Aniverse-Kanal sucht, findet ihn nicht, denn die Seite ist das
   * Prime-Angebot.
   *
   * Zwei Zeilen, die auf dieselbe Adresse zeigen, sind keine zwei Auskünfte.
   * Dasselbe Bild wie bei „City The Animation" (zwei Prime-Zeilen) und bei
   * „7th Time Loop" (Verweis entfernt, Bezugsweg blieb) — dreimal am selben
   * Tag, jedes Mal von Daniel gemeldet.
   *
   * Der **Verweis** gewinnt: Er trägt das Sprachurteil und die Zugangsart, der
   * Bezugsweg nur einen Namen. Gemessen sind es 37 Dopplungen.
   */
  let doppelterWeg = 0
  {
    const kern = (u: string): string => {
      const asin = /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,26})/i.exec(u)?.[1]
      if (asin) return `amazon:${asin.toLowerCase()}`
      return u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    }
    for (const title of titles.values()) {
      if (!title.watchLinks?.length || !title.streams?.length) continue
      const belegt = new Set(title.streams.map((s) => kern(s.url)))
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter((w) => !belegt.has(kern(w.url)))
      doppelterWeg += vorher - title.watchLinks.length
    }
  }
  if (doppelterWeg)
    log(`${doppelterWeg} Bezugswege entfernt, die auf dieselbe Adresse zeigen wie ein Verweis desselben Titels`)

  let wegNachNein = 0
  {
    const kern = (u: string): string =>
      u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    const raus = new Set(verweiseEntfernt.map((e) => kern(e.url ?? '')))
    for (const e of readJson<{ verweise?: { url?: string }[] }>('data/verweise-entfernt.json', {}).verweise ?? []) {
      raus.add(kern(e.url ?? ''))
    }
    for (const title of titles.values()) {
      if (!title.watchLinks?.length) continue
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter((w) => !raus.has(kern(w.url)))
      wegNachNein += vorher - title.watchLinks.length
    }
  }
  if (wegNachNein) log(`${wegNachNein} Bezugswege entfernt, deren Adresse als belegtes Nein aus den Verweisen flog`)

  /**
   * **Ein YouTube-Verweis bleibt, wenn sein Umfang dransteht — nicht, wenn er groß genug ist.**
   *
   * Die erste Fassung vom 07.09.2026 zählte Folgen: unter zwei belegten flog
   * der Verweis, Anlass war „Kill Blue" („youtube hat nur untertitel, also weg
   * damit, wir führen nur >1 folge synchro pillen dort"). Sechzehn Verweise
   * gingen so.
   *
   * Am selben Abend kam die genauere Vorgabe, mit einem Gegenbeispiel: „season
   * 1 ep 1 date a live, deutsch komplett. füg es hinzu, schreib auch das es nur
   * diese ep unter diesem verweis gibt, sodass kein falscher eindruck
   * entsteht." Ein Verweis auf **eine** Folge ist also kein Problem — der
   * falsche Eindruck ist es. Und der entsteht nicht aus der Zahl, sondern
   * daraus, dass niemand sie sieht.
   *
   * Deshalb entscheidet jetzt, ob der Umfang **ausgewiesen** ist:
   *
   * - keine Bereiche → der Beleg gilt dem ganzen Weg, die Pille sagt „alle
   *   Folgen"; das war schon immer so und bleibt richtig, wo es stimmt;
   * - Bereiche, die bis zur letzten Folge reichen → die Pille nennt die Grenze
   *   („✓ DE nur Fg. 1"), und niemand kann sich verlesen;
   * - Bereiche, die **vor** der letzten Folge enden → genau die Lücke von
   *   „Kill Blue": Belegt sind acht von zwölf, über die übrigen vier sagt
   *   niemand etwas, und die Pille schwiege ebenfalls. Der Verweis fliegt.
   *
   * Ohne bekannte Folgenzahl gibt es nichts zu vergleichen; dann zählt der
   * Beleg, wie bisher.
   */
  let youtubeStumm = 0
  for (const title of titles.values()) {
    if (!title.streams?.length) continue
    const vorher = title.streams.length
    title.streams = title.streams.filter((s) => {
      if (s.platform !== 'youtube') return true
      if (s.dub !== true) return false
      const bereiche = s.dubRanges ?? []
      if (!bereiche.length) return true
      const gesamt = title.episodes
      if (!gesamt) return true
      /* Reicht die Beschreibung bis zur letzten Folge? Dann steht der Umfang in der Pille. */
      const bisWohin = bereiche.reduce((n, r) => Math.max(n, r.to), 0)
      return bisWohin >= gesamt
    })
    youtubeStumm += vorher - title.streams.length
  }
  if (youtubeStumm)
    log(`${youtubeStumm} YouTube-Verweise entfernt, deren Umfang unbekannt bleibt — dort führen wir nur ausgewiesene Wege`)


  /**
   * **Und was am Ende noch auf eine Suche zeigt, fliegt.**
   *
   * Die Reparatur weiter oben hat den Katalog gefragt, die Runden dazwischen
   * hatten jede Gelegenheit, eine echte Titelseite einzusetzen. Was hier noch
   * steht, ist eine Suche — und die ist als Auskunft schlechter als nichts:
   * Sie sieht aus wie ein Weg und endet auf „Es konnte nichts gefunden werden".
   *
   * Die Frage dahinter geht deshalb nicht verloren, sie wechselt den Ort:
   * `daniel-zum-abarbeiten/18-suchadressen.md`.
   */
  let suchAdressen = 0
  let ausSuche = 0
  for (const title of titles.values()) {
    if (!title.streams?.length) continue
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? ''
    title.streams = title.streams.filter((stream) => {
      let suche = false
      try {
        const u = new URL(stream.url)
        /* Amazons `/s?k=`, Crunchyrolls `/search?q=`, Netflix' `/search?q=`. */
        suche = /\/search(\/|$)|^\/s$/.test(u.pathname) || u.searchParams.has('k') || u.searchParams.has('q')
      } catch {
        suche = false
      }
      if (!suche) return true
      /*
        **Auch hier wird erst repariert.** Die Suchadresse steht heute nicht
        mehr nur im Bau: Ein früherer Lauf hat sie aus dem Datensatz nach
        `data/crunchyroll-series-ids.json` übernommen, und von dort kommt sie
        zurück. Wer sie nur wegwirft, verliert den Verweis — obwohl der Katalog
        die Adresse kennt.
      */
      if (stream.platform === 'crunchyroll' && name) {
        const echte = crAdresseZu(name)
        if (echte) {
          stream.url = echte
          ausSuche++
          return true
        }
      }
      suchAdressen++
      /*
        Trägt der Titel beim selben Anbieter schon eine Titelseite, ist die Frage
        beantwortet — die Suche fällt weg, ohne auf der Liste zu landen (18.09.2026:
        fünf Suchen blieben offen, nachdem ihre Seiten in `verweise-von-hand.yaml`
        standen).
      */
      const hatSeite = title.streams.some((s) => {
        if (s === stream || s.platform !== stream.platform) return false
        try {
          const v = new URL(s.url)
          return !(/\/search(\/|$)|^\/s$/.test(v.pathname) || v.searchParams.has('k') || v.searchParams.has('q'))
        } catch {
          return false
        }
      })
      if (!hatSeite && !beantworteteSuchen.has(`${title.id}|${stream.platform}`))
        suchOffen.push({ id: title.id, titel: name, plattform: stream.platform, url: stream.url })
      return false
    })
  }
  if (ausSuche) log(`${ausSuche} Suchadressen über den deutschen Katalog auf ihre Serienadresse gesetzt`)
  if (suchAdressen) log(`${suchAdressen} Suchadressen entfernt — eine Suche ist kein Weg zu einem Titel`)
  schreibeSuchadressen(suchOffen)

  /**
   * **Zwei Ausgaben derselben Staffel: die ohne Deutsch bleibt als Auskunft stehen.**
   *
   * Ein belegtes Nein entfernt den Verweis (15.08.2026), und dabei bleibt es.
   * Gibt es beim selben Anbieter aber **auch** eine Ausgabe mit deutschem Ton,
   * findet ein Besucher dort beide und weiß nicht, welche gemeint ist — Digimon
   * bei Prime: „In Prime enthalten" mit Synchro, der Crunchyroll-Kanal nur mit
   * Untertiteln. Daniel am 14.09.2026: „wenn beides legit ist, dann sollten wir
   * diese erkenntnis offen kommunizieren".
   *
   * Gelesen wird aus den Belegen, nicht aus den entfernten Verweisen: Ob die
   * Kanal-Adresse in diesem Lauf überhaupt als Verweis ankam, hängt an den
   * Sammelquellen; das Nein im Beleg steht fest. Je Adresse zählt der jüngste
   * Beleg — ein späteres Ja nimmt die Ausgabe wieder heraus.
   *
   * Im selben Zug fällt dieselbe Seite unter zwei Schreibweisen weg (`/dp/` und
   * `/gp/video/detail/`, Date a Live V trug beide als zwei Pillen).
   */
  {
    const kanalName = (text: string): string | undefined => {
      const treffer =
        /Abos:[^—]*?\b(crunchyroll|aniverse|animedigital)de\b/i.exec(text)?.[1] ??
        /\b(Crunchyroll|Aniverse|ADN)[ -](?:Amazon Channel|Kanal)/i.exec(text)?.[1]
      if (!treffer) return undefined
      const k = treffer.toLowerCase()
      return k === 'crunchyroll' ? 'Crunchyroll' : k === 'aniverse' ? 'Aniverse' : 'ADN'
    }
    /*
      **Eine Adresse, die bei zwei Titeln belegt ist, gehört keinem sicher.**

      Der erste Bau zeigte bei „Date a Live II" die Kanal-Seite `B0CJJF26WZ` —
      die trägt laut Daniels Beleg Staffel 4 und 5. Die Meldung war damals an
      mehrere Titel der Reihe verteilt worden. Eine durchgestrichene Pille zu
      einer fremden Staffel wäre eine falsche Auskunft; lieber keine.
    */
    const titelJeAdresse = new Map<string, Set<number>>()
    for (const c of alleChecks) {
      if (!c.url) continue
      const k = adressKern(c.url)
      const menge = titelJeAdresse.get(k) ?? new Set<number>()
      menge.add(c.anilistId)
      titelJeAdresse.set(k, menge)
    }
    /*
      **Prime-Verweise zeigen auf JustWatchs gti-Adresse** (Daniel, 17.09.2026, nach dem
      PoC in `docs/poc-justwatch-amazon.md`: 8 von 8 lebenden Seiten tragen JustWatchs
      gti, die tote Afro-Samurai-Seite fand ihren Ersatz über die Weiterleitung).

      Erst hier, am Ende: Bis hierher rechnet der Bau mit der ASIN, an der Handbelege,
      Gedächtnis und Prüfliste hängen. Die ASIN bleibt als `seite` erhalten. Nur wo
      JustWatch genau eine gti kennt und der Titel genau einen Prime-Weg hat
      (`amazonGtiWahl`). Ein Titel ohne lebenden Prime-Weg bekommt seinen Abgang
      zurück, mit der gti-Adresse und ohne Sprachurteil — Amazon hat ihn neu angelegt.
    */
    {
      const jwAngebote = readJson<Record<string, { angebote?: JwAngebot[] }>>('data/justwatch-audio.json', {})
      const ERSATZ_TOTER_AMAZON_LINKS = false
      const gtiBelegt = readJson<Record<string, string>>('data/amazon-gti-belegt.json', {})
      let unbelegt = 0
      /* Eine gti, die JustWatch bei mehreren Titeln führt, gehört keinem sicher (gemessen: 15). */
      const gtiTitel = new Map<string, Set<string>>()
      for (const [id, e] of Object.entries(jwAngebote))
        for (const a of e.angebote ?? []) {
          const g = gtiAus(a.url)
          if (g) gtiTitel.set(g, (gtiTitel.get(g) ?? new Set()).add(id))
        }
      const geteilt = (angebote: JwAngebot[]) => angebote.some((a) => (gtiTitel.get(gtiAus(a.url) ?? '')?.size ?? 0) > 1)
      const primeNein = new Set(
        (readJson<{ verweise?: { titleId?: number; plattform?: string; grund?: string }[] }>('data/verweise-entfernt.json', {})
          .verweise ?? [])
          .filter((v) => v.plattform === 'primevideo' && /^belegtes Nein/.test(v.grund ?? ''))
          .map((v) => v.titleId),
      )
      let umgestellt = 0
      let wiederbelebt = 0
      for (const title of titles.values()) {
        if (tmdbMehrdeutig.has(String(title.id))) continue
        const angebote = jwAngebote[String(title.id)]?.angebote ?? []
        if (!angebote.length || geteilt(angebote)) continue
        const prime = title.streams.filter((s) => s.platform === 'primevideo')
        if (prime.length === 1) {
          const s = prime[0]!
          const wahl = amazonGtiWahl(angebote, s.dub)
          if (!wahl || /\/s\?/.test(s.url)) continue
          /*
            **Nur belegt** (Daniel, 17.09.2026, nach Pokémon Weiß → Schwarz): Umgestellt wird
            erst, wenn die Erweiterung auf genau dieser Amazon-Seite dieselbe gti abgelesen hat.
            `data/amazon-gti-belegt.json` führt ASIN → gti aus den Meldungen.
          */
          if (gtiBelegt[adressKern(s.url)] !== wahl.gti) {
            unbelegt++
            continue
          }
          s.seite = s.url
          s.url = wahl.url
          umgestellt++
          continue
        }
        if (prime.length) continue
        /*
          **Abgeschaltet am 17.09.2026, 19:05.** Daniels Gegenprobe von drei ersetzten Links:
          „Pokémon: Der Film – Weiß" führte auf den Schwester-Film „Schwarz". JustWatch führt
          den richtigen Film, aber sein Amazon-Angebot trägt die gti des anderen. Ohne alte
          Seite zum Abgleich fällt das nicht auf; 1 von 3 ist zu viel.
        */
        if (!ERSATZ_TOTER_AMAZON_LINKS) continue
        /*
          Tote Amazon-Adresse: ein geführter Abgang (dort gab es Deutsch) oder eine
          aniSearch-Adresse, die die Linkprüfung als tot kennt — die legt der Bau gar
          nicht erst an. Gemessen am 17.09.2026: 158 Titel ohne Prime-Weg mit toter
          aniSearch-Adresse, 27 davon mit genau einer gti bei JustWatch.
        */
        const abgang = (title.entfernteStreams ?? []).filter((a) => a.platform === 'primevideo')
        const toteAnisearch = (anisearch[String(title.id)]?.streams ?? [])
          .map((x) => x.url && stripAffiliate(x.url))
          .filter((u): u is string => Boolean(u && /amazon\.de\/(?:dp|gp\/video\/detail)\//.test(u) && lautPruefungTot(u)))
        const alteSeite = abgang.length === 1 ? abgang[0]!.url : abgang.length ? undefined : toteAnisearch[0]
        if (!alteSeite) continue
        /* Ein Handbeleg ohne Adresse („bei Prime nicht zu finden") gilt der ganzen Plattform und schlägt JustWatch. */
        const handNein = (checksJePlattform.get(dubKey(title.id, 'primevideo')) ?? []).some(
          (c) => !c.url && (c.available === false || c.dub === false),
        )
        if (handNein) continue
        /* Ein belegtes Nein bei Prime (Gedächtnis der entfernten Verweise) gilt auch hier. */
        if (primeNein.has(title.id)) continue
        const wahl = amazonGtiWahl(angebote, abgang[0]?.dub)
        if (!wahl) continue
        /*
          Ohne geführten Abgang gab es nie ein Urteil. Dann nur eine Ausgabe, für die
          JustWatch deutschen Ton nennt — sonst entstünde ein Weg ohne Deutsch (Afro
          Samurai, Black Cat, A Silent Voice).
        */
        if (!abgang.length && !wahl.audio.includes('de')) continue
        const art = angebote.find((a) => a.url?.includes(wahl.gti))?.art
        title.streams.push({
          platform: 'primevideo',
          url: wahl.url,
          seite: alteSeite,
          ...(art ? { zugang: art === 'FLATRATE' ? 'abo' : art === 'FREE' || art === 'ADS' ? 'kostenlos' : 'kauf' } : {}),
        } as StreamLink)
        wiederbelebt++
      }
      if (umgestellt || wiederbelebt)
        log(`gti-Brücke: ${umgestellt} Prime-Verweise auf JustWatchs Adresse umgestellt, ${wiederbelebt} tote über sie ersetzt`)
      if (unbelegt) log(`gti-Brücke: ${unbelegt} Prime-Verweise warten auf eine abgelesene gti`)
    }
    let doppelt = 0
    let ausgabenOhneDe = 0
    let mehrdeutig = 0
    let abgaengeUeberholt = 0
    for (const title of titles.values()) {
      const gesehen = new Set<string>()
      const vorher = title.streams.length
      title.streams = title.streams.filter((s) => {
        const k = `${s.platform}|${adressKern(s.url)}`
        if (gesehen.has(k)) return false
        gesehen.add(k)
        return true
      })
      doppelt += vorher - title.streams.length

      const ausgaben: NonNullable<Title['ausgabenOhneDe']> = []
      for (const plattform of new Set(title.streams.filter((s) => s.dub === true).map((s) => s.platform))) {
        const beurteilt = new Set<string>()
        for (const c of checksJePlattform.get(dubKey(title.id, plattform)) ?? []) {
          if (!c.url || beurteilt.has(adressKern(c.url))) continue
          beurteilt.add(adressKern(c.url))
          if (c.dub !== false) continue
          if (title.streams.some((s) => adressGleich(s.url, c.url) || adressGleich(s.seite, c.url))) continue
          if ((titelJeAdresse.get(adressKern(c.url))?.size ?? 0) > 1) {
            mehrdeutig++
            continue
          }
          const texte = alleChecks
            .filter((x) => x.anilistId === title.id && x.platform === plattform && adressGleich(x.url, c.url))
            .map((x) => `${x.note ?? ''} ${(x as { zweiteQuelle?: string }).zweiteQuelle ?? ''}`)
            .join(' ')
          const kanal = kanalName(texte)
          ausgaben.push({
            platform: plattform,
            url: c.url,
            ...(kanal ? { kanal } : {}),
            ...(/Deutsch nur als Untertitel/i.test(texte) ? { untertitelDe: true } : {}),
            ...(c.checkedAt ? { geprueftAm: c.checkedAt } : {}),
          })
        }
      }
      /*
        **Ein Bezugsweg über denselben Kanal ist dieselbe Ausgabe.**

        Digimon trug nach dem ersten Bau zusätzlich die Pille „Amazon Prime
        (Crunchyroll) · 54 Fg." auf `B0CHHGC263` — ungestrichen, direkt neben der
        durchgestrichenen Crunchyroll-Kanal-Ausgabe. Die zweite Quelle des Neins
        ist JustWatchs Angebot „Crunchyroll Amazon Channel", und das gilt dem
        Kanal, nicht einer einzelnen Kennung.
      */
      for (const a of [...ausgaben]) {
        if (!a.kanal || a.platform !== 'primevideo') continue
        const kanalMuster = new RegExp(`\\(${a.kanal}\\)`, 'i')
        const gleicherKanal = (title.watchLinks ?? []).filter(
          (w) => w.kind === 'stream' && /amazon\./.test(w.url) && kanalMuster.test(w.name ?? ''),
        )
        /*
          Die Pille steht schon da — eine zweite Kennung desselben Kanals wäre
          dieselbe Auskunft zweimal (erster Bau: zwei gestrichene
          „Crunchyroll-Kanal"-Pillen bei Digimon). Der Weg verschwindet nur.
        */
        if (gleicherKanal.length) title.watchLinks = (title.watchLinks ?? []).filter((w) => !gleicherKanal.includes(w))
      }
      if (ausgaben.length) {
        title.ausgabenOhneDe = ausgaben
        ausgabenOhneDe += ausgaben.length
      }
      /*
        **Ein Abgang gilt nur, solange der Anbieter keinen gültigen Weg trägt.**

        So steht es seit dem 01.09.2026 an der Stelle, die `entfernteStreams`
        füllt. Dort ist der Stand aber ein früherer: Die zweite Ausgabe mit
        Deutsch kommt erst über die Belege dazu, und Digimon zeigte danach neben
        der deutschen Prime-Pille eine graue „Prime Video — nicht mehr abrufbar"
        (`B00SZC9B9G`, weg seit 20.08.2026). Hier am Ende gilt die Regel für den
        fertigen Stand.
      */
      if (title.entfernteStreams?.length) {
        const vorherWeg = title.entfernteStreams.length
        title.entfernteStreams = title.entfernteStreams.filter(
          (a) => !title.streams.some((s) => s.platform === a.platform),
        )
        abgaengeUeberholt += vorherWeg - title.entfernteStreams.length
        if (!title.entfernteStreams.length) delete title.entfernteStreams
      }
    }
    if (doppelt) log(`${doppelt} doppelte Verweise (dieselbe Seite, andere Schreibweise) zusammengelegt`)
    if (ausgabenOhneDe) log(`${ausgabenOhneDe} Ausgaben ohne deutschen Ton neben einer mit Deutsch angezeigt`)
    if (mehrdeutig) log(`${mehrdeutig} Ausgaben ohne Deutsch übersprungen: Adresse bei mehreren Titeln belegt`)
    if (abgaengeUeberholt) log(`${abgaengeUeberholt} Abgänge entfernt, deren Anbieter wieder einen gültigen Weg trägt`)
  }
}
