/*
  **Ist dieser Titel im Datensatz schon beantwortet?** (08.10.2026)

  Der Prüfstand (`?stand=1`) führt in `anbieter[].ziele` genau die Adressen, die noch offen sind. Steht
  eine Disney+-Seite dort nicht, ist sie erledigt — dann bietet der Kasten kein „melden" an, sondern
  zeigt „im Datensatz beantwortet" mit einem kleinen „trotzdem erneut melden". Ohne diese Prüfung
  zählte `gemeldeteHolen` nur Meldungen ab dem Prüfstand und bot Naruto Shippuden und Shield Hero
  erneut an (Extension 4.24.13). Verglichen wird die Kennung, nicht die Adresse.

  Fehlt der Prüfstand oder die Liste, gilt „nicht beantwortet" — dann wird großzügig geprüft wie zuvor.

  **Mehr Folgen auf der Seite als im Datensatz (4.24.21, 10.10.2026):** Das Band der Unterwelt stand als
  beantwortet da (Datensatz bis Folge 11), Disney+ zeigte aber 15. `bekannt` aus dem Prüfstand nennt die
  höchste Folge des Datensatzes; liegt die Zahl der Folgen laut Seite (`erwartet`) darüber, gilt der Titel
  nicht als beantwortet und der bisherige Weg prüft und meldet alle Folgen erneut.
*/
globalThis.AK_DISNEY_BEANTWORTET = (() => {
  let zweitKnopf = null
  /* Höchste Folge laut Datensatz zur gerade geprüften Seite (`null`: unbekannt). */
  let bekannt = null
  /* Solange der Kasten „beantwortet" zeigt: nimmt die Folgenzahl der Seite entgegen, wenn sie größer ist als `bekannt`. */
  let weiter = null

  /** `kennungVon`: dieselbe Regel wie in `disney.js` (Adresse → Kennung). */
  async function istBeantwortet(url, kennungVon) {
    const hole = globalThis.akPruefstand
    if (typeof hole !== 'function') return false
    const stand = await hole()
    const ziele = (stand?.anbieter ?? []).find((a) => a.plattform === 'disneyplus')?.ziele
    const meine = kennungVon(url)
    bekannt = globalThis.akBekannt?.(stand, 'disneyplus', meine) ?? null
    if (!Array.isArray(ziele) || !meine) return false
    return !ziele.some((z) => kennungVon(z.url ?? '') === meine)
  }

  function entfernen() {
    zweitKnopf?.remove()
    zweitKnopf = null
    weiter = null
  }

  /** Die Seite meldet, wie viele Folgen sie hat (`gemeldet`: wie viele davon schon im Briefkasten liegen). */
  function folgenZahl(erwartet, gemeldet) {
    weiter?.(erwartet, gemeldet)
  }

  /** Der kleine Zweitknopf neben dem Kasten-Knopf. */
  function erneutKnopf(nach, bei) {
    entfernen()
    zweitKnopf = document.createElement('button')
    zweitKnopf.type = 'button'
    zweitKnopf.className = 'ak-melder ak-klein'
    zweitKnopf.textContent = 'trotzdem erneut melden'
    zweitKnopf.onclick = bei
    nach?.parentNode?.appendChild(zweitKnopf)
  }

  /**
   * Beantwortet: nur der Hinweis (kein Sammeln, keine Abfrage je Folge) und ein Signal an den Durchgang
   * („schon gemeldet"). Offen oder ungeklärt: der bisherige Weg — die Seite nach ihrer Folgenliste fragen
   * (zweimal, der Leser ist nicht sofort bereit); die Antworten treibt der Nachrichten-Hörer in `disney.js`.
   */
  async function klaere({ url, kennungVon, aktuell, zeige, knopf, setze, signal, anfrage, zahlen = () => ({}) }) {
    const anfangen = (hinweis = 'sammle Folgen …') => {
      setze(false)
      zeige(hinweis, { laeuft: true })
      anfrage()
      setTimeout(anfrage, 2500)
    }
    const ja = await istBeantwortet(url, kennungVon)
    if (!aktuell()) return
    if (!ja) return anfangen()
    /* Mehr Folgen auf der Seite als im Datensatz, und nicht alle schon gemeldet: nicht beantwortet. */
    const neueFolgen = (erwartet, gemeldet) => {
      if (!(bekannt > 0 && erwartet > bekannt && gemeldet < erwartet)) return false
      entfernen()
      anfangen(`Neue Folgen ${bekannt + 1}–${erwartet} · prüfen und melden`)
      return true
    }
    if (neueFolgen(zahlen().erwartet, zahlen().gemeldet)) return
    setze(true)
    zeige('✓ im Datensatz beantwortet', { klasse: 'gut' })
    erneutKnopf(knopf(), () => {
      entfernen()
      anfangen()
    })
    weiter = neueFolgen
    signal({ zuMelden: 0, schon: 1, beantwortet: true })
  }

  return { istBeantwortet, entfernen, klaere, folgenZahl }
})()
