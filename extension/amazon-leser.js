/**
 * Hört mit, was Amazon beim Blättern durch die Folgenliste nachlädt — und holt
 * die Abschnitte nach, die Daniel sonst einzeln anklicken müsste.
 *
 * ## Warum es das braucht
 *
 * Die Tonspuren stehen im ausgelieferten HTML — aber **nur für den Abschnitt,
 * der beim Seitenaufbau gewählt war**. Wechselt Daniel auf „Folgen 25–48",
 * kommen die Kacheln nach, der Quelltext behält aber die alten Angaben.
 *
 * Gemessen am 23.08.2026 an „Digimon Tamers" (51 Folgen), nach dem Wechsel auf
 * 25–48, aus Daniels angemeldeter Sitzung:
 *
 * ```
 * audioTracks: 27 | episodeNumber: 1,2,3,…,24
 * ```
 *
 * Die Folgen 25–48 waren auf dem Bildschirm zu sehen und im Quelltext nicht
 * vorhanden. Wer nur das HTML liest, bekommt also dauerhaft den ersten
 * Abschnitt und hält ihn für die Staffel.
 *
 * ## Die Struktur, gemessen am 23.08.2026
 *
 * Amazon holt die Folgen über `/gp/video/api/getDetailWidgets`. Die Antwort ist
 * gültiges JSON und enthält **den gewählten Abschnitt plus die Zugänge zu allen
 * übrigen**:
 *
 * ```
 * widgets.episodeList.episodeCount                     → 51
 * widgets.episodeList.episodes[].detail.audioTracks    → ["Deutsch"]
 * widgets.episodeList.episodes[].detail.episodeNumber  → 25 … 48
 * widgets.episodeList.actions.episodePages[].token     → drei Abschnitte
 * ```
 *
 * ## Was hier passiert
 *
 * Zwei Dinge, und der Unterschied ist wichtig:
 *
 * 1. **Mitgelesen** wird am Ergebnis, nicht am Aufruf — `fetch` und
 *    `XMLHttpRequest` geben ihre Antwort ohnehin an die Seite weiter, und genau
 *    dort wird sie abgegriffen.
 * 2. **Nachgeholt** werden allein die Abschnitte derselben Folgenliste, deren
 *    Token in der Antwort mitgeliefert wurde. Das ist Zeichen für Zeichen der
 *    Abruf, den ein Klick aufs Dropdown auslöst — in derselben angemeldeten
 *    Sitzung, auf derselben Seite, ausgelöst dadurch, dass Daniel diese Seite
 *    geöffnet hat. Es wird nichts gesucht, nichts durchlaufen und keine zweite
 *    Serie angefasst.
 *
 * Läuft in der Seitenwelt (`world: MAIN`), weil ein Content-Script in seiner
 * eigenen Welt weder die `fetch`-Funktion der Seite noch ihre Anmeldung
 * erreicht.
 */
