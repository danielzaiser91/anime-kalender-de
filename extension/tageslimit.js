/**
 * **Tageslimit des Workers: pausieren statt weiter senden** (11.10.2026).
 *
 * Das Gratis-Kontingent der Datenbank (100.000 geschriebene Zeilen am Tag) ist endlich; ein
 * „alle durchgehen"-Lauf verbrauchte es am 11.10.2026 in 39 Minuten und sperrte damit auch die
 * Newsletter-Anmeldung. Der Worker antwortet deshalb ab 50.000 Zeilen mit 429 und
 * `{ tageslimit: true, retryAfter: <Sekunden bis 00:00 UTC> }` (worker/src/tagesdeckel.ts).
 *
 * Dieses Skript erkennt die Antwort an einer Stelle für alle Melder, statt an jeder Sendestelle:
 * `fetch` wird im Isolated World der Erweiterung umhüllt, nur 429-Antworten des Workers werden
 * gelesen. Der Stand liegt in `chrome.storage.local`, damit jeder Tab und jeder Frame ihn kennt.
 * Die Durchgänge fragen `aktiv()`/`text()` und halten an; nach Ablauf läuft alles wie vorher.
 *
 * **Antwortet der Worker stattdessen dreimal hintereinander mit 5xx auf eine Meldung** (12.10.2026:
 * das D1-Leselimit riss, Netflix lief weiter, Prime pausierte stumm), gilt dieselbe Pause für 30
 * Minuten, mit dem Grund „Server antwortet nicht". Ein erfolgreicher Aufruf setzt den Zähler zurück.
 */
