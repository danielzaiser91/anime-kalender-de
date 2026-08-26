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

  /** Folgen je Staffel als `1e1-15, 2e1-35`. */
  function nachStaffeln(eintraege) {
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
    /* Erst die vollständige Liste holen lassen, dann prüfen. */
    if (bereit && !angefordert) {
      angefordert = true
      window.postMessage({ marke: MARKE_STEUER, allesHolen: true }, '*')
      zeigePruefung(`${eintrag.titel}\nsammle Folgen …`)
      return
    }
    if (!e.data.vollstaendig) {
      if (erwartet) zeigePruefung(`${eintrag.titel}\nsammle Folgen … ${folgen.length}/${erwartet}`)
      return
    }
    void vielleichtPruefen()
  })

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
  function zeigePruefung(text, { klasse = null, klick = null } = {}) {
    if (!pruefKnopf) {
      pruefKnopf = document.createElement('button')
      pruefKnopf.type = 'button'
      pruefKnopf.style.cssText = KNOPF_STIL + ';bottom:58px;padding:9px 15px;font-size:13px'
      document.body.appendChild(pruefKnopf)
    }
    pruefKnopf.textContent = text
    pruefKnopf.style.background =
      klasse === 'gut' ? '#14532d' : klasse === 'schlecht' ? '#7f1d1d' : '#111'
    pruefKnopf.style.cursor = klick ? 'pointer' : 'default'
    pruefKnopf.disabled = !klick
    pruefKnopf.onclick = klick
  }

  // --- Übersicht ------------------------------------------------------------

  let uebersichtKnopf = null
  let dialog = null

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
        if (Number.isFinite(Number(e.folge_nr)))
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
    const eintraege = offeneEintraege()
    dialog = document.createElement('div')
    dialog.style.cssText =
      'position:fixed;right:16px;bottom:100px;z-index:2147483001;width:min(460px,92vw);' +
      'max-height:70vh;overflow:auto;background:#111;color:#fff;border:1px solid #ffffff33;' +
      'border-radius:10px;padding:14px 16px;font:13px/1.5 system-ui,sans-serif;' +
      'box-shadow:0 8px 32px #000a'

    const kopf = document.createElement('div')
    kopf.style.cssText = 'display:flex;align-items:baseline;gap:10px;margin-bottom:10px;flex-wrap:wrap'
    const titelzeile = document.createElement('strong')
    titelzeile.textContent = eintraege.length ? `${eintraege.length} Titel zu prüfen` : 'Alles geprüft'
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
        wegKnopf.textContent = ok ? 'nicht da ✓' : 'ging nicht'
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
    uebersichtKnopf.textContent = offen.length
      ? `Anime-Kalender: ${offen.length} offen`
      : 'Anime-Kalender: alles geprüft ✓'
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
      return new Set((daten.nummern ?? []).map(Number))
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
    const zuPruefen = alle.filter((f) => !gemeldeteNummern.has(f.nummer))
    const schon = alle.filter((f) => gemeldeteNummern.has(f.nummer))

    if (!zuPruefen.length) {
      zeigePruefung(`${eintrag.titel}\n✓ ${nachStaffeln(alle)} gemeldet`, { klasse: 'gut' })
      return
    }
    zeigePruefung(
      `${eintrag.titel}\nprüfe ${zuPruefen.length} Folgen …` +
        (schon.length ? `\n✓ ${nachStaffeln(schon)}` : ''),
    )

    const beginn = Date.now()
    ergebnisse = []
    for (const f of zuPruefen) {
      ergebnisse.push({ ...f, ...(await frage(f.playbackId)) })
      await new Promise((ok) => setTimeout(ok, TAKT))
    }
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
    const echte = ergebnisse.filter((r) => r.sprachen && !gemeldeteNummern.has(r.nummer))
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
    for (const r of echte) {
      zeigePruefung(`${eintrag.titel}\nmelde ${geschafft + 1}/${echte.length} …`)
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
          gemeldeteNummern.add(r.nummer)
        }
      } catch {
        /* Eine ausgefallene Meldung ist kein Grund, die übrigen zu lassen. */
      }
      await new Promise((ok) => setTimeout(ok, 120))
    }
    await briefkastenHolen()
    zeigeUebersicht()
    const alle = [...folgen].sort(
      (a, b) => (a.staffel ?? 0) - (b.staffel ?? 0) || a.nummer - b.nummer,
    )
    zeigePruefung(
      `${eintrag.titel}\n✓ ${nachStaffeln(alle.filter((f) => gemeldeteNummern.has(f.nummer)))} gemeldet` +
        `\nÜbernahme ab ${uhrzeit(naechsteUebernahme())}`,
      { klasse: geschafft === echte.length ? 'gut' : 'schlecht' },
    )
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
    eintrag = jetzt ? liste[jetzt] : null
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
    if (!eintrag) return
    window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*')
    setTimeout(() => window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*'), 2500)
  }

  void briefkastenHolen().then(zeigeUebersicht)
  pruefeAdresse()
  setInterval(pruefeAdresse, 1000)
})()
