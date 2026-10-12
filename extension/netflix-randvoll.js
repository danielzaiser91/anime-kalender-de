/*
  **Uneinheitliche Randprobe: im Sammeldurchgang misst die Erweiterung alle Folgen** (4.30.0, 12.10.2026) —
  eigene Datei, weil `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Anlass (Daniel, 12.10.2026, Netflix 80174608): Folge 1 deutsch, Folge 9 nicht. Der Durchgang setzte
  `randOffen`, warnte und wartete auf eine Grenze im Feld; der Titel blieb ohne Meldung. Im Sammeldurchgang
  wartet niemand davor. Also bekommt der nächste Anlauf desselben Titels `vollLauf` und misst jede Folge
  (`durchlaufStarten` liest den Merker einmal und macht dann keine Randprobe). Gemeldet wird, was gemessen
  ist: eine Folge ohne Deutsch geht als „kein Deutsch" raus, nichts wird angenommen. Die Last bleibt in den
  Händen von `durchlaufMelden`: Tageslimit und 5xx-Pause (`tageslimit.js`) setzen `abbruch`, der Lauf endet.

  Von Hand gestartet (kein Sammeldurchgang) bleibt es beim Hinweis und dem Grenzfeld.
*/
globalThis.akNetflixRandUneinheitlich = (D, reihe, sammeln, erste, letzte) => {
  const urteil = (r) => `Folge ${r.folge.nummer} ${r.deutsch ? 'deutsch' : 'nicht deutsch'}`
  if (sammeln) {
    D.randOffen = null
    D.vollLauf = String(reihe)
    console.info(`[Anime-Kalender] ${urteil(erste)}, ${urteil(letzte)} — alle ${D.randprobe.length} Folgen werden einzeln geprüft.`)
    return
  }
  D.randOffen = { folgen: D.randprobe, erste, letzte }
  console.warn(`[Anime-Kalender] ${urteil(erste)}, ${urteil(letzte)} — nichts gemeldet. Grenze im Feld unten eintragen oder den vollen Lauf starten.`)
}
