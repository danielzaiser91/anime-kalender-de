/**
 * Hört mit, was Amazon beim Blättern durch die Folgenliste nachlädt.
 *
 * ## Warum es das braucht
 *
 * Die Tonspuren stehen im ausgelieferten HTML — aber **nur für den Abschnitt,
 * der beim Seitenaufbau gewählt war**. Wechselt Daniel auf „Folgen 25–48",
 * kommen die Kacheln nach, der Quelltext behält aber die alten Angaben.
 *
 * Gemessen am 23.08.2026 an „Digimon Tamers" (51 Folgen), nach dem Wechsel auf
 * 25–48, aus Daniels angemeldeter Sitzung:
 *
 * ```
 * audioTracks: 27 | episodeNumber: 1,2,3,…,24
 * ```
 *
 * Die Folgen 25–48 waren auf dem Bildschirm zu sehen und im Quelltext nicht
 * vorhanden. Wer nur das HTML liest, bekommt also dauerhaft den ersten
 * Abschnitt und hält ihn für die Staffel.
 *
 * ## Was hier passiert
 *
 * Dasselbe wie bei Netflix (`leser.js`): Mitgelesen wird am **Ergebnis**, nicht
 * am Aufruf — `fetch` und `XMLHttpRequest` geben ihre Antwort ohnehin an die
 * Seite weiter, und genau dort wird sie abgegriffen. **Es wird nichts
 * angefordert.** Was hier ankommt, hat die Seite geladen, weil Daniel geklickt
 * hat.
 *
 * Läuft in der Seitenwelt (`world: MAIN`), weil ein Content-Script in seiner
 * eigenen Welt die `fetch`-Funktion der Seite nicht erreicht.
 */
;(() => {
  const MARKE = 'ak-amazon-folgen'

  /**
   * Aus einer Antwort die Folgen mit ihren Tonspuren ziehen.
   *
   * Gesucht wird dasselbe Muster wie im HTML — Amazon liefert beim Nachladen
   * dieselbe Struktur, nur ohne das Seitengerüst drumherum.
   */
  function auswerten(text) {
    if (typeof text !== 'string' || text.length < 60) return
    if (!text.includes('audioTracks')) return
    const funde = []
    for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\][\s\S]{0,240}?"episodeNumber"\s*:\s*(\d+)/g)) {
      const sprachen = m[1]
        .split(',')
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
      funde.push({ nummer: Number(m[2]), sprachen })
    }
    if (!funde.length) return
    window.postMessage({ marke: MARKE, funde }, '*')
  }

  // --- fetch ---------------------------------------------------------------

  try {
    const nativ = window.fetch
    window.fetch = async function (...args) {
      const antwort = await nativ.apply(this, args)
      try {
        // Geklont, damit die Seite ihre eigene Antwort unangetastet bekommt.
        antwort
          .clone()
          .text()
          .then(auswerten)
          .catch(() => {})
      } catch {
        /* Eine Antwort, die sich nicht klonen lässt, bleibt liegen. */
      }
      return antwort
    }
  } catch {
    /* Ohne fetch-Mitlesen bleibt der XHR-Weg. */
  }

  // --- XMLHttpRequest ------------------------------------------------------

  try {
    const beschreibung = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')
    const nativGetter = beschreibung?.get
    if (nativGetter) {
      Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
        configurable: true,
        enumerable: beschreibung.enumerable,
        get() {
          const text = nativGetter.call(this)
          try {
            auswerten(text)
          } catch {
            /* Eine unlesbare Antwort ändert nichts am Rest. */
          }
          return text
        },
      })
    }
  } catch {
    /* Ohne Mitlesen bleibt der Stand aus dem HTML. */
  }
})()
