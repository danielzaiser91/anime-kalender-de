/**
 * Bewertet die Datenanfragen eines Seitenstarts gegen die Tabelle `dateien` aus `dist/data/meta.json`
 * (Gegenstück zu `daten-adressen-browser.mjs`, getrennt, damit die Regeln ohne Browser prüfbar sind).
 * Regel: `?v=` einer Anfrage = Kennung der Datei, sonst die ihres Ordners; `meta.json` und `patchnotes.json` tragen die Code-Version.
 * Jede vorgeladene Adresse wird genau einmal geholt.
 */
const OHNE_TABELLE = ['meta.json', 'patchnotes.json']

/** Erwartete Kennung zu einem Pfad unter `/data/` (`titles-core.json`, `voices/1.json`), `undefined` wenn keine Regel greift. */
export function erwarteteKennung(datei: string, dateien: Record<string, string>, version: string): string | undefined {
  if (OHNE_TABELLE.includes(datei)) return version
  const ordner = datei.includes('/') ? `${datei.split('/')[0]}/` : ''
  return dateien[datei] ?? dateien[ordner]
}

/** `anfragen`: URLs der Datenabrufe in Reihenfolge; `vorgeladen`: href aller Vorlade-Links. Rückgabe: Liste der Verstöße. */
export function bewerteAnfragen(anfragen: string[], vorgeladen: string[], dateien: Record<string, string>, version: string): string[] {
  const fehler: string[] = []
  for (const roh of anfragen) {
    const url = new URL(roh)
    const datei = url.pathname.replace(/^.*?\/data\//, '')
    const soll = erwarteteKennung(datei, dateien, version)
    const ist = url.searchParams.get('v')
    if (soll === undefined) fehler.push(`${datei}: keine Kennung in der Tabelle, Anfrage trägt ?v=${ist}`)
    else if (ist !== soll) fehler.push(`${datei}: ?v=${ist}, erwartet ${soll}`)
  }
  for (const href of vorgeladen) {
    const n = anfragen.filter((a) => new URL(a).pathname + new URL(a).search === new URL(href, 'http://ak.test').pathname + new URL(href, 'http://ak.test').search).length
    if (n !== 1) fehler.push(`vorgeladen ${href}: ${n} Abrufe statt 1`)
  }
  if (anfragen.length === 0) fehler.push('kein Datenabruf beim Start')
  if (vorgeladen.length === 0) fehler.push('kein Vorlade-Link im Kopf')
  return fehler
}
