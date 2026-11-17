/**
 * Holt main per `update-branch` in den PR-Zweig (Lehre 129, 17.11.2026): Schließen und Wiederöffnen ließ die Kette mehrfach gegen die alte Basis
 * laufen (PR 4069: sieben Schließen/Öffnen-Paare, Kette weiter gegen 6cc945fe4 statt 5f7c1343e), `update-branch` mit `expected_head_sha` brachte
 * main jedes Mal in den Zweig (PR 4069 Kopf 6ccbb47a9, PR 4097 Kopf eca1e9a71). Der Kopf ändert sich: der Aufrufer meldet den neuen Kopf und endet mit Exit 1.
 */
export const KOPF_PRUEFUNGEN = 15
export const KOPF_ABSTAND_MS = 2000

const kurz = (sha) => sha.slice(0, 9)

/**
 * Rückgabe: neuer Kopf (40 Zeichen) oder null, wenn update-branch nicht möglich war und der Rückfall (Schließen/Öffnen) gelten darf.
 * Wirft bei 422 (Konflikt oder Kopf nicht mehr aktuell), Zeitlimit und bei angenommenem, aber nicht sichtbarem Update: dort nichts weiter anstoßen.
 */
export function aktualisiereZweig(gh, nummer, kopf, warte) {
  try {
    gh(['api', '-X', 'PUT', `repos/{owner}/{repo}/pulls/${nummer}/update-branch`, '-f', `expected_head_sha=${kopf}`])
  } catch (e) {
    const text = String(e.message)
    if (/\b422\b/.test(text)) throw new Error(`PR ${nummer}: update-branch abgelehnt (422: Konflikt mit main oder Kopf ${kurz(kopf)} nicht mehr aktuell): main von Hand hineinmergen bzw. Kopf neu lesen; nichts angestoßen (${text.split('\n')[0]})`)
    if (text.startsWith('FEHLER:')) throw new Error(`PR ${nummer}: update-branch hing (${text}); Kopf prüfen (SCHON ANGESTOSSEN möglich), nicht blind wiederholen`)
    return null
  }
  for (let i = 0; ; i++) {
    const neu = gh(['api', `repos/{owner}/{repo}/pulls/${nummer}`, '--jq', '.head.sha']).trim()
    if (neu !== '' && neu !== kopf) return neu
    if (i >= KOPF_PRUEFUNGEN) throw new Error(`PR ${nummer}: update-branch angenommen, Kopf noch ${kurz(kopf)} (SCHON ANGESTOSSEN: später Kopf prüfen, nicht blind wiederholen)`)
    warte(KOPF_ABSTAND_MS)
  }
}
