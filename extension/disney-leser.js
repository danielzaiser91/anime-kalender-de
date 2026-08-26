/**
 * Läuft in der Seitenwelt: holt die vollständige Folgenliste und je Folge die
 * Tonspuren.
 *
 * **Warum Disney+ einfacher ist als Netflix.** Bei Netflix stehen die Tonspuren
 * nur an einem laufenden Player, und das Manifest ist MSL-verschlüsselt — ein
 * Klick je Folge, 3,1 Sekunden. Disney+ beantwortet dieselbe Frage mit einem
 * einzigen POST (gemessen am 26.08.2026):
 *
 *     POST /v7/playback/ctr-regular   { playbackId: <resourceId der Folge> }
 *     → stream.renditions.audio[] = [{ language: "de", name: "German" }, …]
 *
 * Kein Player, keine Wiedergabe, kein DRM, keine Videodaten — und kein Eintrag
 * unter „Weiterschauen".
 *
 * **Und warum nachgeladen wird, statt mitzulesen.** Der Seitenaufruf bringt nur
 * die ersten 15 Folgen der ersten Staffel mit; die übrigen holt Disney+ beim
 * Scrollen. Wer nur mithört, prüft 15 von 51 und hält das für die Staffel —
 * derselbe Fehler wie bei Amazons Abschnitten (Daniel, 26.08.2026).
 *
 * Der Seitenaufruf nennt dafür alles Nötige: je Staffel ihre Kennung und
 * `pagination.totalCount`. Nachgeladen wird mit
 * `?after=<base64 von {"offset":N}>&limit=24`, bis `hasMore` false meldet —
 * Zeichen für Zeichen der Abruf, den ein Scrollen auslöst.
 */
