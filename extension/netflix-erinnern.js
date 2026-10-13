/*
  **Netflix-Durchgang: Titelseite ohne Folgenliste** — eigene Datei, weil `melder.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Daniel am 13.10.2026 (4.30.4), Yu-Gi-Oh! (`/title/70177034`): Die Titelseite zeigt statt „Abspielen"
  nur „Erinnern", keine Folgenliste, nur „Ähnliche Titel". Der Durchgang wartete die ganze Frist auf
  eine Liste (20 s plus Takt, gut 30 s), die dort nie kommt. Jetzt geht er nach `ERINNERN_NACH_MS`
  weiter und **meldet nichts** (wie Disney+: ein Nein hat mehrere Gründe, und das Merkmal ist unbelegt).
  Ein Nein meldet weiter nur der Klick auf „Keine Folge da — als nicht abrufbar melden" (`melden()`);
  die Automatik dafür wurde am 26.08.2026 bewusst entfernt. Der Titel steht als übersprungen in der Endliste.

  Das Merkmal ist das des Knopfes (`keineFolgeVorhanden()`, Text „Erinnern" / „Remind me"); ein
  sprachfreies Merkmal im DOM oder Netzwerk ist ohne Mitschnitt einer solchen Seite nicht belegt.
  Die Schonzeit hält Reste einer vorigen Seite und eine noch ladende Liste auseinander von der Seite.
*/
const ERINNERN_NACH_MS = 3000

/**
 * Ein Takt des Wartens auf die Folgenliste. `wartet`: `{ seite, seit, entschieden? }` oder `null`;
 * `o`: `{ seite, reihe, erinnern, frist, jetzt, durchlauf }`; `tun`: `{ spur, uebersprungen (Map Kennung → Grund), weiter }`.
 * Gibt den neuen Wartestand zurück.
 */
globalThis.akNetflixListeWarten = (wartet, o, tun) => {
  if (wartet?.seite !== o.seite) return { seite: o.seite, seit: o.jetzt }
  if (wartet.entschieden) return wartet
  const dauer = o.jetzt - wartet.seit
  const dazu = { reihe: o.reihe, folgen: o.durchlauf.folgen.length, listeFuer: o.durchlauf.listeFuer ?? null }
  if (o.erinnern && dauer >= ERINNERN_NACH_MS) {
    tun.spur('Erinnern statt Folgenliste', dazu)
    tun.uebersprungen.set(o.reihe, 'Erinnern statt Folgenliste')
    tun.weiter()
    return { ...wartet, entschieden: true }
  }
  if (dauer <= o.frist) return wartet
  tun.spur('keine Folgenliste', dazu)
  tun.uebersprungen.set(o.reihe, `keine Folgenliste in ${Math.round(o.frist / 1000)} s`)
  tun.weiter()
  return null
}

/**
 * Grund für einen Titel, der nach allen Versuchen offen blieb (Eintrag in `selbstUebersprungen`);
 * ein gerissenes Tageslimit gehört dazu, weil dann die Meldungen scheiterten, nicht der Titel.
 */
globalThis.akNetflixGrundOffen = (versuche) => {
  const limit = globalThis.AK_TAGESLIMIT?.text()
  return `nach ${versuche} Versuchen noch offen${limit ? ` (${limit})` : ''}`
}
