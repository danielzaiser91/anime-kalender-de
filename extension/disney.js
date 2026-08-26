/**
 * Disney+: prüfen ohne Player, melden auf Klick, nichts doppelt.
 *
 * Der Weg steht in `disney-leser.js` — ein POST je Folge, Tonspuren im
 * Klartext, kein Eintrag unter „Weiterschauen".
 *
 * Dieser Teil sagt, **was noch fehlt**, und zwar in Bereichen statt in Sätzen:
 *
 *     grün  1e1-15
 *     grau  1e16-51, 2e1-35
 *
 * Daniels Vorgabe am 26.08.2026: „außerdem ist es zuviel text, also grün:
 * 1e1-15, grau: 1e16-51, 2e1-35." Eine Zeile beantwortet damit beide Fragen —
 * was erledigt ist und was ansteht — ohne dass jemand rechnen muss.
 *
 * **Was der Worker übernommen hat, verschwindet von selbst.** Die Bereiche
 * kommen aus dem Briefkasten, nicht aus einem eigenen Gedächtnis: Sobald der
 * stündliche Lauf die Meldungen abgeholt hat, ist der grüne Teil weg und der
 * graue steht allein da. Genau so soll es sein — die Ferne ist die Quelle.
 */
;(() => {
  const MARKE = 'ak-disney'
  const MARKE_STEUER = 'ak-disney-steuer'
  const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'
  /* Abstand zwischen zwei Abrufen — die Seite selbst macht einen je Klick. */
  const TAKT = 300

  /**
   * Die Kennung einer Disney+-Adresse.
   *
   * Zwei Formen, weil Disney+ dieselbe Serie unter beiden führt: 27 Verweise in
   * unserem Bestand tragen `/browse/entity-<uuid>`, 19 `/series/<slug>/<id>`.
   * Dieselbe Regel steht in `tools/extension-offene-disney.mjs`;
   * `disney.test.cjs` hält beide gegeneinander.
   */
  function kennung(url) {
    return (
      /\/browse\/entity-([0-9a-f-]{8,})/i.exec(url)?.[1] ??
      /\/(?:series|movies)\/[^/]+\/([A-Za-z0-9]{6,})/.exec(url)?.[1] ??
      null
    )
  }

  /**
   * Der Schlüssel einer Folge — **mit Staffel**.
   *
   * Der erste Anlauf merkte sich nur die Folgennummer. Bei Beyblade X waren
   * S1E1-15 gemeldet, und damit galten **S2E1-15** als erledigt: Der Durchlauf
   * übersprang sie, und im Briefkasten landeten Staffel 1 vollständig und
   * Staffel 2 erst ab Folge 16 (gemessen am 26.08.2026, nachdem Daniel fragte:
   * „2e16? wo sind die ersten 15 von s2?").
   *
   * Jede Staffel zählt bei Disney+ ab 1. Eine Nummer allein ist deshalb keine
   * Kennung, sondern ein Namensvetter.
   */
  const folgenSchluessel = (staffel, nummer) => `${staffel ?? 1}e${nummer}`

  /**
   * Zusammenhängende Folgen als Bereich: `[1,2,3,7]` → `1-3, 7`.
   *
   * Fünfzig Nummern nebeneinander liest niemand; drei Bereiche schon.
   */
  function bereiche(nummern) {
    const sortiert = [...new Set(nummern)].sort((a, b) => a - b)
    if (!sortiert.length) return ''
    const teile = []
    let von = sortiert[0]
    let bis = sortiert[0]
    for (const n of sortiert.slice(1)) {
      if (n === bis + 1) {
        bis = n
        continue
      }
      teile.push(von === bis ? `${von}` : `${von}-${bis}`)
      von = n
      bis = n
    }
    teile.push(von === bis ? `${von}` : `${von}-${bis}`)
    return teile.join(', ')
  }

  /** Folgen je Staffel als `1e1-15, 2e1-35` — bei einem Film schlicht „Film". */
  function nachStaffeln(eintraege) {
    if (eintraege.length === 1 && eintraege[0].film) return 'Film'
    const jeStaffel = new Map()
    for (const f of eintraege) {
      const nr = f.staffel ?? 1
      jeStaffel.set(nr, [...(jeStaffel.get(nr) ?? []), f.nummer])
    }
    return [...jeStaffel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([nr, nummern]) => `${nr}e${bereiche(nummern)}`)
      .join(', ')
  }

  /**
   * Wann der nächste Lauf die Meldungen übernimmt.
   *
   * `refresh-hourly.yml` läuft zur Minute 23 und ruft dort `data:pruefungen`
   * auf — der Schritt, der den Briefkasten leert. Ohne die Uhrzeit ist von
   * außen nicht zu unterscheiden, ob der Lauf noch aussteht oder seine Arbeit
   * nicht getan hat. GitHub startet geplante Läufe oft ein paar Minuten später,
   * deshalb „ab", nicht „um".
   */
  function naechsteUebernahme(jetzt = new Date()) {
    const ziel = new Date(jetzt)
    ziel.setSeconds(0, 0)
    ziel.setMinutes(23)
    if (ziel <= jetzt) ziel.setTime(ziel.getTime() + 3600000)
    return ziel
  }

  const uhrzeit = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const liste = globalThis.AK_OFFENE_DISNEY ?? {}
  /*
    `undefined`, nicht `null` — sonst erkennt der erste Durchlauf auf einer
    Seite ohne Kennung keinen Wechsel (`null === null`), und der Knopf erscheint
    erst nach einer Navigation („ein reload auf homepage zeigt anime-kalender
    button nicht an", 26.08.2026).
  */
  let seite
  let eintrag = null
  let folgen = []
  let anbieterStaffeln = []
  let erwartet = 0
  let bereit = false
  let angefordert = false
  let gelaufen = false
  let ergebnisse = []
  let gemeldeteNummern = new Set()
  const offeneFragen = new Map()
  /** Je Adresse die gemeldeten Folgennummern — für die Liste. */
  let briefkasten = new Map()

  // --- Brücke zur Seitenwelt ------------------------------------------------

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.marke !== MARKE) return
    if (e.data.antwortFuer) {
      offeneFragen.get(e.data.antwortFuer)?.(e.data)
      offeneFragen.delete(e.data.antwortFuer)
      return
    }
    if (Array.isArray(e.data.folgen)) folgen = e.data.folgen
    if (Array.isArray(e.data.staffeln)) anbieterStaffeln = e.data.staffeln
    if (Number.isFinite(e.data.erwartet)) erwartet = e.data.erwartet
    if (e.data.bereit) bereit = true

    if (!eintrag) return

    /*
      **Die Anforderung wird wiederholt, solange sie auf ein Hindernis trifft.**

      Der erste Anlauf setzte `angefordert` und war fertig damit. Fehlte in dem
      Moment noch das Token, stieg der Leser stumm aus — und nebenan stand für
      immer „sammle Folgen … 86/86". Daniel am 26.08.2026: „sammelt er oder
      lügt er? … nichts passiert auch nach mehreren minuten nicht."

      Jetzt nennt der Leser sein Hindernis, und der nächste Anlass — ein
      weiterer Aufruf der Seite — versucht es erneut.
    */
    if (e.data.hindernis) {
      angefordert = false
      zeigePruefung(`${eintrag.titel}\nwarte auf die Seite (${e.data.hindernis}) …`)
      return
    }
    if (bereit && !angefordert) {
      angefordert = true
      /* Ein Film ist mit einer Kennung vollständig — nichts nachzuladen. */
      if (folgen.length === 1 && folgen[0].film) return void vielleichtPruefen()
      window.postMessage({ marke: MARKE_STEUER, allesHolen: true }, '*')
      zeigePruefung(`${eintrag.titel}\nsammle Folgen …`, { laeuft: true })
      return
    }
    /*
      **Losgelegt wird, wenn die Folgen da sind — nicht, wenn ein Signal kommt.**

      Der erste Anlauf wartete auf `vollstaendig`. Blieb das aus, stand der Knopf
      bei „sammle Folgen … 86/86, 71 gemeldet, 15 zu prüfen" und rührte sich
      nicht mehr; Daniel hat fünf Minuten zugesehen (26.08.2026). Ein Signal
      kann ausbleiben, eine Zahl nicht: Sind so viele Folgen beisammen, wie die
      Staffeln zusammen ansagen, gibt es nichts mehr zu sammeln.

      `vollstaendig` bleibt als zweiter Weg — wo eine Staffel weniger liefert,
      als sie ansagt, ist es der einzige.
    */
    const beisammen = erwartet > 0 && folgen.length >= erwartet
    if (!e.data.vollstaendig && !beisammen) {
      if (erwartet) {
        const offen = Math.max(0, erwartet - gemeldeteNummern.size)
        zeigePruefung(
          `${eintrag.titel}\nsammle Folgen … ${folgen.length}/${erwartet}` +
            (gemeldeteNummern.size ? `\n${gemeldeteNummern.size} gemeldet, ${offen} zu prüfen` : ''),
          { laeuft: true },
        )
      }
      return
    }
    void vielleichtPruefen()
  })

  /**
   * Arbeitet eine Liste in mehreren Bahnen ab.
   *
   * Nacheinander mit 300 ms Pause brauchten 56 Folgen über eine Minute, und
   * beim Melden zählte der Knopf sichtbar durch (Daniel, 26.08.2026:
   * „beschleunige das"). Die Antwortzeit liegt bei rund 200 ms je Aufruf, also
   * wartet der Ablauf die meiste Zeit.
   *
   * Fünf Bahnen sind ein Kompromiss: schnell genug, dass niemand zusieht, und
   * weit entfernt von dem, was ein Mensch beim Durchklicken auslösen würde.
   * Die Reihenfolge bleibt erhalten, weil jedes Ergebnis an seinen Platz
   * zurückgeschrieben wird.
   */
  const BAHNEN = 5
  async function inBahnen(liste, arbeit, melde) {
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
    await Promise.all(Array.from({ length: Math.min(BAHNEN, liste.length) }, bahn))
    return raus
  }

  const frage = (playbackId) =>
    new Promise((fertig) => {
      offeneFragen.set(playbackId, fertig)
      window.postMessage({ marke: MARKE_STEUER, playbackId }, '*')
      setTimeout(() => {
        if (offeneFragen.delete(playbackId)) fertig({ fehler: 'keine Antwort' })
      }, 15000)
    })

  // --- Die beiden Knöpfe ----------------------------------------------------

  const KNOPF_STIL =
    'position:fixed;right:16px;z-index:2147483000;border-radius:8px;' +
    'border:1px solid #ffffff33;background:#111;color:#fff;text-align:left;' +
    'font:12px/1.35 system-ui,sans-serif;max-width:340px;white-space:pre-line'

  let pruefKnopf = null
  /*
    Ein Lebenszeichen: Ohne es sieht ein Knopf, der zwei Minuten „sammle Folgen"
    sagt, aus wie einer, der hängt (Daniel, 26.08.2026: „sammelt er oder lügt
    er?"). Die Zeichen wechseln jede halbe Sekunde, solange nichts anderes
    angezeigt wird.
  */
  const ZEICHEN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let dreher = null
  let dreherText = ''
  function drehe(text) {
    dreherText = text
    if (dreher) return
    let i = 0
    dreher = setInterval(() => {
      if (!pruefKnopf) return
      pruefKnopf.textContent = `${ZEICHEN[i++ % ZEICHEN.length]} ${dreherText}`
    }, 500)
  }
  function haltAn() {
    if (dreher) clearInterval(dreher)
    dreher = null
  }

  function zeigePruefung(text, { klasse = null, klick = null, laeuft = false } = {}) {
    if (!pruefKnopf) {
      pruefKnopf = document.createElement('button')
      pruefKnopf.type = 'button'
      pruefKnopf.style.cssText = KNOPF_STIL + ';bottom:58px;padding:9px 15px;font-size:13px'
      document.body.appendChild(pruefKnopf)
    }
    if (laeuft) drehe(text)
    else {
      haltAn()
      pruefKnopf.textContent = text
    }
    pruefKnopf.style.background =
      klasse === 'gut' ? '#14532d' : klasse === 'schlecht' ? '#7f1d1d' : '#111'
    pruefKnopf.style.cursor = klick ? 'pointer' : 'default'
    pruefKnopf.disabled = !klick
    pruefKnopf.onclick = klick
  }

  // --- Übersicht ------------------------------------------------------------

  let uebersichtKnopf = null
  let dialog = null
  /* Gemeldetes bleibt eingeklappt, bis jemand danach fragt. */
  let zeigeErledigte = false

  /**
   * Ist zu diesem Titel alles gemeldet, was Disney+ führt?
   *
   * „Alles" heißt hier: mindestens eine Meldung, und keine Folge mehr offen,
   * soweit wir das wissen. Ein Titel mit „nichts da" zählt ebenfalls als
   * erledigt — er ist beantwortet, nur eben mit Nein.
   *
   * Der Wert kommt aus dem Briefkasten, nicht aus einem eigenen Gedächtnis:
   * Sobald der stündliche Lauf die Meldungen übernommen hat, ist der Eintrag
   * hier wieder offen — und das ist richtig so, denn dann steht die Antwort im
   * Datensatz und der Titel fällt bei der nächsten Listenerzeugung heraus.
   */
  function istErledigt(e) {
    return briefkasten.has(e.url)
  }

  function offeneEintraege() {
    return Object.entries(liste)
      .map(([id, wert]) => ({ id, ...wert, offen: wert.staffeln.filter((st) => st.offen).length }))
      .filter((e) => e.offen > 0)
      .sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
  }

  /*
    Welche Folgennummern zu jeder Adresse im Briefkasten liegen.

    Ein Abruf für alle 31 Titel, nicht einer je Titel. Ohne ihn sagt die Liste
    nichts darüber, was schon erledigt ist.
  */
  async function briefkastenHolen() {
    try {
      const antwort = await fetch(`${WORKER}?zaehlen=1&nummern=1`, { cache: 'no-store' })
      if (!antwort.ok) return
      const daten = await antwort.json()
      const gesammelt = new Map()
      /*
        Der Worker antwortet je nach Fassung mit `eintraege` (Adresse + Nummer)
        oder nur mit `adressen`. Beides wird gelesen; fehlt die Nummer, zählt
        der Eintrag trotzdem.
      */
      for (const e of daten.eintraege ?? []) {
        const dazu = gesammelt.get(e.url) ?? []
        /*
          Eine Meldung ohne Folgennummer ist keine Folge — „nichts da" trägt
          keine. Ohne diese Prüfung stand in der Liste „Aoashi 1e0" (Daniel,
          26.08.2026).
        */
        if (Number(e.folge_nr) > 0)
          dazu.push({ staffel: Number(e.staffel) || 1, nummer: Number(e.folge_nr) })
        gesammelt.set(e.url, dazu)
      }
      for (const url of daten.adressen ?? []) {
        if (!gesammelt.has(url)) gesammelt.set(url, [])
      }
      briefkasten = gesammelt
    } catch {
      /* Ohne Auskunft bleibt die Liste bei dem, was der Datensatz sagt. */
    }
  }

  function dialogSchliessen() {
    dialog?.remove()
    dialog = null
  }

  function dialogOeffnen() {
    if (dialog) return dialogSchliessen()
    const alle = offeneEintraege()
    const erledigte = alle.filter(istErledigt)
    const eintraege = zeigeErledigte ? alle : alle.filter((e) => !istErledigt(e))
    dialog = document.createElement('div')
    dialog.style.cssText =
      'position:fixed;right:16px;bottom:100px;z-index:2147483001;width:min(460px,92vw);' +
      'max-height:70vh;overflow:auto;background:#111;color:#fff;border:1px solid #ffffff33;' +
      'border-radius:10px;padding:14px 16px;font:13px/1.5 system-ui,sans-serif;' +
      'box-shadow:0 8px 32px #000a'

    const kopf = document.createElement('div')
    kopf.style.cssText = 'display:flex;align-items:baseline;gap:10px;margin-bottom:10px;flex-wrap:wrap'
    const titelzeile = document.createElement('strong')
    const nochOffen = alle.length - erledigte.length
    titelzeile.textContent = nochOffen ? `${nochOffen} Titel zu prüfen` : 'Alles gemeldet'
    kopf.appendChild(titelzeile)

    /* Wann das Gemeldete hier wieder verschwindet. */
    if ([...briefkasten.values()].some((n) => n.length >= 0) && briefkasten.size) {
      const lauf = document.createElement('span')
      lauf.style.cssText = 'font-size:11px;opacity:.65;margin-left:auto;white-space:nowrap'
      lauf.textContent = `Übernahme ab ${uhrzeit(naechsteUebernahme())}`
      lauf.title =
        'Der stündliche Datenlauf holt die Meldungen ab und schreibt sie in den Kalender. Danach sind die grünen Bereiche hier weg.'
      kopf.appendChild(lauf)
    }
    /*
      **Gemeldetes ist standardmäßig weg.**

      Es blieb sichtbar, damit erkennbar ist, was schon durch ist — bei einer
      Liste aus 31 Titeln ist das aber nur Ballast. Wer nachsehen will, klappt
      sie auf. Dieselbe Lösung wie bei Netflix (Daniel, 26.08.2026: „komplett
      gemeldete sollten ausgeblendet und togglebar sein in der liste (wie
      netflix)").
    */
    if (erledigte.length) {
      const umschalter = document.createElement('button')
      umschalter.type = 'button'
      umschalter.style.cssText =
        'padding:2px 9px;border-radius:6px;border:1px solid #ffffff33;background:none;' +
        'color:#fff;font:11px system-ui,sans-serif;cursor:pointer'
      const beschriften = () => {
        umschalter.textContent = zeigeErledigte
          ? `${erledigte.length} gemeldet ausblenden`
          : `${erledigte.length} gemeldet zeigen`
      }
      beschriften()
      umschalter.onclick = () => {
        zeigeErledigte = !zeigeErledigte
        dialogSchliessen()
        dialogOeffnen()
      }
      kopf.appendChild(umschalter)
    }

    const zu = document.createElement('button')
    zu.textContent = '×'
    zu.title = 'Schließen (Esc)'
    zu.style.cssText =
      'background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1'
    zu.onclick = dialogSchliessen
    kopf.appendChild(zu)
    dialog.appendChild(kopf)

    for (const e of eintraege) {
      const zeile = document.createElement('div')
      zeile.style.cssText = 'padding:6px 0;border-top:1px solid #ffffff1a'

      const verweis = document.createElement('a')
      verweis.href = e.url
      verweis.textContent = e.titel
      verweis.style.cssText = 'color:#7dd3fc;text-decoration:none'
      /*
        Wohin der Klick geht, weiß die Zielseite nachher nicht mehr — landet er
        auf der Fehlerseite, steht dort keine Kennung mehr in der Adresse.
        Deshalb wird sie beim Klick hinterlegt.
      */
      verweis.onclick = () => merkeZiel(e.id)
      zeile.appendChild(verweis)

      const gemeldet = briefkasten.get(e.url) ?? null
      if (gemeldet?.length) {
        const gruen = document.createElement('span')
        gruen.style.cssText = 'margin-left:8px;color:#4ade80'
        gruen.textContent = nachStaffeln(gemeldet)
        zeile.appendChild(gruen)
      } else {
        /*
          Ohne Meldung steht da, was unser Bestand erwartet — mit „ca.", weil
          unsere Staffelzählung von der des Anbieters abweicht (Beyblade X: bei
          uns eine Staffel, bei Disney+ zwei mit 51 und 35 Folgen).
        */
        const grau = document.createElement('span')
        grau.style.cssText = 'margin-left:8px;opacity:.6'
        const folgenZahl = e.staffeln
          .filter((st) => st.offen)
          .reduce((n, st) => n + (st.folgen ?? 0), 0)
        grau.textContent =
          `${e.offen} Staffel${e.offen === 1 ? '' : 'n'}` + (folgenZahl ? `, ca. ${folgenZahl} Folgen` : '')
        zeile.appendChild(grau)
      }

      /*
        **„Nicht da" gehört in die Liste, nicht auf die Titelseite.**

        Ist ein Titel in Deutschland nicht verfügbar, leitet Disney+ auf die
        Startseite um — dort gibt es keine Seite, auf der ein Knopf stehen
        könnte. Daniel am 26.08.2026: „aoashi button für nicht verfügbar hast du
        nicht eingebaut, hab ich vorher bereits gemeldet."
      */
      const wegKnopf = document.createElement('button')
      wegKnopf.type = 'button'
      wegKnopf.textContent = 'nichts da?'
      wegKnopf.style.cssText =
        'margin-left:8px;padding:1px 7px;border-radius:6px;border:1px solid #ffffff33;' +
        'background:none;color:#fca5a5;font:11px system-ui,sans-serif;cursor:pointer'
      wegKnopf.onclick = async (ev) => {
        ev.preventDefault()
        wegKnopf.disabled = true
        wegKnopf.textContent = '…'
        const ok = await meldeWeg(e)
        if (!ok) {
          wegKnopf.textContent = 'ging nicht'
          return
        }
        /*
          Die Zeile verschwindet erst, wenn die Ferne sie kennt — und sie
          verschwindet dann von selbst, weil die Liste den Briefkasten liest.
          Ohne diesen Schritt blieb der Titel stehen, obwohl die Meldung
          angekommen war (Daniel, 26.08.2026: „aoashi als nicht da gemeldet, und
          verschwindet trotzdem nicht aus der zu meldenden liste").
        */
        await briefkastenHolen()
        zeigeUebersicht()
        dialogSchliessen()
        dialogOeffnen()
      }
      zeile.appendChild(wegKnopf)

      dialog.appendChild(zeile)
    }
    document.body.appendChild(dialog)
  }

  function zeigeUebersicht() {
    const offen = offeneEintraege()
    if (!uebersichtKnopf) {
      uebersichtKnopf = document.createElement('button')
      uebersichtKnopf.type = 'button'
      uebersichtKnopf.style.cssText =
        KNOPF_STIL + ';bottom:16px;padding:7px 13px;cursor:pointer;opacity:.85'
      uebersichtKnopf.onclick = dialogOeffnen
      document.body.appendChild(uebersichtKnopf)
    }
    /*
      Gezählt wird der Titel, nicht die Meldung. Ein Titel, von dem 15 von 86
      Folgen gemeldet sind, ist weiter offen — „anime-kalender button sollte 31
      offen sagen, weil 1 nur teilweise gemeldet wurde" (Daniel, 26.08.2026).
    */
    const nochOffen = offen.filter((e) => !istErledigt(e)).length
    uebersichtKnopf.textContent = nochOffen
      ? `Anime-Kalender: ${nochOffen} offen`
      : 'Anime-Kalender: alles gemeldet ✓'
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialogSchliessen()
  })

  // --- Was schon gemeldet ist ----------------------------------------------

  async function gemeldeteHolen(url) {
    try {
      const antwort = await fetch(`${WORKER}?gemeldet=${encodeURIComponent(url)}`, {
        cache: 'no-store',
      })
      if (!antwort.ok) return new Set()
      const daten = await antwort.json()
      /* Die Ferne antwortet mit Nummern und Staffeln; der Schlüssel braucht beides. */
      const paare = daten.paare ?? null
      if (paare) return new Set(paare.map((p) => folgenSchluessel(p.staffel, p.nummer)))
      return new Set((daten.nummern ?? []).map((n) => folgenSchluessel(daten.staffel ?? 1, Number(n))))
    } catch {
      /* Ohne Auskunft lieber einmal zu viel prüfen als eine Lücke lassen. */
      return new Set()
    }
  }

  // --- Prüfen ---------------------------------------------------------------

  async function vielleichtPruefen() {
    if (gelaufen || !eintrag || folgen.length === 0) return
    gelaufen = true

    const adresse = eintrag.url ?? location.href.split('?')[0]
    gemeldeteNummern = await gemeldeteHolen(adresse)

    /* Nach Staffel und Folge, nicht in Ladereihenfolge. */
    const alle = [...folgen].sort(
      (a, b) => (a.staffel ?? 0) - (b.staffel ?? 0) || a.nummer - b.nummer,
    )
    const istGemeldet = (f) => gemeldeteNummern.has(folgenSchluessel(f.staffel, f.nummer))
    const zuPruefen = alle.filter((f) => !istGemeldet(f))
    const schon = alle.filter(istGemeldet)

    if (!zuPruefen.length) {
      zeigePruefung(`${eintrag.titel}\n✓ ${nachStaffeln(alle)} gemeldet`, { klasse: 'gut' })
      return
    }
    zeigePruefung(
      `${eintrag.titel}\nprüfe ${zuPruefen.length} Folgen …` +
        (schon.length ? `\n✓ ${nachStaffeln(schon)}` : ''),
    )

    const beginn = Date.now()
    ergebnisse = await inBahnen(
      zuPruefen,
      async (f) => ({ ...f, ...(await frage(f.playbackId)) }),
      (n) =>
        zeigePruefung(`${eintrag.titel}\nprüfe ${n}/${zuPruefen.length}` +
          (schon.length ? `\n✓ ${nachStaffeln(schon)}` : ''), { laeuft: true }),
    )
    const sekunden = ((Date.now() - beginn) / 1000).toFixed(1)

    const echte = ergebnisse.filter((r) => r.sprachen)
    const mitDeutsch = echte.filter((r) => r.sprachen.includes('de'))

    /* Eine Tabelle, nicht fünfzig Zeilen — getrennte Ausgaben muss man suchen. */
    console.log(
      `[Anime-Kalender] ${eintrag.titel}: ${echte.length} Folgen in ${sekunden} s, ohne Player-Start` +
        (schon.length ? ` (${schon.length} schon gemeldet)` : '') +
        (anbieterStaffeln.length
          ? ` — Disney+ teilt: ${anbieterStaffeln.map((s) => `${s.name}: ${s.gesamt}`).join(', ')}`
          : ''),
    )
    console.table(
      ergebnisse.map((r) => ({
        Folge: `S${r.staffel ?? '?'}E${r.nummer}`,
        Titel: (r.titel ?? '').slice(0, 32),
        Deutsch: r.sprachen ? (r.sprachen.includes('de') ? 'ja' : 'NEIN') : (r.fehler ?? '?'),
        Tonspuren: (r.sprachen ?? []).join(' '),
      })),
    )

    if (!echte.length) {
      zeigePruefung(`${eintrag.titel}\nkeine Antwort — ${ergebnisse[0]?.fehler ?? 'unbekannt'}`, {
        klasse: 'schlecht',
      })
      return
    }
    zeigePruefung(
      `${eintrag.titel}` +
        (schon.length ? `\n✓ ${nachStaffeln(schon)}` : '') +
        `\n▸ ${nachStaffeln(echte)} melden (${mitDeutsch.length}× deutsch)`,
      { klasse: mitDeutsch.length ? 'gut' : null, klick: melden },
    )
  }

  // --- Melden ---------------------------------------------------------------

  /** Ein Titel, den Disney+ hier gar nicht führt. */
  async function meldeWeg(e) {
    const { token } = await chrome.storage.sync.get('token')
    if (!token) return false
    try {
      const antwort = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'disneyplus',
          url: e.url,
          befund: 'weg',
          titel: e.titel,
          serientitel: e.titel,
          notiz: 'Disney+ meldet: nicht in deinem Gebiet verfügbar',
        }),
      })
      return antwort.ok
    } catch {
      return false
    }
  }

  async function melden() {
    const echte = ergebnisse.filter(
      (r) => r.sprachen && !gemeldeteNummern.has(folgenSchluessel(r.staffel, r.nummer)),
    )
    if (!echte.length) return
    const { token } = await chrome.storage.sync.get('token')
    if (!token) {
      return zeigePruefung('Kein Token — Rechtsklick aufs Symbol, dann Optionen', {
        klasse: 'schlecht',
      })
    }

    /*
      Wie Disney+ die Reihe teilt: je Staffel die Zahl der Folgen und die erste
      Nummer. Damit lässt sich eine Meldung später einer unserer Staffeln
      zuordnen, auch wenn der Anbieter anders einteilt — und er tut es.
    */
    const staffeln = [...new Set(echte.map((r) => r.staffel))]
      .filter((nr) => nr)
      .map((nr) => {
        const dazu = echte.filter((r) => r.staffel === nr)
        return { seq: nr, folgen: dazu.length, erste: Math.min(...dazu.map((r) => r.nummer)) }
      })

    let geschafft = 0
    const gescheitert = []
    await inBahnen(
      echte,
      async (r) => {
      try {
        const antwort = await fetch(WORKER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
          body: JSON.stringify({
            plattform: 'disneyplus',
            /* Die Adresse aus unserem Bestand — danach sucht die Pipeline. */
            url: eintrag.url ?? location.href.split('?')[0],
            sprachen: r.sprachen,
            befund: r.sprachen.includes('de') ? 'dub' : 'kein_dub',
            titel: eintrag.titel,
            folge: r.titel || null,
            folge_nr: r.nummer,
            staffel: r.staffel,
            staffeln,
            serientitel: eintrag.titel,
          }),
        })
        if (antwort.ok) {
          geschafft++
          /* Sofort merken — ein zweiter Klick soll nichts verdoppeln. */
          gemeldeteNummern.add(folgenSchluessel(r.staffel, r.nummer))
        } else {
          gescheitert.push(`S${r.staffel}E${r.nummer}: HTTP ${antwort.status}`)
        }
      } catch (fehler) {
        /* Eine ausgefallene Meldung ist kein Grund, die übrigen zu lassen. */
        gescheitert.push(`S${r.staffel}E${r.nummer}: ${fehler}`)
      }
      },
      (n) => zeigePruefung(`${eintrag.titel}\nmelde ${n}/${echte.length}`, { laeuft: true }),
    )
    if (gescheitert.length) {
      console.warn(`[Anime-Kalender] ${gescheitert.length} Meldungen kamen nicht an:`, gescheitert)
    }
    await briefkastenHolen()
    zeigeUebersicht()
    const alle = [...folgen].sort(
      (a, b) => (a.staffel ?? 0) - (b.staffel ?? 0) || a.nummer - b.nummer,
    )
    zeigePruefung(
      `${eintrag.titel}\n✓ ${nachStaffeln(
        alle.filter((f) => gemeldeteNummern.has(folgenSchluessel(f.staffel, f.nummer))),
      )} gemeldet` +
        (gescheitert.length ? `\n${gescheitert.length} kamen nicht an — siehe Konsole` : '') +
        `\nÜbernahme ab ${uhrzeit(naechsteUebernahme())}`,
      {
        /*
          Rot heißt: etwas kam nicht an, und die Konsole sagt was. Ohne diesen
          Zusatz stand der Knopf rot da, ohne dass jemand den Grund erfahren
          konnte (Daniel, 26.08.2026: „warum ist er rot geworden??").
        */
        klasse: geschafft === echte.length ? 'gut' : 'schlecht',
      },
    )
  }

  // --- Wenn Disney+ die Seite gar nicht zeigt ------------------------------

  /*
    **Wohin der Klick ging — und warum das nötig ist.**

    Zwei Fälle, beide am 26.08.2026 gemessen, beide von derselben Notiz gelöst:

    - **Disney+ leitet um.** Unser Bestand führt „Bright Sun: Dark Shadows" als
      `/series/summer-time-rendering/3AHbeFV7Lqvn`; der Klick landet auf
      `/browse/entity-ad803e91-…`. Die Kennung dort steht in keiner Liste, und
      die Erweiterung tat gar nichts.
    - **Disney+ zeigt eine Fehlerseite.** `/de-de/error?src=bap` trägt überhaupt
      keine Kennung mehr.

    Beide Male weiß nur der Klick, welcher Titel gemeint war. Er hinterlegt ihn
    für zehn Minuten.

    **Aus einer Fehlerseite wird trotzdem keine Meldung.** Sie sieht gleich aus,
    ob ein Titel fehlt oder gerade etwas klemmt — und bei Bright Sun führte
    derselbe Klick eine Minute später auf die Seite („erneuter klick auf link in
    liste führt korrekt zur seite"). Der Knopf bietet deshalb einen zweiten
    Versuch an; „nicht da" bleibt eine Entscheidung von Hand.
  */
  const ZIEL_SCHLUESSEL = 'ak-disney-ziel'

  function merkeZiel(id) {
    try {
      sessionStorage.setItem(ZIEL_SCHLUESSEL, JSON.stringify({ id, zeit: Date.now() }))
    } catch {
      /* Ohne Speicher fällt nur diese Bequemlichkeit aus. */
    }
  }

  function letztesZiel() {
    try {
      const roh = sessionStorage.getItem(ZIEL_SCHLUESSEL)
      if (!roh) return null
      const { id, zeit } = JSON.parse(roh)
      if (Date.now() - zeit > 600000) return null
      return liste[id] ? { id, ...liste[id] } : null
    } catch {
      return null
    }
  }

  function istFehlerseite() {
    return /\/error(\?|$)/.test(location.pathname + location.search)
  }

  function vielleichtFehlerseite() {
    if (!istFehlerseite()) return false
    const ziel = letztesZiel()
    if (!ziel) return false
    zeigePruefung(`${ziel.titel}\nDisney+ hat eine Fehlerseite gezeigt.\n▸ nochmal versuchen`, {
      klasse: 'schlecht',
      klick: () => {
        location.href = ziel.url
      },
    })
    return true
  }

  // --- Start ----------------------------------------------------------------

  /*
    Disney+ wechselt die Seite ohne Neuladen. Ohne diesen Blick auf die Adresse
    bliebe der Knopf des vorigen Titels stehen — bei Netflix hat genau das eine
    Meldung unter der falschen Reihe erzeugt.
  */
  function pruefeAdresse() {
    const jetzt = kennung(location.href)
    if (jetzt === seite) return
    seite = jetzt
    /*
      Kennt die Liste diese Kennung nicht, war es vielleicht eine Weiterleitung:
      Der letzte Klick aus der Liste sagt dann, welcher Titel gemeint ist.
      Gemeldet wird trotzdem unter der Adresse aus unserem Bestand — die ist es,
      nach der die Pipeline sucht.
    */
    eintrag = (jetzt ? liste[jetzt] : null) ?? (jetzt ? letztesZiel() : null)
    gelaufen = false
    angefordert = false
    folgen = []
    anbieterStaffeln = []
    erwartet = 0
    ergebnisse = []
    gemeldeteNummern = new Set()
    pruefKnopf?.remove()
    pruefKnopf = null
    dialogSchliessen()

    zeigeUebersicht()
    if (!eintrag) return void vielleichtFehlerseite()
    /*
      Vorab, nicht erst nach dem Sammeln: Nur so kann die Anzeige während des
      Sammelns schon sagen, wie viele Folgen überhaupt noch anstehen („1e1-15
      stehen in der liste, also müssten es 71/71 nicht 86/86 sein").
    */
    void gemeldeteHolen(eintrag.url ?? location.href.split('?')[0]).then((n) => {
      gemeldeteNummern = n
    })
    window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*')
    setTimeout(() => window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*'), 2500)
  }

  void briefkastenHolen().then(zeigeUebersicht)
  pruefeAdresse()
  setInterval(pruefeAdresse, 1000)
})()
