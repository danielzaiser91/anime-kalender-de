/**
 * Hört mit, was Amazon beim Blättern durch die Folgenliste nachlädt — und holt
 * die Abschnitte nach, die Daniel sonst einzeln anklicken müsste.
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
 * ## Die Struktur, gemessen am 23.08.2026
 *
 * Amazon holt die Folgen über `/gp/video/api/getDetailWidgets`. Die Antwort ist
 * gültiges JSON und enthält **den gewählten Abschnitt plus die Zugänge zu allen
 * übrigen**:
 *
 * ```
 * widgets.episodeList.episodeCount                     → 51
 * widgets.episodeList.episodes[].detail.audioTracks    → ["Deutsch"]
 * widgets.episodeList.episodes[].detail.episodeNumber  → 25 … 48
 * widgets.episodeList.actions.episodePages[].token     → drei Abschnitte
 * ```
 *
 * ## Was hier passiert
 *
 * Zwei Dinge, und der Unterschied ist wichtig:
 *
 * 1. **Mitgelesen** wird am Ergebnis, nicht am Aufruf — `fetch` und
 *    `XMLHttpRequest` geben ihre Antwort ohnehin an die Seite weiter, und genau
 *    dort wird sie abgegriffen.
 * 2. **Nachgeholt** werden allein die Abschnitte derselben Folgenliste, deren
 *    Token in der Antwort mitgeliefert wurde. Das ist Zeichen für Zeichen der
 *    Abruf, den ein Klick aufs Dropdown auslöst — in derselben angemeldeten
 *    Sitzung, auf derselben Seite, ausgelöst dadurch, dass Daniel diese Seite
 *    geöffnet hat. Es wird nichts gesucht, nichts durchlaufen und keine zweite
 *    Serie angefasst.
 *
 * Läuft in der Seitenwelt (`world: MAIN`), weil ein Content-Script in seiner
 * eigenen Welt weder die `fetch`-Funktion der Seite noch ihre Anmeldung
 * erreicht.
 */
