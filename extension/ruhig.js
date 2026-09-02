/**
 * **Der Ruhemodus, so früh wie möglich.**
 *
 * `amazon.js` läuft bei `document_idle` — da stehen Amazons Elemente längst, das
 * Hintergrundvideo läuft, und die Erweiterung hat sich schon gezeichnet. Wer
 * eine Aufnahme macht, sieht dann genau die Sekunde Unruhe, die der Modus
 * verhindern soll (Daniel, 02.09.2026: „it activates the ruhemodus too late").
 *
 * Diese Datei läuft bei `document_start`, also bevor der erste Knoten im Body
 * steht. Sie tut genau eines: den gespeicherten Zustand holen und die Klasse
 * setzen. Alles Weitere — Schalter, Anzeige, Umschalten — bleibt in `amazon.js`.
 *
 * **Die Lücke bleibt Millisekunden groß und lässt sich nicht schließen.**
 * `chrome.storage` antwortet nur asynchron; es gibt keinen synchronen Weg, den
 * Wert vor dem ersten Bild zu kennen. Optimistisch die Klasse zu setzen und sie
 * bei „aus" wieder zu entfernen wäre die Alternative — dann flackert jede Seite
 * für alle, die den Modus nie benutzen. Das ist der schlechtere Tausch.
 */
;(() => {
  try {
    const wurzel = document.documentElement
    if (!wurzel) return
    void Promise.resolve(chrome.storage.local.get('akRuhig')).then((x) => {
      if (x?.akRuhig) wurzel.classList.add('ak-ruhig')
    })
  } catch {
    /* Ohne Speicher startet die Seite normal — der Schalter bleibt bedienbar. */
  }
})()
