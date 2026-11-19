/**
 * Die Adresse der Seite, auf der die Erweiterung eine Meldung erzeugt hat (19.11.2026, Migration 066). Sie steht nur zur
 * Auswertung da und fließt in keinen Vergleich ein (nicht in den Meldungs-Hash): ein anderer Seitenaufruf schreibt keine
 * Meldung neu. Suchteil und Anker fallen weg — dort hängen Anbieter Sitzungs- und Herkunftsangaben an.
 */
const FORM = /^https?:\/\/[^\s?#]{1,300}/

/** Die Seitenadresse aus dem Rumpf (`seitenAdresse`), oder `null` bei alten Meldungen und unbrauchbaren Werten. */
export function meldungSeitenadresse(daten: Record<string, unknown>): string | null {
  const a = daten.seitenAdresse
  return typeof a === 'string' ? (FORM.exec(a.trim())?.[0] ?? null) : null
}