;(() => {
  const MARKE = 'ak-amazon-folgen'

  /**
   * Obergrenze für das Nachholen.
   *
   * Bei 24 Folgen je Abschnitt deckt das rund 600 Folgen ab — mehr als jede
   * Serie im Bestand. Die Grenze steht nicht wegen der Datenmenge da, sondern
   * damit aus einer Bedienhilfe nie ein Durchlauf wird: Wo sie greift, bleibt
   * die Zahl unvollständig, und der Knopf meldet dann ausdrücklich einen
   * Ausschnitt statt eines „kein Deutsch".
   */
  const MAX_ABSCHNITTE = 25

  /** Pause zwischen zwei Abrufen. Ein Mensch klickt auch nicht schneller. */
  const PAUSE_MS = 400

  const geholt = new Set()
  let laeuft = false
  let titleID = null

  /**
   * Der Stand des Lesers, ablesbar aus der Konsole.
   *
   * Zweimal hintereinander blieb der Knopf bei „24 von 51" stehen, und beide
   * Male war die Ursache eine andere als vermutet — einmal fehlte die
   * Netzantwort, einmal der richtige Feldname. Geraten wurde jedes Mal zuerst.
   *
   * Diese Aufstellung sagt in einem Zug, wie weit der Leser gekommen ist:
   * ob er läuft, ob er die Kennung hat, wie viele Abschnitte er sieht, was er
   * angefordert hat und woran es scheiterte. `copy(JSON.stringify(
   * window.__akAmazon))` in der Konsole genügt.
   *
   * Sie bleibt dauerhaft drin. Ein paar Zähler kosten nichts, und der nächste
   * Umbau bei Amazon kommt bestimmt.
   */
  const diagnose = {
    fassung: '0.51.0',
    anlaeufe: 0,
    quelltextLaenge: 0,
    titleID: null,
    titleIDfundstellen: 0,
    episodePagesGefunden: false,
    tokensImQuelltext: 0,
    abrufe: [],
    fehler: [],
  }
  window.__akAmazon = diagnose

  const warte = (ms) => new Promise((r) => setTimeout(r, ms))

  /**
   * Aus einer Antwort die Folgen mit ihren Tonspuren ziehen.
   *
   * **Geparst, nicht abgetastet.** Die Antwort ist gültiges JSON; ein Muster
   * über den Zeichenabstand („`episodeNumber` irgendwo hinter `audioTracks`")
   * hält nur so lange, wie dazwischen nichts Langes steht — `contributors` mit
   * gefüllter Besetzungsliste reicht, um es zu brechen.
   *
   * Das Muster bleibt als Rückfallebene: Ändert Amazon die Verschachtelung,
   * liefert es wenigstens noch die Sprachen.
   */
  function auswerten(text, herkunft) {
    if (typeof text !== 'string' || text.length < 60) return
    if (!text.includes('audioTracks') && !text.includes('episodePages')) return

    const funde = []
    let gesamt = null
    let seiten = []

    try {
      const liste = JSON.parse(text)?.widgets?.episodeList
      if (liste) {
        if (Number.isFinite(liste.episodeCount)) gesamt = liste.episodeCount
        for (const folge of liste.episodes ?? []) {
          const d = folge?.detail
          if (!d || !Array.isArray(d.audioTracks) || !Number.isFinite(d.episodeNumber)) continue
          funde.push({ nummer: d.episodeNumber, sprachen: d.audioTracks.filter(Boolean) })
        }
        for (const seite of liste.actions?.episodePages ?? []) {
          const token = seite?.token
          if (typeof token !== 'string' || token.length <= 10) continue
          // Der gerade gelieferte Abschnitt gilt als erledigt: Seine Folgen
          // stehen oben schon in `funde`, ein zweiter Abruf brächte dieselben
          // Daten und einen Zugriff mehr auf Amazons Server.
          if (seite.isSelected) geholt.add(token)
          seiten.push(token)
        }
      }
    } catch {
      /* Keine JSON-Antwort — dann greift das Muster unten. */
    }

    if (!funde.length) {
      // Rückfall: Eine Sprache ohne Nummer zählt als Sprache, **nicht** als
      // Folge — sonst stimmte die Zahl am Knopf wieder nicht.
      for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)) {
        const sprachen = m[1]
          .split(',')
          .map((s) => s.trim().replace(/^"|"$/g, ''))
          .filter(Boolean)
        if (sprachen.length) funde.push({ nummer: null, sprachen })
      }
    }

    if (funde.length || gesamt !== null) {
      window.postMessage({ marke: MARKE, funde, gesamt }, '*')
    }

    // Die Kennung der Serie steht in der Adresse, aus der die Antwort kam. Sie
    // wird gelesen, nicht gebaut — ohne sie wird nichts nachgeholt.
    if (!titleID && typeof herkunft === 'string') {
      try {
        titleID = new URL(herkunft, location.href).searchParams.get('titleID')
      } catch {
        /* Keine brauchbare Adresse — dann bleibt es beim Mitlesen. */
      }
    }
    if (seiten.length > 1) void nachholen(seiten)
  }

  /**
   * Die übrigen Abschnitte derselben Folgenliste holen.
   *
   * Jedes Token genau einmal, nacheinander, mit Pause. Was zurückkommt, läuft
   * durch `auswerten` — findet es dort weitere Tokens, sind die längst gesehen
   * und die Schleife endet von selbst.
   */
  async function nachholen(tokens) {
    if (laeuft || !titleID) return
    const offen = tokens.filter((t) => !geholt.has(t))
    if (!offen.length) return
    laeuft = true
    try {
      for (const token of offen) {
        if (geholt.size >= MAX_ABSCHNITTE) break
        geholt.add(token)
        const widgets = JSON.stringify([{ widgetType: 'EpisodeList', widgetToken: token }])
        const adresse =
          '/gp/video/api/getDetailWidgets' +
          `?titleID=${encodeURIComponent(titleID)}&widgets=${encodeURIComponent(widgets)}`
        try {
          const antwort = await nativFetch.call(window, adresse, {
            credentials: 'include',
            headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          })
          const text = antwort.ok ? await antwort.text() : ''
          diagnose.abrufe.push({ status: antwort.status, zeichen: text.length })
          if (antwort.ok) auswerten(text, antwort.url)
        } catch (err) {
          /* Ein fehlgeschlagener Abschnitt lässt die Zahl unvollständig — und
             damit meldet der Knopf ausdrücklich einen Ausschnitt. */
          diagnose.fehler.push(String(err?.message ?? err).slice(0, 120))
        }
        await warte(PAUSE_MS)
      }
    } finally {
      laeuft = false
    }
  }

  // --- Der Seitenquelltext --------------------------------------------------

  /**
   * Beim ersten Seitenaufbau gibt es nichts mitzulesen.
   *
   * Amazon liefert den ersten Abschnitt **im HTML** mit — es fliegt also keine
   * Antwort vorbei, an die sich der Mitleser hängen könnte. Ohne diesen Weg
   * blieb der Knopf deshalb bei „24 von 51 — Abschnitte selbst öffnen" stehen,
   * obwohl die Zugänge zu den übrigen Abschnitten längst auf der Seite lagen
   * (Daniel, 23.08.2026, mit Bild).
   *
   * Gemessen an derselben Seite, welche Felder es wirklich sind:
   *
   * ```
   * "titleID":"B0CKPCSHMC"          ← nicht die ASIN der Seite (B0CQ4VL364)!
   * "episodePages":[{"isSelected":true,…,"token":"ADAAAAIEAGJhbXpuMS5…"}]
   * ```
   *
   * **Beide Namen waren zu messen, nicht zu erraten.** Der erste Versuch suchte
   * nach `widgetToken` — so heißt das Feld im *Aufruf*, im Seitenquelltext
   * heißt es `token`. Und die `titleID` aus der Adresse zu bauen wäre
   * fehlgegangen: Die Seite liegt unter `B0CQ4VL364`, der Abruf braucht
   * `B0CKPCSHMC`.
   */
  /**
   * Vom `episodePages`-Fund nur das Array selbst behalten.
   *
   * Gleich dahinter steht `pagination` — „Vorherige Seite", „Nächste Seite" —
   * mit **denselben Abschnitten unter eigenen Tokens**. Wer stumpf 20.000
   * Zeichen absucht, findet bei „Digimon Tamers" fünf statt drei Tokens und
   * holt einen Abschnitt doppelt: 267 KB umsonst, bei jedem Seitenaufruf
   * (gemessen 23.08.2026 an Daniels Diagnose-Ausgabe).
   *
   * Geschnitten wird über die Klammern, nicht über ein Stichwort: Ein
   * `indexOf('pagination')` hielte nur, solange dieses Feld dort steht.
   */
  function nurDieAbschnitte(block) {
    const auf = block.indexOf('[')
    if (auf < 0) return block
    let tiefe = 0
    for (let i = auf; i < block.length; i++) {
      const c = block[i]
      if (c === '[') tiefe++
      else if (c === ']' && --tiefe === 0) return block.slice(auf, i + 1)
    }
    return block
  }

  function ausSeite() {
    const html = document.documentElement?.innerHTML
    if (typeof html !== 'string') return
    diagnose.quelltextLaenge = html.length

    /**
     * **Jede** Fundstelle wird probiert, nicht die erste.
     *
     * `titleID` steht in einem Seitenquelltext dieser Größe vielfach — in
     * Empfehlungsleisten, in Verfolgungsmarken, in Vorlagen ohne Wert. Die
     * erste Fundstelle zu nehmen und beim Misserfolg aufzugeben heißt, an der
     * falschen Stelle zu scheitern und die richtige nie zu sehen.
     */
    if (!titleID) {
      const stellen = [...html.matchAll(/titleID/g)].map((m) => m.index)
      diagnose.titleIDfundstellen = stellen.length
      for (const i of stellen) {
        // Gesucht wird am kurzen Ausschnitt: Amazon legt sein JSON mal roh in
        // einem Skriptblock ab, mal maskiert in einem HTML-Attribut
        // (`\"titleID\":\"…\"`). Eine Regex für beide Formen wird unlesbar.
        const treffer = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10})/.exec(html.slice(i, i + 80))
        if (treffer) {
          titleID = treffer[1]
          break
        }
      }
      diagnose.titleID = titleID
    }
    if (!titleID) return

    // Dasselbe hier: Der erste `episodePages`-Fund muss nicht der mit den
    // Tokens sein.
    const stellen = [...html.matchAll(/episodePages/g)].map((m) => m.index)
    diagnose.episodePagesGefunden = stellen.length > 0
    for (const start of stellen) {
      const block = nurDieAbschnitte(html.slice(start, start + 20000).replace(/\\+"/g, '"'))
      const tokens = []
      for (const m of block.matchAll(/"isSelected"\s*:\s*(true|false)[\s\S]{0,400}?"token"\s*:\s*"([^"]{20,})"/g)) {
        // Der gewählte Abschnitt steht schon im HTML — seine Folgen hat
        // `amazon.js` bereits gezählt. Ihn zu holen brächte nichts als einen
        // Zugriff mehr.
        if (m[1] === 'true') geholt.add(m[2])
        tokens.push(m[2])
      }
      if (tokens.length > 1) {
        diagnose.tokensImQuelltext = tokens.length
        void nachholen(tokens)
        return
      }
    }
  }

  // --- fetch ---------------------------------------------------------------

  // Festgehalten, bevor die eigene Fassung gesetzt wird: Das Nachholen ruft
  // absichtlich die **native** Funktion, sonst läse es seine eigene Antwort ein
  // zweites Mal mit.
  const nativFetch = window.fetch

  try {
    window.fetch = async function (...args) {
      const antwort = await nativFetch.apply(this, args)
      try {
        // Geklont, damit die Seite ihre eigene Antwort unangetastet bekommt.
        antwort
          .clone()
          .text()
          .then((t) => auswerten(t, antwort.url))
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
            auswerten(text, this.responseURL)
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

  // --- Anlauf ---------------------------------------------------------------

  /**
   * Der Quelltext wird mehrfach befragt, nicht einmal.
   *
   * Das Skript läuft bei `document_start`, da steht vom Seitenkörper noch
   * nichts. Wie lange Amazon braucht, bis die Folgenliste im Quelltext steht,
   * hängt an Leitung und Gerät — deshalb wird nachgesehen statt geraten.
   * Sobald `nachholen()` einmal gegriffen hat, sind die Tokens in `geholt` und
   * weitere Anläufe tun nichts.
   */
  const takt = setInterval(() => {
    // 60 Anläufe à 500 ms sind 30 Sekunden. Die erste Fassung gab nach zehn
    // auf — großzügig gerechnet für eine schnelle Leitung, knapp für eine
    // Seite, die ihren Inhalt in mehreren Wellen nachlädt.
    if (++diagnose.anlaeufe > 60 || diagnose.tokensImQuelltext) clearInterval(takt)
    try {
      ausSeite()
    } catch (err) {
      diagnose.fehler.push(String(err?.message ?? err).slice(0, 120))
    }
  }, 500)
  try {
    ausSeite()
  } catch {
    /* Beim ersten Anlauf ist der Seitenkörper meist noch leer — erwartet. */
  }
})()
