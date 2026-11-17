/**
 * Teil der Vorprüfung (`pr-vorpruefung.mjs`): die Ratsche „Kindprozess in Tests ohne Frist“ (`test-kind-frist.mjs`) läuft vor dem PR,
 * sobald der Diff einen Test, eine Kulisse oder den Stand berührt. Sonst wurde sie erst in der Kette rot (PR 2539, 2556, 3765).
 */

/** Berührt der Diff eine Datei, die `test-kind-frist.mjs` zählt (Tests, Kulissen, Attrappen-Mocks), den Stand oder die Ratsche selbst? */
export function kindFristNoetig(dateien) {
  return dateien.some((d) => /^tools\/[^/]+(\.test\.(mjs|ts|tsx)|-(kulisse|mock)\.mjs)$/.test(d) || /^tools\/test-kind-frist(-stand\.json|\.mjs)$/.test(d))
}

/** Rote Befunde der Ratsche (leer, wenn der Diff nichts Zählbares berührt; `fahre()` startet sie und liefert deren Befunde). */
export function kindFristRot(dateien, fahre) {
  return kindFristNoetig(dateien) ? fahre() : []
}
