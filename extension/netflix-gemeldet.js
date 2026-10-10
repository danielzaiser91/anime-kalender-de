/*
  **Nach der Meldung bleibt der Knopf bei „✓ gemeldet“ — und neue Folgen heißen „Neue Folgen“** (4.24.21, 10.10.2026)

  Daniel am 10.10.2026 (Das Band der Unterwelt): Nach „2/2" sprang der Knopf zurück auf „▶ E1 + E15 prüfen",
  obwohl alle 15 Meldungen im Briefkasten lagen. Im Sandkasten lässt sich der Rücksprung nicht herstellen;
  deshalb hängt der Abschluss nicht mehr an der Rechnung des Knopfes, sondern an einem eigenen Merker in
  `chrome.storage.local` (überlebt das Neuladen). Er gilt, bis der Prüfstand nach der Meldung entstanden ist
  (`pruefstandAm`: dann trägt der Datensatz die Antwort) oder 36 Stunden — je nachdem, was früher eintritt.

  Ein Aufruf genügt: `melder.js` ruft `zeigen()` bei jeder Anzeige des Knopfes. Daran erkennt das Modul auch,
  wann ein Lauf endet (Merker setzen) und wann ein neuer beginnt (Merker löschen); `melder.js` bleibt
  unberührt. Fehlt die Datei (Sandkasten), gilt das bisherige Verhalten.
*/
globalThis.AK_GEMELDET = (() => {
  const SCHLUESSEL = 'netflixGemeldet'
  const HOECHSTENS_MS = 36 * 3600 * 1000
  let merker = {}
  let stand = null
  let lief = false /* lief der Lauf bei der letzten Anzeige noch? */

  /** Merker und Prüfstand holen; der Aufrufer zeichnet danach den Knopf neu. */
  async function laden() {
    merker = (await chrome.storage.local.get(SCHLUESSEL).catch(() => ({})))[SCHLUESSEL] ?? {}
    stand = (await globalThis.akPruefstand?.()) ?? null
  }

  function aktiv(reihe, jetzt = Date.now()) {
    const am = merker[String(reihe)]
    if (!am || jetzt - Date.parse(am) > HOECHSTENS_MS) return false
    return !(stand?.pruefstandAm && stand.pruefstandAm > am)
  }

  function schreiben() {
    /* Ohne Speicher gilt der Abschluss nur bis zum Neuladen. */
    chrome.storage.local.set({ [SCHLUESSEL]: merker }).catch(() => {})
  }

  const nurEineStaffel = (alleFolgen) => new Set(alleFolgen.map((f) => String(f.seasonId ?? ''))).size <= 1

  /**
   * Folgen hinter dem Stand des Datensatzes, die noch nicht gemeldet sind. Nur bei einer einzigen
   * geladenen Staffel — bei mehreren zählt Netflix je Staffel neu und die Nummern sind nicht vergleichbar.
   */
  function neu(reihe, folgen, alleFolgen, gemeldet) {
    if (!nurEineStaffel(alleFolgen)) return null
    const bekannt = globalThis.akBekannt?.(stand, 'netflix', String(reihe))
    const offen = folgen.filter((f) => !gemeldet.has(f.videoId)).map((f) => Number(f.nummer))
    return bekannt ? globalThis.akNeueFolgen(bekannt, offen) : null
  }

  /** Ein Lauf ist sauber zu Ende, wenn nichts abgebrochen, gestört oder offen ist und jede Folge gemeldet. */
  function lauf(D, reihe) {
    if (D.laeuft || D.mehrfach || D.uebergangen) {
      lief ||= Boolean(D.laeuft)
      if (String(reihe) in merker) {
        delete merker[String(reihe)]
        schreiben()
      }
      return true
    }
    const fertig = lief && !D.abbruch && !D.stoerung && !D.randOffen
    lief = false
    if (fertig && D.folgen.length && D.folgen.every((f) => D.gemeldet.has(f.videoId)) && nurEineStaffel(D.alleFolgen ?? [])) {
      merker[String(reihe)] = new Date().toISOString()
      schreiben()
    }
    return false
  }

  /**
   * Der Knopf zeigt den Abschluss (aus, „✓ gemeldet“) oder die neuen Folgen („Neue Folgen 12–15 · prüfen und
   * melden“, der Klick prüft dann alle Folgen). `true`: Der Knopf ist beschriftet, `melder.js` zeichnet nichts mehr.
   */
  function zeigen(D, reihe) {
    const knopf = D.knopf
    if (!knopf || lauf(D, reihe) || D.stoerung) return false
    if (aktiv(reihe)) {
      knopf.textContent = '✓ gemeldet'
      knopf.title = 'Die Meldung ist angekommen. Der Datensatz zieht beim nächsten Bau nach.\n„↻ alle“ prüft noch einmal.'
      knopf.disabled = true
      knopf.classList.add('ak-fertig')
      return true
    }
    const n = neu(reihe, D.folgen, D.alleFolgen ?? [], D.gemeldet)
    if (!n) return false
    knopf.textContent = `Neue Folgen ${n.von}–${n.bis} · prüfen und melden`
    knopf.title = 'Der Datensatz kennt diese Folgen noch nicht.\nDer Klick prüft alle Folgen erneut: die alten werden bestätigt, die neuen ergänzt.'
    knopf.disabled = false
    knopf.classList.remove('ak-fertig')
    return true
  }

  return { laden, zeigen, neu }
})()
