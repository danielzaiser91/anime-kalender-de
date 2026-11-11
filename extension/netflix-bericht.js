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

  /**
   * Die Titel, die der Durchgang nicht mehr anfasst, mit Namen und Grund (13.10.2026): Bis 4.30.8 stand nur
   * die Kennung im Bericht, und warum Yu-Gi-Oh!, Pokémon und Banana Fish fehlten, war nur zu erraten.
   * `gruende`: Map Kennung → Grund (`selbstUebersprungen`); `titel`: `offeneTitel`.
   */
  uebersprungen(gruende, titel) {
    return [...gruende].map(([reihe, grund]) => ({ reihe, titel: titel[reihe]?.titel ?? null, grund }))
  },

  /** Die Titel, die die Prüfliste jetzt noch offen zeigt (`fertig()` entscheidet, wie bei der Knopfzahl) — nicht nur ihre Zahl. */
  offene(titel, fertig) {
    return Object.entries(titel)
      .filter(([id, e]) => !fertig(id, e))
      .map(([reihe, e]) => ({ reihe, titel: e?.titel ?? null }))
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

  /**
   * Merkmale der Netflix-Seite für die Diagnose „keine Folgenliste" (10.11.2026): Der Durchgang vom 09.11.
   * besuchte 103 Titel und maß 0, Tab-Titel blieb „Startseite – Netflix" auf `/title/<id>`. Ob Netflix die
   * Titelkarte anders zeichnet (Modal, andere `data-uia`) oder unsere Navigation nichts mehr auslöst, ist nur an
   * der echten Seite zu sehen — deshalb schreibt der Durchgang bei jedem Überspringen mit, was dort steht.
   * Parameter statt Globals, damit ein Fake-DOM reicht.
   */
  seitenmerkmale(doc, loc, hist) {
    try {
      const wichtig = /title|modal|jawbone|preview|episode|season|billboard|remind|play|more|dialog|detail/i
      const uia = {}
      for (const el of doc.querySelectorAll('[data-uia]')) {
        const name = el.getAttribute('data-uia')
        if (wichtig.test(name)) uia[name] = (uia[name] ?? 0) + 1
      }
      const kette = (el) => {
        const glieder = []
        for (let e = el; e && glieder.length < 6; e = e.parentElement) {
          glieder.push([e.tagName, e.getAttribute('data-uia'), e.getAttribute('role')].filter(Boolean).join('|'))
        }
        return glieder
      }
      const erinnern = [...doc.querySelectorAll('button, [role="button"], a')].filter((e) => /^(Erinnern|Remind me)$/.test((e.textContent ?? '').trim()))
      const dialoge = [...doc.querySelectorAll('[role="dialog"]')]
      return {
        pfad: loc.pathname,
        suche: loc.search,
        titel: doc.title,
        verlauf: hist?.length ?? null,
        textZeichen: (doc.body?.innerText ?? '').length,
        uia: Object.fromEntries(Object.entries(uia).slice(0, 40)),
        folgenElemente: doc.querySelectorAll('[data-uia*="episode"]').length,
        dialoge: { anzahl: dialoge.length, anfang: dialoge[0] ? (dialoge[0].innerText ?? '').slice(0, 120) : null },
        erinnern: { anzahl: erinnern.length, ketten: erinnern.slice(0, 2).map(kette) },
      }
    } catch (e) {
      return { fehler: String(e?.message ?? e) }
    }
  },
}
