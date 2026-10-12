/*
  **Uneinheitliche Randprobe: Hinweis und Grenzfeld** — eigene Datei, weil `melder.js` über der Zeilengrenze
  liegt (check:umfang). Lädt laut Manifest vor `melder.js`. Hier steht, was `durchlaufStarten` bei einer
  Randprobe tut, deren erste und letzte Folge nicht gleich ausgehen.
*/
globalThis.akNetflixRandUneinheitlich = (D, erste, letzte) => {
  D.randOffen = { folgen: D.randprobe, erste, letzte }
  console.warn(
    `[Anime-Kalender] Folge ${erste.folge.nummer} ist ${erste.deutsch ? 'deutsch' : 'nicht deutsch'}, ` +
      `Folge ${letzte.folge.nummer} ${letzte.deutsch ? 'deutsch' : 'nicht'} — nichts gemeldet. ` +
      'Grenze im Feld unten eintragen oder den vollen Lauf starten.',
  )
}
