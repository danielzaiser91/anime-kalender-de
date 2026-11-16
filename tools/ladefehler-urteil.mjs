/**
 * Regeln für die Fehlerzustände beim Laden (16.11.2026, `releases.json` mit 503), als reine Funktionen aus festen Messwerten.
 * Messung und Bilder: `tools/ladefehler-messen.mjs`.
 */
export const FEHLER_SATZ = 'Die Daten laden gerade nicht.'
export const FEHLER_HINWEIS = 'Klappt es nicht, versuch es in ein paar Minuten noch einmal.'
export const KNOPF_NAME = 'Erneut versuchen'
/** Wörter, die ein Besucher nie sehen soll: Befehl, Dateiname, Statuscode. */
export const VERBOTEN = /npm|\.json|\b[45]\d\d\b|data:all|pipeline/i
const KNOPF_MIN_PX = 44

/** Ein Aussetzer: die Seite lädt normal, und der Abruf kam wirklich zweimal (sonst prüfte der Fall nichts). */
export function aussetzerFehler({ anfragen, fehlerSichtbar, geladen }) {
  const fehler = []
  if (anfragen < 2) fehler.push(`Aussetzer nicht ausgelöst oder nicht wiederholt (${anfragen} Anfrage/n)`)
  if (fehlerSichtbar) fehler.push('Fehlerseite trotz Aussetzer')
  if (!geladen) fehler.push('Seite lädt nach dem Aussetzer nicht')
  return fehler
}

/** Dauerstörung: der Satz steht da, der Knopf ist groß genug, kein Entwicklertext. `breite` ist die Fensterbreite (Tippfläche gilt am Handy: 44 px). */
export function dauerFehler({ text, knopf, anfragen }) {
  const fehler = []
  if (anfragen < 4) fehler.push(`zu wenige Versuche vor der Fehlerseite (${anfragen}, erwartet 4)`)
  if (!text.includes(FEHLER_SATZ)) fehler.push(`Besuchersatz fehlt („${FEHLER_SATZ}“)`)
  if (!text.includes(FEHLER_HINWEIS)) fehler.push(`Hinweis fehlt („${FEHLER_HINWEIS}“)`)
  const treffer = VERBOTEN.exec(text)
  if (treffer) fehler.push(`Entwicklertext sichtbar („${treffer[0]}“)`)
  if (!knopf) fehler.push(`Knopf „${KNOPF_NAME}“ fehlt`)
  else if (knopf.w < KNOPF_MIN_PX || knopf.h < KNOPF_MIN_PX) fehler.push(`Knopf zu klein (${Math.round(knopf.w)} × ${Math.round(knopf.h)} px, mindestens ${KNOPF_MIN_PX})`)
  else if (!knopf.trifft) fehler.push('Knopf wird überdeckt (Trefferprobe)')
  return fehler
}

/** Nach behobener Störung: ein Klick auf den Knopf lädt die Seite, die Fehlerseite ist weg. */
export function erholungFehler({ fehlerSichtbar, geladen }) {
  const fehler = []
  if (fehlerSichtbar) fehler.push('Fehlerseite bleibt nach „Erneut versuchen“ stehen')
  if (!geladen) fehler.push('Seite lädt nach „Erneut versuchen“ nicht')
  return fehler
}

/** Stehende Ansicht: scheitert das Nachladen der vollen Daten endgültig (4 Anfragen), bleibt die Woche stehen, keine Fehlerseite. */
export function stehendeAnsichtFehler({ anfragen, fehlerSichtbar, kopfDa }) {
  const fehler = []
  if (anfragen < 4) fehler.push(`Nachladen nicht bis zum Ende versucht (${anfragen} Anfragen, erwartet 4)`)
  if (fehlerSichtbar) fehler.push('Fehlerseite ersetzt die stehende Ansicht')
  if (!kopfDa) fehler.push('stehende Ansicht ist weg')
  return fehler
}
