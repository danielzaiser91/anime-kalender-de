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

  Der Knopf zeigt die neuen Folgen („Neue Folgen 12–15 · prüfen und melden“, der Klick prüft alle Folgen) oder den
  Abschluss (aus, „✓ gemeldet“). Neue Folgen gewinnen: Kommen sie innerhalb der 36 Stunden dazu, bleibt der Merker
  nicht stehen. `zeigen` gibt `true` zurück, wenn der Knopf beschriftet ist; `melder.js` zeichnet dann nichts mehr.

  `neu` nennt die Folgen hinter dem Stand des Datensatzes, die noch nicht gemeldet sind. Nur bei einer einzigen
  geladenen Staffel — bei mehreren zählt Netflix je Staffel neu und die Nummern sind nicht vergleichbar. Was der
  letzte saubere Lauf schon abdeckte (`bis` im Merker), zählt nicht noch einmal als neu.

  4.24.22: Gilt eine Folge nach dem Lauf lokal als offen, fragt `akGemeldetAbschliessen` den Briefkasten. Anlass: Die
  Randprobe schickt 15 Meldungen als Stapel 10 + 5 und merkt nur die Folgen vor, die der Worker im Stapel ausdrücklich
  bestätigt. Bestätigte er den ersten Stapel nicht, standen E1–10 lokal offen („▶ E1 + E10 prüfen → gilt für E1–10“),
  obwohl der Briefkasten alle 15 führte.

  4.24.22: Merker gelesen/gesetzt/gelöscht, das Urteil am Lauf-Ende und jeder geänderte Befund von `zeigen` gehen
  ins Zustandsprotokoll (`netflix-protokoll.js`, `nfpAufzeichnen`); fehlt es, bleibt alles wie vorher.
*/
globalThis.AK_GEMELDET = (() => {
  const SCHLUESSEL = 'netflixGemeldet'
  const HOECHSTENS_MS = 36 * 3600 * 1000
  let merker = {}
  let stand = null
  let lief = false /* lief der Lauf bei der letzten Anzeige noch? */
  let geladen = null

  /** Merker und Prüfstand holen (beim ersten `zeigen`); danach wird der Knopf neu gezeichnet. */
  async function laden() {
    merker = (await chrome.storage.local.get(SCHLUESSEL).catch(() => ({})))[SCHLUESSEL] ?? {}
    stand = (await globalThis.akPruefstand?.()) ?? null
    protokoll('merker-gelesen', { merker, pruefstandAm: stand?.pruefstandAm ?? null, standGeladen: Boolean(stand) })
    globalThis.durchlaufKnopfZeigen?.() /* Funktion aus melder.js, gleicher Scope */
  }

  function aktiv(reihe, jetzt = Date.now()) {
    const am = merker[String(reihe)]?.am
    if (!am || jetzt - Date.parse(am) > HOECHSTENS_MS) return false
    return !(stand?.pruefstandAm && stand.pruefstandAm > am)
  }

  const protokoll = (art, daten) => globalThis.nfpAufzeichnen?.(art, daten)

  /* Ohne Speicher gilt der Abschluss nur bis zum Neuladen. */
  const schreiben = () => chrome.storage.local.set({ [SCHLUESSEL]: merker }).catch(() => {})

  const nurEineStaffel = (alleFolgen) => new Set(alleFolgen.map((f) => String(f.seasonId ?? ''))).size <= 1

  function neu(reihe, folgen, alleFolgen, gemeldet) {
    if (!nurEineStaffel(alleFolgen)) return null
    const bekannt = globalThis.akBekannt?.(stand, 'netflix', String(reihe))
    const offen = folgen.filter((f) => !gemeldet.has(f.videoId)).map((f) => Number(f.nummer))
    const gedeckt = aktiv(reihe) ? merker[String(reihe)].bis : 0
    return bekannt ? globalThis.akNeueFolgen(Math.max(bekannt, gedeckt), offen) : null
  }

  /** Ein Lauf ist sauber zu Ende, wenn nichts abgebrochen, gestört oder offen ist und jede Folge gemeldet. */
  function lauf(D, reihe) {
    if (D.laeuft || D.mehrfach || D.uebergangen) {
      lief ||= Boolean(D.laeuft)
      if (String(reihe) in merker) {
        delete merker[String(reihe)]
        schreiben()
        protokoll('merker-geloescht', { reihe: String(reihe), laeuft: Boolean(D.laeuft), mehrfach: Boolean(D.mehrfach) })
      }
      return true
    }
    const fertig = lief && !D.abbruch && !D.stoerung && !D.randOffen
    if (lief) globalThis.nfpUrteil?.(D, reihe, fertig)
    lief = false
    if (fertig && D.folgen.length && nurEineStaffel(D.alleFolgen ?? [])) {
      akGemeldetAbschliessen(D, reihe, (bis) => {
        merker[String(reihe)] = { am: new Date().toISOString(), bis }
        schreiben()
        protokoll('merker-gesetzt', { reihe: String(reihe), merker: merker[String(reihe)] })
      })
    }
    return false
  }

  function zeigen(D, reihe) {
    const knopf = D.knopf
    geladen ??= laden()
    if (!knopf || lauf(D, reihe) || D.stoerung) return false
    const n = neu(reihe, D.folgen, D.alleFolgen ?? [], D.gemeldet)
    protokoll('zeigen', { neu: n, aktiv: aktiv(reihe), merkerAm: merker[String(reihe)]?.am ?? null, pruefstandAm: stand?.pruefstandAm ?? null })
    if (!n && !aktiv(reihe)) return false
    knopf.textContent = n ? globalThis.akNeueText(n) : '✓ gemeldet'
    knopf.title = n
      ? 'Der Datensatz kennt diese Folgen noch nicht.\nDer Klick prüft alle Folgen erneut: die alten werden bestätigt, die neuen ergänzt.'
      : 'Die Meldung ist angekommen. Der Datensatz zieht beim nächsten Bau nach.\n„↻ alle“ prüft noch einmal.'
    knopf.disabled = !n
    knopf.classList.toggle('ak-fertig', !n)
    return true
  }

  return { zeigen, neu }
})()

/**
 * Alle Folgen gemeldet: `setzen(höchste Folge)` schreibt den Merker. Gilt lokal eine Folge als offen, wird einmal der
 * Briefkasten gefragt (`meldungenLaden`, nur diese Abfrage — `durchlaufStandLaden` fällt bei jedem Fehler auf den
 * lokalen Speicher zurück) und dann neu entschieden: der Briefkasten ist die Wahrheit, die Bestätigung eines Stapels
 * nur ein Vermerk darüber.
 */
function akGemeldetAbschliessen(D, reihe, setzen, nachgefragt = false) {
  const offen = D.folgen.filter((f) => !D.gemeldet.has(f.videoId))
  if (!offen.length) {
    setzen(Math.max(...D.folgen.map((f) => Number(f.nummer))))
    return
  }
  if (nachgefragt) return
  globalThis.nfpAufzeichnen?.('abgleich', { reihe: String(reihe), offen: offen.length })
  void Promise.resolve(globalThis.meldungenLaden?.(reihe)).then(() => {
    for (const f of offen) {
      if (globalThis.meldungAm?.(reihe, null, f.nummer, f.videoId) !== undefined) D.gemeldet.add(f.videoId)
    }
    if (!D.laeuft) akGemeldetAbschliessen(D, reihe, setzen, true)
    globalThis.durchlaufKnopfZeigen?.()
  })
}
