/*
  Schutz vor einem toten Erweiterungs-Kontext — die einzige Stelle, die `chrome.storage`/`chrome.runtime`
  in Content-Scripts anfasst (Wächter: `kontext-schutz.test.cjs`).

  Chrome trennt beim Neuladen/Aktualisieren der Erweiterung alle laufenden Content-Scripts: Jeder
  `chrome.*`-Zugriff wirft synchron „Extension context invalidated", `chrome.storage` ist `undefined`
  (Daniel, 23.08.2026 und 13.11.2026). Ein toter Kontext ist kein Fehler: lesen liefert `null`,
  schreiben `false`, alles andere tut nichts — still und ohne Wiederholung.
*/
globalThis.akKontext = (() => {
  /** `chrome.runtime.id` verschwindet mit der Verbindung. */
  function lebt() {
    try {
      return Boolean(chrome?.runtime?.id)
    } catch {
      return false
    }
  }

  /**
   * Liest `schluessel` aus `bereich` ('local' | 'sync'); `null`, wenn der Kontext tot ist oder der Zugriff wirft.
   * Gibt das Ergebnis von Chrome unverändert zurück (Zusage; der Testsandkasten antwortet synchron), nur ein
   * Fehlschlag der Zusage wird zu `null`.
   */
  function lesen(schluessel, bereich = 'local') {
    if (!lebt()) return null
    try {
      const r = chrome.storage[bereich].get(schluessel)
      return typeof r?.catch === 'function' ? r.catch(() => null) : r
    } catch {
      return null
    }
  }

  /** Schreibt `werte` in `bereich`; `true`, wenn es ankam. */
  async function schreiben(werte, bereich = 'local') {
    if (!lebt()) return false
    try {
      await chrome.storage[bereich].set(werte)
      return true
    } catch {
      return false
    }
  }

  /** Hängt `fn(aenderung, bereich)` an `storage.onChanged`; `false`, wenn der Kontext tot ist. */
  function beiAenderung(fn) {
    if (!lebt()) return false
    try {
      chrome.storage.onChanged.addListener((a, b) => {
        if (lebt()) fn(a, b)
      })
      return true
    } catch {
      return false
    }
  }

  /** Die Erweiterungsversion; `null` im toten Kontext. */
  function version() {
    try {
      return lebt() ? (chrome.runtime.getManifest?.().version ?? null) : null
    } catch {
      return null
    }
  }

  /** Der Text, wenn kein Token da ist — im toten Kontext liegt es nicht am Token, sondern an der Verbindung. */
  const keinTokenText = () =>
    lebt() ? 'Kein Token — Rechtsklick aufs Symbol, dann Optionen' : 'Erweiterung neu geladen — Seite neu laden'

  /** Wie `chrome.storage.local` (`get`/`set`), aber tot-sicher — für Bauteile, die einen Speicher gereicht bekommen. */
  const lokal = {
    get: async (schluessel) => (await lesen(schluessel)) ?? {},
    set: schreiben,
  }

  return { lebt, lesen, schreiben, beiAenderung, version, keinTokenText, lokal }
})()
/* Die Folgeskripte im Manifest beginnen mit `;` (huellen-semikolon.test.cjs): Diese Datei endet ohne Semikolon. */
