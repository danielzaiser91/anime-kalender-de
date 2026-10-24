/*
  **Stumm von Anfang an: die Seitenwelt vor dem Player** (4.31.14, 24.10.2026). Daniel: „beim melden kam
  ein ton, die extension hat den video player nicht von anfang an gemutet".

  `netflix-stumm.js` läuft in der Isolated World und reagiert erst auf Ereignisse (Einfügen, `play`,
  `volumechange`). Das kommt nach dem Ton: Ruft die Seite `play()` auf, setzt `muted = false` oder
  schaltet den Ton nach dem Laden an, spielt das Video, bis der Hörer läuft. Diese Datei läuft in
  der Seitenwelt (`world: MAIN`, `document_start`, wie `leser.js`) und greift davor ein: Während eines
  Durchgangs auf `/watch/` setzt `play()` zuerst `muted = true`, und `muted = false` der Seite wird
  zu `true`. `volume` bleibt unberührt. Ohne Durchgang tut die Datei nichts.

  Wer vorher laut war, trägt `data-ak-war-laut`; `netflix-stumm.js` gibt diesen Elementen nach dem
  Durchgang den Ton zurück. Schlüssel und Frist stehen hier getrennt (MAIN sieht die Isolated World
  nicht); `netflix-stumm.test.cjs` vergleicht sie.
*/
globalThis.akNetflixStummSeite = (umg) => {
  const { proto, speicher, ort, jetzt } = umg
  const nativ = Object.getOwnPropertyDescriptor(proto, 'muted')
  const nativPlay = proto.play
  const aktiv = () => {
    try {
      const seit = Number(speicher.getItem('ak-netflix-lauf'))
      const laeuft = Number.isFinite(seit) && jetzt() - seit < 6 * 60 * 60 * 1000
      return laeuft && ort.pathname.startsWith('/watch/')
    } catch {
      return false
    }
  }
  const stummen = (video) => {
    if (!nativ.get.call(video)) video.setAttribute('data-ak-war-laut', '')
    nativ.set.call(video, true)
  }
  Object.defineProperty(proto, 'muted', {
    configurable: true,
    enumerable: nativ.enumerable,
    get() {
      return nativ.get.call(this)
    },
    set(wert) {
      if (aktiv() && !wert) return stummen(this)
      nativ.set.call(this, wert)
    },
  })
  proto.play = function (...args) {
    if (aktiv()) stummen(this)
    return nativPlay.apply(this, args)
  }
}

if (typeof HTMLMediaElement !== 'undefined' && typeof sessionStorage !== 'undefined') {
  globalThis.akNetflixStummSeite({
    proto: HTMLMediaElement.prototype,
    speicher: sessionStorage,
    ort: location,
    jetzt: () => Date.now(),
  })
}
