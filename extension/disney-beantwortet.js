/*
  **Ist dieser Titel im Datensatz schon beantwortet?** (08.10.2026)

  Der Prüfstand (`?stand=1`) führt in `anbieter[].ziele` genau die Adressen, die noch offen sind. Steht
  eine Disney+-Seite dort nicht, ist sie erledigt — dann bietet der Kasten kein „melden" an, sondern
  zeigt „im Datensatz beantwortet" mit einem kleinen „trotzdem erneut melden". Ohne diese Prüfung
  zählte `gemeldeteHolen` nur Meldungen ab dem Prüfstand und bot Naruto Shippuden und Shield Hero
  erneut an (Extension 4.24.13). Verglichen wird die Kennung, nicht die Adresse.

  Fehlt der Prüfstand oder die Liste, gilt „nicht beantwortet" — dann wird großzügig geprüft wie zuvor.
*/
globalThis.AK_DISNEY_BEANTWORTET = (() => {
  let zweitKnopf = null

  /** `kennungVon`: dieselbe Regel wie in `disney.js` (Adresse → Kennung). */
  async function istBeantwortet(url, kennungVon) {
    const hole = globalThis.akPruefstand
    if (typeof hole !== 'function') return false
    const stand = await hole()
    const ziele = (stand?.anbieter ?? []).find((a) => a.plattform === 'disneyplus')?.ziele
    const meine = kennungVon(url)
    if (!Array.isArray(ziele) || !meine) return false
    return !ziele.some((z) => kennungVon(z.url ?? '') === meine)
  }

  function entfernen() {
    zweitKnopf?.remove()
    zweitKnopf = null
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
  async function klaere({ url, kennungVon, aktuell, zeige, knopf, setze, signal, anfrage }) {
    const anfangen = () => {
      setze(false)
      zeige('sammle Folgen …', { laeuft: true })
      anfrage()
      setTimeout(anfrage, 2500)
    }
    const ja = await istBeantwortet(url, kennungVon)
    if (!aktuell()) return
    if (!ja) return anfangen()
    setze(true)
    zeige('✓ im Datensatz beantwortet', { klasse: 'gut' })
    erneutKnopf(knopf(), () => {
      entfernen()
      anfangen()
    })
    signal({ zuMelden: 0, schon: 1, beantwortet: true })
  }

  return { istBeantwortet, entfernen, klaere }
})()
