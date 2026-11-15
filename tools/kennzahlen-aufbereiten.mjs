/**
 * Datenaufbereitung der Tagesbericht-Ansicht (tools/kennzahlen/kennzahlen.html): reine Funktionen, kein Dateizugriff.
 * Wochenmittel = gleitender Mittelwert über die letzten 7 Tage (nur vorhandene Werte); Marker = Index des Maßnahmen-Tags.
 */

/** Kennzahlen der Ansicht: Schlüssel = Pfad in der Tageszeile. */
export const KENNZAHLEN = [
  { pfad: 'merges', name: 'Merges gesamt', einheit: '' },
  { pfad: 'mergesHand', name: 'Merges von Hand', einheit: '' },
  { pfad: 'mergesBot', name: 'Merges von Bots', einheit: '' },
  { pfad: 'storyPoints', name: 'Story Points', einheit: '' },
  { pfad: 'medianOffenBisMergeHandH', name: 'Offen bis Merge (Hand, Median)', einheit: 'h' },
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

/** Maßnahmen auf Tagesindizes abbilden; Maßnahmen außerhalb des Zeitraums entfallen. */
export function markerZuordnen(massnahmen, tage) {
  const tagIndex = new Map(tage.map((t, i) => [t.tag, i]))
  return massnahmen
    .filter((m) => tagIndex.has(m.datum))
    .map((m) => ({ index: tagIndex.get(m.datum), datum: m.datum, pr: m.pr, text: m.text, kennzahl: m.kennzahl, richtung: m.richtung }))
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
