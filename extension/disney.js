/**
 * Disney+: prüfen ohne Player, melden auf Klick.
 *
 * Der Weg steht in `disney-leser.js` — ein POST je Folge, Tonspuren im
 * Klartext. Gemessen am 26.08.2026: Der Aufruf hinterlässt **keinen** Eintrag
 * unter „Weiterschauen". Die Gegenprobe lief an Wandance, einer Serie, die nie
 * geöffnet war — der erste Verdacht hatte sich an einer Folge entzündet, die
 * Daniel kurz zuvor selbst abgespielt hatte.
 *
 * **Warum trotzdem nur auf Klick gemeldet wird.** Bei Netflix meldete eine
 * frühere Fassung beim Abspielen von selbst, und bei einem Titelwechsel kamen
 * dadurch fremde Sprachen an. Daniels Urteil: „automatische prüfung bei play
 * auch entfernen, es soll nur noch mit der neuen logik funktionieren." Geprüft
 * wird hier von selbst, weil es nichts kostet und nichts hinterlässt — gemeldet
 * wird, wenn er es will.
 *
 * **Und nur auf Seiten, die auf der Liste stehen.** Sonst meldet die Erweiterung
 * jede Disney-Seite: „die extension stört beim gucken und will ich da nicht
 * sehen" (22.08.2026, zu Netflix).
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
   * `disney.test.cjs` hält beide gegeneinander, damit sie nicht auseinanderlaufen.
   */
  function kennung(url) {
    return (
      /\/browse\/entity-([0-9a-f-]{8,})/i.exec(url)?.[1] ??
      /\/(?:series|movies)\/[^/]+\/([A-Za-z0-9]{6,})/.exec(url)?.[1] ??
      null
    )
  }

  const liste = globalThis.AK_OFFENE_DISNEY ?? {}
  let seite = null
  let eintrag = null
  let folgen = []
  let bereit = false
  let gelaufen = false
  let ergebnisse = []
  const offeneFragen = new Map()

  // --- Brücke zur Seitenwelt ------------------------------------------------

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.marke !== MARKE) return
    if (e.data.antwortFuer) {
      offeneFragen.get(e.data.antwortFuer)?.(e.data)
      offeneFragen.delete(e.data.antwortFuer)
      return
    }
    if (Array.isArray(e.data.folgen)) folgen = e.data.folgen
    if (e.data.bereit) bereit = true
    vielleichtPruefen()
  })

  const frage = (playbackId) =>
    new Promise((fertig) => {
      offeneFragen.set(playbackId, fertig)
      window.postMessage({ marke: MARKE_STEUER, playbackId }, '*')
      setTimeout(() => {
        if (offeneFragen.delete(playbackId)) fertig({ fehler: 'keine Antwort' })
      }, 15000)
    })

  // --- Knopf ----------------------------------------------------------------

  let knopf = null
  function zeige(text, { klasse = null, klick = null } = {}) {
    if (!knopf) {
      knopf = document.createElement('button')
      knopf.type = 'button'
      knopf.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483000;padding:9px 15px;' +
        'border-radius:8px;border:1px solid #ffffff33;background:#111;color:#fff;' +
        'font:13px/1.4 system-ui,sans-serif;max-width:340px;text-align:left;white-space:pre-line'
      document.body.appendChild(knopf)
    }
    knopf.textContent = text
    knopf.style.background = klasse === 'gut' ? '#14532d' : klasse === 'schlecht' ? '#7f1d1d' : '#111'
    knopf.style.cursor = klick ? 'pointer' : 'default'
    knopf.disabled = !klick
    knopf.onclick = klick
  }

  // --- Prüfen ---------------------------------------------------------------

  async function vielleichtPruefen() {
    if (gelaufen || !bereit || !eintrag || folgen.length === 0) return
    gelaufen = true

    /* Nach Staffel und Folge, nicht in Ladereihenfolge. */
    const sortiert = [...folgen].sort(
      (a, b) => (a.staffel ?? 0) - (b.staffel ?? 0) || a.nummer - b.nummer,
    )
    zeige(`Anime-Kalender: prüfe ${sortiert.length} Folgen …`)

    const beginn = Date.now()
    ergebnisse = []
    for (const f of sortiert) {
      ergebnisse.push({ ...f, ...(await frage(f.playbackId)) })
      await new Promise((ok) => setTimeout(ok, TAKT))
    }
    const sekunden = ((Date.now() - beginn) / 1000).toFixed(1)

    const echte = ergebnisse.filter((r) => r.sprachen)
    const mitDeutsch = echte.filter((r) => r.sprachen.includes('de'))

    /* Eine Tabelle, nicht dreißig Zeilen — getrennte Ausgaben muss man suchen. */
    console.log(
      `[Anime-Kalender] ${eintrag.titel}: ${echte.length} Folgen in ${sekunden} s, ohne Player-Start`,
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
      zeige(`Anime-Kalender: keine Antwort — ${ergebnisse[0]?.fehler ?? 'unbekannt'}`, {
        klasse: 'schlecht',
      })
      return
    }
    zeige(
      `${eintrag.titel}\n${mitDeutsch.length} von ${echte.length} Folgen mit deutschem Ton\n▸ melden`,
      { klasse: mitDeutsch.length ? 'gut' : null, klick: melden },
    )
  }

  // --- Melden ---------------------------------------------------------------

  async function melden() {
    const echte = ergebnisse.filter((r) => r.sprachen)
    if (!echte.length) return
    const { token } = await chrome.storage.sync.get('token')
    if (!token) {
      return zeige('Kein Token — Rechtsklick aufs Symbol, dann Optionen', { klasse: 'schlecht' })
    }

    /*
      Wie Disney+ die Reihe teilt: je Staffel die Zahl der Folgen und die erste
      Nummer. Damit lässt sich eine Meldung später einer unserer Staffeln
      zuordnen, auch wenn der Anbieter anders einteilt — dieselbe Angabe, die
      die Netflix-Meldungen tragen.
    */
    const staffeln = [...new Set(echte.map((r) => r.staffel))]
      .filter((nr) => nr)
      .map((nr) => {
        const dazu = echte.filter((r) => r.staffel === nr)
        return { seq: nr, folgen: dazu.length, erste: Math.min(...dazu.map((r) => r.nummer)) }
      })

    let geschafft = 0
    for (const r of echte) {
      zeige(`Anime-Kalender: melde ${geschafft + 1}/${echte.length} …`)
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
        if (antwort.ok) geschafft++
      } catch {
        /* Eine ausgefallene Meldung ist kein Grund, die übrigen zu lassen. */
      }
      await new Promise((ok) => setTimeout(ok, 120))
    }
    zeige(`${eintrag.titel}\n${geschafft} von ${echte.length} Folgen gemeldet ✓`, {
      klasse: geschafft === echte.length ? 'gut' : 'schlecht',
    })
  }

  // --- Übersicht ------------------------------------------------------------

  /*
    **Auf jeder anderen Disney-Seite: was noch zu prüfen ist.**

    Ohne sie sieht Daniel nur dann etwas, wenn er zufällig auf einer gelisteten
    Serienseite landet — und weiß nirgends, welche das sind. Sein Befund am
    26.08.2026: „ich hab keinen button zum öffnen wo ich sehe welche titel zu
    prüfen sind."

    Der Knopf ist klein und der Dialog geschlossen, solange niemand klickt. Was
    beim Gucken stört, fliegt wieder raus — bei Netflix war das der Grund für
    die Prüfliste überhaupt.
  */
  let uebersichtKnopf = null
  let dialog = null

  function offeneEintraege() {
    return Object.entries(liste)
      .map(([id, wert]) => ({ id, ...wert, offen: wert.staffeln.filter((st) => st.offen).length }))
      .filter((e) => e.offen > 0)
      .sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
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
      'position:fixed;right:16px;bottom:60px;z-index:2147483001;width:min(420px,92vw);' +
      'max-height:70vh;overflow:auto;background:#111;color:#fff;border:1px solid #ffffff33;' +
      'border-radius:10px;padding:14px 16px;font:13px/1.5 system-ui,sans-serif;' +
      'box-shadow:0 8px 32px #000a'

    const kopf = document.createElement('div')
    kopf.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px'
    const titelzeile = document.createElement('strong')
    titelzeile.textContent = eintraege.length ? `${eintraege.length} Titel zu prüfen` : 'Alles geprüft'
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
      const folgen = e.staffeln.filter((st) => st.offen).reduce((n, st) => n + (st.folgen ?? 0), 0)
      rest.textContent = `${e.offen} Staffel${e.offen === 1 ? '' : 'n'}${folgen ? `, ${folgen} Folgen` : ''}`
      zeile.appendChild(rest)
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
        'position:fixed;right:16px;bottom:16px;z-index:2147483000;padding:7px 13px;' +
        'border-radius:8px;border:1px solid #ffffff33;background:#111;color:#fff;' +
        'font:12px/1.3 system-ui,sans-serif;cursor:pointer;opacity:.85'
      uebersichtKnopf.onclick = dialogOeffnen
      document.body.appendChild(uebersichtKnopf)
    }
    uebersichtKnopf.textContent = offen.length
      ? `Anime-Kalender: ${offen.length} offen`
      : 'Anime-Kalender: alles geprüft ✓'
  }

  function uebersichtWeg() {
    dialogSchliessen()
    uebersichtKnopf?.remove()
    uebersichtKnopf = null
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialogSchliessen()
  })

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
    folgen = []
    ergebnisse = []
    knopf?.remove()
    knopf = null
    if (!eintrag) return zeigeUebersicht()
    /* Auf einer gelisteten Seite gilt der Prüf-Knopf, nicht die Übersicht. */
    uebersichtWeg()
    window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*')
    setTimeout(() => window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*'), 2500)
  }

  pruefeAdresse()
  setInterval(pruefeAdresse, 1000)
})()
