/**
 * Läuft in der Seitenwelt: hört mit, was Disney+ selbst lädt, und fragt je
 * Folge die Tonspuren ab.
 *
 * **Warum Disney+ einfacher ist als Netflix.** Bei Netflix stehen die Tonspuren
 * nur an einem laufenden Player, und das Manifest ist MSL-verschlüsselt — ein
 * Klick je Folge, 3,1 Sekunden. Disney+ beantwortet dieselbe Frage mit einem
 * einzigen POST (gemessen am 26.08.2026):
 *
 *     POST /v7/playback/ctr-regular   { playbackId: <resourceId der Folge> }
 *     → stream.renditions.audio[] = [{ language: "de", name: "German" }, …]
 *
 * Kein Player, keine Wiedergabe, kein DRM, keine Videodaten. Die `resourceId`
 * steht offen in der Folgenliste, die die Seite ohnehin lädt.
 *
 * **Warum getrennt vom Knopf:** Ein gewöhnliches Content-Skript läuft in einer
 * abgeschotteten Welt und sieht die Aufrufe der Seite nicht. Das Token, das der
 * POST braucht, wandert nur durch den Verkehr der Seite — hier kommt es an,
 * nebenan nicht.
 *
 * Angefordert wird ausschließlich der Playback-Aufruf, und den löst sonst ein
 * Klick auf „Abspielen" aus. Nichts davon lädt Videodaten.
 */
;(() => {
  const MARKE = 'ak-disney'
  const MARKE_STEUER = 'ak-disney-steuer'
  const PLAYBACK = 'https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular'

  /** Das Token wandert durch jeden Aufruf der Seite; einer genügt. */
  let token = null
  /** Folgen nach Kennung, damit ein zweiter Abruf derselben Staffel nichts verdoppelt. */
  const folgen = new Map()

  // --- Mithören -------------------------------------------------------------

  /*
    Die Folgen stecken an zwei Stellen, und beide werden gebraucht: Der
    Seitenaufruf (`/page/`) bringt die Staffelliste samt der ersten Folgen mit,
    der Nachschlag (`/season/`) den Rest. Gemessen an Jujutsu Kaisen: 15 Folgen
    im Seitenaufruf, 24 je Nachschlag.
  */
  function sammle(wert, tiefe = 0) {
    if (tiefe > 9 || wert === null || typeof wert !== 'object') return
    if (Array.isArray(wert)) {
      for (const x of wert) sammle(x, tiefe + 1)
      return
    }
    const nummer = Number(wert.visuals?.episodeNumber)
    const kennung = (wert.actions ?? []).find((a) => a.resourceId)?.resourceId
    if (kennung && Number.isFinite(nummer) && nummer > 0) {
      folgen.set(kennung, {
        staffel: Number(wert.visuals?.seasonNumber) || null,
        nummer,
        titel: wert.visuals?.episodeTitle ?? '',
        playbackId: kennung,
      })
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
    if (folgen.size !== vorher) melde()
  }

  function melde() {
    window.postMessage(
      { marke: MARKE, bereit: Boolean(token), folgen: [...folgen.values()] },
      '*',
    )
  }

  const altFetch = window.fetch
  window.fetch = async function (...a) {
    const url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || ''
    const kopf = (a[1] && a[1].headers) || (a[0] && a[0].headers)
    if (kopf && /bamgrid/.test(url)) {
      const wert =
        typeof kopf.get === 'function' ? kopf.get('authorization') : kopf.authorization || kopf.Authorization
      if (wert) token = wert
    }
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
    if (/\/explore\/v1\.\d+\/(page|season)\//.test(String(url))) {
      this.addEventListener('load', () => lies(url, this.responseText ?? ''))
    }
    return altOpen.call(this, methode, url, ...rest)
  }
  XMLHttpRequest.prototype.setRequestHeader = function (name, wert) {
    if (name.toLowerCase() === 'authorization' && /bamgrid/.test(this._akUrl ?? '')) {
      const neu = !token
      token = wert
      if (neu) melde()
    }
    return altSet.call(this, name, wert)
  }

  // --- Fragen ---------------------------------------------------------------

  /*
    Der Rumpf ist der der Seite, bis auf eine Änderung: `resolution.max` steht
    auf der kleinsten Stufe. Gefragt wird nach der Sprachliste, nicht nach einem
    Bild — und je kleiner die Stufe, desto weniger richtet der Aufruf bei
    Disney+ an.
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
    if (!token) return { fehler: 'kein Token' }
    const antwort = await altFetch(PLAYBACK, {
      method: 'POST',
      headers: {
        authorization: token,
        'content-type': 'application/json',
        accept: 'application/vnd.media-service+json; version=8',
        'x-dss-feature-filtering': 'true',
        'x-application-version': 'f65105e0_bap',
        'x-bamsdk-client-id': 'disney-svod-3d9324fc',
        'x-bamsdk-platform': 'javascript/windows/chrome',
        'x-bamsdk-version': '35.3',
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
    if (!e.data.playbackId) return
    const ergebnis = await spurenFuer(e.data.playbackId)
    window.postMessage(
      { marke: MARKE, antwortFuer: e.data.playbackId, ...ergebnis },
      '*',
    )
  })

  melde()
})()
