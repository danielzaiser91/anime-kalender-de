// Getrennte Datei, weil Manifest v3 kein Inline-Skript erlaubt.
const feld = document.getElementById('token')
const stand = document.getElementById('stand')

chrome.storage.sync.get('token').then(({ token }) => {
  if (token) feld.value = token
})

document.getElementById('speichern').addEventListener('click', async () => {
  await chrome.storage.sync.set({ token: feld.value.trim() })
  stand.textContent = 'gespeichert'
  setTimeout(() => { stand.textContent = '' }, 2000)
})

/**
 * Den Merkzettel leeren, den die Übersicht führt.
 *
 * Zwei Schlüssel, zwei Anbieter: `erledigt` (Netflix) und `amazonErledigt`
 * (Prime Video). Die Meldungen selbst liegen im Worker und bleiben
 * unberührt — hier verschwindet nur die Erinnerung daran, was schon
 * angeklickt wurde.
 *
 * Der Knopf gibt es, weil ein Konsolenbefehl dafür nicht funktioniert:
 * `chrome.storage` erreicht man aus der Seitenwelt nicht (Daniel,
 * 23.08.2026: „Cannot read properties of undefined (reading 'local')").
 */
const zuruecksetzen = document.getElementById('zuruecksetzen')
const standStand = document.getElementById('standStand')

if (zuruecksetzen) {
  zuruecksetzen.addEventListener('click', async () => {
    try {
      const vorher = await chrome.storage.local.get(['erledigt', 'amazonErledigt'])
      const zahl =
        Object.keys(vorher.erledigt ?? {}).length +
        Object.keys(vorher.amazonErledigt ?? {}).length
      await chrome.storage.local.remove(['erledigt', 'amazonErledigt'])
      standStand.textContent = zahl
        ? `${zahl} Einträge geleert — offene Tabs neu laden`
        : 'Der Merkzettel war schon leer'
    } catch (err) {
      standStand.textContent = `Fehlgeschlagen: ${err.message}`
    }
  })
}
