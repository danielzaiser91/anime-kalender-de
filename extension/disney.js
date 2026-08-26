/**
 * Disney+, erste Stufe: messen, nicht melden.
 *
 * Der Weg steht (siehe `disney-leser.js`): ein POST je Folge, Tonspuren im
 * Klartext. Was noch fehlt, ist die Gegenprobe — **erzeugt dieser POST einen
 * Eintrag unter „Weiter ansehen"?** Solange das offen ist, wird nichts an den
 * Worker gemeldet: Eine Meldung lässt sich zurücknehmen, ein Eintrag in Daniels
 * Verlauf ist Handarbeit (die Netflix-Fehlläufe haben dort welche hinterlassen).
 *
 * Diese Stufe prüft deshalb automatisch die ersten fünf Folgen, schreibt eine
 * Tabelle in die Konsole und zeigt das Ergebnis am Knopf. Mehr nicht.
 */
;(() => {
  const MARKE = 'ak-disney'
  const MARKE_STEUER = 'ak-disney-steuer'
  /* Fünf reichen für die Gegenprobe und halten die Last klein. */
  const PROBE = 5
  /* Abstand zwischen zwei Abrufen — die Seite selbst macht einen je Klick. */
  const TAKT = 300

  let folgen = []
  let bereit = false
  let gelaufen = false
  const offeneFragen = new Map()

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.marke !== MARKE) return
    if (e.data.antwortFuer) {
      offeneFragen.get(e.data.antwortFuer)?.(e.data)
      offeneFragen.delete(e.data.antwortFuer)
      return
    }
    if (Array.isArray(e.data.folgen)) folgen = e.data.folgen
    if (e.data.bereit) bereit = true
    vielleichtLaufen()
  })

  const frage = (playbackId) =>
    new Promise((fertig) => {
      offeneFragen.set(playbackId, fertig)
      window.postMessage({ marke: MARKE_STEUER, playbackId }, '*')
      setTimeout(() => {
        if (offeneFragen.delete(playbackId)) fertig({ fehler: 'keine Antwort' })
      }, 15000)
    })

  // --- Knopf ---------------------------------------------------------------

  let knopf = null
  function zeige(text, klasse) {
    if (!knopf) {
      knopf = document.createElement('button')
      knopf.className = 'ak-knopf'
      knopf.type = 'button'
      knopf.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483000;padding:8px 14px;' +
        'border-radius:8px;border:1px solid #ffffff33;background:#111;color:#fff;' +
        'font:13px/1.3 system-ui,sans-serif;cursor:default;max-width:340px;text-align:left'
      document.body.appendChild(knopf)
    }
    knopf.textContent = text
    knopf.style.background = klasse === 'gut' ? '#14532d' : klasse === 'schlecht' ? '#7f1d1d' : '#111'
  }

  // --- Der Durchlauf -------------------------------------------------------

  async function vielleichtLaufen() {
    if (gelaufen || !bereit || folgen.length === 0) return
    gelaufen = true

    /* Nach Staffel und Folge sortieren — die Seite liefert sie in Ladereihenfolge. */
    const liste = [...folgen]
      .sort((a, b) => (a.staffel ?? 0) - (b.staffel ?? 0) || a.nummer - b.nummer)
      .slice(0, PROBE)

    zeige(`Anime-Kalender: prüfe ${liste.length} Folgen …`)
    const beginn = Date.now()
    const raus = []
    for (const f of liste) {
      const antwort = await frage(f.playbackId)
      raus.push({ ...f, ...antwort })
      await new Promise((ok) => setTimeout(ok, TAKT))
    }
    const sekunden = ((Date.now() - beginn) / 1000).toFixed(1)

    /* Eine Tabelle, nicht fünf Zeilen — getrennte Ausgaben muss man suchen. */
    console.log(`[Anime-Kalender] Disney+ — ${raus.length} Folgen in ${sekunden} s, ohne einen Player-Start`)
    console.table(
      raus.map((r) => ({
        Folge: `S${r.staffel ?? '?'}E${r.nummer}`,
        Titel: (r.titel ?? '').slice(0, 34),
        Deutsch: r.sprachen ? (r.sprachen.includes('de') ? 'ja' : 'NEIN') : (r.fehler ?? '?'),
        Tonspuren: (r.sprachen ?? []).join(' '),
      })),
    )

    const mitDeutsch = raus.filter((r) => r.sprachen?.includes('de')).length
    const kaputt = raus.filter((r) => r.fehler).length
    if (kaputt === raus.length) {
      zeige(`Anime-Kalender: keine Antwort — ${raus[0]?.fehler ?? 'unbekannt'}`, 'schlecht')
      return
    }
    zeige(
      `Anime-Kalender: ${mitDeutsch}/${raus.length} Folgen mit deutschem Ton, in ${sekunden} s.\n` +
        'Einzelheiten in der Konsole. Bitte „Weiter ansehen" prüfen.',
      mitDeutsch ? 'gut' : null,
    )
  }

  /* Die Seite lädt ihre Folgen nach; ein Nachfragen kostet nichts. */
  window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*')
  setTimeout(() => window.postMessage({ marke: MARKE_STEUER, frageListe: true }, '*'), 2500)
})()
