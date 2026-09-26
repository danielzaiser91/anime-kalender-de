/**
 * Disney+: Wie sieht der Playback-Aufruf aus?
 *
 * Die Master-Playlist steht im Klartext und listet alle Tonspuren
 * (LANGUAGE="de"). Offen ist nur, wie man an ihre Adresse kommt: über
 * POST /v7/playback/ctr-regular. Dieses Skript schneidet genau diesen einen
 * Aufruf mit — Kopfzeilen, Rumpf, Antwort — damit er sich für eine Folge
 * nachstellen lässt, die nie geöffnet wurde.
 *
 * Läuft in Daniels angemeldeter Sitzung; dorthin komme ich nicht.
 * Die Datei enthält sein Zugangs-Token und gehört deshalb nicht ins Repo.
 */
;(() => {
  const funde = []
  const PASST = /playback\.edge\.bamgrid\.com/

  /* Ton bleibt aus, egal was der Player vorhat. */
  const stumm = setInterval(() => {
    document.querySelectorAll('video').forEach((v) => { v.muted = true })
  }, 100)

  const altFetch = window.fetch
  window.fetch = async function (...a) {
    const url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || ''
    const antwort = await altFetch.apply(this, a)
    if (PASST.test(url)) {
      const kopf = {}
      const h = (a[1] && a[1].headers) || (a[0] && a[0].headers)
      if (h) {
        if (typeof h.forEach === 'function') h.forEach((v, k) => { kopf[k] = v })
        else Object.assign(kopf, h)
      }
      antwort.clone().text().then((t) => {
        funde.push({ art: 'fetch', methode: (a[1] && a[1].method) || 'GET', url, kopf,
                     rumpf: (a[1] && a[1].body) || null, antwort: t.slice(0, 30000) })
      }).catch(() => {})
    }
    return antwort
  }

  const altOpen = XMLHttpRequest.prototype.open
  const altSend = XMLHttpRequest.prototype.send
  const altSet = XMLHttpRequest.prototype.setRequestHeader
  XMLHttpRequest.prototype.open = function (methode, url, ...r) {
    this._ak = { methode, url, kopf: {} }
    return altOpen.call(this, methode, url, ...r)
  }
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this._ak) this._ak.kopf[k] = v
    return altSet.call(this, k, v)
  }
  XMLHttpRequest.prototype.send = function (rumpf) {
    if (this._ak && PASST.test(this._ak.url)) {
      this.addEventListener('load', () => {
        funde.push({ art: 'xhr', ...this._ak, rumpf: String(rumpf ?? ''),
                     antwort: String(this.responseText ?? '').slice(0, 30000) })
      })
    }
    return altSend.call(this, rumpf)
  }

  console.log('[AK] Mitschnitt läuft — jetzt eine Folge abspielen.')

  /* Auf echten Videostart warten, danach kurz nachlaufen lassen. */
  const takt = setInterval(() => {
    const v = [...document.querySelectorAll('video')].find((x) => x.currentTime > 0.5 && !x.paused)
    if (!v) return
    clearInterval(takt)
    console.log('[AK] Videostart erkannt — noch 6 Sekunden.')
    setTimeout(() => {
      clearInterval(stumm)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify({ seite: location.href, funde }, null, 1)], { type: 'application/json' }),
      )
      a.download = 'disney-playback.json'
      a.click()
      console.log(`[AK] fertig — ${funde.length} Aufrufe in disney-playback.json`)
    }, 6000)
  }, 200)
})()
