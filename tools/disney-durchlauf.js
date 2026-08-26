;(() => {
  let token = null
  const folgen = []
  const PLAYBACK = 'https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular'

  /* Token und Folgenliste aus dem laufenden Verkehr aufsammeln. */
  const merkFolgen = (txt) => {
    let d
    try { d = JSON.parse(txt) } catch { return }
    for (const item of d?.data?.season?.items ?? []) {
      const a = (item.actions ?? []).find((x) => x.resourceId)
      if (!a) continue
      folgen.push({
        staffel: Number(item.visuals?.seasonNumber),
        nummer: Number(item.visuals?.episodeNumber),
        titel: item.visuals?.episodeTitle ?? '',
        playbackId: a.resourceId,
      })
    }
  }
  const altOpen = XMLHttpRequest.prototype.open
  const altSet = XMLHttpRequest.prototype.setRequestHeader
  XMLHttpRequest.prototype.open = function (m, u, ...r) {
    this._u = u
    if (/\/explore\/v1\.\d+\/season\//.test(u)) {
      this.addEventListener('load', () => merkFolgen(this.responseText ?? ''))
    }
    return altOpen.call(this, m, u, ...r)
  }
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (k.toLowerCase() === 'authorization' && /bamgrid/.test(this._u ?? '')) token = v
    return altSet.call(this, k, v)
  }
  const altFetch = window.fetch
  window.fetch = async function (...a) {
    const u = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || ''
    const h = (a[1] && a[1].headers) || (a[0] && a[0].headers)
    if (h && /bamgrid/.test(u)) {
      const hol = typeof h.get === 'function' ? h.get('authorization') : h.authorization || h.Authorization
      if (hol) token = hol
    }
    const antwort = await altFetch.apply(this, a)
    if (/\/explore\/v1\.\d+\/season\//.test(u)) antwort.clone().text().then(merkFolgen).catch(() => {})
    return antwort
  }

  /* Eine Folge fragen — ein POST, keine Wiedergabe. */
  const frage = async (f) => {
    const r = await altFetch(PLAYBACK, {
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
      body: JSON.stringify({
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
        playbackId: f.playbackId,
      }),
    })
    if (!r.ok) return { ...f, fehler: 'HTTP ' + r.status }
    const d = await r.json()
    return { ...f, sprachen: (d?.stream?.renditions?.audio ?? []).map((x) => x.language).sort() }
  }

  window.AKSTART = async (grenze = 99) => {
    if (!token) return console.error('[AK] kein Token gesehen — einmal die Staffel wechseln.')
    if (!folgen.length) return console.error('[AK] keine Folgen gesehen — einmal die Staffel wechseln.')
    const raus = []
    const beginn = Date.now()
    for (const f of folgen.slice(0, grenze)) {
      raus.push(await frage(f))
      await new Promise((ok) => setTimeout(ok, 300))
    }
    console.log(`[AK] ${raus.length} Folgen in ${Math.round((Date.now() - beginn) / 1000)} s`)
    console.table(raus.map((r) => ({
      Folge: `S${r.staffel}E${r.nummer}`,
      Deutsch: r.sprachen ? (r.sprachen.includes('de') ? 'ja' : 'NEIN') : r.fehler,
      Spuren: (r.sprachen ?? []).join(' '),
    })))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(raus, null, 1)], { type: 'application/json' }))
    a.download = 'disney-durchlauf.json'
    a.click()
    return raus
  }
  console.log('[AK] bereit. Einmal die Staffel wechseln, dann AKSTART() eingeben.')
})()