;(() => {
  const MARKE = 'ak-amazon-folgen'

  /**
   * Obergrenze für das Nachholen.
   *
   * Bei 24 Folgen je Abschnitt deckt das rund 600 Folgen ab — mehr als jede
   * Serie im Bestand. Die Grenze steht nicht wegen der Datenmenge da, sondern
   * damit aus einer Bedienhilfe nie ein Durchlauf wird: Wo sie greift, bleibt
   * die Zahl unvollständig, und der Knopf meldet dann ausdrücklich einen
   * Ausschnitt statt eines „kein Deutsch".
   */
  const MAX_ABSCHNITTE = 25

  /** Pause zwischen zwei Abrufen. Ein Mensch klickt auch nicht schneller. */
  const PAUSE_MS = 400

  const geholt = new Set()

  /**
   * **Alle Abschnitts-Tokens, die diese Seite je genannt hat.**
   *
   * `geholt` sagt, was schon abgerufen wurde. Erst der Vergleich mit dieser
   * Menge sagt, ob noch etwas aussteht — und genau das entscheidet, ob die
   * Folgenliste vollständig ist. Die Zahl aus `episodeCount` kann es nicht
   * entscheiden, siehe die Bänder-Regel in `amazon.js`.
   */
  const alleAbschnitte = new Set()
  let laeuft = false
  let titleID = null

  /**
   * Der Stand des Lesers, ablesbar aus der Konsole.
   *
   * Zweimal hintereinander blieb der Knopf bei „24 von 51" stehen, und beide
   * Male war die Ursache eine andere als vermutet — einmal fehlte die
   * Netzantwort, einmal der richtige Feldname. Geraten wurde jedes Mal zuerst.
   *
   * Diese Aufstellung sagt in einem Zug, wie weit der Leser gekommen ist:
   * ob er läuft, ob er die Kennung hat, wie viele Abschnitte er sieht, was er
   * angefordert hat und woran es scheiterte. `copy(JSON.stringify(
   * window.__akAmazon))` in der Konsole genügt.
   *
   * Sie bleibt dauerhaft drin. Ein paar Zähler kosten nichts, und der nächste
   * Umbau bei Amazon kommt bestimmt.
   */
  /**
   * Die Adresse, wie sie beim **Seitenstart** aussah.
   *
   * Amazon räumt seinen Verweis-Parameter weg, sobald die Seite steht — die
   * Meldung vom 23.08.2026, 19:31 Uhr trug deshalb keine Staffelangabe, obwohl
   * Daniel `?ref_=atv_dp_season_select_s3` aufgerufen hatte. Dieses Skript
   * läuft bei `document_start` und sieht sie noch; `amazon.js` startet bei
   * `document_idle` und kommt zu spät.
   */
  const startAdresse = location.href

  const diagnose = {
    fassung: '0.54.0',
    startAdresse,
    suchteil: location.search,
    anlaeufe: 0,
    quelltextLaenge: 0,
    titleID: null,
    titleIDfundstellen: 0,
    episodePagesGefunden: false,
    tokensImQuelltext: 0,
    abrufe: [],
    fehler: [],
  }
  window.__akAmazon = diagnose

  const warte = (ms) => new Promise((r) => setTimeout(r, ms))

  /**
   * Die Sprachnamen aus einem `audioTracks`-Feld — beide Formen.
   *
   * Die meisten Seiten führen schlichte Namen (`["Deutsch","日本語"]`), „Oshi
   * no Ko" Staffel 3 dagegen ganze Objekte:
   *
   *     [{"audioTrackId":"de-de_dialog_0","displayName":"Deutsch",
   *       "languageCode":"de-de","audioSubtype":"dialog", …}]
   *
   * Die erste Fassung reichte sie unverändert weiter. Beim Empfänger wurde
   * daraus `[object Object]`, in der Meldung an den Worker ein zerlegtes
   * JSON-Bruchstück — genau so kam sie am 23.08.2026 zweimal an. **Der Fehler
   * saß hier, nicht in `amazon.js`:** Dort war er schon behoben, und trotzdem
   * blieb die Meldung falsch, weil die Sprachen über diesen Weg kommen.
   */
  function namenAus(spuren) {
    if (!Array.isArray(spuren)) return []
    return spuren
      .map((s) => (typeof s === 'string' ? s : (s?.displayName ?? s?.language ?? null)))
      .filter((s) => typeof s === 'string' && s.trim())
  }

  /**
   * Aus einer Antwort die Folgen mit ihren Tonspuren ziehen.
   *
   * **Geparst, nicht abgetastet.** Die Antwort ist gültiges JSON; ein Muster
   * über den Zeichenabstand („`episodeNumber` irgendwo hinter `audioTracks`")
   * hält nur so lange, wie dazwischen nichts Langes steht — `contributors` mit
   * gefüllter Besetzungsliste reicht, um es zu brechen.
   *
   * Das Muster bleibt als Rückfallebene: Ändert Amazon die Verschachtelung,
   * liefert es wenigstens noch die Sprachen.
   */

  /**
   * **Eine Folge, vollständig — nicht zwei Felder daraus.**
   *
   * Daniel am 25.08.2026, nachdem er die Antwort selbst gelesen hatte: „da steht
   * sogar fsk, und abo required, episoden beschreibung, etc releasedate der
   * episode runtime, etc, audiotracks, title id etc. alles was wir brauchen
   * quasi… wir sammeln ab jetzt infos pro episode."
   *
   * Die Antwort von `getDetailWidgets` ist gültiges JSON; es gibt hier nichts zu
   * parsen. Was hier stehen bleibt, ist eine **Auswahl**, keine Ableitung: Jedes
   * Feld kommt unverändert aus der Antwort, damit später nichts ein zweites Mal
   * abgerufen werden muss.
   */
  function folgeAusDetail(folge) {
    const d = folge?.detail
    if (!d) return null
    return {
      nummer: Number.isFinite(d.episodeNumber) ? d.episodeNumber : null,
      kennung: folge.titleID ?? null,
      gti: folge.self?.compactGTI ?? null,
      titel: d.title ?? null,
      beschreibung: d.synopsis ?? null,
      sprachen: namenAus(d.audioTracks ?? []),
      untertitel: Array.isArray(d.subtitles) ? d.subtitles : [],
      dauerSek: Number.isFinite(d.duration) ? d.duration : null,
      laufzeit: d.runtime ?? null,
      erschienen: d.releaseDate ?? null,
      jahr: Number.isFinite(d.releaseYear) ? d.releaseYear : null,
      studios: Array.isArray(d.studios) ? d.studios : [],
      genres: (d.genres ?? []).map((g) => g?.text).filter(Boolean),
      /* Wer die Folge sehen darf — Prime, ein Kanal, oder ein Kauf. */
      zugaenge: [...new Set([...JSON.stringify(folge).matchAll(/"benefitId":"([^"]+)"/g)].map((m) => m[1]))],
      fsk: folge.metadata?.maturityRating?.displayText ?? null,
      bild: d.images?.covershot ?? null,
    }
  }

  /**
   * **Der Film-Weg: die Seite bringt ihre Daten schon mit.**
   *
   * Für einen Film schickt Prime **keinen** `getDetailWidgets`-Abruf ab (Daniel,
   * 25.08.2026). Stattdessen steht im ausgelieferten HTML ein Skriptblock
   * `<script id="dv-web-page-hydration-data" type="application/json">` mit dem
   * vollständigen Zustand der Seite.
   *
   * Gemessen an „Avatar Aang: Der Herr der Elemente" (`B0H6QYBZFS`,
   * 239.064 Zeichen JSON):
   *
   *     init.preparations.body.atf.state.detail.headerDetail[<ASIN>]
   *       title, synopsis, audioTracks, subtitles, entityType: "Movie",
   *       runtime, releaseDate, releaseYear, genres, studios, images, …
   *
   *     benefitId  →  "paramountplusde"   (ein Kanal-Abo, kein Prime-Inhalt)
   *
   * Auch das ist gültiges JSON in einem `<script>`-Element — gelesen wird es
   * über `textContent`, nicht über ein Muster auf dem Quelltext.
   */
  function ausHydration() {
    const block = document.getElementById('dv-web-page-hydration-data')
    if (!block) return null
    let daten
    try {
      daten = JSON.parse(block.textContent)
    } catch {
      return null
    }
    const koerper = daten?.init?.preparations?.body
    const oben = koerper?.atf?.state
    const unten = koerper?.btf?.state
    if (!oben) return null

    const kennung = oben.pageTitleId ?? null
    const kopf = (oben.detail?.headerDetail ?? {})[kennung] ?? Object.values(oben.detail?.headerDetail ?? {})[0]
    if (!kopf) return null

    /*
      **Die Zugänge stehen an der Seite, nicht nur an der Folge.**

      `benefitId` taucht im ganzen Block auf — in den Kanal-Karten, im
      Abspiel-Knopf, in den Empfehlungsleisten daneben. Gelesen wird deshalb
      nur der Aktionsblock der Seite selbst; alles andere gehört zu fremden
      Titeln (`containers` ist die Empfehlungsleiste „Kunden schauten auch").
    */
    const zugaengeAus = (o) => [
      ...new Set([...JSON.stringify(o ?? {}).matchAll(/"benefitId":"([^"]+)"/g)].map((m) => m[1])),
    ]

    const seite = {
      kennung,
      art: kopf.entityType ?? null,
      /* „season" bei einer Staffel, „movie" bei einem Film, „episode" bei einer Folge. */
      sorte: kopf.titleType ?? null,
      titel: kopf.title ?? null,
      /* Der Serientitel — bei einer Staffel steht er getrennt vom Staffelnamen. */
      serie: kopf.parentTitle ?? null,
      staffel: Number.isFinite(kopf.seasonNumber) ? kopf.seasonNumber : null,
      /**
       * **Der Band, falls Prime die Staffel geteilt hat.**
       *
       * „Yu-Gi-Oh! ZEXAL" führt sechs Einträge im Auswahlfeld, aber nur drei
       * Staffeln: jede einmal als Band 1 und einmal als Band 2. Ohne diese
       * Angabe sähen zwei Meldungen zu „Staffel 2" wie ein Widerspruch aus,
       * obwohl sie verschiedene Folgen meinen.
       *
       * Genommen wird der Name aus der Staffelliste, nicht aus dem Seitentitel:
       * Dort steht er als eigenes Feld, statt aus „Yu-Gi-Oh! ZEXAL - Season 2,
       * Volume 2 [OV]" herausgeschnitten werden zu müssen.
       */
      band: (oben.seasons?.[kennung] ?? []).find((s) => s?.isSelected)?.displayName ?? null,
      beschreibung: kopf.synopsis ?? null,
      sprachen: namenAus(kopf.audioTracks ?? []),
      untertitel: Array.isArray(kopf.subtitles) ? kopf.subtitles : [],
      dauerSek: Number.isFinite(kopf.duration) ? kopf.duration : null,
      laufzeit: kopf.runtime || null,
      erschienen: kopf.releaseDate ?? null,
      jahr: Number.isFinite(kopf.releaseYear) ? kopf.releaseYear : null,
      studios: Array.isArray(kopf.studios) ? kopf.studios : [],
      genres: (kopf.genres ?? []).map((g) => g?.text).filter(Boolean),
      zugaenge: zugaengeAus(oben.action),
      fsk:
        oben.metadata?.[kennung]?.maturityRating?.displayText ??
        kopf.ratingBadge?.displayText ??
        null,
      bild: kopf.images?.covershot ?? null,
      imdb: oben.imdb?.[kennung]?.score ?? null,
      /*
        Die Folgenzahl der Staffel steht als Text („74 Folgen"), nicht als Zahl.
        Sie meint die **Reihe**, nicht den gerade gezeigten Abschnitt.
      */
      folgenGesamt: Number(/(\d+)/.exec(oben.metadata?.[kennung]?.episodeCount ?? '')?.[1]) || null,
      /* Alle Staffeln mit ihrer eigenen Kennung — der Bauplan der Reihe. */
      staffeln: (oben.seasons?.[kennung] ?? []).map((s) => ({
        kennung: s.seasonId,
        name: s.displayName,
        nummer: s.sequenceNumber,
        gewaehlt: Boolean(s.isSelected),
      })),
    }

    /*
      **Und die Folgen stehen im unteren Teil derselben Seite.**

      Daniel am 25.08.2026: „ich merke gerade das hydration steht auch 1:1
      genauso bei serien, also brauchen wir das widget überhaupt nicht."

      Er hat recht. `btf.state.detail.detail` führt je Folge dasselbe Objekt wie
      die Widget-Antwort — Nummer, Titel, Beschreibung, Tonspuren, Untertitel,
      Dauer, Erscheinungsdatum. Der Abruf ist damit nur noch der Weg zu den
      **weiteren Abschnitten**, nicht mehr die Quelle.
    */
    const folgen = []
    for (const [asin, e] of Object.entries(unten?.detail?.detail ?? {})) {
      /* Der Eintrag der Staffel selbst steht mit drin — er ist keine Folge. */
      if (e?.titleType !== 'episode' || !Number.isFinite(e.episodeNumber)) continue

      /*
        **Ob die Folge hier abrufbar ist, steht im Aktionsblock.**

        Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 2: „ein paar episoden
        sind in der region nicht verfügbar." Bei ihnen trägt `primaryActions`
        eine schlichte Meldung statt eines Abspiel- oder Abo-Knopfes:

            actionType: "MESSAGE"
            string: "In deiner Region nicht mehr auf Prime Video verfügbar"

        Ihre `audioTracks` sind dann **leer** — was ohne diese Unterscheidung
        wie „keine deutsche Fassung" aussähe. Es heißt aber nur: hier nicht.
      */
      const aktion = unten?.action?.btf?.[asin]
      const arten = (aktion?.primaryActions ?? []).map((a) => a?.actionType)
      const meldung = (aktion?.primaryActions ?? [])
        .map((a) => a?.payload?.message?.message?.string ?? '')
        .find(Boolean)
      const gesperrt = arten.length > 0 && arten.every((a) => a === 'MESSAGE')

      folgen.push({
        nummer: e.episodeNumber,
        kennung: asin,
        titel: e.title ?? null,
        beschreibung: e.synopsis ?? null,
        sprachen: namenAus(e.audioTracks ?? []),
        untertitel: Array.isArray(e.subtitles) ? e.subtitles : [],
        dauerSek: Number.isFinite(e.duration) ? e.duration : null,
        laufzeit: e.runtime || null,
        erschienen: e.releaseDate ?? null,
        jahr: Number.isFinite(e.releaseYear) ? e.releaseYear : null,
        fsk: unten?.metadata?.[asin]?.maturityRating?.displayText ?? null,
        bild: e.images?.covershot ?? null,
        zugaenge: zugaengeAus(aktion),
        /* false heißt „hier gesperrt", nicht „ohne deutsche Fassung". */
        verfuegbar: !gesperrt,
        hinweis: gesperrt ? meldung ?? null : null,
      })
    }
    folgen.sort((a, b) => a.nummer - b.nummer)

    return { ...seite, folgen }
  }

  /* Für welche Adresse der Hydration-Block schon gelesen wurde. */
  let hydrationFuer = null

  function auswerten(text, herkunft) {
    if (typeof text !== 'string' || text.length < 60) return
    if (!text.includes('audioTracks') && !text.includes('episodePages')) return

    const funde = []
    let gesamt = null
    let seiten = []

    try {
      const liste = JSON.parse(text)?.widgets?.episodeList
      if (liste) {
        if (Number.isFinite(liste.episodeCount)) gesamt = liste.episodeCount
        for (const folge of liste.episodes ?? []) {
          const d = folge?.detail
          if (!d || !Array.isArray(d.audioTracks) || !Number.isFinite(d.episodeNumber)) continue
          const voll = folgeAusDetail(folge)
          if (voll) funde.push(voll)
        }
        for (const seite of liste.actions?.episodePages ?? []) {
          const token = seite?.token
          if (typeof token !== 'string' || token.length <= 10) continue
          // Der gerade gelieferte Abschnitt gilt als erledigt: Seine Folgen
          // stehen oben schon in `funde`, ein zweiter Abruf brächte dieselben
          // Daten und einen Zugriff mehr auf Amazons Server.
          if (seite.isSelected) geholt.add(token)
          alleAbschnitte.add(token)
          seiten.push(token)
        }
      }
    } catch {
      /* Keine JSON-Antwort — dann greift das Muster unten. */
    }

    if (!funde.length) {
      // Rückfall: Eine Sprache ohne Nummer zählt als Sprache, **nicht** als
      // Folge — sonst stimmte die Zahl am Knopf wieder nicht.
      for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)) {
        const namen = [...m[1].matchAll(/"displayName"\s*:\s*"([^"]+)"/g)].map((t) => t[1])
        const sprachen = namen.length
          ? namen
          : m[1]
              .split(',')
              .map((s) => s.trim().replace(/^"|"$/g, ''))
              .filter((s) => s && !s.includes('{') && !s.includes(':'))
        if (sprachen.length) funde.push({ nummer: null, sprachen })
      }
    }

    if (funde.length || gesamt !== null) {
      /*
        **Jede Meldung sagt, zu welcher Seite sie gehoert.**

        Daniel hat den Wettlauf am 25.08.2026 eingekreist: Laedt ein Titel noch
        — erkennbar an Amazons Abspiel-Knopf, der rund zwanzig Sekunden lang
        eine Ladeanimation zeigt — und wechselt man in dieser Zeit, kommen
        dessen Nachlade-Antworten **nach** dem Wechsel an. Sie landeten im
        frisch geleerten Zaehlstand des neuen Titels: "13 von 24" bei Clannad,
        wo die dreizehn zu Darwin Jihen gehoerten. Wartet er, bis der vorige
        Titel fertig ist, stimmt alles.

         taugt dafuer nicht: Sie steht fuer den Skriptstart, nicht
        fuer den Abruf.  wird hier gelesen, also genau dann, wenn
        die Antwort ausgewertet wird.
      */
      window.postMessage(
        { marke: MARKE, funde, gesamt, startAdresse, fuerAdresse: location.pathname + location.search, abschnitte: { gesamt: alleAbschnitte.size, offen: [...alleAbschnitte].filter((t) => !geholt.has(t)).length }, },
        '*',
      )
    }

    // Die Kennung der Serie steht in der Adresse, aus der die Antwort kam. Sie
    // wird gelesen, nicht gebaut — ohne sie wird nichts nachgeholt.
    if (!titleID && typeof herkunft === 'string') {
      try {
        titleID = new URL(herkunft, location.href).searchParams.get('titleID')
      } catch {
        /* Keine brauchbare Adresse — dann bleibt es beim Mitlesen. */
      }
    }
    if (seiten.length > 1) void nachholen(seiten)
  }

  /**
   * Die übrigen Abschnitte derselben Folgenliste holen.
   *
   * Jedes Token genau einmal, nacheinander, mit Pause. Was zurückkommt, läuft
   * durch `auswerten` — findet es dort weitere Tokens, sind die längst gesehen
   * und die Schleife endet von selbst.
   */
  async function nachholen(tokens) {
    if (laeuft || !titleID) return
    const offen = tokens.filter((t) => !geholt.has(t))
    if (!offen.length) return
    laeuft = true
    try {
      for (const token of offen) {
        if (geholt.size >= MAX_ABSCHNITTE) break
        geholt.add(token)
        const widgets = JSON.stringify([{ widgetType: 'EpisodeList', widgetToken: token }])
        const adresse =
          '/gp/video/api/getDetailWidgets' +
          `?titleID=${encodeURIComponent(titleID)}&widgets=${encodeURIComponent(widgets)}`
        try {
          const antwort = await nativFetch.call(window, adresse, {
            credentials: 'include',
            headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          })
          const text = antwort.ok ? await antwort.text() : ''
          diagnose.abrufe.push({ status: antwort.status, zeichen: text.length })
          if (antwort.ok) auswerten(text, antwort.url)
        } catch (err) {
          /* Ein fehlgeschlagener Abschnitt lässt die Zahl unvollständig — und
             damit meldet der Knopf ausdrücklich einen Ausschnitt. */
          diagnose.fehler.push(String(err?.message ?? err).slice(0, 120))
        }
        await warte(PAUSE_MS)
      }
    } finally {
      laeuft = false
    }
  }

  // --- Der Seitenquelltext --------------------------------------------------

  /**
   * Beim ersten Seitenaufbau gibt es nichts mitzulesen.
   *
   * Amazon liefert den ersten Abschnitt **im HTML** mit — es fliegt also keine
   * Antwort vorbei, an die sich der Mitleser hängen könnte. Ohne diesen Weg
   * blieb der Knopf deshalb bei „24 von 51 — Abschnitte selbst öffnen" stehen,
   * obwohl die Zugänge zu den übrigen Abschnitten längst auf der Seite lagen
   * (Daniel, 23.08.2026, mit Bild).
   *
   * Gemessen an derselben Seite, welche Felder es wirklich sind:
   *
   * ```
   * "titleID":"B0CKPCSHMC"          ← nicht die ASIN der Seite (B0CQ4VL364)!
   * "episodePages":[{"isSelected":true,…,"token":"ADAAAAIEAGJhbXpuMS5…"}]
   * ```
   *
   * **Beide Namen waren zu messen, nicht zu erraten.** Der erste Versuch suchte
   * nach `widgetToken` — so heißt das Feld im *Aufruf*, im Seitenquelltext
   * heißt es `token`. Und die `titleID` aus der Adresse zu bauen wäre
   * fehlgegangen: Die Seite liegt unter `B0CQ4VL364`, der Abruf braucht
   * `B0CKPCSHMC`.
   */
  /**
   * Vom `episodePages`-Fund nur das Array selbst behalten.
   *
   * Gleich dahinter steht `pagination` — „Vorherige Seite", „Nächste Seite" —
   * mit **denselben Abschnitten unter eigenen Tokens**. Wer stumpf 20.000
   * Zeichen absucht, findet bei „Digimon Tamers" fünf statt drei Tokens und
   * holt einen Abschnitt doppelt: 267 KB umsonst, bei jedem Seitenaufruf
   * (gemessen 23.08.2026 an Daniels Diagnose-Ausgabe).
   *
   * Geschnitten wird über die Klammern, nicht über ein Stichwort: Ein
   * `indexOf('pagination')` hielte nur, solange dieses Feld dort steht.
   */
  function nurDieAbschnitte(block) {
    const auf = block.indexOf('[')
    if (auf < 0) return block
    let tiefe = 0
    for (let i = auf; i < block.length; i++) {
      const c = block[i]
      if (c === '[') tiefe++
      else if (c === ']' && --tiefe === 0) return block.slice(auf, i + 1)
    }
    return block
  }

  function ausSeite(vorgelesen) {
    const html = vorgelesen ?? document.documentElement?.innerHTML
    if (typeof html !== 'string') return
    diagnose.quelltextLaenge = html.length

    /**
     * **Jede** Fundstelle wird probiert, nicht die erste.
     *
     * `titleID` steht in einem Seitenquelltext dieser Größe vielfach — in
     * Empfehlungsleisten, in Verfolgungsmarken, in Vorlagen ohne Wert. Die
     * erste Fundstelle zu nehmen und beim Misserfolg aufzugeben heißt, an der
     * falschen Stelle zu scheitern und die richtige nie zu sehen.
     */
    if (!titleID) {
      const stellen = [...html.matchAll(/titleID/g)].map((m) => m.index)
      diagnose.titleIDfundstellen = stellen.length
      for (const i of stellen) {
        // Gesucht wird am kurzen Ausschnitt: Amazon legt sein JSON mal roh in
        // einem Skriptblock ab, mal maskiert in einem HTML-Attribut
        // (`\"titleID\":\"…\"`). Eine Regex für beide Formen wird unlesbar.
        const treffer = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10,32})/.exec(html.slice(i, i + 80))
        if (treffer) {
          titleID = treffer[1]
          break
        }
      }
      diagnose.titleID = titleID
    }
    if (!titleID) return

    // Dasselbe hier: Der erste `episodePages`-Fund muss nicht der mit den
    // Tokens sein.
    const stellen = [...html.matchAll(/episodePages/g)].map((m) => m.index)
    diagnose.episodePagesGefunden = stellen.length > 0
    for (const start of stellen) {
      const block = nurDieAbschnitte(html.slice(start, start + 20000).replace(/\\+"/g, '"'))
      const tokens = []
      for (const m of block.matchAll(/"isSelected"\s*:\s*(true|false)[\s\S]{0,400}?"token"\s*:\s*"([^"]{20,})"/g)) {
        // Der gewählte Abschnitt steht schon im HTML — seine Folgen hat
        // `amazon.js` bereits gezählt. Ihn zu holen brächte nichts als einen
        // Zugriff mehr.
        if (m[1] === 'true') geholt.add(m[2])
        tokens.push(m[2])
      }
      if (tokens.length > 1) {
        diagnose.tokensImQuelltext = tokens.length
        void nachholen(tokens)
        return
      }
    }
  }

  // --- fetch ---------------------------------------------------------------

  // Festgehalten, bevor die eigene Fassung gesetzt wird: Das Nachholen ruft
  // absichtlich die **native** Funktion, sonst läse es seine eigene Antwort ein
  // zweites Mal mit.
  const nativFetch = window.fetch

  try {
    window.fetch = async function (...args) {
      const antwort = await nativFetch.apply(this, args)
      try {
        // Geklont, damit die Seite ihre eigene Antwort unangetastet bekommt.
        antwort
          .clone()
          .text()
          .then((t) => auswerten(t, antwort.url))
          .catch(() => {})
      } catch {
        /* Eine Antwort, die sich nicht klonen lässt, bleibt liegen. */
      }
      return antwort
    }
  } catch {
    /* Ohne fetch-Mitlesen bleibt der XHR-Weg. */
  }

  // --- XMLHttpRequest ------------------------------------------------------

  try {
    const beschreibung = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')
    const nativGetter = beschreibung?.get
    if (nativGetter) {
      Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
        configurable: true,
        enumerable: beschreibung.enumerable,
        get() {
          const text = nativGetter.call(this)
          try {
            auswerten(text, this.responseURL)
          } catch {
            /* Eine unlesbare Antwort ändert nichts am Rest. */
          }
          return text
        },
      })
    }
  } catch {
    /* Ohne Mitlesen bleibt der Stand aus dem HTML. */
  }

  // --- Anlauf ---------------------------------------------------------------

  /**
   * Der Quelltext wird mehrfach befragt, nicht einmal.
   *
   * Das Skript läuft bei `document_start`, da steht vom Seitenkörper noch
   * nichts. Wie lange Amazon braucht, bis die Folgenliste im Quelltext steht,
   * hängt an Leitung und Gerät — deshalb wird nachgesehen statt geraten.
   * Sobald `nachholen()` einmal gegriffen hat, sind die Tokens in `geholt` und
   * weitere Anläufe tun nichts.
   */
  /**
   * Beim Staffelwechsel fängt der Leser von vorn an.
   *
   * Amazon tauscht im Auswahlfeld die ganze Seite aus und schreibt eine neue
   * Kennung in die Adresse, ohne neu zu laden. Behielte der Leser seine alte
   * `titleID`, holte er die Abschnitte der **vorigen** Staffel nach — und
   * `geholt` hielte ihn davon ab, die neuen überhaupt anzufordern.
   */
  /**
   * Die Adresse als Zeichenkette — mit `String()`, nicht mit `+`.
   *
   * `location.pathname + location.search` sieht nach Textverkettung aus, ist
   * aber eine **Zahlenaddition**, sobald beide Werte fehlen: `undefined +
   * undefined` ergibt `NaN`, und `NaN === NaN` ist `false`. Der Vergleich
   * meldete dann bei **jedem** Takt einen Seitenwechsel und leerte `geholt` —
   * jeder Abschnitt wurde doppelt und dreifach geholt.
   */
  const pfad = () => `${location?.pathname ?? ''}${location?.search ?? ''}`

  let letzterPfad = pfad()
  let langsam = false
  let takt = null

  /**
   * Ein Fingerabdruck der gerade gezeigten Folgenliste.
   *
   * Der erste Abschnitts-Token gehört zu **dieser** Staffel und wechselt mit
   * ihr. Er ist damit das Merkmal, das ein Staffelwechsel nicht verfehlen kann
   * — anders als die Adresse, die Amazon beim Wechsel über das Auswahlfeld
   * nicht immer anfasst.
   *
   * Gelesen wird nur der Anfang des Tokens: Er genügt zum Vergleichen, und die
   * kurze Zeichenkette bleibt auch in der Diagnose lesbar.
   */
  function abschnittsFinger(vorgelesen) {
    try {
      /**
       * **Der Quelltext wird durchgereicht, nicht zweimal gebaut.**
       *
       * `innerHTML` baut die Zeichenkette jedes Mal neu auf — bei einer
       * Prime-Seite 2,2 MB. Bis zum 25.08.2026 taten das je 500-ms-Takt **zwei**
       * Stellen unabhängig voneinander: diese hier und `ausSeite()`. Zusammen
       * mit `body.textContent` waren das rund **9 MB Zeichenketten je Sekunde**
       * je Prime-Tab, dreißig Sekunden lang — und Chrome hält alle Tabs
       * derselben Site in **einem** Renderer-Prozess, wo sich der Müll summiert.
       * Daniel am 25.08.2026: „nach ca 20 meldungen in a row, crashed es …
       * memory leak??"
       *
       * `schritt()` liest jetzt einmal und gibt den Stand weiter. Beide lesen
       * ohnehin denselben Stand im selben Durchlauf; sie lasen ihn nur getrennt.
       *
       * **Der `textContent`-Wächter fällt damit weg**, und das ist kein
       * Verlust: Er sollte das teure `innerHTML` verhindern, griff aber nie —
       * auf einer Prime-Titelseite steht „Folgen" praktisch immer (Reiter,
       * Zwischenüberschrift, Kachelbeschriftung), und er baute selbst eine
       * Zeichenkette über den ganzen Baum auf.
       *
       * Ohne Argument liest die Funktion weiter selbst — der gemächliche Takt
       * ruft sie so auf.
       */
      const html = vorgelesen ?? document.documentElement?.innerHTML
      if (typeof html !== 'string') return ''
      const i = html.indexOf('episodePages')
      if (i < 0) return ''
      const m = /\\?"token\\?"\s*:\s*\\?"([A-Za-z0-9+/=_.-]{20,})/.exec(html.slice(i, i + 2000))
      return m ? m[1].slice(0, 32) : ''
    } catch {
      return ''
    }
  }

  let letzterFinger = ''

  /**
   * Die ASIN, die die **Adresse** gerade nennt.
   *
   * Sie ist beim Dropdown-Wechsel die einzige Quelle, die mitwandert — der
   * Quelltext bleibt bei der Staffel, mit der die Seite geladen wurde.
   */
  function asinAusAdresse() {
    return /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})(?:[/?]|$)/.exec(location.pathname)?.[1] ?? null
  }

  /**
   * Die Kennung, zu der der jetzige Zählstand gehört.
   *
   * Beim Laden ist das die der Adresse — der Quelltext ist dann frisch und
   * gehört genau zu ihr. Danach setzt jeder Abruf sie auf die geholte Staffel.
   * Aus dem Vergleich mit der Adresse folgt beides: ob überhaupt etwas zu holen
   * ist, und ob der Aufruf die gewünschte Staffel überhaupt treffen kann.
   */
  let geholteStaffel =
    /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})(?:[/?]|$)/.exec(location.pathname)?.[1] ?? null
  let holtGerade = false

  /**
   * Die Folgenliste einer Staffel gezielt anfordern.
   *
   * Ohne „widgetToken": Der liefert einen bestimmten Abschnitt, die Kennung
   * allein den ersten — und damit `episodeCount` und die Tonspuren, um die es
   * geht. Weitere Abschnitte holt `nachholen()` wie bisher über die Tokens aus
   * der Antwort.
   *
   * Gesendet wird mit `ersetzt: true`: Der Empfänger muss seinen Zählstand
   * wegwerfen, sonst mischen sich die Folgen zweier Staffeln.
   */
  async function holeStaffel(asin) {
    if (holtGerade || !asin || asin === geholteStaffel) return
    holtGerade = true
    // Beim Fehlschlag zurück auf den alten Wert — sonst gilt eine Staffel als
    // geholt, von der nie etwas angekommen ist, und der Knopf wartet für immer.
    const vorher = geholteStaffel
    geholteStaffel = asin
    let ankam = false
    try {
      const widgets = JSON.stringify([{ widgetType: 'EpisodeList' }])
      const adresse =
        '/gp/video/api/getDetailWidgets' +
        `?titleID=${encodeURIComponent(asin)}&widgets=${encodeURIComponent(widgets)}`
      const antwort = await nativFetch.call(window, adresse, {
        credentials: 'include',
        headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      })
      if (!antwort.ok) return
      const text = await antwort.text()
      const liste = JSON.parse(text)?.widgets?.episodeList
      if (!liste) return

      const funde = []
      for (const folge of liste.episodes ?? []) {
        const d = folge?.detail
        if (!d || !Array.isArray(d.audioTracks) || !Number.isFinite(d.episodeNumber)) continue
        const voll = folgeAusDetail(folge)
        if (voll) funde.push(voll)
      }
      const gesamt = Number.isFinite(liste.episodeCount) ? liste.episodeCount : null
      window.postMessage(
        { marke: MARKE, funde, gesamt, startAdresse, ersetzt: true, asin, fuerAdresse: location.pathname + location.search, abschnitte: { gesamt: alleAbschnitte.size, offen: [...alleAbschnitte].filter((t) => !geholt.has(t)).length }, },
        '*',
      )
      ankam = true

      // Die übrigen Abschnitte wie gewohnt — die Tokens stehen in der Antwort.
      const seiten = []
      for (const seite of liste.actions?.episodePages ?? []) {
        if (typeof seite?.token !== 'string' || seite.token.length <= 10) continue
        if (seite.isSelected) geholt.add(seite.token)
        alleAbschnitte.add(seite.token)
        seiten.push(seite.token)
      }
      if (seiten.length > 1) {
        titleID = asin
        void nachholen(seiten)
      }
    } catch {
      /* Kein Netz oder eine unerwartete Antwort — dann bleibt es beim Mitlesen. */
    } finally {
      if (!ankam) geholteStaffel = vorher
      holtGerade = false
    }
  }

  /** Nimmt den Quelltext entgegen, wenn ihn der Aufrufer schon hat (siehe schritt()). */
  function beiSeitenwechsel(vorgelesen) {
    const jetzt = pfad()
    const finger = abschnittsFinger(vorgelesen)
    /**
     * Zwei Merkmale, und das zweite ist das verlässlichere.
     *
     * Bis zum 24.08.2026 zählte nur der Pfad. Wechselt Amazon die Staffel über
     * das Auswahlfeld, ohne die Adresse zu ändern — oder ändert sie erst nach
     * dem Inhalt —, blieb der Wechsel unbemerkt: `geholt` behielt die Tokens
     * der alten Staffel, und für die neue wurde nie etwas angefordert. Genau
     * das hat Daniel beobachtet: beim ersten Laden klappte es, nach dem
     * Dropdown-Wechsel nicht mehr.
     */
    const gewechselt = jetzt !== letzterPfad || (finger && finger !== letzterFinger)
    if (!gewechselt) return
    letzterPfad = jetzt
    letzterFinger = finger
    titleID = null
    geholt.clear()
    /**
     * **Auch die zuletzt geholte Kennung wird vergessen — sonst gibt es keinen
     * zweiten Anlauf.**
     *
     * `holeStaffel()` steigt aus, wenn die gewünschte Kennung bereits geholt
     * wurde. Das ist innerhalb einer Staffel richtig und spart Abrufe. Über
     * einen Seitenwechsel hinweg ist es falsch: Der Knopf leert seinen
     * Zählstand beim Wechsel, und wenn danach kein Abruf mehr kommt, bleibt er
     * für immer leer.
     *
     * Genau das hat Daniel am 25.08.2026 gemessen — der Knopf zeigte nach dem
     * Wechsel kurz „🇩🇪 Deutsch · 12 Folgen", fiel dann auf „Tonspuren noch
     * nicht geladen" zurück und blieb dort: „jetzt sind 5min später und es
     * steht immer noch ‚noch nicht geladen'". Der erste Abruf war angekommen,
     * der zweite unterblieb.
     *
     * Ein Abruf je Seitenwechsel ist der Preis, und er ist niedrig: Prime holt
     * dieselbe Adresse beim Navigieren ohnehin selbst.
     */
    geholteStaffel = null
    /* Auch der Hydration-Block gehoert zur alten Adresse. */
    hydrationFuer = null
    diagnose.titleID = null
    diagnose.tokensImQuelltext = 0
    diagnose.anlaeufe = 0
    takten(false) // Die neue Staffel lädt gerade erst — wieder genau hinsehen.
    /**
     * Und die Folgenliste gezielt holen, statt auf einen Quelltext zu warten,
     * der nie kommt. Das ist der Unterschied zwischen „Seite neu laden" und
     * „einen Moment" (Daniel, 24.08.2026: „wozu muss ich neuladen").
     */
    /**
     * **Nur, wenn die ASIN allein die Staffel bestimmt.**
     *
     * `getDetailWidgets?titleID=<ASIN>` liefert die Folgenliste, die zu dieser
     * Kennung gehört — und mehr weiß der Aufruf nicht. Bei einer Serie, die je
     * Staffel eine eigene ASIN führt, ist das genau die richtige. Bei einer
     * **Sammel-ASIN** für mehrere Staffeln (JoJo: 7, Jujutsu Kaisen: 4, Marco:
     * 8) kommt dagegen immer dieselbe zurück, egal welche Staffel gerade
     * gewählt ist.
     *
     * Was dann geschieht, hat Daniel am 25.08.2026 gemeldet: Er stand auf
     * Jujutsu Kaisen Staffel 3 mit zwölf Folgen, der Knopf sagte „23 Folgen",
     * und die Meldung ging mit dieser Zahl raus. Der Abruf hatte die Folgen
     * einer anderen Staffel geliefert und den Zählstand damit **ersetzt** —
     * `ersetzt: true` ist für den Fall gedacht, dass die neuen Daten die
     * richtigen sind.
     *
     * Erkennbar ist die Sammel-ASIN **an der Kennung selbst**: Bleibt sie beim
     * Wechsel dieselbe, könnte der Aufruf nur wieder dieselbe Staffel liefern.
     * Dann wird nicht geholt, und es bleibt beim Hinweis, neu zu laden. Genau
     * das prüft `holeStaffel()` in seiner ersten Zeile.
     *
     * Bis zum 25.08.2026 stand hier stattdessen die **Staffelnummer** aus der
     * Adresse: geholt wurde nur bei `_s1`. Das traf den Sammelfall richtig, warf
     * aber den häufigeren gleich mit weg — jeder Wechsel auf Staffel 2 oder
     * höher verlangte ein Neuladen, auch dort, wo der Abruf funktioniert hätte
     * (High School DxD, GOSICK, Captain Tsubasa führen je Staffel eine eigene
     * Kennung). Daniel am 25.08.2026: „neu lade zwang bug … ich muss jedesmal
     * neuladen nervt".
     */
    void holeStaffel(asinAusAdresse())
  }

  /**
   * Nach getaner Arbeit wird der Takt langsam, nicht stumm.
   *
   * Ihn ganz abzuschalten war die erste Fassung — dann bleibt ein
   * Staffelwechsel unbemerkt, und genau der ist der häufigste Fall. Ihn
   * unverändert weiterlaufen zu lassen war die zweite: zwei Durchläufe je
   * Sekunde, für immer, auf einer Seite, die stundenlang offen sein kann.
   *
   * Also beides. 30 Sekunden lang wird der Quelltext im Halbsekundentakt
   * abgesucht — solange lädt Amazon noch nach. Danach genügt es, alle vier
   * Sekunden nach einer neuen Kennung zu sehen; ein Mensch wechselt die
   * Staffel nicht schneller.
   */
  function takten(gemaechlich) {
    if (takt !== null && gemaechlich === langsam) return
    langsam = gemaechlich
    if (takt !== null) clearInterval(takt)
    takt = setInterval(gemaechlich ? beiSeitenwechsel : schritt, gemaechlich ? 4000 : 500)
  }

  function schritt() {
    /*
      **Einmal lesen, zweimal verwenden.**

      Bis zum 25.08.2026 bauten abschnittsFinger() und ausSeite() den Quelltext
      je Takt unabhaengig voneinander auf — zusammen mit body.textContent rund
      9 MB Zeichenketten je Sekunde je Prime-Tab. Beide lesen ohnehin denselben
      Stand im selben Durchlauf.
    */
    /*
      **Der Film-Weg zuerst — er braucht keinen Abruf.**

      Für einen Film schickt Prime kein `getDetailWidgets`; die Daten stehen im
      Hydration-Block der ausgelieferten Seite. Einmal je Adresse gelesen und
      weitergereicht, danach schweigt es.
    */
    /*
      **Der Merker wird erst gesetzt, wenn es geklappt hat.**

      Daniel am 25.08.2026 an „Jujutsu Kaisen 0" (`0PCNT2617SSVLV8ZGSS62UTQSZ`):
      Der Knopf blieb auf „nicht abrufbar", auch nach Neuladen. Sein
      Diagnosefeld zeigte neun Sprachen, aber `folgen: 0` und `jeFolge: {}` —
      die Sprachen kamen aus dem Muster-Rückfall, der Film-Weg war nie gelaufen.

      Der Block ist da und vollständig (544.032 Zeichen, nachgemessen), und er
      trägt alles: `entityType: "Movie"`, die neun Tonspuren. Nur hatte der erste
      Versuch nach 500 ms ins Leere gegriffen — und weil `hydrationFuer`
      **unabhängig vom Ergebnis** gesetzt wurde, gab es keinen zweiten.

      Ein Merker, der auch den Fehlschlag festhält, verwandelt eine Verzögerung
      in einen Dauerzustand.
    */
    /*
      **Die Seite bringt alles mit — Film wie Serie.**

      Daniel am 25.08.2026: „ich merke gerade das hydration steht auch 1:1
      genauso bei serien, also brauchen wir das widget überhaupt nicht und
      können immer auf hydration gehen."

      Gemessen an „Yu-Gi-Oh! ZEXAL" Staffel 2 (`B0GV8N71SL`): Der Block liefert
      Serientitel, Staffelnummer, alle sechs Staffeln mit eigener Kennung, die
      Gesamtzahl von 74 Folgen — und 24 Folgen mit Tonspuren, Beschreibung und
      Erscheinungsdatum. Der Widget-Abruf ist damit nur noch der Weg zu den
      **weiteren Abschnitten**, nicht mehr die Quelle.

      Der Merker wird erst nach einem Treffer gesetzt: Ein erster Versuch nach
      500 ms greift bei einem halben Megabyte JSON manchmal ins Leere, und ein
      Fehlschlag darf keine Verzögerung in einen Dauerzustand verwandeln
      („Jujutsu Kaisen 0" blieb so auf „nicht abrufbar" stehen).
    */
    if (hydrationFuer !== location.pathname + location.search) {
      const seite = ausHydration()
      if (seite) {
        hydrationFuer = location.pathname + location.search
        window.postMessage(
          {
            marke: MARKE,
            /* Ein Film zählt als eine Folge, eine Serie bringt ihre eigenen mit. */
            funde:
              seite.folgen.length > 0
                ? seite.folgen
                : seite.art && seite.art !== 'TV Show'
                  ? [{ ...seite, nummer: 1 }]
                  : [],
            gesamt: seite.folgen.length || (seite.art !== 'TV Show' ? 1 : null),
            seite,
            startAdresse,
            fuerAdresse: location.pathname + location.search,
          },
          '*',
        )
      }
    }

    const html = document.documentElement?.innerHTML ?? ''
    beiSeitenwechsel(html)
    if (++diagnose.anlaeufe > 60 || diagnose.tokensImQuelltext) {
      takten(true)
      return
    }
    try {
      ausSeite(html)
    } catch (err) {
      diagnose.fehler.push(String(err?.message ?? err).slice(0, 120))
    }
  }

  takten(false)
  try {
    ausSeite()
  } catch {
    /* Beim ersten Anlauf ist der Seitenkörper meist noch leer — erwartet. */
  }
})()
