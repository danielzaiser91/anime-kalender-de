/**
 * **„▶ alle durchgehen" für Disney+** (27.09.2026).
 *
 * Daniel am 25.09.2026: „hier wäre alles durchgehen trotzdem nice, dann kann er im hintergrund
 * weiter sammeln, während ich tab wechsele". Disney+ braucht keinen Player: Die Titelseite prüft
 * alle Folgen selbst (`disney.js`, `vielleichtPruefen`) und bietet danach „▸ … melden" an. Der
 * Durchgang tut nur, was Daniel von Hand täte — Titel öffnen, auf das Ergebnis warten, melden,
 * weiter. Kein zweiter Meldeweg: gemeldet wird über dieselbe Funktion wie beim Klick.
 *
 * - **Die sichtbare Seite navigiert** von Titel zu Titel. Frames wie bei Prime gehen hier nicht,
 *   Disney+ ist eine Einzelseiten-App mit Anmeldung.
 * - **Der Lauf gehört dem Tab** (`sessionStorage`), endet nach zwei Stunden und spätestens, wenn
 *   nichts mehr offen ist. Ein Titel, der nach drei Minuten kein Ergebnis hat (Umleitung, Fehlerseite,
 *   leere Antwort), wird übersprungen und steht am Ende in der Liste — „nicht da" bleibt eine
 *   Entscheidung von Hand.
 * - `disney.js` meldet über zwei Ereignisse: `ak-disney-geprueft` ({ url, zuMelden, fehler }) und
 *   `ak-disney-gemeldet` ({ ok }).
 */
;(() => {
  const LAUF = 'ak-disney-lauf'
  const ENDE = 'ak-disney-lauf-ende'
  const LAUF_HOECHSTENS_MS = 2 * 60 * 60 * 1000
  const SEITE_HOECHSTENS_MS = 3 * 60 * 1000
  /* Zeit, die eine Seite zum Laden und Umleiten bekommt, bevor ihr Zustand zählt. */
  const ANKOMMEN_MS = 10_000

  /** Die Ablauflogik ohne Browser — `disney-durchgang.test.cjs` spielt sie im Sandkasten. */
  function durchgang({ speicher, jetzt, offene, oeffne, melde, ende, zustand = () => ({}) }) {
    const lesen = () => {
      try {
        const lauf = JSON.parse(speicher.getItem(LAUF) ?? 'null')
        return lauf && jetzt() - lauf.seit <= LAUF_HOECHSTENS_MS ? lauf : null
      } catch {
        return null
      }
    }
    const schreiben = (lauf) => {
      try {
        speicher.setItem(LAUF, JSON.stringify(lauf))
      } catch {
        /* Ohne Speicher endet der Lauf mit dem nächsten Seitenwechsel. */
      }
    }
    function beenden(lauf, grund) {
      const info = { grund, erledigt: lauf.erledigt.length, uebersprungen: lauf.uebersprungen }
      try {
        speicher.removeItem(LAUF)
        speicher.setItem(ENDE, JSON.stringify(info))
      } catch {
        /* Das Ende wird trotzdem angezeigt. */
      }
      ende(info)
    }
    function weiter(lauf) {
      const naechster = offene().find((e) => !lauf.erledigt.includes(e.url))
      if (!naechster) return beenden(lauf, 'nichts mehr offen')
      lauf.aktuell = naechster.url
      lauf.seiteSeit = jetzt()
      lauf.meldet = false
      schreiben(lauf)
      oeffne(naechster)
    }
    function abhaken(lauf, uebersprungen) {
      if (uebersprungen) lauf.uebersprungen.push({ url: lauf.aktuell, grund: uebersprungen })
      lauf.erledigt.push(lauf.aktuell)
      weiter(lauf)
    }
    return {
      laeuft: () => Boolean(lesen()),
      starten: () => weiter({ seit: jetzt(), erledigt: [], uebersprungen: [], aktuell: null }),
      beenden() {
        const lauf = lesen()
        if (lauf) beenden(lauf, 'von Hand')
      },
      geprueft(d) {
        const lauf = lesen()
        if (!lauf || lauf.meldet || d?.url !== lauf.aktuell) return
        if (!(d.zuMelden > 0)) return abhaken(lauf, d.fehler ? `keine Antwort (${d.fehler})` : null)
        lauf.meldet = true
        schreiben(lauf)
        melde()
      },
      gemeldet(d) {
        const lauf = lesen()
        if (lauf?.meldet) abhaken(lauf, d?.ok ? null : 'Meldung kam nicht an')
      },
      takt() {
        const lauf = lesen()
        if (!lauf?.aktuell) return
        const seit = jetzt() - lauf.seiteSeit
        const z = zustand()
        /* Disney+ leitet einen nicht verfügbaren Titel auf die Startseite um (Dialog „Je nach Standort …"). */
        if (z.startseite && seit > ANKOMMEN_MS) return abhaken(lauf, 'nicht verfügbar (Startseite)')
        /* Eine andere Titelseite heißt: Daniel hat übernommen — der Lauf zieht ihm den Tab nicht weg. */
        if (z.kennung && z.eintragUrl !== lauf.aktuell && seit > ANKOMMEN_MS) return beenden(lauf, 'von Hand übernommen')
        if (seit > SEITE_HOECHSTENS_MS) abhaken(lauf, 'kein Ergebnis nach 3 Minuten')
      },
    }
  }
  globalThis.akDisneyDurchgang = durchgang
  if (typeof document === 'undefined' || typeof location === 'undefined') return

  const seite = () => globalThis.AK_DISNEY
  const lauf = durchgang({
    speicher: sessionStorage,
    jetzt: () => Date.now(),
    offene: () => seite()?.offene() ?? [],
    oeffne: (e) => {
      seite()?.merkeZiel(e.id)
      location.href = e.url
    },
    melde: () => void seite()?.melden(),
    ende: (info) => seite()?.zeigeEnde(info),
    zustand: () => seite()?.zustand() ?? {},
  })
  globalThis.AK_DISNEY_DURCHGANG = lauf
  document.addEventListener('ak-disney-geprueft', (ev) => lauf.geprueft(ev.detail))
  document.addEventListener('ak-disney-gemeldet', (ev) => lauf.gemeldet(ev.detail))
  setInterval(lauf.takt, 5000)
})()
