import { readJson, log } from '../lib/util.ts'
import { adressKern, dubKey, adressGleich, type DubCheck } from '../lib/dub-confirmed.ts'
import { type Title, type PlatformId } from '../../shared/types.ts'
import { netflixTitelAdresse } from '../lib/netflix-adresse.ts'
import { netflixAdresseTaugt } from '../../shared/netflix-adresse-pruefung.ts'
import { todayIso } from '../../shared/time.ts'

export function werteLinkpruefungAus({
  ytKanal,
  ytKauf,
  titles,
  netflixOhneKennung,
  checksJePlattform,
  youtubeBefunde,
  belegFuer,
  vonHandBelegtAm,
  checks,
}: {
  ytKanal: Record<string, string>
  ytKauf: Set<string>
  titles: Map<number, Title>
  netflixOhneKennung: number
  checksJePlattform: Map<string, DubCheck[]>
  youtubeBefunde: Record<string, { art: string; inDE: number; unklar?: boolean; }>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  vonHandBelegtAm: Map<string, string>
  checks: Map<string, DubCheck>
}) {
  let geprueft = 0
  /** YouTube-Verweise, deren Urteil aus der Tonspur-Angabe der Videoseite stammt. */
  let ytAusTonspur = 0
  let entfernt = 0
  let ytEntfernt = 0
  let totEntfernt = 0
  let adressen = 0
  /**
   * **Was YouTube selbst über die Tonspur sagt — je Adresse.**
   *
   * `pipeline/check-youtube.mjs` liest die Angabe seit dem 23.08.2026 aus der
   * Videoseite („Audio: Deutsch"). Sie stand seither in `youtube-befunde.json`
   * und erreichte den Datensatz nie: Dieser Block las `kanal` und
   * `kaufAngebot`, das dritte Feld daneben las niemand. 41 Verweise trugen eine
   * belegte Sprachangabe, und 22 YouTube-Verweise standen trotzdem ohne Urteil
   * im Kalender (gemessen 29.08.2026).
   *
   * Die Aussage gilt dem **Verweis**, nicht dem Werk — genau das ist
   * `stream.dub`. Ein „Japanisch" bei einer Seite, die mit `de-DE` angefragt
   * wurde, heißt: Hier gibt es keinen deutschen Ton zu holen.
   */
  const ytAudio = new Map<string, boolean>()
  /**
   * **Ein Trailer ist kein Bezugsweg** (Daniel an „Your Name.", 17.09.2026:
   * „youtube pill verlinkt dort fälschlicherweise auf trailer, dafür ist trailer
   * button da").
   *
   * YouTube Movies zeigt zum Kaufangebot eines Films dessen Trailer als eigenes
   * Video; die Adresse trägt deshalb eine `offerId` und sieht wie ein Kaufweg
   * aus. Gemessen an allen fünf Verweisen mit `kategorie: 'Trailers'` (17.09.2026)
   * dauert das Video 60 bis 106 Sekunden und heißt „… - Trailer" — bei Your Name
   * sogar „Trailer (OmU)", also nicht einmal die deutsche Fassung, während der
   * Verweis „DE ✓" trug.
   *
   * Der Film selbst liegt unter einer Adresse, die wir nicht kennen, und
   * JustWatch führt für diese Titel gar kein YouTube-Angebot. Ein Weg, der auf
   * den Trailer führt, ist deshalb schlechter als keiner — dieselbe Entscheidung
   * wie bei den Suchadressen (10.09.2026).
   */
  const ytTrailer = new Set<string>()
  for (const [url, b] of Object.entries(
    readJson<
      Record<string, { kanal?: string | null; kaufAngebot?: boolean; audioDeutsch?: boolean; kategorie?: string }>
    >('data/youtube-befunde.json', {}),
  )) {
    if (b?.kanal) ytKanal[url] = b.kanal
    if (b?.kaufAngebot === true) ytKauf.add(url)
    if (typeof b?.audioDeutsch === 'boolean') ytAudio.set(url, b.audioDeutsch)
    if (b?.kategorie === 'Trailers') ytTrailer.add(url)
  }
  /** Antwortstatus je Anbieter-Adresse aus `pipeline/check-links.ts`. */
  const linkBefundeRoh = readJson<
    Record<string, { status: number | string; prime?: boolean; geprueftAm?: string }>
  >('data/link-check.json', {})
  /*
    **Ein Befund gehört der Seite, nicht ihrer Schreibweise** (21.09.2026). Seit Prime-Verweise
    unter `/gp/video/detail/` ausgeliefert werden, misst die Linkprüfung auch diese Form; der Bau
    trägt aus seinen Quellen aber oft noch `/dp/`. „Haikyu!! Karasuno vs. Shiratorizawa" war
    unter der Video-Adresse als „in Deutschland nicht abrufbar" gemessen, galt unter `/dp/` als
    unbekannt, blieb im Datensatz — und `check:tote-adressen` brach den Bau ab (Lauf
    35619070607). Der exakte Treffer gewinnt weiter; sonst zählt der jüngste Befund derselben
    Seite (`adressKern`). So bleiben alle zehn Nachschlagestellen, wie sie sind.
  */
  const befundJeKern = new Map<string, (typeof linkBefundeRoh)[string]>()
  for (const [u, b] of Object.entries(linkBefundeRoh)) {
    const k = adressKern(u)
    const alt = befundJeKern.get(k)
    if (!alt || (b.geprueftAm ?? '') > (alt.geprueftAm ?? '')) befundJeKern.set(k, b)
  }
  const linkBefunde = new Proxy(linkBefundeRoh, {
    get: (o, k) => (typeof k === 'string' ? (o[k] ?? befundJeKern.get(adressKern(k))) : undefined),
  })
  /*
    **Eine späte Runde legt keine Adresse an, die die Linkprüfung als tot kennt**
    (17.09.2026). Der Filter gegen tote Verweise steht weiter unten vor den
    Ergänzungen aus aniSearch und dem Crunchyroll-Katalog; was dort entsteht,
    sah er nie. Sechs Joyn-Adressen standen so seit dem 20.08. als 404 in
    `data/link-check.json` und trotzdem im Datensatz, ohne Sprachurteil.
  */
  const lautPruefungTot = (url: string): boolean => {
    const status = linkBefunde[url]?.status
    return status === 404 || status === 'region'
  }
  /** Wie oft der Kanal-Verweis mit dem Crunchyroll-Befund entfallen ist. */
  let kanalMitEntfernt = 0
  /** Welche Anbieter der zuletzt ausgelieferte Stand je Titel mit „DE ✓" führte — für die Abgänge. */
  const vorherDeutsch = new Map<number, Set<string>>()
  {
    const alt = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
    for (const t of Array.isArray(alt) ? alt : Object.values(alt)) {
      /* Auch die geführten Abgänge — sonst verschwände einer beim Bau nach seinem Entstehen. */
      const deutsch = [
        ...(t.streams ?? []).filter((s) => s.dub === true).map((s) => s.platform),
        ...(t.entfernteStreams ?? []).filter((s) => s.dub === true).map((s) => s.platform),
      ]
      if (deutsch.length) vorherDeutsch.set(t.id, new Set(deutsch))
    }
  }

  for (const title of titles.values()) {
    /**
     * Tote Verweise verschwinden, statt ein „✕" zu bekommen.
     *
     * Sechs von zehn Verweisen aus dem ersten Prüfdurchgang waren nicht
     * „vorhanden, aber nur untertitelt", sondern schlicht weg: „Videos nicht
     * verfügbar" oder eine Weiterleitung auf die Startseite. Ein „🇩🇪 ✕"
     * behauptete dort ein Angebot ohne deutsche Fassung — also etwas, das es
     * gar nicht gibt.
     */
    /*
      Netflix schreibt dieselbe Seite auf drei Arten — hier wird daraus eine.

      **Außer die eine Form ist nachweislich tot und die andere nicht.** Am
      06.09.2026 gemessen an zwei Fate-Titeln, die Netflix nur als Folge bzw.
      Film **innerhalb** einer Serie führt:

          /watch/82850867   HTTP 200 (20.08.2026)
          /title/82850867   HTTP 404 (29.08.2026)

      Eine eigene Titelseite gibt es für sie nicht. Die Vereinheitlichung machte
      aus einer lebenden Adresse eine tote, der Abgangsfilter entfernte den
      Verweis daraufhin zu Recht — und beide Titel standen danach ohne Weg da.

      Der Riegel ist eng: Er greift nur, wo für die **neue** Form ein 404 vorliegt
      und für die alte keiner. Ohne Messung bleibt es bei der Vereinheitlichung,
      die für die übrigen 596 Netflix-Verweise richtig ist.
    */
    for (const s of title.streams) {
      if (s.platform !== 'netflix') continue
      const vereinheitlicht = netflixTitelAdresse(s.url)
      if (vereinheitlicht === s.url) continue
      const neuTot = linkBefunde[vereinheitlicht]?.status === 404
      const altTot = linkBefunde[s.url]?.status === 404
      if (neuTot && !altTot) continue
      s.url = vereinheitlicht
    }
    /*
      **Was auch danach keine Kennung trägt, führt ins Leere.**

      Zwei Verweise bleiben nach der Vereinheitlichung übrig, beide aus AniLists
      Verweisliste: `netflix.com/title/` ohne Nummer und
      `netflix.com/DetectiveConanMovies`, das auf eine Genre-Liste führt statt
      auf den Film. Ein Besucher klickt und findet nicht, wonach er gesucht hat.

      Der Titel bleibt im Bestand und landet über die reguläre Prüfliste wieder
      auf dem Tisch — entfernt wird der Weg, nicht das Werk.
    */
    const vorNetflix = title.streams.length
    title.streams = title.streams.filter((s) => s.platform !== 'netflix' || netflixAdresseTaugt(s.url))
    netflixOhneKennung += vorNetflix - title.streams.length

    /*
      Abgänge werden gesammelt, nicht weggeworfen — siehe `entfernteStreams`.
    */
    const abgaenge: typeof title.streams = []
    /*
      **Ein Abgang nur, wo es vorher Deutsch gab.** „Netflix — nicht mehr abrufbar" stand
      über Mushoku Tensei Staffel 3, die dort nie lief (Daniel, 16.09.2026, mit Bild des
      Staffel-Dropdowns: nur Staffel 1 und 2). Alle 514 Abgänge im Datensatz trugen kein
      Sprachurteil — die Pille behauptete einen Verlust, den niemand belegt hatte.
      Belegt ist er nur, wenn ein Handbeleg oder der zuletzt ausgelieferte Stand dort
      deutschen Ton führte.
    */
    const warDeutsch = (s: { platform: PlatformId; url: string }) =>
      (checksJePlattform.get(dubKey(title.id, s.platform)) ?? []).some((c) => c.dub === true) ||
      (vorherDeutsch.get(title.id)?.has(s.platform) ?? false)
    title.streams = title.streams.filter((stream) => {
      /**
       * Was YouTube selbst über seine Verweise sagt.
       *
       * `pipeline/check-youtube.ts` fragt je Adresse die offizielle Data API:
       * Wie viele der dort liegenden Videos sind **in Deutschland** abrufbar?
       * Null heißt, der Verweis führt einen Besucher hier ins Leere — sei es,
       * weil die Playlist gelöscht ist, weil sie keine Videos führt, oder weil
       * alle auf einen anderen Erdteil beschränkt sind.
       *
       * Das war der Normalfall, nicht die Ausnahme: Von 460 bewertbaren
       * Adressen führten am 20.08.2026 **362** ins Leere, allein 290 wegen einer
       * Ländersperre (Daniels Fund: eine Playlist zu „Sword of the Demon
       * Hunter", deren 24 Videos auf den asiatisch-pazifischen Raum beschränkt
       * sind und chinesische Untertitel tragen).
       *
       * Kanäle bleiben unangetastet — ein Kanal ist keine Folgenliste, und was
       * dort liegt, sagt nichts über diesen Titel.
       */
      const yt = stream.platform === 'youtube' ? youtubeBefunde[stream.url] : undefined
      /**
       * Kanaladressen fliegen raus, ohne Prüfung.
       *
       * Ein Kanal ist keine Folgenliste: Er beantwortet nicht, ob **dieser**
       * Titel dort zu sehen ist, sondern zeigt irgendwas vom Sender. Bis zum
       * 20.08.2026 blieben sie stehen, weil sie sich nicht bewerten lassen —
       * genau das ist aber der Grund, sie wegzulassen (Daniel: „YouTube-
       * Verlinkungen zu Kanälen statt Videos/Playlists direkt streichen").
       */
      if (yt?.art === 'kanal') {
        ytEntfernt++
        return false
      }
      /* Ein Trailer beantwortet die Frage nicht, wo der Film läuft — siehe `ytTrailer`. */
      if (ytTrailer.has(stream.url)) {
        ytEntfernt++
        return false
      }
      /* `unklar` heißt „die Abfrage hat nicht geantwortet" — kein Grund, einen Verweis zu entfernen (17.09.2026). */
      if (yt && yt.art !== 'kanal' && yt.inDE === 0 && !yt.unklar) {
        ytEntfernt++
        return false
      }
      /**
       * Führt der Verweis überhaupt noch irgendwohin?
       *
       * `pipeline/check-links.ts` misst es für die Anbieter, deren Antwort etwas
       * bedeutet. Eine Stichprobe am 20.08.2026 fand bei Joyn 9 von 11 und bei
       * Aniverse 9 von 30 Verweisen mit 404 — ein Versprechen auf eine
       * Fehlerseite.
       *
       * **Nur ein hartes 404 entfernt.** Zeitüberschreitung, 403 und Netzfehler
       * sagen etwas über den Weg dorthin, nicht über den Verweis. Crunchyroll
       * und ADN antworten jedem Skript mit 403; sie werden gar nicht erst
       * geprüft, sonst verwürfe diese Zeile reihenweise gültige Verweise.
       */
      /*
        **Ein Abgang wird vermerkt, nicht verschwiegen** (Daniel, 01.09.2026).

        Bis dahin fiel ein Verweis stillschweigend heraus, sobald er ins Leere
        führte oder eine Prüfung ihn als weg meldete. Für den Leser sah das aus,
        als hätte es ihn nie gegeben — dabei ist genau das die Auskunft, die er
        sucht: „seit <Datum> nicht mehr im Katalog von <Anbieter>".

        Der Eintrag bleibt deshalb stehen und trägt `entferntAm`. Die Oberfläche
        zeigt ihn als Vermerk statt als Verweis; anklickbar ist er nicht mehr,
        denn dort ist nichts.
      */
      const check = belegFuer(title.id, stream.platform, stream.url, title.streams.filter((x) => x.platform === stream.platform).length)
      const befund = linkBefunde[stream.url]?.status
      /*
        **Eine jüngere Handprüfung derselben Adresse schlägt den Linkbefund** (22.09.2026). Die
        Linkprüfung sah bei Fairy Tail nur Staffel 1 („region") und entfernte den Weg; Daniel sah
        dieselbe Seite zwei Tage später mit Staffel 2–9 zum Kauf. Gilt nur, wenn der Beleg genau
        diese Adresse nennt, jünger ist und die Seite nicht selbst als weg meldet.
      */
      const linkAm = String(linkBefunde[stream.url]?.geprueftAm ?? '')
      const handSticht =
        check?.available !== false &&
        ((Boolean(check?.url && adressGleich(check.url, stream.url)) && String(check?.checkedAt ?? '') > linkAm) ||
          /* Ein von Hand bestätigter Weg (`verweise-von-hand.yaml`) — der Lader kennt Belege ohne Urteil nicht. */
          (vonHandBelegtAm.get(adressKern(stream.url)) ?? '') > linkAm)
      if ((befund === 404 || befund === 'region') && !handSticht) {
        totEntfernt++
        abgaenge.push({ ...stream, entferntAm: linkBefunde[stream.url]?.geprueftAm ?? todayIso() })
        return false
      }
      if (check?.available === false) {
        entfernt++
        abgaenge.push({ ...stream, entferntAm: check.checkedAt ?? todayIso() })
        return false
      }
      if (check && typeof check.dub === 'boolean') {
        stream.dub = check.dub
        geprueft++
      }
      // Die Handprüfung hat Vorrang; wo sie schweigt, spricht YouTube selbst.
      if (stream.dub === undefined && stream.platform === 'youtube') {
        const ton = ytAudio.get(stream.url)
        if (ton !== undefined) {
          stream.dub = ton
          ytAusTonspur++
        }
      }
      // Wo der deutsche Ton aufhört, steht nur in den Bereichen. Sie kommen
      // fertig auf diese Staffel umgerechnet aus fetch-pruefungen.ts.
      if (check?.dubRanges?.length) {
        stream.dubRanges = check.dubRanges.map((r) => ({ from: r.from, to: r.to, dub: r.dub }))
      }
      /*
        Der Teilbereich gehört zur Adresse, nicht zum Befund: Er sagt, welchen
        Ausschnitt der Anbieter-Liste dieser Eintrag meint.
      */
      if (check?.teilBereich) {
        stream.teilBereich = { von: check.teilBereich.von, bis: check.teilBereich.bis }
      }
      /*
        Eine von Hand gefundene Adresse schlägt jede geratene — **außer sie ist tot**.
        Der 404-Riegel steht wenige Zeilen darüber und prüft die Adresse, die der
        Verweis **vorher** trug; bei „Your Name." war das die Suchadresse (HTTP 200),
        und erst hier wurde daraus die gelöschte Seite `B0FLLFC2L6`. Der Beleg kam so
        an jedem Riegel vorbei (17.09.2026).
      */
      if (check?.url && !lautPruefungTot(check.url)) {
        stream.url = check.url
        adressen++
      }
      return true
    })
    /*
      **Ein Abgang je Anbieter, der jüngste.** Wechselt eine Adresse und fällt
      auch die neue weg, steht sonst zweimal dasselbe da.

      Und nur, solange der Anbieter keinen gültigen Weg mehr trägt: Führt ein
      Titel nach einem Adresswechsel wieder einen Netflix-Verweis, ist der alte
      Abgang keine Auskunft mehr, sondern eine Irreführung.
    */
    if (abgaenge.length) {
      const jeAnbieter = new Map<string, (typeof abgaenge)[number]>()
      for (const a of abgaenge) {
        /*
          **Eine Suchadresse ist kein Abgang.** Sie war nie ein Eintrag im
          Katalog, sondern ein Suchauftrag — „nicht mehr abrufbar" würde
          behaupten, dort sei einmal etwas gewesen. 61 der ersten 613 Abgänge
          waren solche Adressen (Cowboy Bebop auf Prime etwa).
        */
        if (/[?&]k=|\/s\?/.test(a.url)) continue
        if (title.streams.some((s) => s.platform === a.platform)) continue
        if (!warDeutsch(a)) continue
        const bisher = jeAnbieter.get(a.platform)
        if (!bisher || (a.entferntAm ?? '') > (bisher.entferntAm ?? '')) jeAnbieter.set(a.platform, { ...a, dub: true })
      }
      if (jeAnbieter.size) title.entfernteStreams = [...jeAnbieter.values()]
    }

    /*
      **Crunchyroll über Prime Video ist Crunchyroll.**

      Der Kanal zeigt denselben Katalog — wer ihn bei Prime dazubucht, sieht
      dort, was Crunchyroll führt, und sonst nichts. Daniel am 03.09.2026:
      „crunchy in prime ist identisch zu crunchy, also wenn wir crunchy in prime
      pills haben, und sie gleichzeitig laut unserem Bestand nicht in crunchy
      sind, dann sind sie auch nicht in crunchy in prime."

      Deshalb erbt der Kanal-Verweis den Befund: Ist der Crunchyroll-Verweis
      **belegt entfallen** — kein Deutsch, nicht mehr abrufbar —, dann führt der
      Weg über Prime genauso ins Leere und verschwindet mit.

      **Was er nicht erbt, ist das Schweigen.** Ein Titel ohne
      Crunchyroll-Verweis heißt meist nur, dass wir keine Adresse kennen; dort
      ist der Kanal-Verweis der einzige Hinweis überhaupt und bleibt stehen. Der
      Unterschied ist derselbe wie überall in diesem Projekt: Gestrichen wird,
      was eine Quelle **aktiv widerlegt**.
    */
    /* Alle Abgänge, nicht nur die angezeigten — ein Crunchyroll-Verweis ohne früheres Deutsch ist trotzdem weg. */
    const crWeg = abgaenge.some((s) => s.platform === 'crunchyroll')
    const crDa = title.streams.some((s) => s.platform === 'crunchyroll')
    if (crWeg && !crDa && title.watchLinks?.length) {
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter(
        (w) => !/crunchyroll/i.test(w.name ?? '') || !/prime/i.test(w.name ?? ''),
      )
      kanalMitEntfernt += vorher - title.watchLinks.length
    }
  }
  if (kanalMitEntfernt) {
    log(`${kanalMitEntfernt} Kanal-Verweise „Crunchyroll über Prime Video" entfernt — Crunchyroll selbst ist dort belegt weg`)
  }
  /**
   * Verweise, die es nur von Hand gibt.
   *
   * Steht in `dub-confirmed.yaml` eine Adresse zu einer Plattform, die der
   * Titel gar nicht führt, wird sie angelegt. Der Fall entsteht, wo ein
   * Anbieter mehrere unserer Staffeln unter einer Reihe zeigt und die Quellen
   * deshalb nur eine davon kennen.
   *
   * **Ein `available: false` legt nichts an.** Der Block darüber entfernt genau
   * solche Verweise, und dieser hier legte sie unmittelbar danach wieder an —
   * die Adresse steht ja im Beleg. Zwei Schritte, die sich widersprechen, und
   * der zweite gewann.
   *
   * Aufgefallen ist es am 26.08.2026, als die Erweiterung erstmals
   * „nicht verfügbar" **mit** Adresse meldete: `check:handbelege` wurde rot und
   * nannte acht Titel, die „als nicht verfügbar geprüft" waren und trotzdem im
   * Datensatz standen — Aoashi, Chainsaw Man, SPY×FAMILY und fünf weitere. Der
   * Deploy blieb zwei Läufe lang hängen.
   *
   * Die Zusicherung hat den Widerspruch gefunden, nicht der Vorsatz.
   */
  let ergaenzt = 0
  for (const title of titles.values()) {
    for (const check of checks.values()) {
      if (check.anilistId !== title.id || !check.url) continue
      if (check.available === false) continue
      /*
        **Und eine tote Adresse legt der Beleg genauso wenig an** (17.09.2026). Der
        Handbeleg sagt, welche Sprache die Seite hatte — nicht, dass es sie noch gibt.
        Bei „Your Name." hat Daniel am 31.08. auf `B0FLLFC2L6` deutschen Ton gemeldet;
        Amazon hat die Ausgabe seitdem gelöscht (HTTP 404, gemessen 17.09.), der Block
        darüber entfernte den Verweis, und dieser legte ihn unmittelbar wieder an —
        derselbe Widerspruch wie beim `available: false` am 26.08.2026.
      */
      if (lautPruefungTot(check.url)) continue
      if (title.streams.some((s) => s.platform === check.platform)) continue
      title.streams.push({ platform: check.platform, url: check.url, dub: check.dub })
      ergaenzt++
    }
  }
  if (ergaenzt) log(`${ergaenzt} Verweise aus geprüften Adressen ergänzt`)
  return { lautPruefungTot, linkBefunde, geprueft, ytAusTonspur, entfernt, ytEntfernt, totEntfernt, adressen }
}
