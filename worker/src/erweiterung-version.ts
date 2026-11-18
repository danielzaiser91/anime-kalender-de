/**
 * Die Erweiterungsversion einer Meldung (18.11.2026): Am selben Tag kamen 152 falsche Umleitungsmeldungen, und welche
 * Version sie erzeugt hatte, war nicht feststellbar. Sie steht nur zur Auswertung da und fließt in keinen Vergleich ein
 * (nicht in den Meldungs-Hash, nicht in `gleicherInhalt`): ein Versionswechsel schreibt keine Meldung neu.
 */
const FORM = /^[\w.+-]{1,20}$/

/** Die Version aus dem Rumpf (`version`), oder `null` bei alten Meldungen und unbrauchbaren Werten. */
export function erweiterungVersion(daten: Record<string, unknown>): string | null {
  const v = daten.version
  return typeof v === 'string' && FORM.test(v) ? v : null
}