;(() => {
  const MARKE = 'ak-disney'
  const MARKE_STEUER = 'ak-disney-steuer'
  const PLAYBACK = 'https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular'
  const EXPLORE = 'https://disney.api.edge.bamgrid.com/explore/v1.18/season/'
  /* Abstand zwischen zwei Nachlade-Abrufen — die Seite macht einen je Scrollen. */
  const TAKT = 250

  /** Die Kopfzeilen eines echten Aufrufs — daraus stammt auch das Token. */
  let kopfzeilen = null
  /** Staffeln aus dem Seitenaufruf: Kennung, Name, Gesamtzahl. */
  const staffeln = []
  /** Folgen nach Kennung, damit ein zweiter Abruf nichts verdoppelt. */
  const folgen = new Map()
  let holtGerade = false

  // --- Mithören -------------------------------------------------------------

  function merkeFolge(wert) {
    const nummer = Number(wert?.visuals?.episodeNumber)
    const kennung = (wert?.actions ?? []).find((a) => a.resourceId)?.resourceId
    if (!kennung || !Number.isFinite(nummer) || nummer <= 0) return false
    folgen.set(kennung, {
      staffel: Number(wert.visuals?.seasonNumber) || null,
      nummer,
      titel: wert.visuals?.episodeTitle ?? '',
      playbackId: kennung,
    })
    return true
  }

  /*
    Rekursiv, weil dieselben Folgen an zwei Stellen stehen: im Seitenaufruf
    unter `data.page.containers[].seasons[].items[]`, im Nachschlag unter
    `data.season.items[]`. Aufgenommen wird nur, was Folgennummer UND Kennung
    trägt — Empfehlungsleisten haben die Kennung, aber keine Nummer.
  */
  function sammleFolgen(wert, tiefe = 0) {
    if (tiefe > 9 || wert === null || typeof wert !== 'object') return
    if (Array.isArray(wert)) {
      for (const x of wert) sammleFolgen(x, tiefe + 1)
      return
    }
    merkeFolge(wert)
    for (const k in wert) sammleFolgen(wert[k], tiefe + 1)
  }

  /**
   * Die Staffeln — **gezielt**, nicht durch Suchen.
   *
   * Der erste Anlauf nahm jeden Knoten mit Kennung und `pagination.totalCount`.
   * Damit fiel die Empfehlungsleiste mit hinein, die genauso aufgebaut ist: Bei
   * Beyblade X kam „86 Folgen" als 51 + 35 heraus, gemeldet wurden aber 94 —
   * die acht Empfehlungen (Daniel, 26.08.2026: „51 + 35 = 86, woher kommen die
   * 94?").
   *
   * Staffeln stehen an genau einer Stelle. Wer dort nachsieht statt zu suchen,
   * findet keine Nachbarn.
   */
  function sammleStaffeln(daten) {
    for (const container of daten?.data?.page?.containers ?? []) {
      for (const s of container.seasons ?? []) {
        if (!s.id || !Number.isFinite(s.pagination?.totalCount)) continue
        if (staffeln.some((x) => x.id === s.id)) continue
        staffeln.push({
          id: s.id,
          name: s.visuals?.name ?? s.name ?? '',
          gesamt: s.pagination.totalCount,
        })
      }
    }
  }

  /**
   * Ein Film hat keine Staffeln und keine Folgen — nur einen Abspielen-Knopf.
   *
   * Daniel am 26.08.2026 zu „Dragon Ball Super: Super Hero": „das ist ein film.
   * warum kann ich das nicht melden?" Der Leser suchte Folgen, fand keine, und
   * der Knopf blieb bei „warte auf die Seite (keine Staffeln)".
   *
   * Gesucht wird **gezielt** an der Stelle, an der die Seite ihre eigene
   * Wiedergabe-Aktion führt — nicht durch Durchsuchen. Sonst fällt die erste
   * Empfehlungskachel hinein, und gemeldet wird ein fremder Film. Dieselbe
   * Lehre wie bei den Staffeln, wo die Empfehlungsleiste als dritte Staffel
   * zählte.
   *
   * Ein Film zählt als Staffel 1, Folge 1 — so führt ihn auch unser Bestand.
   */
  function sammleFilm(daten) {
    if (folgen.size) return
    const seite = daten?.data?.page
    if (!seite) return
    const kennung = (seite.actions ?? []).find(
      (a) => a.resourceId && (a.type === 'playback' || a.contentType === 'vod'),
    )?.resourceId
    if (!kennung) return
    folgen.set(kennung, {
      staffel: 1,
      nummer: 1,
      titel: seite.visuals?.title ?? '',
      playbackId: kennung,
      film: true,
    })
    if (!staffeln.length) staffeln.push({ id: 'film', name: 'Film', gesamt: 1 })
  }

  function lies(url, text) {
    if (!/\/explore\/v1\.\d+\/(page|season)\//.test(String(url))) return
    let daten
    try {
      daten = JSON.parse(text)
    } catch {
      return
    }
    const vorher = folgen.size
    sammleStaffeln(daten)
    sammleFolgen(daten)
    sammleFilm(daten)
    /*
      Die letzte Seitenantwort bleibt greifbar — für den nächsten Fall, in dem
      etwas nicht gefunden wird. Ohne sie hilft nur ein neuer Mitschnitt.
    */
    if (/\/page\//.test(String(url))) window.AK_LETZTE_SEITE = daten
    if (folgen.size !== vorher || staffeln.length) melde()
  }

  function melde(vollstaendig = false, hindernis = null) {
    window.postMessage(
      {
        marke: MARKE,
        bereit: Boolean(kopfzeilen),
        hindernis,
        vollstaendig,
        staffeln: staffeln.map((s) => ({ name: s.name, gesamt: s.gesamt })),
        erwartet: staffeln.reduce((n, s) => n + s.gesamt, 0),
        folgen: [...folgen.values()],
      },
      '*',
    )
  }

  function merkeKopf(url, kopf) {
    if (!kopf) return
    const auth =
      typeof kopf.get === 'function' ? kopf.get('authorization') : kopf.authorization || kopf.Authorization
    if (!auth) return
    const neu = !kopfzeilen
    kopfzeilen = { ...(kopfzeilen ?? {}) }
    if (typeof kopf.forEach === 'function') kopf.forEach((v, k) => { kopfzeilen[k.toLowerCase()] = v })
    else for (const k in kopf) kopfzeilen[k.toLowerCase()] = kopf[k]
    if (neu) melde()
  }

  /**
   * **`window.fetch` bleibt unangetastet — Disney+ nutzt XHR.**
   *
   * Gemessen am 26.08.2026: Ein Mitschnitt, der nur `fetch` abfing, sah gar
   * nichts; erst der über XHR fand den Playback-Aufruf und die Folgenlisten.
   *
   * Der Wrapper war damit nutzlos und trotzdem teuer: Schlug irgendein Aufruf
   * der Seite fehl — Daniels Blocker weist die Telemetrie von Datadog ab —,
   * stand `disney-leser.js` im Stack, und `chrome://extensions` meldete einen
   * Fehler der Erweiterung. Zweimal nachgebessert, zweimal wiedergekommen; erst
   * das Weglassen hat es behoben.
   *
   * Für eigene Abrufe wird das unveränderte `fetch` benutzt.
   */
  const altFetch = window.fetch.bind(window)

  /** Was uns angeht — alles andere wird nicht angefasst. */
  const UNSER = /bamgrid.com/

  const altOpen = XMLHttpRequest.prototype.open
  const altSet = XMLHttpRequest.prototype.setRequestHeader
  XMLHttpRequest.prototype.open = function (methode, url, ...rest) {
    this._akUrl = url
    this._akKopf = {}
    if (/\/explore\/v1\.\d+\/(page|season)\//.test(String(url))) {
      this.addEventListener('load', () => lies(url, this.responseText ?? ''))
    }
    return altOpen.call(this, methode, url, ...rest)
  }
  XMLHttpRequest.prototype.setRequestHeader = function (name, wert) {
    if (this._akKopf) this._akKopf[name.toLowerCase()] = wert
    if (name.toLowerCase() === 'authorization' && UNSER.test(this._akUrl ?? '')) {
      merkeKopf(this._akUrl, this._akKopf)
    }
    return altSet.call(this, name, wert)
  }

  // --- Nachladen ------------------------------------------------------------

  /*
    Die Kopfzeilen stammen aus einem echten Aufruf der Seite; nachgebaut wird
    nichts. Ohne `content-type` und `content-length`, die zu einem GET nicht
    passen.
  */
  /**
   * Nur die Kopfzeilen, die ein Explore-Abruf wirklich braucht.
   *
   * Der erste Anlauf uebernahm alles aus dem letzten Aufruf der Seite und
   * strich nur `content-type` und `content-length`. Damit gingen auch
   * Verfolgungsmarken mit, die zu einem anderen Aufruf gehoerten
   * (`x-request-id`, `traceparent`, die Datadog-Felder) — und der Abruf
   * scheiterte mit `Failed to fetch` (Daniel, 26.08.2026, an „Das Band der
   * Unterwelt“).
   *
   * Eine Liste dessen, was mitgeht, ist sicherer als eine Liste dessen, was
   * wegbleibt: Was Disney+ morgen Neues mitschickt, faellt dann von selbst
   * heraus statt den Abruf zu kippen.
   */
  const NOETIG = [
    'authorization',
    'accept',
    'accept-language',
    'x-dss-edge-accept',
    'x-application-version',
    'x-bamsdk-client-id',
    'x-bamsdk-platform',
    'x-bamsdk-version',
  ]

  function leseKopf() {
    const raus = {}
    for (const name of NOETIG) {
      const wert = kopfzeilen?.[name]
      if (wert) raus[name] = wert
    }
    return raus
  }


  async function staffelHolen(staffel) {
    let gesehen = 0
    let weiter = true
    /*
      Eine Schleife über einen fremden Seitenzähler braucht eine eigene Grenze.
      Sagt der Zähler dauerhaft `hasMore`, ohne dass etwas Neues kommt, läuft
      sie sonst endlos — und nebenan steht für immer „sammle Folgen".
    */
    let runden = 0
    while (weiter && gesehen < staffel.gesamt && runden < 40) {
      runden++
      const nach = gesehen
        ? `after=${encodeURIComponent(btoa(JSON.stringify({ offset: gesehen })))}&`
        : ''
      const antwort = await altFetch(`${EXPLORE}${staffel.id}?${nach}limit=24`, {
        headers: leseKopf(),
      })
      if (!antwort.ok) {
        console.warn(`[Anime-Kalender] Staffel ${staffel.name}: HTTP ${antwort.status}`)
        return
      }
      const daten = await antwort.json()
      const stueck = daten?.data?.season?.items ?? []
      sammleFolgen(daten)
      gesehen += stueck.length
      weiter = Boolean(daten?.data?.season?.pagination?.hasMore) && stueck.length > 0
      console.log(
        `[Anime-Kalender] ${staffel.name}: ${gesehen}/${staffel.gesamt}` +
          (weiter ? ' — weiter' : ' — fertig'),
      )
      await new Promise((ok) => setTimeout(ok, TAKT))
    }
  }

  /*
    **Ein stummer Ausstieg ist schlimmer als ein Fehler.**

    Der erste Anlauf kehrte bei fehlendem Token einfach zurück. Nebenan stand
    dann für immer „sammle Folgen … 86/86", weil die Anforderung als erledigt
    galt und nie wiederholt wurde. Daniel am 26.08.2026: „sammelt er oder lügt
    er? was passiert tatsächlich im hintergrund? nichts passiert auch nach
    mehreren minuten nicht."

    Jetzt meldet jeder Ausgang seinen Grund — und der Empfänger darf es noch
    einmal versuchen.
  */
  async function allesHolen() {
    if (holtGerade) return
    if (!kopfzeilen) {
      console.log('[Anime-Kalender] noch kein Token gesehen — warte auf einen Aufruf der Seite')
      return melde(false, 'kein Token')
    }
    if (!staffeln.length) {
      console.log('[Anime-Kalender] noch keine Staffelliste gesehen')
      return melde(false, 'keine Staffeln')
    }
    holtGerade = true
    console.log(`[Anime-Kalender] hole ${staffeln.length} Staffeln: ${staffeln.map((s) => s.name + ' (' + s.gesamt + ')').join(', ')}`)
    try {
      for (const staffel of [...staffeln]) {
        await staffelHolen(staffel)
        melde()
      }
      console.log(`[Anime-Kalender] ${folgen.size} Folgen beisammen`)
    } catch (fehler) {
      console.warn('[Anime-Kalender] Nachladen abgebrochen:', fehler)
    } finally {
      holtGerade = false
      melde(true)
    }
  }

  // --- Fragen ---------------------------------------------------------------

  /*
    Der Rumpf ist der der Seite, bis auf eine Änderung: `resolution.max` steht
    auf der kleinsten Stufe. Gefragt wird nach der Sprachliste, nicht nach einem
    Bild.
  */
  const RUMPF = {
    playback: {
      attributes: {
        resolution: { max: ['1280x720'] },
        protocol: 'HTTPS',
        assetInsertionStrategies: { point: 'SGAI', range: 'SGAI' },
        playbackInitiationContext: 'ONLINE',
        frameRates: [60],
        videoSegmentTypes: ['FMP4'],
        maxSlideDuration: '15_MIN',
        promosSupported: true,
      },
      adTracking: {
        limitAdTrackingEnabled: 'NOT_SUPPORTED',
        deviceAdId: '00000000-0000-0000-0000-000000000000',
        privacyOptOut: 'YES',
      },
    },
  }

  async function spurenFuer(playbackId) {
    if (!kopfzeilen?.authorization) return { fehler: 'kein Token' }
    const antwort = await altFetch(PLAYBACK, {
      method: 'POST',
      headers: {
        ...leseKopf(),
        'content-type': 'application/json',
        accept: 'application/vnd.media-service+json; version=8',
        'x-dss-feature-filtering': 'true',
      },
      body: JSON.stringify({ ...RUMPF, playbackId }),
    })
    if (!antwort.ok) return { fehler: 'HTTP ' + antwort.status }
    const daten = await antwort.json()
    const spuren = (daten?.stream?.renditions?.audio ?? []).map((x) => x.language)
    if (!spuren.length) return { fehler: 'keine Tonspur in der Antwort' }
    return { sprachen: [...new Set(spuren)].sort() }
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.data?.marke !== MARKE_STEUER) return
    if (e.data.frageListe) return melde()
    if (e.data.allesHolen) return void allesHolen()
    if (!e.data.playbackId) return
    const ergebnis = await spurenFuer(e.data.playbackId)
    window.postMessage({ marke: MARKE, antwortFuer: e.data.playbackId, ...ergebnis }, '*')
  })

  melde()
})()
