/**
 * Disney+: prüfen ohne Player, melden auf Klick, nichts doppelt.
 *
 * Der Weg steht in `disney-leser.js` — ein POST je Folge, Tonspuren im
 * Klartext, kein Eintrag unter „Weiterschauen".
 *
 * Drei Dinge, die dieser Teil dazu beiträgt, und alle drei sind aus einem
 * Fehlschlag entstanden (Daniel, 26.08.2026):
 *
 * - **Gewartet wird auf die vollständige Liste.** Der Seitenaufruf bringt 15
 *   Folgen mit, die Staffel hat 51. Wer sofort losprüft, meldet ein Drittel und
 *   nennt es die Staffel.
 * - **Was im Briefkasten liegt, wird übersprungen.** Sonst bietet die Seite nach
 *   einem Neuladen dieselben Folgen erneut an.
 * - **Beide Knöpfe stehen nebeneinander**, Übersicht unten, Prüfung darüber.
 *   Der erste Anlauf blendete die Übersicht auf einer gelisteten Seite aus —
 *   dann fehlte der Weg zur Liste genau dort, wo man den nächsten Titel
 *   aussucht.
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
  /** Je Adresse die Zahl der Meldungen im Briefkasten — für die Liste. */
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
    Wie viele Meldungen zu jeder Adresse im Briefkasten liegen.

    Ein Abruf für alle 31 Titel, nicht einer je Titel. Ohne ihn sagt die Liste
    nichts darüber, was schon erledigt ist — „bereits gemeldete folgen und
    fehlende meldungen werden ebenfalls nicht korrekt in der liste angezeigt"
    (Daniel, 26.08.2026).
  */
  async function briefkastenHolen() {
    try {
      const antwort = await fetch(`${WORKER}?zaehlen=1`, { cache: 'no-store' })
      if (!antwort.ok) return
      const daten = await antwort.json()
      const gezaehlt = new Map()
      for (const url of daten.adressen ?? []) gezaehlt.set(url, (gezaehlt.get(url) ?? 0) + 1)
      briefkasten = gezaehlt
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
      'position:fixed;right:16px;bottom:100px;z-index:2147483001;width:min(440px,92vw);' +
      'max-height:70vh;overflow:auto;background:#111;color:#fff;border:1px solid #ffffff33;' +
      'border-radius:10px;padding:14px 16px;font:13px/1.5 system-ui,sans-serif;' +
      'box-shadow:0 8px 32px #000a'

    const kopf = document.createElement('div')
    kopf.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px'
    const titelzeile = document.createElement('strong')
    const gemeldet = eintraege.filter((e) => briefkasten.get(e.url)).length
    titelzeile.textContent = eintraege.length
      ? `${eintraege.length} Titel zu prüfen` + (gemeldet ? `, ${gemeldet} im Briefkasten` : '')
      : 'Alles geprüft'
    kopf.appendChild(titelzeile)
    const zu = document.createElement('button')
    zu.textContent = '×'
    zu.title = 'Schließen (Esc)'
    zu.style.cssText =
      'margin-left:auto;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1'
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

      const rest = document.createElement('span')
      rest.style.cssText = 'opacity:.6;margin-left:8px'
      /*
        Unsere Folgenzahl stammt aus AniList und weicht von Disneys Zählung ab
        (Beyblade X: wir eine Staffel, Disney+ zwei mit 51 und 35). Sie steht
        deshalb als Anhaltspunkt da, nicht als Zusage.
      */
      const folgenZahl = e.staffeln
        .filter((st) => st.offen)
        .reduce((n, st) => n + (st.folgen ?? 0), 0)
      rest.textContent =
        `${e.offen} Staffel${e.offen === 1 ? '' : 'n'}` + (folgenZahl ? `, ca. ${folgenZahl} Folgen` : '')
      zeile.appendChild(rest)

      const wieviel = briefkasten.get(e.url)
      if (wieviel) {
        const marke = document.createElement('span')
        marke.style.cssText = 'margin-left:8px;color:#4ade80'
        marke.textContent = `${wieviel} gemeldet`
        zeile.appendChild(marke)
      }
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
    const gemeldet = offen.filter((e) => briefkasten.get(e.url)).length
    uebersichtKnopf.textContent = offen.length
      ? `Anime-Kalender: ${offen.length - gemeldet} offen` + (gemeldet ? `, ${gemeldet} gemeldet` : '')
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
    const teilung = anbieterStaffeln.map((s) => `${s.name}: ${s.gesamt}`).join(', ')

    if (!zuPruefen.length) {
      zeigePruefung(`${eintrag.titel}\n${alle.length} Folgen schon gemeldet ✓`, { klasse: 'gut' })
      return
    }
    const uebersprungen = alle.length - zuPruefen.length
    zeigePruefung(
      `Anime-Kalender: prüfe ${zuPruefen.length} Folgen …` +
        (uebersprungen ? `\n${uebersprungen} schon gemeldet` : ''),
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
        (uebersprungen ? ` (${uebersprungen} schon gemeldet)` : '') +
        (teilung ? ` — Disney+ teilt: ${teilung}` : ''),
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
      zeigePruefung(`Anime-Kalender: keine Antwort — ${ergebnisse[0]?.fehler ?? 'unbekannt'}`, {
        klasse: 'schlecht',
      })
      return
    }
    zeigePruefung(
      `${eintrag.titel}\n${mitDeutsch.length} von ${echte.length} Folgen mit deutschem Ton` +
        (teilung ? `\n${teilung}` : '') +
        '\n▸ melden',
      { klasse: mitDeutsch.length ? 'gut' : null, klick: melden },
    )
  }

  // --- Melden ---------------------------------------------------------------

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
      zuordnen, auch wenn der Anbieter anders einteilt — und er tut es: Beyblade
      X ist bei uns eine Staffel, bei Disney+ zwei mit 51 und 35 Folgen.
    */
    const staffeln = [...new Set(echte.map((r) => r.staffel))]
      .filter((nr) => nr)
      .map((nr) => {
        const dazu = echte.filter((r) => r.staffel === nr)
        return { seq: nr, folgen: dazu.length, erste: Math.min(...dazu.map((r) => r.nummer)) }
      })

    let geschafft = 0
    for (const r of echte) {
      zeigePruefung(`Anime-Kalender: melde ${geschafft + 1}/${echte.length} …`)
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
    zeigePruefung(`${eintrag.titel}\n${geschafft} von ${echte.length} Folgen gemeldet ✓`, {
      klasse: geschafft === echte.length ? 'gut' : 'schlecht',
    })
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
