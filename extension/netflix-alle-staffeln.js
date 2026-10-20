/**
 * Beschriftung des Knopfes in „Alle Folgen anzeigen“, wenn nichts mehr offen ist.
 *
 * „Gemeldet“ heißt: jede Folge der Staffel hat eine Meldung. Dass ein Titel nicht auf der
 * Prüfliste steht (und deshalb keine Staffel als offen gilt), ist keine Meldung — Edgerunners
 * zeigte so „2 Staffeln gemeldet“, obwohl nur eine gemeldet war (Daniel, 20.10.2026).
 *
 * `staffeln`: Map Netflix-Kennung → Folgenliste; `jeFolge`: Map der gemeldeten videoIds (als Text)
 * aus `MELDUNGEN`; `imLauf`: Set der in diesem Durchgang gemeldeten videoIds.
 */
globalThis.akAlleStaffelnFertig = (staffeln, jeFolge, imLauf) => {
  const gruppen = [...staffeln.values()]
  const gemeldet = gruppen.filter(
    (g) => g.length && g.every((f) => Boolean(jeFolge?.has(String(f.videoId))) || Boolean(imLauf?.has(f.videoId))),
  ).length
  if (!gemeldet) {
    return { gruppen: gruppen.length, text: 'Alle Staffeln · ✓ nichts offen', title: 'Für diesen Titel liegt nichts auf der Prüfliste.' }
  }
  if (gemeldet < gruppen.length) {
    return {
      gruppen: gruppen.length,
      text: `Alle Staffeln · ✓ ${gemeldet} von ${gruppen.length} Staffeln gemeldet`,
      title: 'Die übrigen Staffeln stehen nicht auf der Prüfliste.',
    }
  }
  return {
    gruppen: gruppen.length,
    text: `Alle Staffeln · ✓ ${gruppen.length} ${gruppen.length === 1 ? 'Staffel' : 'Staffeln'} gemeldet`,
    title: 'Alles gemeldet.',
  }
}
