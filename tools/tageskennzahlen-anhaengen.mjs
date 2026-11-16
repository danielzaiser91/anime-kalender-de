/**
 * Schalter `--anhaengen` von tageskennzahlen.mjs: neue Tage in die bestehende tage.jsonl mischen statt sie zu ersetzen,
 * und vorher das GitHub-Kontingent gegen den Bedarf prüfen (Lehre 110, 16.11.2026: Volllauf leerte das geteilte Stundenkontingent).
 */
import { tagPlus } from './tageskennzahlen-rechnen.mjs'

// Schätzung 16.11.2026 (Volllauf 01.10.–15.11., 46 Tage ≈ 5000 Abrufe): rund 300 feste (PR-Liste, Urteile, Commits)
// plus rund 100 je Tag (acht Lauf-Fenster mit Seiten). Absichtlich grob, nur zum Abbruch vor dem sicheren Scheitern.
const FEST = 300
const JE_TAG = 100

/** Zeilen (JSON-Text) von `text` und `neu` nach Datum; ein Tag in `neu` ersetzt dieselbe Zeile in `text`. */
export function mischeZeilen(text, neu) {
  const jeTag = new Map()
  for (const zeile of [...text.split('\n'), ...neu].filter(Boolean)) jeTag.set(JSON.parse(zeile).tag, zeile)
  return [...jeTag.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, zeile]) => zeile)
}

/** Erster Tag nach der letzten Zeile von `text`; ohne Zeilen `vorgabe`. */
export function tagNachLetzterZeile(text, vorgabe) {
  const tage = text.split('\n').filter(Boolean).map((z) => JSON.parse(z).tag)
  return tage.length === 0 ? vorgabe : tagPlus(tage.sort().at(-1), 1)
}

export function geschaetzterBedarf(tage) {
  return FEST + JE_TAG * tage
}

/** Wirft mit klarer Meldung, wenn `uebrig` Anfragen für `tage` Tage nicht reichen. */
export function pruefeKontingent(uebrig, tage) {
  const bedarf = geschaetzterBedarf(tage)
  if (uebrig < bedarf) throw new Error(`GitHub-Kontingent zu klein: ${uebrig} Anfragen übrig, geschätzt ${bedarf} nötig für ${tage} Tage (Schätzung: ${FEST} + ${JE_TAG} je Tag, Stand 16.11.2026). Später erneut oder --von/--bis kürzen.`)
}

/** Neuer Dateiinhalt: mit `anhaengen` bestehende Zeilen mischen, sonst nur die neuen. */
export function dateiInhalt(bestehend, zeilen, anhaengen) {
  return `${(anhaengen ? mischeZeilen(bestehend, zeilen) : zeilen).join('\n')}\n`
}
