/**
 * Liest je Prime-Seite **einen** Zustand und schickt ihn vollständig an `amazon.js`.
 *
 * ## Das Modell
 *
 * Daniel am 15.09.2026, nach drei Fixes an einem Vormittag: „es ist ein simples
 * scraping … einfach scrapen was da ist, mitbekommen wann ein wechsel passiert,
 * bisherige scraping data entsprechend zurücksetzen und scraping erneut starten."
 *
 * Genau so ist es gebaut:
 *
 * 1. **Ein Zustand je Seite.** Schlüssel ist der Pfad plus die Staffel aus der
 *    Adresse (`?ref_=…_sN`) — Sammel-Kennungen wie JoJo wechseln die Staffel,
 *    ohne den Pfad zu ändern.
 * 2. **Ändert sich der Schlüssel, wird der Zustand verworfen** und neu gelesen.
 * 3. **Eine Quelle:** der Hydration-Block der Seite
 *    (`<script id="dv-web-page-hydration-data">`). Beim Laden steht er im DOM.
 *    Nach einem Wechsel über das Auswahlfeld tauscht Amazon ihn **nicht** aus
 *    (gemessen 24.08.2026 und im Bericht vom 15.09.2026) — dann wird die Seite
 *    der neuen Adresse abgerufen und der Block aus der Antwort gelesen. Das sind
 *    dieselben Daten, die ein Neuladen bringt.
 * 4. **Weitere Abschnitte** einer langen Staffel („Folgen 25–48") stehen nicht im
 *    Block; sie kommen über die Tokens aus derselben Seite
 *    (`/gp/video/api/getDetailWidgets`), Zeichen für Zeichen der Abruf, den ein
 *    Klick auf das Abschnitts-Auswahlfeld auslöst.
 * 5. **Gesendet wird an einer Stelle, immer der ganze Zustand.** `amazon.js`
 *    ersetzt seinen Zählstand damit und führt nichts zusammen.
 *
 * ## Was es vorher gab, und warum es wegfiel
 *
 * Bis 4.20.10 lasen fünf Wege dieselben Angaben — DOM-Block, nachgeholte Seite,
 * ein gezielter `getDetailWidgets`-Abruf je Staffel, das Mitlesen von Amazons
 * eigenen Anfragen samt Muster-Rückfall, und das Nachholen der Abschnitte — und
 * schickten sie über vier Stellen. Wer zuletzt ankam, gewann: Am 15.09.2026
 * zeigte derselbe Knopf nach dem Laden je nach Reihenfolge „Deutsch" oder
 * „kein Deutsch", weil der Staffel-Abruf leere `audioTracks` (Kanal ohne Abo)
 * über die gefüllten des Blocks schrieb.
 *
 * Läuft in der Seitenwelt (`world: MAIN`) bei `document_start`: Nur hier gehört
 * ein `fetch` zur angemeldeten Sitzung, und nur hier ist der Verweis-Parameter
 * der Startadresse noch zu sehen.
 */
