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
 *   Entscheidung von Hand: Der Lauf meldet nichts an den Worker (Disney+ kennt drei Gründe für
 *   ein Nein, `quellen.md`). Sagt Disney+ selbst „nicht in deinem Gebiet" oder leitet auf die
 *   Startseite um, merkt sich der Lauf das nur lokal (`zurueckstellung`, 7 Tage), damit nicht
 *   jeder Durchgang dieselben Titel wieder öffnet (13.10.2026).
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

  /* Wie lange ein Titel nach „nicht verfügbar" im Durchgang ruht; danach fragt der Lauf wieder (Disney+ kann ihn aufnehmen). */
  const ZURUECK = 'ak-disney-zurueck'
  const ZURUECK_MS = 7 * 24 * 60 * 60 * 1000

  /**
   * Das lokale Gedächtnis (`dauer` = localStorage, über Durchgänge hinweg): Adresse → Zeit, zu der
   * ein Durchgang „nicht verfügbar" sah. Es ändert nichts am Worker und nichts an der Wiedervorlage.
   */
  function zurueckstellung({ dauer, jetzt }) {
    const lesen = () => {
      try {
        return JSON.parse(dauer.getItem(ZURUECK) ?? '{}')
      } catch {
        return {}
      }
    }
    const gilt = (url) => jetzt() - (lesen()[url] ?? -Infinity) < ZURUECK_MS
    return {
      gilt,
      /** Bis wann (ms) die Rückstellung gilt; `null`, wenn der Titel nicht zurückgestellt ist. */
      bis: (url) => (gilt(url) ? lesen()[url] + ZURUECK_MS : null),
      merke(url) {
        const frisch = Object.fromEntries(Object.entries(lesen()).filter(([u]) => gilt(u)))
        try {
          dauer.setItem(ZURUECK, JSON.stringify({ ...frisch, [url]: jetzt() }))
        } catch {
          /* Ohne Speicher gilt die Rückstellung nur für diesen Lauf (`erledigt`). */
        }
      },
      /** Die zurückgestellten unter den offenen Einträgen, die dieser Lauf nicht selbst abgehakt hat. */
      uebrige: (offene, erledigt) => offene.filter((e) => !erledigt.includes(e.url) && gilt(e.url)).map((e) => e.url),
    }
  }

  /** Die Angaben der Endanzeige (`endeText`). */
  const endeInfo = (lauf, grund, zurueck) => ({
    grund,
    erledigt: lauf.erledigt.length,
    uebersprungen: lauf.uebersprungen,
    schon: lauf.schon ?? [],
    gebiet: lauf.gebiet ?? [],
    zurueck,
  })

  /**
   * Der Hinweistext „nicht in deinem Gebiet verfügbar" ist Disney+' eigene Auskunft und der einzige
   * Fall, den der Durchgang meldet (Daniel, 21.10.2026: sechs von Hand geprüfte Titel blieben in der
   * Liste). Startseiten-Umleitung und Zeitablauf melden weiter nichts (Rooster Fighter, 13.10.2026).
   */
  function gebietMelden({ lauf, meldeGebiet, lesen, schreiben, zurueck, nichtDa, abhaken }) {
    const url = lauf.aktuell
    lauf.meldet = true
    schreiben(lauf)
    Promise.resolve(meldeGebiet(url)).catch(() => false).then((ok) => {
      const jetztLauf = lesen()
      if (jetztLauf?.aktuell !== url) return
      if (!ok) return nichtDa(jetztLauf, 'nicht in deinem Gebiet verfügbar (Meldung kam nicht an)')
      zurueck.merke(url)
      jetztLauf.gebiet = [...(jetztLauf.gebiet ?? []), url]
      abhaken(jetztLauf, null)
    })
  }

  /** Die Ablauflogik ohne Browser — `disney-durchgang.test.cjs` spielt sie im Sandkasten. */
  function durchgang({ speicher, dauer, seitenStart = Infinity, jetzt, offene, oeffne, melde, meldeGebiet = async () => false, ende, zustand = () => ({}), limit = () => null }) {
    const zurueck = zurueckstellung({ dauer, jetzt })
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
      const info = endeInfo(lauf, grund, zurueck.uebrige(offene(), lauf.erledigt))
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
      const naechster = offene().find((e) => !lauf.erledigt.includes(e.url) && !zurueck.gilt(e.url))
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
    /* Disney+ führt den Titel hier offenbar nicht: lokal merken und weiter — gemeldet wird nichts. */
    function nichtDa(lauf, grund) {
      zurueck.merke(lauf.aktuell)
      abhaken(lauf, grund)
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
        /* Eine Seite, die vor dem Öffnen des Ziels geladen wurde, läuft bis zum Seitenwechsel weiter: ihr Zustand gehört dem Titel davor. */
        const z = seitenStart >= lauf.seiteSeit ? zustand() : {}
        /* Disney+ sagt es selbst („nicht in deinem Gebiet verfügbar", Dialog mit „OK"): kein Warten auf die Schonzeit der Startseite. */
        if (z.gebiet && seit > 1000 && !lauf.meldet) return gebietMelden({ lauf, meldeGebiet, lesen, schreiben, zurueck, nichtDa, abhaken })
        /* Disney+ leitet einen nicht verfügbaren Titel auf die Startseite um (Dialog „Je nach Standort …"). */
        if (z.startseite && seit > ANKOMMEN_MS) return nichtDa(lauf, 'nicht verfügbar (Startseite)')
        /* Eine andere Titelseite heißt: Daniel hat übernommen — der Lauf zieht ihm den Tab nicht weg. */
        if (z.kennung && z.eintragUrl !== lauf.aktuell && seit > ANKOMMEN_MS) return beenden(lauf, 'von Hand übernommen')
        if (seit > SEITE_HOECHSTENS_MS) abhaken(lauf, 'kein Ergebnis nach 3 Minuten')
      },
    }
  }
  /** Der Text der Endanzeige: je übersprungenem Titel eine Zeile mit Grund — `titelFuer(url)` liefert den Namen. */
  function endeText({ grund, erledigt, uebersprungen, schon = [], gebiet = [], zurueck = [] }, titelFuer) {
    const kopf = `Durchgang ${grund === 'nichts mehr offen' ? 'fertig' : 'beendet'} · ${erledigt} Titel${grund.startsWith('Tageslimit') ? ` — ${grund}` : ''}`
    const bereits =
      (schon.length ? `\n${schon.length} schon gemeldet: ${schon.map(titelFuer).join(', ')}` : '') +
      (gebiet.length ? `\n${gebiet.length} als „nicht in deinem Gebiet verfügbar“ gemeldet: ${gebiet.map(titelFuer).join(', ')}` : '') +
      (zurueck.length ? `\n${zurueck.length} zurückgestellt (7 Tage, Disney+ zeigte „nicht verfügbar"): ${zurueck.map(titelFuer).join(', ')}` : '')
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
  globalThis.akDisneyZurueckBis = (dauer, url, jetzt) => zurueckstellung({ dauer, jetzt: () => jetzt }).bis(url)
  /**
   * Zählung der Liste: zurückgestellte Titel sind nicht offen (Daniel, 31.10.2026: Anzeige „6 zurückgestellt“ neben „6 offen“).
   * `bisFuer(url)` liefert das Ende der Rückstellung oder `null`; `bis` ist das früheste Ende.
   */
  globalThis.akDisneyZaehlung = (eintraege, istErledigt, bisFuer) => {
    const ruhend = eintraege.filter((e) => !istErledigt(e) && bisFuer(e.url) !== null)
    const bis = ruhend.length ? Math.min(...ruhend.map((e) => bisFuer(e.url))) : null
    return { offen: eintraege.filter((e) => !istErledigt(e)).length - ruhend.length, zurueck: ruhend.length, bis }
  }
  const tag = (ms) => new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Berlin' })
  globalThis.akDisneyBisText = (ms) => `bis ${tag(ms)}`
  /** Kopfzeile der Liste. */
  globalThis.akDisneyKopfText = (z) =>
    z.offen ? `${z.offen} Titel zu prüfen` : z.zurueck ? `${z.zurueck} zurückgestellt ${globalThis.akDisneyBisText(z.bis)}` : 'Alles gemeldet'
  /** Zeile eines offenen Titels: zurückgestellt mit Datum, sonst was der Bestand erwartet (mit „ca.“ — Disney+ teilt Staffeln anders ein). */
  globalThis.akDisneyZeilenText = (e, bis) => {
    if (bis !== null) return `zurückgestellt ${globalThis.akDisneyBisText(bis)} (Disney+ zeigte „nicht verfügbar“)`
    const folgen = e.staffeln.filter((st) => st.offen).reduce((n, st) => n + (st.folgen ?? 0), 0)
    return `${e.offen} Staffel${e.offen === 1 ? '' : 'n'}` + (folgen ? `, ca. ${folgen} Folgen` : '')
  }
  /** Text der Pille am Kasten. */
  globalThis.akDisneyPilleText = (offen, z) => {
    const ruhend = z.zurueck ? `${z.zurueck} zurückgestellt ${globalThis.akDisneyBisText(z.bis)}` : ''
    if (offen) return `Anime-Kalender: ${offen} offen${ruhend ? ` · ${ruhend}` : ''}`
    return `Anime-Kalender: ${ruhend || 'alles gemeldet ✓'}`
  }
  globalThis.akDisneyEndeText = endeText
  globalThis.akDisneyGebietGesperrt = gebietGesperrt
  if (typeof document === 'undefined' || typeof location === 'undefined') return

  const seite = () => globalThis.AK_DISNEY
  const lauf = durchgang({
    speicher: sessionStorage,
    dauer: localStorage,
    seitenStart: Date.now(),
    jetzt: () => Date.now(),
    offene: () => seite()?.offene() ?? [],
    oeffne: (e) => {
      seite()?.merkeZiel(e.id)
      location.href = e.url
    },
    melde: () => void seite()?.melden(),
    meldeGebiet: (url) => seite()?.meldeGebiet(url),
    ende: (info) => seite()?.zeigeEnde(info),
    zustand: () => ({ ...seite()?.zustand(), gebiet: gebietGesperrt(document.body?.innerText) }),
    limit: () => globalThis.AK_TAGESLIMIT?.text() ?? null,
  })
  globalThis.AK_DISNEY_DURCHGANG = lauf
  document.addEventListener('ak-disney-geprueft', (ev) => lauf.geprueft(ev.detail))
  document.addEventListener('ak-disney-gemeldet', (ev) => lauf.gemeldet(ev.detail))
  setInterval(lauf.takt, 5000)
})()
