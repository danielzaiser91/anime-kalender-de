/*
  **Netflix-Durchgang: Warten auf die Folgenliste einer Titelseite** — eigene Datei, weil `melder.js`
  über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Kommt die Liste nicht, hängt der Durchgang nicht still auf dieser Seite: Nach `o.frist` geht er
  zum nächsten Titel, der Titel steht als übersprungen in der Endliste.
*/

/**
 * Ein Takt des Wartens auf die Folgenliste. `wartet`: `{ seite, seit }` oder `null`;
 * `o`: `{ seite, reihe, frist, jetzt, durchlauf }`; `tun`: `{ spur, uebersprungen, weiter }`.
 * Gibt den neuen Wartestand zurück.
 */
globalThis.akNetflixListeWarten = (wartet, o, tun) => {
  if (wartet?.seite !== o.seite) return { seite: o.seite, seit: o.jetzt }
  if (o.jetzt - wartet.seit <= o.frist) return wartet
  tun.spur('keine Folgenliste', { reihe: o.reihe, folgen: o.durchlauf.folgen.length, listeFuer: o.durchlauf.listeFuer ?? null })
  tun.uebersprungen.add(o.reihe)
  tun.weiter()
  return null
}