;(() => {
  const MARKE = 'ak-amazon-folgen'

  /**
   * Obergrenze für das Nachholen von Abschnitten.
   *
   * Bei 24 Folgen je Abschnitt rund 600 Folgen — mehr als jede Serie im Bestand.
   * Die Grenze steht da, damit aus einer Bedienhilfe nie ein Durchlauf wird: Wo
   * sie greift, bleiben Abschnitte offen, und der Knopf meldet einen Ausschnitt.
   */
  const MAX_ABSCHNITTE = 25

  /** Pause zwischen zwei Abschnitts-Abrufen. Ein Mensch klickt auch nicht schneller. */
  const PAUSE_MS = 400

  /** So lange wird beim Laden im Halbsekundentakt nach dem Block gesehen. */
  const ANLAUF_TAKTE = 60

  /**
   * Die Adresse beim **Seitenstart** — Amazon räumt `?ref_=…_sN` weg, sobald die
   * Seite steht (23.08.2026), und `amazon.js` startet zu spät, um ihn zu sehen.
   */
  const startAdresse = location.href
  const startPfad = location.pathname

  /* Festgehalten, bevor irgendjemand `fetch` ersetzt. */
  const nativFetch = window.fetch

  /**
   * Der Stand des Lesers, ablesbar über `window.__akAmazon` — und über den
   * Diagnosebericht der Erweiterung.
   */
  const diagnose = {
    fassung: '1.0.0',
    startAdresse,
    schluessel: null,
    quelle: null,
    folgen: 0,
    abschnitte: 0,
    geholt: 0,
    abrufe: [],
    fehler: [],
  }
  window.__akAmazon = diagnose

  const warte = (ms) => new Promise((r) => setTimeout(r, ms))
  const fehler = (err) => diagnose.fehler.push(String(err?.message ?? err).slice(0, 120))

  /**
   * Die Sprachnamen aus einem `audioTracks`-Feld — beide Formen.
   *
   * Meist schlichte Namen (`["Deutsch","日本語"]`), bei „Oshi no Ko" Staffel 3
   * ganze Objekte mit `displayName`. Ungefiltert weitergereicht wurde daraus am
   * 23.08.2026 `[object Object]` in der Meldung.
   */
  function namenAus(spuren) {
    if (!Array.isArray(spuren)) return []
    return spuren
      .map((s) => (typeof s === 'string' ? s : (s?.displayName ?? s?.language ?? null)))
      .filter((s) => typeof s === 'string' && s.trim())
  }

  /**
   * **Eine Folge, vollständig** — Daniel am 25.08.2026: „wir sammeln ab jetzt
   * infos pro episode." Jedes Feld kommt unverändert aus der Antwort.
   */
  function folgeAusDetail(folge) {
    const d = folge?.detail
    if (!d || !Number.isFinite(d.episodeNumber)) return null
    return {
      nummer: d.episodeNumber,
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
   * Seite und Folgen aus dem Text eines Hydration-Blocks.
   *
   * Gemessen an „Avatar Aang" (Film) und „Yu-Gi-Oh! ZEXAL" Staffel 2 (Serie):
   * `atf.state.detail.headerDetail[<Kennung>]` trägt Titel, Tonspuren, Staffel,
   * `btf.state.detail.detail` je Folge dasselbe Objekt wie die Widget-Antwort.
   */
  function ausHydration(text) {
    let daten
    try {
      daten = JSON.parse(text)
    } catch {
      return null
    }
    const koerper = daten?.init?.preparations?.body
    const oben = koerper?.atf?.state
    const unten = koerper?.btf?.state
    if (!oben) return null

    const kennung = oben.pageTitleId ?? null
    /*
      **`headerDetail` ist manchmal leer — dann steht der Kopf in `detail.detail`.**
      „One Piece – Strong World" (30.08.2026): `audioTracks` dreimal im Block,
      `headerDetail` ein leeres Objekt. Übernommen aus `filmAusSeite()` in
      `amazon.js`, das seit dem 15.09.2026 nicht mehr selbst parst.
    */
    const koepfe = { ...(oben.detail?.detail ?? {}), ...(oben.detail?.headerDetail ?? {}) }
    const kopf = koepfe[kennung] ?? Object.values(oben.detail?.headerDetail ?? {})[0] ?? Object.values(koepfe).find((x) => x?.audioTracks?.length)
    if (!kopf) return null

    /*
      **Die Zugänge stehen am Aktionsblock der Seite.** `benefitId` taucht im
      ganzen Block auf, auch in Empfehlungsleisten fremder Titel.
    */
    const zugaengeAus = (o) => [
      ...new Set([...JSON.stringify(o ?? {}).matchAll(/"benefitId":"([^"]+)"/g)].map((m) => m[1])),
    ]

    const seite = {
      kennung,
      /*
        **Die gti der Seite** (`catalogId` im eigenen Kopf, 17.09.2026). Der Bau stellt einen
        Prime-Verweis erst auf JustWatchs gti-Adresse um, wenn sie hier abgelesen wurde —
        JustWatch ordnete „Pokémon Weiß" die gti von „Schwarz" zu.
      */
      gti: /^amzn1\.dv\.gti\./.test(koepfe[kennung]?.catalogId ?? '') ? koepfe[kennung].catalogId : null,
      art: kopf.entityType ?? null,
      /* „season" bei einer Staffel, „movie" bei einem Film, „episode" bei einer Folge. */
      sorte: kopf.titleType ?? null,
      titel: kopf.title ?? null,
      serie: kopf.parentTitle ?? null,
      staffel: Number.isFinite(kopf.seasonNumber) ? kopf.seasonNumber : null,
      /* Der Band, falls Prime die Staffel geteilt hat („Season 2, Volume 2", ZEXAL). */
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
      /*
        **Kauf und Leihe stehen ebenfalls im Aktionsblock** — gemessen am
        15.09.2026 an der Kaufausgabe `B0CVQW43HC`: `actionType: "TRANSACT"` und
        der Text „Als Kauftitel verfügbar". Bisher las `amazon.js` beides per
        Muster aus dem sichtbaren Seitentext.
      */
      kaufbar: /"actionType":"TRANSACT"/.test(JSON.stringify(oben.action ?? {})),
      leihbar: /Leihtitel|Leihen\b/.test(JSON.stringify(oben.action ?? {})),
      fsk: oben.metadata?.[kennung]?.maturityRating?.displayText ?? kopf.ratingBadge?.displayText ?? null,
      bild: kopf.images?.covershot ?? null,
      imdb: oben.imdb?.[kennung]?.score ?? null,
      /* Als Text („74 Folgen") und für die **Reihe**, nicht den gezeigten Abschnitt. */
      folgenGesamt: Number(/(\d+)/.exec(oben.metadata?.[kennung]?.episodeCount ?? '')?.[1]) || null,
      staffeln: (oben.seasons?.[kennung] ?? []).map((s) => ({
        kennung: s.seasonId,
        name: s.displayName,
        nummer: s.sequenceNumber,
        gewaehlt: Boolean(s.isSelected),
      })),
    }

    const folgen = []
    for (const [asin, e] of Object.entries(unten?.detail?.detail ?? {})) {
      /* Der Eintrag der Staffel selbst steht mit drin — er ist keine Folge. */
      if (e?.titleType !== 'episode' || !Number.isFinite(e.episodeNumber)) continue
      /*
        **Ob die Folge hier abrufbar ist, steht im Aktionsblock.** Bei „In deiner
        Region nicht mehr auf Prime Video verfügbar" trägt `primaryActions` nur
        eine MESSAGE, und die `audioTracks` sind leer — das heißt „hier nicht",
        nicht „ohne deutsche Fassung" (ZEXAL, 25.08.2026).
      */
      const aktion = unten?.action?.btf?.[asin]
      const arten = (aktion?.primaryActions ?? []).map((a) => a?.actionType)
      const meldung = (aktion?.primaryActions ?? []).map((a) => a?.payload?.message?.message?.string ?? '').find(Boolean)
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
        verfuegbar: !gesperrt,
        hinweis: gesperrt ? (meldung ?? null) : null,
      })
    }
    return { ...seite, folgen }
  }

  /**
   * `titleID` und Abschnitts-Tokens aus dem Quelltext einer Seite.
   *
   * **Beide Namen sind gemessen** (23.08.2026, „Digimon Tamers"): Im Quelltext
   * heißt das Feld `token` (im Aufruf `widgetToken`), und die `titleID` ist nicht
   * die Kennung der Adresse (Seite `B0CQ4VL364`, Abruf `B0CKPCSHMC`). Jede
   * Fundstelle wird probiert, nicht die erste — `titleID` steht vielfach im
   * Quelltext, auch in Empfehlungsleisten. Das JSON liegt mal roh, mal maskiert
   * (`\"titleID\"`) vor.
   */
  function tokensAus(html) {
    let titleID = null
    for (const m of html.matchAll(/titleID/g)) {
      const treffer = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10,32})/.exec(html.slice(m.index, m.index + 80))
      if (treffer) {
        titleID = treffer[1]
        break
      }
    }
    for (const m of html.matchAll(/episodePages/g)) {
      const block = nurDasArray(html.slice(m.index, m.index + 20000).replace(/\\+"/g, '"'))
      const tokens = [...block.matchAll(/"isSelected"\s*:\s*(true|false)[\s\S]{0,400}?"token"\s*:\s*"([^"]{20,})"/g)].map(
        (t) => ({ token: t[2], gewaehlt: t[1] === 'true' }),
      )
      if (tokens.length) return { titleID, tokens }
    }
    return { titleID, tokens: [] }
  }

  /**
   * Vom `episodePages`-Fund nur das Array. Gleich dahinter steht `pagination`
   * mit denselben Abschnitten unter **eigenen** Tokens — ein fester Ausschnitt
   * holte bei „Digimon Tamers" einen Abschnitt doppelt (23.08.2026).
   */
  function nurDasArray(text) {
    const auf = text.indexOf('[')
    if (auf < 0) return text
    let tiefe = 0
    for (let i = auf; i < text.length; i++) {
      if (text[i] === '[') tiefe++
      else if (text[i] === ']' && --tiefe === 0) return text.slice(auf, i + 1)
    }
    return text
  }

  // --- Der Zustand ------------------------------------------------------------

  /** Die Staffel aus der Adresse, sofern sie dort steht. */
  const staffelAusAdresse = () => Number(/[?&]ref_=[^&]*_s(\d+)/.exec(location.search)?.[1]) || null

  let zustand = null

  function neuerZustand() {
    zustand = {
      pfad: location.pathname,
      staffel: staffelAusAdresse(),
      /* Die Adresse beim Beginn — mit ihr wird abgerufen und gestempelt. */
      adresse: location.pathname + location.search,
      seite: null,
      folgen: new Map(),
      gesamt: null,
      titleID: null,
      tokens: new Set(),
      geholt: new Set(),
      nachholenLaeuft: false,
    }
    diagnose.schluessel = `${zustand.pfad}|${zustand.staffel ?? ''}`
    diagnose.quelle = null
    return zustand
  }

  /**
   * **Ist das noch dieselbe Seite?** Ein anderer Pfad heißt nein; eine andere
   * Staffel in der Adresse ebenfalls. Fehlt die Staffel in der Adresse, ist das
   * keine Auskunft — Amazon räumt den Parameter nach dem Laden weg, und ein
   * Wechsel daraus wäre ein Fehlalarm, der die Seite ein zweites Mal abruft.
   */
  function gleicheSeite(z) {
    if (!z || location.pathname !== z.pfad) return false
    const s = staffelAusAdresse()
    return s === null || s === z.staffel
  }

  /**
   * Folgen in den Zustand übernehmen — je Nummer eine.
   *
   * **Eine leere Tonspurliste überschreibt keine gefüllte.** Leer heißt „nichts
   * gesagt" (Kanal ohne Abo, gesperrte Folge), nicht „kein Deutsch" (15.09.2026).
   */
  function uebernehmen(z, folgen) {
    for (const f of folgen) {
      if (!f || !Number.isFinite(f.nummer)) continue
      const alt = z.folgen.get(f.nummer)
      if (alt?.sprachen?.length && !f.sprachen?.length) continue
      z.folgen.set(f.nummer, f)
    }
  }

  /** Den Block und die Tokens einer Seite in den Zustand legen. */
  function ausSeite(z, blockText, html, quelle) {
    const seite = ausHydration(blockText)
    if (!seite) return false
    z.seite = seite
    uebernehmen(z, seite.folgen)
    const { titleID, tokens } = tokensAus(html)
    if (titleID) z.titleID = titleID
    for (const t of tokens) {
      z.tokens.add(t.token)
      /* Der gewählte Abschnitt steht schon im Block — ihn zu holen brächte nichts. */
      if (t.gewaehlt) z.geholt.add(t.token)
    }
    diagnose.quelle = quelle
    return true
  }

  /**
   * **Die einzige Sendestelle.** Immer der ganze Zustand; `amazon.js` ersetzt
   * seinen Zählstand damit (`schnappschuss: true`).
   */
  function senden(z, zusatz = {}) {
    if (z !== zustand) return
    const abrufAdresse = z.adresse
    const folgen = [...z.folgen.values()].sort((a, b) => a.nummer - b.nummer)
    const seite = z.seite
    /* Ein Film zählt als eine Folge. */
    const funde = folgen.length ? folgen : seite?.art && seite.art !== 'TV Show' ? [{ ...seite, nummer: 1 }] : []
    diagnose.folgen = folgen.length
    diagnose.abschnitte = z.tokens.size
    diagnose.geholt = z.geholt.size
    window.postMessage(
      {
        marke: MARKE,
        schnappschuss: true,
        funde,
        gesamt: z.gesamt ?? (funde.length || null),
        ...(seite ? { seite } : {}),
        startAdresse,
        fuerAdresse: abrufAdresse,
        abschnitte: { gesamt: z.tokens.size, offen: [...z.tokens].filter((t) => !z.geholt.has(t)).length },
        ...zusatz,
      },
      '*',
    )
  }

  /** Die übrigen Abschnitte über ihre Tokens — jeder genau einmal, nacheinander. */
  async function nachholen(z) {
    if (z.nachholenLaeuft || !z.titleID) return
    z.nachholenLaeuft = true
    try {
      for (const token of [...z.tokens]) {
        if (z !== zustand) return
        if (z.geholt.has(token)) continue
        if (z.geholt.size >= MAX_ABSCHNITTE) break
        z.geholt.add(token)
        const widgets = JSON.stringify([{ widgetType: 'EpisodeList', widgetToken: token }])
        const adresse =
          '/gp/video/api/getDetailWidgets' +
          `?titleID=${encodeURIComponent(z.titleID)}&widgets=${encodeURIComponent(widgets)}`
        try {
          const antwort = await nativFetch.call(window, adresse, {
            credentials: 'include',
            headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          })
          const text = antwort.ok ? await antwort.text() : ''
          diagnose.abrufe.push({ status: antwort.status, zeichen: text.length })
          if (z !== zustand || !antwort.ok) continue
          const liste = JSON.parse(text)?.widgets?.episodeList
          if (!liste) continue
          if (Number.isFinite(liste.episodeCount)) z.gesamt = liste.episodeCount
          uebernehmen(z, (liste.episodes ?? []).map(folgeAusDetail))
          for (const s of liste.actions?.episodePages ?? []) {
            if (typeof s?.token === 'string' && s.token.length > 10) z.tokens.add(s.token)
          }
          senden(z)
        } catch (err) {
          /* Ein fehlgeschlagener Abschnitt bleibt offen — der Knopf meldet dann einen Ausschnitt. */
          fehler(err)
        }
        await warte(PAUSE_MS)
      }
    } finally {
      z.nachholenLaeuft = false
    }
  }

  // --- Beim Laden: der Block im DOM ---------------------------------------------

  /**
   * **Der Block wächst beim Laden.** Bei „Encouragement of Climb" trug der erste
   * Griff zwei von dreizehn Folgen (31.08.2026). Gelesen wird deshalb erneut,
   * solange sich die Länge ändert — gemessen am Textknoten, nicht am Text, der
   * je Takt bis zu zwei Megabyte neu aufbauen würde.
   */
  let gelesenBeiLaenge = -1

  function ausDom(z) {
    const knoten = document.getElementById('dv-web-page-hydration-data')
    const laenge = knoten?.firstChild?.length ?? 0
    if (!laenge || laenge === gelesenBeiLaenge) return
    const html = document.documentElement?.innerHTML ?? ''
    if (!ausSeite(z, knoten.textContent, html, 'dom')) return
    gelesenBeiLaenge = laenge
    senden(z)
    void nachholen(z)
  }

  // --- Nach einem Wechsel: die Seite der neuen Adresse --------------------------

  async function ausNachgeholterSeite(z) {
    try {
      const antwort = await nativFetch.call(window, z.adresse, { credentials: 'include' })
      if (z !== zustand) return
      if (!antwort.ok) {
        fehler(`Seite ${antwort.status}`)
        return
      }
      const html = await antwort.text()
      if (z !== zustand) return
      const block = /<script[^>]*id="dv-web-page-hydration-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1]
      if (!block || !ausSeite(z, block, html, 'nachgeholt')) {
        fehler('nachgeholte Seite ohne Block')
        return
      }
      /* Den Quelltext braucht `amazon.js` für Angaben, die es selbst daraus liest. */
      z.quelltext = html
      senden(z, { quelltext: html, quelltextFuer: z.pfad })
      void nachholen(z)
    } catch (err) {
      fehler(err)
    }
  }

  /**
   * **`amazon.js` fragt nach, sobald es zuhört.**
   *
   * Der Leser startet bei `document_start` und schickt seinen ersten
   * Schnappschuss nach einer halben Sekunde; `amazon.js` startet erst bei
   * `document_idle` und hört auf einer großen Seite dann noch nicht zu. Am
   * 15.09.2026 blieb der Knopf deshalb nach dem Umbau auf „Folgen werden
   * geladen" und fiel auf „Tonspuren nicht gefunden" (Bungo Stray Dogs Staffel
   * 3, Daniel mit Bild). Der alte Leser schickte später noch mehrmals und
   * verdeckte das. Jetzt beantwortet er eine Anfrage mit dem ganzen Zustand.
   */
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.marke !== 'ak-amazon-anfrage' || !zustand) return
    senden(zustand, zustand.quelltext ? { quelltext: zustand.quelltext, quelltextFuer: zustand.pfad } : {})
  })

  // --- Der Takt ---------------------------------------------------------------

  let takte = 0
  /**
   * Der Zustand der geladenen Seite — nur für ihn gilt der DOM-Block. Wer nach
   * einem Wechsel zur Startseite zurückkehrt, bekommt einen neuen Zustand, und
   * der DOM-Block kann inzwischen zu jeder Staffel gehören, die dazwischen lag.
   */
  let ersterZustand = null

  function takt() {
    if (!/\/(?:dp|gp\/video\/detail)\//.test(location.pathname)) return
    if (!gleicheSeite(zustand)) {
      const erster = zustand === null
      const z = neuerZustand()
      /* Ein leerer Schnappschuss räumt den Knopf sofort — „Folgen werden geladen". */
      senden(z)
      if (erster && location.pathname === startPfad) {
        ersterZustand = z
      } else {
        void ausNachgeholterSeite(z)
        return
      }
    }
    if (zustand === ersterZustand && takte < ANLAUF_TAKTE) ausDom(zustand)
  }

  /**
   * Halbsekundentakt beim Laden, danach alle zwei Sekunden: Ab dann wird nur noch
   * gefragt, ob die Seite gewechselt hat — ein Zeichenkettenvergleich.
   */
  const schnell = setInterval(() => {
    if (++takte >= ANLAUF_TAKTE) {
      clearInterval(schnell)
      setInterval(takt, 2000)
    }
    takt()
  }, 500)
})()
