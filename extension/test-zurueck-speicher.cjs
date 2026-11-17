/*
  Testhilfe (kein Test, vom Läufer nicht gefahren): der Speicher der Merkliste (`netflix-zurueckgestellt.js`) wie `chrome.storage.local`
  — kopiert beim Lesen und Schreiben, `get(null)` liefert alles, `remove` löscht. Seit 17.11.2026 (4071) liegt je Titel ein Schlüssel.
*/
const PRAEFIX = 'netflixZurueck:'
const kopie = (x) => JSON.parse(JSON.stringify(x))

const speicherNeu = (start = {}) => {
  const daten = kopie(start)
  return {
    daten,
    get: async (k) => (k === null ? kopie(daten) : k in daten ? { [k]: kopie(daten[k]) } : {}),
    set: async (o) => void Object.assign(daten, kopie(o)),
    remove: async (k) => void delete daten[k],
  }
}

/** Der Anfangsstand `{ Kennung: Eintrag }` als Schlüssel je Titel. */
const zurueckStart = (stand) => Object.fromEntries(Object.entries(stand).map(([k, e]) => [PRAEFIX + k, e]))

/** Die Einträge im Speicher als `{ Kennung: Eintrag }`. */
const stand = (speicher) =>
  Object.fromEntries(
    Object.entries(speicher.daten)
      .filter(([k]) => k.startsWith(PRAEFIX))
      .map(([k, e]) => [k.slice(PRAEFIX.length), e]),
  )

/** Ersetzt alle Einträge im Speicher durch `neu` (`{ Kennung: Eintrag }`), wie ein anderer Tab es täte. */
const standSetzen = (speicher, neu) => {
  for (const k of Object.keys(speicher.daten)) if (k.startsWith(PRAEFIX)) delete speicher.daten[k]
  Object.assign(speicher.daten, kopie(zurueckStart(neu)))
}

module.exports = { speicherNeu, zurueckStart, stand, standSetzen, PRAEFIX }