(() => {
  const SCHLUESSEL = 'akTageslimitBis'
  const ART = 'akTageslimitArt'
  const FEHLER = 'akWorkerFehlerReihe'
  const WORKER = 'https://newsletter.animekalender.workers.dev/'
  const SERVER_FEHLER_REIHE = 3
  const SERVER_PAUSE_SEKUNDEN = 30 * 60
  /* Prime macht nach der Pause von allein weiter; Netflix und Disney+ enden und brauchen einen neuen Start. */
  /* `manifest.json` spielt diese Datei nur auf netflix.com, www.amazon.de und disneyplus.com ein; kommt primevideo.com dazu, muss der Hostname hier mit. */
  const PRIME = globalThis.location?.hostname === 'www.amazon.de'
  let bis = 0
  let art = null
  let reihe = 0

  const aktiv = () => bis > Date.now()

  /** „Tageslimit erreicht, weiter ab 02:00" bzw. „Server antwortet nicht, …" (Berliner Ortszeit; Prime: „nächster Versuch 14:30", sonst „Durchgang ab 14:30 neu starten"), sonst `null`. */
  function text() {
    if (!aktiv()) return null
    const uhr = new Date(bis).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
    if (art !== 'server') return `Tageslimit erreicht, weiter ab ${uhr}`
    return PRIME ? `Server antwortet nicht, nächster Versuch ${uhr}` : `Server antwortet nicht, Durchgang ab ${uhr} neu starten`
  }

  /** Prime-Liste: der Grund der Pause als Zeile im Kopf (`eltern`), nur solange sie gilt. */
  function hinweisAnhaengen(eltern) {
    const grundText = text()
    if (!grundText) return
    const zeile = eltern.ownerDocument.createElement('div')
    zeile.className = 'ak-hinweis ak-tageslimit-grund'
    zeile.textContent = grundText
    eltern.appendChild(zeile)
  }

  /** Der Grund eines Durchgangsendes: das Limit, wenn es gilt, sonst der übliche. */
  const grund = (ueblich) => text() ?? ueblich

  function hinweisZeigen() {
    if (typeof document === 'undefined' || window.top !== window || document.getElementById('ak-tageslimit')) return
    const el = document.createElement('div')
    el.id = 'ak-tageslimit'
    el.textContent = text()
    el.title = 'Anime-Kalender: Die Meldungen pausieren. Klick blendet den Hinweis aus.'
    el.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:8px 12px;border-radius:8px;' +
      'background:#7a1f1f;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px #0006'
    el.addEventListener('click', () => el.remove())
    document.documentElement.appendChild(el)
    setTimeout(() => el.remove(), Math.max(0, bis - Date.now()))
  }

  function speichern(werte) {
    try {
      chrome.storage.local.set(werte)
    } catch {
      /* Ohne Speicher gilt der Stand nur in diesem Frame. */
    }
  }

  /** Pause für `sekunden`; `grundArt` ist `'server'` bei Serverfehlern, sonst das Tageslimit. */
  function merken(sekunden, grundArt = null) {
    bis = Date.now() + sekunden * 1000
    art = grundArt
    reihe = 0
    speichern({ [SCHLUESSEL]: bis, [ART]: art, [FEHLER]: 0 })
    hinweisZeigen()
  }

  /** Eine Meldung ist ein POST an den Worker; Lesen (`?gemeldet=`) zählt nicht. */
  function istMeldung([ziel, optionen]) {
    const adresse = typeof ziel === 'string' ? ziel : (ziel?.url ?? String(ziel))
    return adresse.startsWith(WORKER) && String(optionen?.method ?? ziel?.method ?? 'GET').toUpperCase() === 'POST'
  }

  /**
   * Erfolg setzt die Reihe zurück, 5xx zählt, die dritte in Folge pausiert. Die Reihe liegt im
   * Speicher, weil jeder Prime-Frame nur wenige Meldungen sendet.
   */
  function meldungZaehlen(status) {
    if (status < 400 && reihe) {
      reihe = 0
      speichern({ [FEHLER]: 0 })
    }
    if (status < 500 || aktiv()) return
    reihe++
    if (reihe >= SERVER_FEHLER_REIHE) return merken(SERVER_PAUSE_SEKUNDEN, 'server')
    speichern({ [FEHLER]: reihe })
  }

  /**
   * Nach einer gescheiterten Meldung: gilt das Limit, hält der Durchgang an (`abbruch`).
   * Gibt immer `false` zurück — so steht es an der Stelle von `return false`.
   */
  function fehlgeschlagen(durchlauf) {
    if (aktiv() && durchlauf) durchlauf.abbruch = true
    return false
  }

  /**
   * Prime: eine Staffel, deren Frame am Limit scheiterte, geht zurück an den Anfang des Plans und
   * wird nach dem Limit nachgeholt, statt unter „übersprungen" zu landen. `true`, wenn zurückgestellt.
   */
  function zurueckstellen(plan, kennung) {
    if (!aktiv()) return false
    plan.unshift(kennung)
    return true
  }

  /** Prime-Frame: die Pause, die er gesehen hat (Rest in Sekunden, Art), für die Antwort an die Seite; sonst `null`. */
  function rest() {
    return aktiv() ? { sekunden: Math.ceil((bis - Date.now()) / 1000), art } : null
  }

  /**
   * Prime-Seite: die Antwort eines Frames übernehmen. Der Frame kennt die 429 sofort, die Seite erst
   * über `chrome.storage` – kam seine Antwort davor, zählte die Staffel als „übersprungen" (Bericht
   * 13.10.2026: letzte Seite „Fehler 429"). Mit `limit` gilt die Pause hier ab sofort, und ein
   * Fehlschlag nennt das Limit statt „Fehler 429".
   */
  function ausFrame(daten) {
    if (!daten.limit) return daten
    if (!aktiv()) merken(daten.limit.sekunden, daten.limit.art)
    return daten.ok ? daten : { ...daten, grund: text() }
  }

  async function pruefen(ziel, antwort) {
    const adresse = typeof ziel === 'string' ? ziel : (ziel?.url ?? String(ziel))
    if (!adresse.startsWith(WORKER)) return
    try {
      const inhalt = await antwort.clone().json()
      if (inhalt?.tageslimit && inhalt.retryAfter > 0) merken(inhalt.retryAfter)
    } catch {
      /* Eine 429 ohne unser JSON (Cloudflare selbst) ist kein Tageslimit. */
    }
  }

  const echtesFetch = globalThis.fetch
  if (typeof echtesFetch === 'function') {
    globalThis.fetch = async function (...args) {
      const antwort = await echtesFetch.apply(this, args)
      if (antwort.status === 429) await pruefen(args[0], antwort)
      else if (istMeldung(args)) meldungZaehlen(antwort.status)
      return antwort
    }
  }

  try {
    chrome.storage.local.get([SCHLUESSEL, ART, FEHLER]).then((s) => {
      if (Number(s?.[SCHLUESSEL]) > bis) {
        bis = Number(s[SCHLUESSEL])
        art = s[ART] ?? null
      }
      reihe = Number(s?.[FEHLER]) || reihe
      if (aktiv()) hinweisZeigen()
    })
    chrome.storage.onChanged.addListener((aenderung, bereich) => {
      if (bereich !== 'local') return
      if (aenderung[SCHLUESSEL]) bis = Number(aenderung[SCHLUESSEL].newValue) || 0
      if (aenderung[ART]) art = aenderung[ART].newValue ?? null
      if (aenderung[FEHLER]) reihe = Number(aenderung[FEHLER].newValue) || 0
    })
  } catch {
    /* Außerhalb der Erweiterung (Sandkasten-Test) gibt es keinen Speicher. */
  }

  globalThis.AK_TAGESLIMIT = { aktiv, text, grund, hinweisAnhaengen, merken, fehlgeschlagen, zurueckstellen, rest, ausFrame }
})()
