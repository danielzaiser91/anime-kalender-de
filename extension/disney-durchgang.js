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
 *   leere Antwort), wird übersprungen und steht am Ende in der Liste. Nur wenn Disney+ selbst
 *   sagt „nicht in deinem Gebiet" oder auf die Startseite umleitet, meldet der Lauf den Titel
 *   als „weg" (wie der Knopf „nichts da?") — sonst bliebe die Wiedervorlage ewig offen (13.10.2026).
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

  /** Die Angaben der Endanzeige (`endeText`). */
  const endeInfo = (lauf, grund) => ({
    grund,
    erledigt: lauf.erledigt.length,
    uebersprungen: lauf.uebersprungen,
    schon: lauf.schon ?? [],
    weg: lauf.weg ?? [],
  })

  /**
   * Disney+ führt den Titel hier nicht: als „weg" melden, dann erst abhaken. Eine zweite Meldung
   * desselben Titels verhindert `wegFuer`; nach der Antwort zählt der Lauf von jetzt (er kann
   * von Hand beendet worden sein).
   */
  function wegMelden(lauf, grund, { lesen, schreiben, meldeWeg, abhaken }) {
    if (lauf.wegFuer === lauf.aktuell) return
    lauf.wegFuer = lauf.aktuell
    schreiben(lauf)
    const url = lauf.aktuell
    Promise.resolve(meldeWeg(url)).then((ok) => {
      const frisch = lesen()
      if (frisch?.aktuell !== url) return
      if (!ok) return abhaken(frisch, `${grund}, Meldung kam nicht an`)
      frisch.weg = [...(frisch.weg ?? []), url]
      abhaken(frisch, null)
    })
  }

  /** Die Ablauflogik ohne Browser — `disney-durchgang.test.cjs` spielt sie im Sandkasten. */
  function durchgang({ speicher, jetzt, offene, oeffne, melde, meldeWeg, ende, zustand = () => ({}), limit = () => null }) {
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
      const info = endeInfo(lauf, grund)
      try {
        speicher.removeItem(LAUF)
        speicher.setItem(ENDE, JSON.stringify(info))
      } catch {
        /* Das Ende wird trotzdem angezeigt. */
      }
      ende(info)
    }
    function weiter(lauf) {
      /* Das Tageslimit des Workers (tageslimit.js) hält den Durchgang an, statt Meldungen ins Leere zu schicken. */
      if (limit()) return beenden(lauf, limit())
      const naechster = offene().find((e) => !lauf.erledigt.includes(e.url))
      if (!naechster) return beenden(lauf, 'nichts mehr offen')
      lauf.aktuell = naechster.url
      lauf.seiteSeit = jetzt()
      lauf.meldet = false
      schreiben(lauf)
      oeffne(naechster)
    }
    function abhaken(lauf, uebersprungen, schon = false) {
      if (uebersprungen) lauf.uebersprungen.push({ url: lauf.aktuell, grund: uebersprungen })
      /* Schon gemeldet ist kein Überspringen: Der Titel war beantwortet, nur die Liste wusste es nicht. */
      if (schon) (lauf.schon ??= []).push(lauf.aktuell)
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
        if (!(d.zuMelden > 0)) return abhaken(lauf, d.fehler ? `keine Antwort (${d.fehler})` : null, d.schon > 0)
        lauf.meldet = true
        schreiben(lauf)
        melde()
      },
      gemeldet(d) {
        const lauf = lesen()
        if (lauf?.meldet && !d?.ok && limit()) return beenden(lauf, limit())
        if (lauf?.meldet) abhaken(lauf, d?.ok ? null : 'Meldung kam nicht an')
      },
      takt() {
        const lauf = lesen()
        if (!lauf?.aktuell) return
        const seit = jetzt() - lauf.seiteSeit
        const z = zustand()
        /* Disney+ sagt es selbst („nicht in deinem Gebiet verfügbar", Dialog mit „OK"): kein Warten auf die Schonzeit der Startseite. */
        if (z.gebiet && seit > 1000) return wegMelden(lauf, 'nicht in deinem Gebiet verfügbar', { lesen, schreiben, meldeWeg, abhaken })
        /* Disney+ leitet einen nicht verfügbaren Titel auf die Startseite um (Dialog „Je nach Standort …"). */
        if (z.startseite && seit > ANKOMMEN_MS) return wegMelden(lauf, 'nicht verfügbar (Startseite)', { lesen, schreiben, meldeWeg, abhaken })
        /* Eine andere Titelseite heißt: Daniel hat übernommen — der Lauf zieht ihm den Tab nicht weg. */
        if (z.kennung && z.eintragUrl !== lauf.aktuell && seit > ANKOMMEN_MS) return beenden(lauf, 'von Hand übernommen')
        if (seit > SEITE_HOECHSTENS_MS) abhaken(lauf, 'kein Ergebnis nach 3 Minuten')
      },
    }
  }
  /** Der Text der Endanzeige: je übersprungenem Titel eine Zeile mit Grund — `titelFuer(url)` liefert den Namen. */
  function endeText({ grund, erledigt, uebersprungen, schon = [], weg = [] }, titelFuer) {
    const kopf = `Durchgang ${grund === 'nichts mehr offen' ? 'fertig' : 'beendet'} · ${erledigt} Titel${grund.startsWith('Tageslimit') ? ` — ${grund}` : ''}`
    const bereits =
      (schon.length ? `\n${schon.length} schon gemeldet: ${schon.map(titelFuer).join(', ')}` : '') +
      (weg.length ? `\n${weg.length} nicht verfügbar gemeldet: ${weg.map(titelFuer).join(', ')}` : '')
    if (!uebersprungen.length) return kopf + bereits
    const zeilen = uebersprungen.map((u) => `• ${titelFuer(u.url)}: ${u.grund}`)
    return `${kopf}${bereits}\n${uebersprungen.length} übersprungen:\n${zeilen.join('\n')}`
  }
  /**
   * Zeigt die Seite Disney+' Hinweis „Dieser Inhalt ist zurzeit nicht in deinem Gebiet verfügbar."?
   * Nur der deutsche Wortlaut ist belegt (Daniel, 13.10.2026, `/de-de/home`); ein Fehlercode in der
   * Netzwerkantwort liegt nicht vor.
   */
  const gebietGesperrt = (text) => /nicht in deinem Gebiet verfügbar/i.test(String(text ?? ''))
  globalThis.akDisneyDurchgang = durchgang
  globalThis.akDisneyEndeText = endeText
  globalThis.akDisneyGebietGesperrt = gebietGesperrt
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
    meldeWeg: (url) => seite()?.meldeWeg(url) ?? false,
    ende: (info) => seite()?.zeigeEnde(info),
    zustand: () => ({ ...seite()?.zustand(), gebiet: gebietGesperrt(document.body?.innerText) }),
    limit: () => globalThis.AK_TAGESLIMIT?.text() ?? null,
  })
  globalThis.AK_DISNEY_DURCHGANG = lauf
  document.addEventListener('ak-disney-geprueft', (ev) => lauf.geprueft(ev.detail))
  document.addEventListener('ak-disney-gemeldet', (ev) => lauf.gemeldet(ev.detail))
  setInterval(lauf.takt, 5000)
})()
