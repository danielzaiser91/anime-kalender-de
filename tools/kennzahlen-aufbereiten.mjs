/**
 * Datenaufbereitung der Tagesbericht-Ansicht (tools/kennzahlen/kennzahlen.html): reine Funktionen, kein Dateizugriff.
 * Wochenmittel = gleitender Mittelwert über die letzten 7 Tage (nur vorhandene Werte); Marker = Index des Maßnahmen-Tags.
 */
import { createRequire } from 'node:module'

const logik = createRequire(import.meta.url)('./kennzahlen/kennzahlen-logik.cjs')

/** Kennzahlen der Ansicht: Schlüssel = Pfad in der Tageszeile. */
export const KENNZAHLEN = [
  { pfad: 'merges', name: 'Merges gesamt', einheit: '' },
  { pfad: 'mergesHand', name: 'Merges von Hand', einheit: '' },
  { pfad: 'mergesBot', name: 'Merges von Bots', einheit: '' },
  { pfad: 'storyPoints', name: 'Story Points', einheit: '' },
  { pfad: 'medianOffenBisMergeHandH', name: 'Offen bis Merge (Hand, Median)', einheit: 'h' },
  { pfad: 'medianCiGruenBisMergeHandH', name: 'CI grün bis Merge (Hand, Median)', einheit: 'h' },
  { pfad: 'pruefer.runde1Prozent', name: 'Freigabe in Runde 1 (Hand)', einheit: '%' },
  { pfad: 'pruefer.nachbesserungenJePr', name: 'Nachbesserungsrunden je PR (Hand)', einheit: '' },
  { pfad: 'lehren', name: 'Neue Lehren', einheit: '' },
  { pfad: 'stau.offen', name: 'Offene PRs am Tagesende', einheit: '' },
  { pfad: 'stau.ueber24h', name: 'Offene PRs über 24 h', einheit: '' },
  { pfad: 'stau.aeltestesH', name: 'Ältester offener PR', einheit: 'h' },
  { pfad: 'reverts', name: 'Reverts', einheit: '' },
  { pfad: 'sammlerStandZurueck', name: 'Sammler-Stand zurückgenommen', einheit: '' },
  { pfad: 'rotLaeufe', name: 'Rote Läufe', einheit: '' },
  { pfad: 'bestandRotH', name: 'Bestandsbau rot', einheit: 'h' },
  { pfad: 'seite.metaGzipKb', name: 'meta gzip', einheit: 'KB' },
  { pfad: 'seite.wocheKachelnGzipKb', name: 'woche-kacheln gzip', einheit: 'KB' },
  { pfad: 'seite.titlesGzipKb', name: 'titles gzip', einheit: 'KB' },
  { pfad: 'bauDauerMedianMin', name: 'Bestandsbau Dauer (Median)', einheit: 'min' },
  { pfad: 'ketteDauerMedianMin', name: 'PR-Prüfkette Dauer (Median)', einheit: 'min' },
]

/** Wert am Pfad („stau.offen“) oder null, wenn er fehlt. */
export function wert(zeile, pfad) {
  let v = zeile
  for (const teil of pfad.split('.')) v = v?.[teil]
  return typeof v === 'number' ? v : null
}

/** Reihe je Kennzahl über alle Tage, null bei fehlendem Wert. */
export function reihe(tage, pfad) {
  return tage.map((t) => wert(t, pfad))
}

/** Gleitender Mittelwert über `fenster` Tage (inklusive heute); null, wenn im Fenster kein Wert vorliegt. */
export function wochenmittel(werte, fenster = 7) {
  return werte.map((_, i) => {
    const sicht = werte.slice(Math.max(0, i - fenster + 1), i + 1).filter((v) => v !== null)
    if (sicht.length === 0) return null
    return Math.round((sicht.reduce((a, b) => a + b, 0) / sicht.length) * 100) / 100
  })
}

const WIRKUNG_TAGE = 7
const WIRKUNG_MIN_TAGE = 3
const MARKER_ZEILEN = 5
const MARKER_BREITE = 52

function mittel(werte) {
  const da = werte.filter((v) => v !== null)
  if (da.length < WIRKUNG_MIN_TAGE) return null
  return Math.round((da.reduce((a, b) => a + b, 0) / da.length) * 100) / 100
}

/**
 * Wirkung einer Maßnahme am Tag `index`: Mittel der bis zu 7 Tage davor gegen die bis zu 7 Tage danach (der Tag selbst zählt nicht);
 * je Seite mindestens 3 Werte, sonst null (zu früh). urteil: 'ja' wenn die Veränderung der erwarteten Richtung entspricht.
 */
export function wirkung(werte, index, richtung) {
  const vorher = mittel(werte.slice(Math.max(0, index - WIRKUNG_TAGE), index))
  const nachher = mittel(werte.slice(index + 1, index + 1 + WIRKUNG_TAGE))
  if (vorher === null || nachher === null) return { vorher, nachher, urteil: null }
  const regeln = { sinkt: nachher < vorher, 'nicht-steigend': nachher <= vorher, steigt: nachher > vorher }
  return { vorher, nachher, urteil: richtung in regeln ? (regeln[richtung] ? 'ja' : 'nein') : null }
}

/** Maßnahmen auf Tagesindizes abbilden (samt Wirkung und Beschriftungszeile); Maßnahmen außerhalb des Zeitraums entfallen. */
export function markerZuordnen(massnahmen, tage) {
  const tagIndex = new Map(tage.map((t, i) => [t.tag, i]))
  const innen = massnahmen.filter((m) => tagIndex.has(m.datum))
  const zeilen = logik.staffelZeilen(innen.map((m) => logik.tagPosition(tagIndex.get(m.datum), tage.length)), MARKER_BREITE, MARKER_ZEILEN)
  return innen.map((m, i) => ({
    index: tagIndex.get(m.datum),
    datum: m.datum,
    pr: m.pr,
    text: m.text,
    kennzahl: m.kennzahl,
    richtung: m.richtung,
    zeile: zeilen[i],
    ...wirkung(reihe(tage, m.kennzahl), tagIndex.get(m.datum), m.richtung),
  }))
}

/** Alles, was die Seite braucht (wird als daten.js geschrieben). kernpunkte: { 'YYYY-MM-DD': { geschafft: [], probleme: [] } } */
export function baueAnsichtsDaten(tage, massnahmen, kernpunkte = {}) {
  return {
    kennzahlen: KENNZAHLEN.map((k) => ({
      ...k,
      werte: reihe(tage, k.pfad),
      wochenmittel: wochenmittel(reihe(tage, k.pfad)),
    })),
    tage: tage.map((t) => t.tag),
    marker: markerZuordnen(massnahmen, tage),
    kernpunkte,
  }
}
