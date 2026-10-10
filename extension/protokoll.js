/*
  **Zustandsprotokoll: ein Ringpuffer der letzten 200 Ereignisse** (4.24.22, 10.10.2026)

  Der Melde-Kasten auf Netflix sprang nach dem Melden zweimal zurück auf den klickbaren Prüfknopf
  (4.24.21 half nicht), und im Sandkasten ließ sich der Rücksprung nicht herstellen. Statt zu raten,
  schreibt dieses Modul auf, was der Kasten tut: Zustandswechsel, Merker, Worker-Antworten, Lauf-Ende.
  „Bericht laden" nimmt es mit (`netflix-protokoll.js`).

  Der Puffer liegt in `chrome.storage.local` und überlebt das Neuladen der Seite. Er enthält nur Titel-
  und Folgenkennungen, Zahlen und Knopftexte — nichts Personenbezogenes. Geschrieben wird gesammelt
  (höchstens alle 500 ms), damit ein Lauf den Speicher nicht je Ereignis anfasst.
*/
globalThis.akProtokoll = (() => {
  const SCHLUESSEL = 'akZustandsprotokoll'
  const MAX = 200
  let liste = []
  let geplant = false

  /* Was vor dem Neuladen stand, kommt vor das, was seit dem Laden dazukam. */
  const geladen = Promise.resolve(chrome.storage.local.get(SCHLUESSEL))
    .then((r) => {
      liste = [...(r?.[SCHLUESSEL] ?? []), ...liste].slice(-MAX)
    })
    .catch(() => {})

  function sichern() {
    if (geplant) return
    geplant = true
    setTimeout(async () => {
      geplant = false
      await geladen
      await Promise.resolve(chrome.storage.local.set({ [SCHLUESSEL]: liste })).catch(() => {})
    }, 500)
  }

  /** Ein Ereignis aufzeichnen: `art` nennt es, `daten` trägt nur einfache Werte. */
  function ereignis(art, daten = {}) {
    liste.push({ t: new Date().toISOString(), art, ...daten })
    if (liste.length > MAX) liste.splice(0, liste.length - MAX)
    sichern()
  }

  ereignis.liste = () => liste.slice()
  return ereignis
})()
