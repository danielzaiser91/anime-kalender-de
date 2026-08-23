/**
 * Liest bei Amazon die Tonspuren mit, während Daniel die Seite ohnehin ansieht.
 *
 * ## Warum das hier einfacher ist als bei Netflix
 *
 * Netflix gibt seine Tonspuren erst preis, wenn eine Folge läuft — deshalb
 * braucht es dort ein Skript in der Seitenwelt, das `window.netflix` erreicht.
 * Amazon liefert sie **im HTML mit**: je Folge ein `audioTracks`-Feld, je
 * Staffel ein `benefitId`. Ein gewöhnliches Content-Script genügt.
 *
 * Gemessen am 23.08.2026 an „Naruto Shippuden", drei Staffeln einzeln:
 *
 * ```
 * "audioTracks":["Deutsch","日本語"]      je Folge
 * "benefitId":"Prime" | "aniversede"     je Staffel — welches Abo nötig ist
 * ```
 *
 * ## Was ausdrücklich nicht gelesen wird
 *
 * `entitlementType` sagt, ob **dieses Konto** Zugriff hat — anonym steht dort
 * immer „Unentitled", bei Daniel etwas anderes. Eine Angabe über ihn, nicht
 * über den Titel. Sie bleibt liegen.
 *
 * ## Warum die Erweiterung und kein Abruf
 *
 * Amazons Nutzungsbedingungen untersagen „Data Mining, Robots oder ähnliche
 * Datensammel- und Extraktionsprogramme". Ein Mensch, der eine Seite ansieht,
 * nutzt die Lizenz bestimmungsgemäß. Deshalb wird hier **nichts angefordert** —
 * gelesen wird nur, was die Seite ohnehin geladen hat.
 */
;(() => {
  const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'

  /** Die Kennung aus der Adresse — beide Formen kommen vor. */
  function asin() {
    return /\/(?:dp|detail)\/([A-Z0-9]{10})/.exec(location.pathname + location.search)?.[1] ?? null
  }

  /**
   * Die Tonspuren aller Folgen dieser Seite.
   *
   * Gelesen wird aus dem Quelltext, nicht aus dem sichtbaren DOM: Amazon legt
   * die Angaben in JSON-Blöcken ab, die nie als Text erscheinen. Mehrfach
   * genannte Sprachen werden zusammengefasst — für unsere Frage zählt, **ob**
   * Deutsch dabei ist, nicht wie oft.
   */
  function spuren() {
    const text = document.documentElement.innerHTML
    const alle = new Set()
    let folgen = 0
    for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)) {
      folgen++
      for (const s of m[1].split(',')) {
        const name = s.trim().replace(/^"|"$/g, '')
        if (name) alle.add(name)
      }
    }
    return { sprachen: [...alle], folgen }
  }

  /** Welche Abos diese Staffel freischalten — `Prime`, `aniversede`, … */
  function abos() {
    const text = document.documentElement.innerHTML
    return [...new Set([...text.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))]
  }

  const liste = globalThis.AK_OFFENE_AMAZON ?? {}
  const id = asin()
  if (!id || !liste[id]) return // Kein Titel von unserer Liste: still bleiben.

  const eintrag = liste[id]

  // --- Der Knopf -----------------------------------------------------------

  const knopf = document.createElement('button')
  knopf.className = 'ak-amazon-knopf'
  knopf.type = 'button'
  document.body.appendChild(knopf)

  let letzterStand = ''
  function zeichnen() {
    const { sprachen, folgen } = spuren()
    const deutsch = sprachen.some((s) => /deutsch|german/i.test(s))
    const stand = `${deutsch}|${folgen}|${sprachen.join(',')}`
    if (stand === letzterStand) return
    letzterStand = stand
    knopf.dataset.deutsch = String(deutsch)
    knopf.textContent = folgen
      ? `${deutsch ? '🇩🇪 Deutsch' : '✕ kein Deutsch'} · ${folgen} Folgen · melden`
      : 'Tonspuren noch nicht geladen'
    knopf.disabled = !folgen
  }

  /**
   * Amazon lädt die Folgenliste nach, nicht mit dem ersten HTML.
   *
   * Deshalb wird wiederholt nachgesehen statt einmal beim Laden — sonst stünde
   * dort dauerhaft „noch nicht geladen", obwohl die Angaben längst da sind.
   */
  zeichnen()
  setInterval(zeichnen, 500)

  // --- Melden --------------------------------------------------------------

  knopf.addEventListener('click', async () => {
    const { sprachen, folgen } = spuren()
    if (!folgen) return
    const deutsch = sprachen.some((s) => /deutsch|german/i.test(s))
    knopf.textContent = 'sende …'
    knopf.disabled = true
    const { token } = await chrome.storage.sync.get('token')
    if (!token) {
      knopf.textContent = 'Kein Token — Rechtsklick aufs Symbol, dann Optionen'
      return
    }
    try {
      const antwort = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'primevideo',
          url: eintrag.url,
          sprachen,
          befund: deutsch ? 'ja' : 'nein',
          titel: eintrag.titel,
          notiz: `Amazon-Seite ${asin()}: ${folgen} Folgen, Abos: ${abos().join(', ') || 'keine Angabe'}`,
        }),
      })
      knopf.textContent = antwort.ok ? '✓ gemeldet' : `Fehler ${antwort.status}`
    } catch (err) {
      knopf.textContent = `Nicht erreichbar: ${err.message}`
    }
    setTimeout(() => {
      letzterStand = ''
      knopf.disabled = false
      zeichnen()
    }, 2500)
  })
})()
