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
import { schluessel, type Folge, type OffeneHashes } from './pruefung-unveraendert.ts'

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

/**
 * **Die Rohfolge der neuen Zeile — nur, was der Zuordner noch nicht kennt** (Prüfer-Befund zu PR 1150).
 *
 * Eine Meldung ersetzt die offene Zeile ihrer Folge und fügt eine neue ein, auch wenn nur die Notiz wechselt. Mit
 * der Rohfolge in jeder neuen Zeile holte der Zuordner dieselbe Rohfolge erneut und `?alle=1` führte sie doppelt;
 * in `prime_folge` verhinderte das der Hash (`rohfolgen-abgleich.ts`). Derselbe Maßstab hier:
 * - eine offene Zeile derselben Folge trägt dieselbe Rohfolge (sie wird gleich ersetzt): die neue erbt deren Abhak-Stand;
 * - sonst trägt die jüngste übernommene Zeile mit Rohfolge dieselbe: die neue Zeile braucht keine (`NULL`);
 * - sonst ist sie neu und offen (A, B, A kommt als A wieder an, wenn B zuletzt übernommen wurde).
 */
export function rohfolgeFuerZeile(
  offene: OffeneHashes | undefined,
  folge: Folge,
  rohfolge: string | null,
): { rohfolge: string | null; rohUebernommen: number | null } {
  if (rohfolge === null) return { rohfolge: null, rohUebernommen: null }
  const gleicheOffene = offene?.zeilen.get(schluessel(folge))?.find((z) => z.rohfolge === rohfolge)
  if (gleicheOffene) return { rohfolge, rohUebernommen: gleicheOffene.rohUebernommen ?? 0 }
  if (offene?.uebernommeneRoh.get(schluessel(folge))?.rohfolge === rohfolge) return { rohfolge: null, rohUebernommen: null }
  return { rohfolge, rohUebernommen: 0 }
}
