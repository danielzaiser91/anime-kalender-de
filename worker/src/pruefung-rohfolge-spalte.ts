/**
 * **Die Rohfolge von Netflix und Disney+ steht in der Zeile der Meldung** (13.10.2026, Migration 054).
 *
 * Diese Anbieter melden eine Folge je Anfrage und schicken genau eine Rohfolge mit, die dieselben
 * Angaben trägt wie die Meldung (Folge, Staffel, Sprachen, Befund). Beides getrennt abzulegen kostete
 * 6 + 5 D1-Zeilen je Folge (Tabelle, `sqlite_sequence`, Indexe); als Spalte der Meldungszeile kostet
 * die Rohfolge keine (Messung: `tools/worker-schreibzeilen-messen.ts`). Prime meldet mehrere Rohfolgen
 * je Seite und bleibt in `prime_folge`, ebenso jede Meldung dieser Anbieter mit null oder mehreren.
 *
 * Gelesen wird die Spalte von `rohfolgen-seiten.ts`; die Felder heißen wie die Spalten von `prime_folge`.
 */
import { ROH_FELDER, rohZeile } from './pruefung-rohfolgen-speichern.ts'

const MIT_ROHFOLGE_IN_MELDUNG = new Set(['netflix', 'disneyplus'])

/** Die Rohfolge als JSON-Text für `pruefung.rohfolge`, oder `null`, wenn sie in `prime_folge` gehört. */
export async function rohfolgeFuerMeldung(
  daten: Record<string, unknown>,
  url: string,
  seitenKennung: string | null,
): Promise<string | null> {
  if (!MIT_ROHFOLGE_IN_MELDUNG.has(String(daten.plattform))) return null
  const rohfolgen = Array.isArray(daten.rohfolgen) ? daten.rohfolgen : []
  const folge = rohfolgen[0] as Record<string, unknown> | undefined
  if (rohfolgen.length !== 1 || !folge || typeof folge !== 'object') return null
  const { werte } = await rohZeile(daten, url, seitenKennung, folge)
  return JSON.stringify(Object.fromEntries(ROH_FELDER.map((name, i) => [name, werte[i]])))
}
