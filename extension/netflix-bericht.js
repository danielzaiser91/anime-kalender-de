/*
  **Netflix-Diagnosebericht: Bausteine, die `melder.js` nicht vergrößern** (13.10.2026, 4.30.9).

  `nfBericht()` in `melder.js` ruft diese Funktionen; sie lesen nur, was sie als Parameter bekommen,
  oder das DOM. Lädt laut Manifest nach `melder.js` — der Bericht läuft erst auf Anforderung.
*/
globalThis.akNetflixBericht = {
  /**
   * Steht die Prüfliste im DOM, und liegt sie sichtbar oben?
   *
   * Am 06.09.2026 meldete der Bericht `imDom: true`, Text „Anime-Kalender 2", Lage 1604/835 in
   * einem Fenster von 1767×887 — alles richtig, und Daniel sah trotzdem nichts. „Da" und
   * „sichtbar" sind zwei Fragen, die zweite beantwortet nur `elementFromPoint`.
   */
  uebersicht() {
    const el = document.querySelector('.ak-uebersicht')
    if (!el) return { imDom: false }
    const rect = el.getBoundingClientRect?.()
    const stil = getComputedStyle(el)
    const mitte = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
    const oben = mitte ? document.elementFromPoint(mitte.x, mitte.y) : null
    return {
      imDom: true,
      text: el.textContent,
      lage: rect
        ? {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            breite: Math.round(rect.width),
            hoehe: Math.round(rect.height),
          }
        : null,
      fenster: { breite: window.innerWidth, hoehe: window.innerHeight },
      stil: {
        display: stil.display,
        sichtbarkeit: stil.visibility,
        deckkraft: stil.opacity,
        zIndex: stil.zIndex,
        position: stil.position,
        hintergrund: stil.backgroundColor,
      },
      /* `null` heißt: außerhalb des sichtbaren Bereichs. */
      obenLiegt: oben
        ? {
            istErSelbst: oben === el,
            tag: oben.tagName,
            klasse: String(oben.className ?? '').slice(0, 80),
          }
        : null,
    }
  },

  /** Welche Staffeln die Seite bisher geladen hat — je Netflix-Staffelkennung; `gruppen`: `folgenJeStaffel(...)`. */
  geladen(gruppen) {
    return [...gruppen.entries()].map(([seasonId, g]) => {
      const n = g.map((f) => Number(f.nummer)).filter(Number.isFinite)
      return {
        seasonId,
        anzahl: g.length,
        von: n.length ? Math.min(...n) : null,
        bis: n.length ? Math.max(...n) : null,
        ersterTitel: g[0]?.titel ?? null,
      }
    })
  },
}
