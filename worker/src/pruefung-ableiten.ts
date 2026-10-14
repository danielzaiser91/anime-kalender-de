/**
 * **Verfügbarkeit und Sprache einer Meldung ableiten** (aus `speichereDaten` herausgelöst, Wortlaut unverändert).
 *
 * Stufe 1 des Modells vom 22.09.2026 (docs/konzept-meldungen-architektur.md): Die Erweiterung schickt `vorhanden`,
 * `ton_de`, `art`; ältere Fassungen schicken nur `befund`. Beides wird angenommen, das jeweils andere abgeleitet.
 * **Befristet:** Die Ableitung von `befund` entfällt, sobald Stufe 2 den Einleser ersetzt; die Annahme des alten `befund`
 * entfällt, sobald alle Erweiterungen ≥ 4.21.0 melden.
 */

/** Was `speichereDaten` und die Titelzeile aus der Meldung brauchen. */
export type Abgeleitet = { befund: string; vorhanden: string; tonDe: string; art: string }

/** Das Abgeleitete, oder die Fehlermeldung für HTTP 400. */
export function leiteAb(daten: Record<string, unknown>): Abgeleitet | { fehler: string } {
  let vorhanden = daten.vorhanden != null ? String(daten.vorhanden).trim() : ''
  let tonDe = daten.ton_de != null ? String(daten.ton_de).trim() : ''
  let art = daten.art != null ? String(daten.art).trim() : ''
  let befund = String(daten.befund ?? '').trim()
  if (vorhanden) {
    if (!['ja', 'nein'].includes(vorhanden)) return { fehler: 'vorhanden muss ja oder nein sein' }
    if (vorhanden === 'nein') tonDe = 'unbekannt'
    if (!['ja', 'nein', 'unbekannt'].includes(tonDe)) return { fehler: 'ton_de muss ja, nein oder unbekannt sein' }
    /* Eine vorhandene Folge ohne Sprachauskunft ist eine Störung, keine Beobachtung (Szenario 10). */
    if (vorhanden === 'ja' && tonDe === 'unbekannt') return { fehler: 'vorhanden ja braucht ton_de ja oder nein' }
    if (!art) art = 'gemessen'
    if (!['gemessen', 'angenommen'].includes(art)) return { fehler: 'art muss gemessen oder angenommen sein' }
    befund = vorhanden === 'nein' ? 'weg' : tonDe === 'ja' ? 'dub' : 'kein_dub'
  } else {
    if (!['dub', 'kein_dub', 'weg'].includes(befund)) return { fehler: 'befund muss dub, kein_dub oder weg sein' }
    vorhanden = befund === 'weg' ? 'nein' : 'ja'
    tonDe = befund === 'weg' ? 'unbekannt' : befund === 'dub' ? 'ja' : 'nein'
    art = /ANGENOMMEN/.test(String(daten.notiz ?? '')) ? 'angenommen' : 'gemessen'
  }
  return { befund, vorhanden, tonDe, art }
}
