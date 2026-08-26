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
 * derselbe Fehler wie bei Amazons Abschnitten. Daniel am 26.08.2026: „staffel 2
 * hat 35 folgen. staffel 1 hat übrigens 51 folgen, also sind die 15 dort auch
 * falsch."
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
  let staffeln = []
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
  function sammle(wert, tiefe = 0) {
    if (tiefe > 9 || wert === null || typeof wert !== 'object') return
    if (Array.isArray(wert)) {
      for (const x of wert) sammle(x, tiefe + 1)
      return
    }
    merkeFolge(wert)
    /* Eine Staffel erkennt man an Kennung und Seitenzähler. */
    if (wert.id && wert.pagination && Number.isFinite(wert.pagination.totalCount)) {
      if (!staffeln.some((s) => s.id === wert.id)) {
        staffeln.push({
          id: wert.id,
          name: wert.visuals?.name ?? wert.name ?? '',
          gesamt: wert.pagination.totalCount,
        })
      }
    }
    for (const k in wert) sammle(wert[k], tiefe + 1)
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
    sammle(daten)
    if (folgen.size !== vorher || staffeln.length) melde()
  }

  function melde(vollstaendig = false) {
    window.postMessage(
      {
        marke: MARKE,
        bereit: Boolean(kopfzeilen),
        vollstaendig,
        staffeln: staffeln.map((s) => ({ name: s.name, gesamt: s.gesamt })),
        erwartet: staffeln.reduce((n, s) => n + s.gesamt, 0),
        folgen: [...folgen.values()],
      },
      '*',
    )
  }

  function merkeKopf(url, kopf) {
    if (!kopf || !/bamgrid/.test(String(url))) return
    const auth =
      typeof kopf.get === 'function' ? kopf.get('authorization') : kopf.authorization || kopf.Authorization
    if (!auth) return
    const neu = !kopfzeilen
    kopfzeilen = { ...(kopfzeilen ?? {}) }
    if (typeof kopf.forEach === 'function') kopf.forEach((v, k) => { kopfzeilen[k.toLowerCase()] = v })
    else for (const k in kopf) kopfzeilen[k.toLowerCase()] = kopf[k]
    if (neu) melde()
  }

  const altFetch = window.fetch
  window.fetch = async function (...a) {
    const url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || ''
    merkeKopf(url, (a[1] && a[1].headers) || (a[0] && a[0].headers))
    const antwort = await altFetch.apply(this, a)
    if (/\/explore\/v1\.\d+\/(page|season)\//.test(url)) {
      antwort.clone().text().then((t) => lies(url, t)).catch(() => {})
    }
    return antwort
  }

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
    if (name.toLowerCase() === 'authorization') merkeKopf(this._akUrl, this._akKopf)
    return altSet.call(this, name, wert)
  }

  // --- Nachladen ------------------------------------------------------------

  /*
    Die Kopfzeilen stammen aus einem echten Aufruf der Seite; nachgebaut wird
    nichts. Ohne `content-type` und `content-length`, die zu diesem GET nicht
    passen.
  */
  function leseKopf() {
    const raus = {}
    for (const [k, v] of Object.entries(kopfzeilen ?? {})) {
      if (k === 'content-type' || k === 'content-length') continue
      raus[k] = v
    }
    return raus
  }

  async function staffelHolen(staffel) {
    let offset = folgen.size ? undefined : 0
    /* Beim ersten Abruf ohne `after`; danach mit dem Stand der letzten Antwort. */
    let weiter = true
    let gesehen = 0
    while (weiter && gesehen < staffel.gesamt) {
      const nach = gesehen ? `after=${encodeURIComponent(btoa(JSON.stringify({ offset: gesehen })))}&` : ''
      const antwort = await altFetch(`${EXPLORE}${staffel.id}?${nach}limit=24`, {
        headers: leseKopf(),
      })
      if (!antwort.ok) return
      const daten = await antwort.json()
      const stueck = daten?.data?.season?.items ?? []
      sammle(daten)
      gesehen += stueck.length
      weiter = Boolean(daten?.data?.season?.pagination?.hasMore) && stueck.length > 0
      await new Promise((ok) => setTimeout(ok, TAKT))
    }
    void offset
  }

  async function allesHolen() {
    if (holtGerade || !kopfzeilen) return
    holtGerade = true
    try {
      for (const staffel of [...staffeln]) {
        await staffelHolen(staffel)
        melde()
      }
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
