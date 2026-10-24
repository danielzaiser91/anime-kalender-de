/*
  **Der Netflix-Durchgang spielt stumm** (4.30.7, 13.10.2026). Daniel: „netflix durchgang öffnet den
  player um die infos zu bekommen, dabei ertönt kurz sound".

  Läuft bei `document_start` (eigenes Skript, `melder.js` kommt erst bei `document_idle`, da läuft
  der Player längst) und stellt jedes `<video>` auf `/watch/` auf `muted = true`, solange ein
  Durchgang läuft. Der Durchgang steht im `sessionStorage` des Tabs (`LAUF_SCHLUESSEL` in `melder.js`;
  `netflix-stumm.test.cjs` vergleicht Schlüssel und Frist mit denen hier).
  Ohne Durchgang tut das Skript nichts: normales Schauen bleibt unberührt.

  **Die Tonspuren hängen nicht am Ton.** Sie kommen aus der Player-Schnittstelle der Seite
  (`getAudioTrackList()` in `leser.js`, Seitenwelt), also aus dem geladenen Manifest. Stummschalten
  des `<video>`-Elements ändert daran nichts, und es ruft keine Player-Funktion auf.

  **Die Lautstärke bleibt Daniels.** Gesetzt wird nur `muted` am Element, nie `volume` und nie
  Netflix' eigener Zustand. Damit Netflix die Stummschaltung nicht als Wunsch des Nutzers speichert,
  sieht es während des Durchgangs keine `volumechange`-Ereignisse. Endet der Durchgang (Schlüssel im
  `sessionStorage` weg oder abgelaufen), kommt jedes Element zurück, das vorher laut war — spätestens
  nach `akNetflixStummPruefTaktMs`; geprüft wird nur, solange ein Element stumm gestellt ist.
  Ob Netflix die Lautstärke außerhalb des Elements speichert, ist nicht belegt (kein Mitschnitt).
*/
globalThis.akNetflixLauf = { schluessel: 'ak-netflix-lauf', hoechstensMs: 6 * 60 * 60 * 1000 }

/** So lange darf ein Durchgang vorbei sein, bevor ein stummes Element wieder Ton bekommt. */
globalThis.akNetflixStummPruefTaktMs = 1000

/** Läuft in diesem Tab ein Durchgang? Dieselbe Regel wie `selbstAn` in `melder.js`. */
globalThis.akNetflixLaufAktiv = (speicher, jetzt) => {
  try {
    const seit = Number(speicher.getItem(globalThis.akNetflixLauf.schluessel))
    return Number.isFinite(seit) && seit > 0 && jetzt - seit < globalThis.akNetflixLauf.hoechstensMs
  } catch {
    return false
  }
}

/** Hängt die Hörer an; gibt `alleStumm(wurzel)` für neu eingefügte Knoten und `zurueck()` zurück. */
globalThis.akNetflixStummStarten = (umg) => {
  const { fenster, dokument, speicher, beobachter, takt, taktStopp } = umg
  /* Element → war es davor stumm? Nur was laut war, bekommt seinen Ton zurück. */
  const vorher = new Map()
  let uhr = null
  const aktiv = () => fenster.location.pathname.startsWith('/watch/') && globalThis.akNetflixLaufAktiv(speicher, Date.now())

  const zurueck = () => {
    for (const [video, warStumm] of vorher) {
      if (!warStumm && video.muted) video.muted = false
      video.removeAttribute?.('data-ak-war-laut')
    }
    vorher.clear()
    taktStopp(uhr)
    uhr = null
  }
  const lauftNoch = () => globalThis.akNetflixLaufAktiv(speicher, Date.now()) || zurueck()
  const stumm = (video) => {
    /* `netflix-stumm-seite.js` (Seitenwelt) hat es evtl. schon stumm gestellt und es so markiert. */
    if (!vorher.has(video)) vorher.set(video, video.muted && !video.hasAttribute?.('data-ak-war-laut'))
    if (!video.muted) video.muted = true
    if (uhr === null) uhr = takt(lauftNoch, globalThis.akNetflixStummPruefTaktMs)
  }
  const alleStumm = (wurzel) => {
    if (!aktiv()) return
    if (wurzel.tagName === 'VIDEO') stumm(wurzel)
    for (const v of wurzel.querySelectorAll?.('video') ?? []) stumm(v)
  }

  beobachter.observe(dokument.documentElement, { childList: true, subtree: true })
  /* Capture am Fenster: vor jedem Hörer der Seite. `play` und `volumechange` fangen, was später kommt. */
  fenster.addEventListener(
    'play',
    (e) => {
      if (e.target?.tagName === 'VIDEO' && aktiv()) stumm(e.target)
    },
    true,
  )
  fenster.addEventListener(
    'volumechange',
    (e) => {
      if (e.target?.tagName !== 'VIDEO' || !aktiv()) return
      stumm(e.target)
      e.stopImmediatePropagation()
    },
    true,
  )
  return { alleStumm, zurueck }
}

globalThis.akNetflixStummAmStart = () => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || typeof sessionStorage === 'undefined') return
  const lauf = globalThis.akNetflixStummStarten({
    fenster: window,
    dokument: document,
    speicher: sessionStorage,
    takt: (f, ms) => setInterval(f, ms),
    taktStopp: (uhr) => clearInterval(uhr),
    beobachter: new MutationObserver((eintraege) => {
      const neue = eintraege.flatMap((e) => [...e.addedNodes])
      for (const k of neue) {
        if (k.nodeType === 1) lauf.alleStumm(k)
      }
    }),
  })
}
globalThis.akNetflixStummAmStart()
