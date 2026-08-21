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
