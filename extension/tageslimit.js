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
 */
(() => {
  const SCHLUESSEL = 'akTageslimitBis'
  const WORKER = 'https://newsletter.animekalender.workers.dev/'
  let bis = 0

  const aktiv = () => bis > Date.now()

  /** „Tageslimit erreicht, weiter ab 02:00" (Berliner Ortszeit), sonst `null`. */
  function text() {
    if (!aktiv()) return null
    const uhr = new Date(bis).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
    return `Tageslimit erreicht, weiter ab ${uhr}`
  }

  /** Der Grund eines Durchgangsendes: das Limit, wenn es gilt, sonst der übliche. */
  const grund = (ueblich) => text() ?? ueblich

  function hinweisZeigen() {
    if (typeof document === 'undefined' || window.top !== window || document.getElementById('ak-tageslimit')) return
    const el = document.createElement('div')
    el.id = 'ak-tageslimit'
    el.textContent = text()
    el.title = 'Anime-Kalender: Die Meldungen warten bis zum nächsten Tag. Klick blendet den Hinweis aus.'
    el.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:8px 12px;border-radius:8px;' +
      'background:#7a1f1f;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px #0006'
    el.addEventListener('click', () => el.remove())
    document.documentElement.appendChild(el)
    setTimeout(() => el.remove(), Math.max(0, bis - Date.now()))
  }

  function merken(sekunden) {
    bis = Date.now() + sekunden * 1000
    try {
      chrome.storage.local.set({ [SCHLUESSEL]: bis })
    } catch {
      /* Ohne Speicher gilt der Stand nur in diesem Frame. */
    }
    hinweisZeigen()
  }

  /**
   * Nach einer gescheiterten Meldung: gilt das Limit, hält der Durchgang an (`abbruch`).
   * Gibt immer `false` zurück — so steht es an der Stelle von `return false`.
   */
  function fehlgeschlagen(durchlauf) {
    if (aktiv() && durchlauf) durchlauf.abbruch = true
    return false
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
      return antwort
    }
  }

  try {
    chrome.storage.local.get(SCHLUESSEL).then((s) => {
      bis = Math.max(bis, Number(s?.[SCHLUESSEL]) || 0)
      if (aktiv()) hinweisZeigen()
    })
    chrome.storage.onChanged.addListener((aenderung, bereich) => {
      if (bereich === 'local' && aenderung[SCHLUESSEL]) bis = Number(aenderung[SCHLUESSEL].newValue) || 0
    })
  } catch {
    /* Außerhalb der Erweiterung (Sandkasten-Test) gibt es keinen Speicher. */
  }

  globalThis.AK_TAGESLIMIT = { aktiv, text, grund, merken, fehlgeschlagen }
})()
