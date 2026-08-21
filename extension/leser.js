/**
 * Läuft in der Seitenwelt und liest, was der Player weiß.
 *
 * **Warum getrennt vom Knopf:** Ein gewöhnliches Content-Skript läuft in einer
 * eigenen, abgeschotteten Welt. Es sieht das DOM, aber **nicht** die
 * JavaScript-Objekte der Seite — `window.netflix` ist dort schlicht nicht da.
 * Genau daran ist die erste Fassung gescheitert: Der Knopf fand nie Tonspuren,
 * auch nicht in einer laufenden Folge (Daniel, 22.08.2026, mit Bild aus dem
 * Player von „Yû Yû Hakusho").
 *
 * Deshalb zwei Skripte: dieses hier in der Seitenwelt (`world: MAIN`), das
 * lesen kann, aber keine Erweiterungsrechte hat — und `melder.js` in der
 * abgeschotteten Welt, das Token und Netzzugriff hat. Dazwischen
 * `window.postMessage`, der einzige Weg, der beide verbindet.
 */
;(() => {
  const MARKE = 'ak-spuren'

  function netflixSpuren() {
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()
    const sitzungen = api?.videoPlayer?.getAllPlayerSessionIds?.() ?? []
    if (!sitzungen.length) return null
    const player = api.videoPlayer.getVideoPlayerBySessionId(sitzungen[0])
    const spuren = player?.getAudioTrackList?.() ?? []
    if (!spuren.length) return null
    return spuren.map((s) => ({ code: s.bcp47 ?? s.language ?? '', name: s.displayName ?? '' }))
  }

  /** Die Reihennummer kennt der Player selbst am zuverlässigsten. */
  function reihenNummer() {
    const ausPfad = /\/title\/(\d+)/.exec(location.pathname)?.[1]
    const ausQuery = new URLSearchParams(location.search).get('jbv')
    const ausWatch = /\/watch\/(\d+)/.exec(location.pathname)?.[1]
    const modelle = window.netflix?.reactContext?.models
    const ausZustand =
      modelle?.playerModel?.data?.videoId ??
      modelle?.graphql?.data?.videoId ??
      null
    return ausPfad || ausQuery || (ausZustand ? String(ausZustand) : null) || ausWatch || null
  }

  function melden() {
    window.postMessage(
      { marke: MARKE, spuren: netflixSpuren(), reihe: reihenNummer(), titel: document.title },
      '*',
    )
  }

  setInterval(melden, 1500)
  melden()
})()
