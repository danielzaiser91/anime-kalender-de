/**
 * Läuft in der Seitenwelt: liest den Player und hört mit, was Netflix selbst lädt.
 *
 * **Warum getrennt vom Knopf:** Ein gewöhnliches Content-Skript läuft in einer
 * eigenen, abgeschotteten Welt. Es sieht das DOM, aber **nicht** die
 * JavaScript-Objekte der Seite — `window.netflix` ist dort schlicht nicht da.
 * Genau daran ist die erste Fassung gescheitert: Der Knopf fand nie Tonspuren,
 * auch nicht in einer laufenden Folge (Daniel, 22.08.2026, mit Bild).
 *
 * **Warum zusätzlich mitgehört wird:** Die Seite weiß mehr, als sie anzeigt.
 * Daniels Frage, 22.08.2026: „nutze die extension um daten zu sammeln, was dort
 * alles im netzwerktab auslesbar ist, und vielleicht existieren ja dort bereits
 * alle infos, und ich muss noch weniger machen." Genau die Prüfung, die der
 * Skill `netzwerkverkehr-statt-scraping` vorschreibt — nur diesmal von innen,
 * weil Netflix von außen nicht abgefragt werden darf.
 *
 * Mitgehört wird ausschließlich, was die Seite ohnehin lädt, weil Daniel sie
 * geöffnet hat. Es wird nichts angefordert.
 */
;(() => {
  const MARKE = 'ak-spuren'
  const FUND = 'ak-netzfund'

  // --- Der Player ----------------------------------------------------------

  function netflixSpuren() {
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()
    const sitzungen = api?.videoPlayer?.getAllPlayerSessionIds?.() ?? []
    if (!sitzungen.length) return null
    const player = api.videoPlayer.getVideoPlayerBySessionId(sitzungen[0])
    const spuren = player?.getAudioTrackList?.() ?? []
    if (!spuren.length) return null
    return spuren.map((s) => ({ code: s.bcp47 ?? s.language ?? '', name: s.displayName ?? '' }))
  }

  function reihenNummer() {
    const ausPfad = /\/title\/(\d+)/.exec(location.pathname)?.[1]
    const ausQuery = new URLSearchParams(location.search).get('jbv')
    const ausWatch = /\/watch\/(\d+)/.exec(location.pathname)?.[1]
    const modelle = window.netflix?.reactContext?.models
    const ausZustand = modelle?.playerModel?.data?.videoId ?? null
    return ausPfad || ausQuery || (ausZustand ? String(ausZustand) : null) || ausWatch || null
  }

  // --- Mithören ------------------------------------------------------------

  /**
   * Was uns interessiert: Antworten, in denen Sprachen oder Folgenlisten
   * vorkommen. Netflix lädt sein halbes Frontend über `pathEvaluator` und
   * `metadata`; die Namen der Felder wechseln, die Begriffe nicht.
   */
  const INTERESSANT = /pathEvaluator|metadata|playerApi|shakti|episodes|videos/i
  const SPRACHFELD = /audioLocale|audioTracks|audio_locale|languages|soundtrack|trackIds|dubbed/i

  const gesehen = new Set()

  function pruefeAntwort(url, text) {
    if (!text || text.length < 200) return
    if (!INTERESSANT.test(url)) return
    if (!SPRACHFELD.test(text)) return
    const schluessel = url.split('?')[0]
    if (gesehen.has(schluessel)) return
    gesehen.add(schluessel)

    // Nur ein Auszug: die Feldnamen und ein paar Fundstellen, nicht der ganze
    // Datenstrom. Es geht um die Frage „steht es da überhaupt", nicht um eine
    // zweite Kopie von Netflix.
    const felder = [...new Set((text.match(/"[a-zA-Z_]*([Aa]udio|[Ll]anguage|dub|track)[a-zA-Z_]*"/g) ?? []).slice(0, 40))]
    const proben = (text.match(/"(de|de-DE|German|Deutsch)[^"]{0,30}"/g) ?? []).slice(0, 10)
    window.postMessage(
      { marke: FUND, url: schluessel, laenge: text.length, felder, proben, reihe: reihenNummer() },
      '*',
    )
  }

  const echtesFetch = window.fetch
  window.fetch = async function (...args) {
    const antwort = await echtesFetch.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? ''
      if (INTERESSANT.test(url)) {
        antwort.clone().text().then((t) => pruefeAntwort(url, t)).catch(() => {})
      }
    } catch {
      /* Mithören darf die Seite nie stören. */
    }
    return antwort
  }

  const echtesOeffnen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (methode, url, ...rest) {
    this.addEventListener('load', () => {
      try {
        if (typeof this.responseText === 'string') pruefeAntwort(String(url), this.responseText)
      } catch {
        /* siehe oben */
      }
    })
    return echtesOeffnen.call(this, methode, url, ...rest)
  }

  // --- Takt ----------------------------------------------------------------

  function melden() {
    window.postMessage(
      { marke: MARKE, spuren: netflixSpuren(), reihe: reihenNummer(), titel: document.title },
      '*',
    )
  }

  setInterval(melden, 1500)
  melden()
})()
