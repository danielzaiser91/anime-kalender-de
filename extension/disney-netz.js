/*
  **Netzwege des Disney+-Melders: Senden mit Wiederholung, Bahnen, „schon gemeldet" je Adresse** (08.10.2026).

  Eigene Datei, weil `disney.js` über der Zeilengrenze liegt (check:umfang). Ohne Browser-Zustand,
  damit `disney.test.cjs` sie im Sandkasten spielen kann.
*/
globalThis.AK_DISNEY_NETZ = (() => {
  const schlaf = (ms) => new Promise((fertig) => setTimeout(fertig, ms))

  /**
   * Arbeitet eine Liste in `anzahl` Bahnen ab; die Reihenfolge der Ergebnisse bleibt erhalten.
   * Fünf Bahnen reichen zum Prüfen (rund 200 ms je Aufruf); Senden nimmt weniger.
   */
  async function inBahnen(liste, arbeit, melde, anzahl = 5) {
    const raus = new Array(liste.length)
    let naechster = 0
    let fertig = 0
    const bahn = async () => {
      for (;;) {
        const i = naechster++
        if (i >= liste.length) return
        raus[i] = await arbeit(liste[i], i)
        melde?.(++fertig)
      }
    }
    await Promise.all(Array.from({ length: Math.min(anzahl, liste.length) }, bahn))
    return raus
  }

  /**
   * Ein POST mit Wiederholung. „Failed to fetch" heißt: keine Antwort bekommen (Netz, ein Fehler ohne
   * CORS-Kopf, ein abgebrochener Seitenwechsel) — das ist einen weiteren Versuch wert, ebenso 429 und 5xx.
   * Andere 4xx sind endgültig. `keepalive` lässt die Anfrage einen Seitenwechsel überleben (Grenze 64 KB).
   */
  async function sende(url, init, { versuche = 3, pause = 1500, warte = schlaf, holen = (...a) => fetch(...a) } = {}) {
    let letzter = ''
    for (let n = 1; n <= versuche; n++) {
      if (globalThis.AK_TAGESLIMIT?.aktiv()) return { ok: false, fehler: globalThis.AK_TAGESLIMIT.text() }
      try {
        const klein = typeof init.body === 'string' && init.body.length < 60000
        const antwort = await holen(url, klein ? { ...init, keepalive: true } : init)
        if (antwort.ok) return { ok: true, status: antwort.status }
        letzter = `HTTP ${antwort.status}`
        if ((antwort.status < 500 && antwort.status !== 429) || globalThis.AK_TAGESLIMIT?.aktiv()) break
      } catch (fehler) {
        letzter = String(fehler)
      }
      if (n < versuche) await warte(pause * n)
    }
    return { ok: false, fehler: letzter }
  }
  return { inBahnen, sende }
})()

/*
  Adressen, zu denen die Ferne (`?gemeldet=<url>`, nicht zwischengespeichert) Meldungen kennt.
  Die Liste `?zaehlen=1` ist bis zu 30 Minuten alt und kennt eine frische Meldung noch nicht
  (Shield Hero: 08:47 gemeldet, um 09:05 weiter „offen"). Was einmal gemeldet ist, bleibt es;
  „nichts" wird nach `frist` neu erfragt (30 Minuten = Alter der Liste). Gleiche Adresse
  gleichzeitig: eine Anfrage.

  Der Durchgang wechselt von Titel zu Titel per Seitenaufruf, und jeder Aufruf begann mit leerem
  Gedächtnis: alle offenen Adressen wurden neu erfragt (Disney+: 172 Titel, 30.272 Abrufe; Netflix:
  100 Titel, 24.400; 11.10.2026). Darum steht das Ergebnis auch in `localStorage` der Seite
  (je Adresse `b<Zeit>` = gemeldet, `k<Zeit>` = nichts), geteilt zwischen Aufrufen und Tabs.
*/

Object.assign(globalThis.AK_DISNEY_NETZ, (() => {
  const { inBahnen } = globalThis.AK_DISNEY_NETZ
  const bekannt = new Set()
  const keine = new Map()
  const laufend = new Map()
  const PRAEFIX = 'ak-gemeldet:'
  const BEKANNT_STUNDE = 3600000

  function ablegen(u, art, zeit) {
    try {
      globalThis.localStorage?.setItem(PRAEFIX + u, art + zeit)
    } catch {
      /* Ohne Ablage bleibt es beim Gedächtnis dieser Seite. */
    }
  }

  function einlesen(u, jetzt) {
    try {
      const roh = globalThis.localStorage?.getItem(PRAEFIX + u) ?? ''
      const zeit = Number(roh.slice(1))
      if (roh[0] === 'b' && jetzt - zeit < BEKANNT_STUNDE) bekannt.add(u)
      if (roh[0] === 'k' && zeit > (keine.get(u) ?? -Infinity)) keine.set(u, zeit)
    } catch {
      /* Unlesbar = unbekannt: dann wird gefragt. */
    }
  }

  /** Eine eigene Meldung sofort merken — auch für die nächste Seite des Durchgangs. */
  function merkeGemeldet(u, jetzt = Date.now) {
    bekannt.add(u)
    ablegen(u, 'b', jetzt())
  }

  /** Ein Set, dessen `add` die Adresse (`zuUrl` macht aus einer Kennung eine) zugleich ablegt. */
  function gemerktesSet(eintraege = [], zuUrl = (x) => x) {
    const menge = new Set(eintraege)
    const add = menge.add.bind(menge)
    menge.add = (x) => (merkeGemeldet(zuUrl(x)), add(x))
    return menge
  }

  async function frischGemeldet(urls, holen, { jetzt = Date.now, frist = 1800000, bahnen = 3 } = {}) {
    for (const u of urls) einlesen(u, jetzt())
    const gesucht = urls.filter((u) => !bekannt.has(u) && !(jetzt() - (keine.get(u) ?? -Infinity) < frist))
    await inBahnen(gesucht, async (u) => {
      if (!laufend.has(u)) {
        laufend.set(
          u,
          holen(u)
            .then((nummern) => {
              const art = nummern.size ? 'b' : 'k'
              if (art === 'b') bekannt.add(u)
              else keine.set(u, jetzt())
              ablegen(u, art, jetzt())
            })
            .catch(() => {})
            .finally(() => laufend.delete(u)),
        )
      }
      await laufend.get(u)
    }, null, bahnen)
    return gemerktesSet(urls.filter((u) => bekannt.has(u)))
  }

  return { frischGemeldet, gemerktesSet, merkeGemeldet }
})())
