/*
  **Netflix-Durchgang: ein Titel, den Netflix auf /browse umleitet, wird selbst gemeldet** (03.11.2026)

  Daniel am 03.11.2026: 5 Centimeters per Second, A Silent Voice und Afro Samurai leiteten auf /browse um
  (Titel nicht mehr bei Netflix), und „▶ alle durchgehen" blieb dort stehen — angeboten war nur der Handknopf
  (`browseWegKnopf` in `melder.js`). Läuft der Durchgang und ist der Sprung des Durchgangs frisch und
  unverbraucht, meldet dieser Schritt den Titel einmal als „nicht bei Netflix" und geht weiter, wie
  `disney-durchgang.js` es für Disney+ tut. Schlägt die Meldung fehl, wird nichts gemeldet; der Titel bleibt
  mit dem Grund zurückgestellt. Ohne Durchgang bleibt es beim Handknopf. Lädt laut Manifest vor `melder.js`.

  Der Handknopf selbst (Daniel am 19.09.2026 an „Bakugan“ (81659233): „der titel ist nicht bei netflix, der
  link wird auf homepage weitergeleitet, aber extension hätte … meldung nicht bei netflix möglich sein“
  müssen; der Kasten zeigte nur „alles gemeldet“): derselbe Befund wie „als tot melden“ in der Liste, dort
  angeboten, wo er auffällt — solange der Klick keine Minute her ist.
*/
globalThis.AK_NETFLIX_NICHT_DA = 'nicht bei Netflix gemeldet'

const BROWSE_ANKOMMEN_MS = 6000
const BROWSE_FENSTER_MS = 60 * 1000

/** Der Auftrag, den der letzte Sprung geöffnet hat (frisch, nicht verbraucht, in der Prüfliste) oder `null`. */
globalThis.akNetflixBrowseAuftrag = (zuletzt, offeneTitel, jetzt) => {
  try {
    return zuletzt?.id && !zuletzt.verbraucht && offeneTitel[zuletzt.id] !== undefined && jetzt - (zuletzt.zeit ?? 0) < BROWSE_FENSTER_MS
      ? zuletzt
      : null
  } catch {
    return null
  }
}

/**
 * **Gemeldet wird nur, wenn der Sprung nie irgendwo angekommen ist** (Prüfer 2751 A1/A2): Hat die Zieltitelseite
 * ihre Folgenliste geliefert (`listeFuer`/`filmId`) oder war eine andere Seite zu sehen (Profilwahl, Login),
 * wurde nicht umgeleitet, und ein späteres /browse ist Daniels eigener Weg. Die Markierung `gesehen` liegt auch
 * im Speicher, denn Profilwahl und Login laden die Seite neu. Der Pfad der Zieltitelseite allein zählt nicht:
 * `gehe()` setzt ihn sofort, Netflix leitet danach erst um.
 */
function browseGesehenMerken(u, auftrag) {
  if (auftrag.gesehen) return
  const titelSeite = /^\/(?:[a-z-]+\/)?title\//.test(u.pfad)
  const id = String(auftrag.id)
  if (titelSeite && ![u.listeFuer, u.filmId].some((k) => k != null && String(k) === id)) return
  const neu = { ...auftrag, gesehen: true }
  u.setzen(neu)
  void u.speichern({ zuletztGeoeffnet: neu })
}

/**
 * Ein Schritt des Durchgangs. `u`: selbstAn, pfad (mit Suchteil), zuletzt, offeneTitel, jetzt, listeFuer, filmId,
 * uebersprungen (Map), melden(id, titel) → `{ ok, text }`, setzen(zuletzt), speichern(werte), spur(was, dazu),
 * weiter(). Gibt `true`, wenn er gemeldet hat.
 */
globalThis.akNetflixBrowseDurchgang = async (u) => {
  if (!u.selbstAn) return false
  const auftrag = globalThis.akNetflixBrowseAuftrag(u.zuletzt, u.offeneTitel, u.jetzt)
  if (!auftrag) return false
  if (!/^\/(?:[a-z-]+\/)?browse\b/.test(u.pfad)) {
    browseGesehenMerken(u, auftrag)
    return false
  }
  if (auftrag.gesehen || /[?&]jbv=/.test(u.pfad) || u.jetzt - (auftrag.zeit ?? 0) < BROWSE_ANKOMMEN_MS) return false
  const id = String(auftrag.id)
  const titel = u.offeneTitel[id]?.titel ?? id
  u.setzen({ ...auftrag, verbraucht: true }) /* vor dem Abruf: der nächste Takt darf nicht ein zweites Mal melden */
  const r = await u.melden(id, titel)
  if (r.ok) u.uebersprungen.set(id, globalThis.AK_NETFLIX_NICHT_DA)
  else u.uebersprungen.set(id, `Meldung nicht möglich: ${r.text}`)
  u.spur(r.ok ? 'Auf /browse umgeleitet, gemeldet' : 'Auf /browse umgeleitet, Meldung fehlgeschlagen', { id, titel, text: r.text ?? null })
  u.weiter()
  return true
}
