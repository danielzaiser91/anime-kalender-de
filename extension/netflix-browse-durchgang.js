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
 * Ein Schritt des Durchgangs auf /browse. `u`: selbstAn, pfad, zuletzt, offeneTitel, jetzt, uebersprungen (Map),
 * melden(id, titel) → `{ ok, text }`, verbrauchen(), spur(was, dazu), weiter(). Gibt `true`, wenn er gehandelt hat.
 */
globalThis.akNetflixBrowseDurchgang = async (u) => {
  if (!u.selbstAn || !/^\/(?:[a-z-]+\/)?browse\b/.test(u.pfad)) return false
  const auftrag = globalThis.akNetflixBrowseAuftrag(u.zuletzt, u.offeneTitel, u.jetzt)
  if (!auftrag || u.jetzt - (auftrag.zeit ?? 0) < BROWSE_ANKOMMEN_MS) return false
  const id = String(auftrag.id)
  const titel = u.offeneTitel[id]?.titel ?? id
  u.verbrauchen() /* vor dem Abruf: der nächste Takt darf nicht ein zweites Mal melden */
  const r = await u.melden(id, titel)
  if (r.ok) u.uebersprungen.set(id, globalThis.AK_NETFLIX_NICHT_DA)
  else u.uebersprungen.set(id, `Meldung nicht möglich: ${r.text}`)
  u.spur(r.ok ? 'Auf /browse umgeleitet, gemeldet' : 'Auf /browse umgeleitet, Meldung fehlgeschlagen', { id, titel, text: r.text ?? null })
  u.weiter()
  return true
}
