/* Urteil über die Lage des Testfensters der Laufstatus-App (Daniel, 31.10.2026: kein sichtbares Fenster, kein Fokusraub). */

/** Liegt der Rahmen `b` ganz oder teilweise auf einem der Bildschirme? */
export function schneidetBildschirm(b, bildschirme) {
  return bildschirme.some((a) => b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y)
}

/** Drei Prüfzeilen `[was, ok, zusatz]` aus der gemessenen Lage. skipTaskbar hat in Electron keinen Getter (nicht messbar). */
export function fensterUrteil(lage) {
  return [
    ['Testfenster liegt außerhalb aller Bildschirme', lage.schneidet === false, JSON.stringify(lage.bounds)],
    ['ohne Fokus', lage.fokus === false, undefined],
    ['und gilt trotzdem als sichtbar', lage.sichtbar === true, undefined],
  ]
}
