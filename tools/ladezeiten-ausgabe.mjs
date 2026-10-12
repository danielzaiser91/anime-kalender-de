/**
 * Ergebnis der Ladezeiten-Messung als Datei: JSON (Artefakt des Workflows `ladezeiten.yml`) und Markdown-Tabelle
 * für die Zusammenfassung eines GitHub-Laufs. Reine Formatierung, keine Messung.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Eine Zeile je Messgröße: Median, Spanne, alle Einzelwerte und die Grenze, gegen die verglichen würde. */
export function ergebnisZeilen(werte, urteilsListe, medianVon) {
  const grenzen = new Map(urteilsListe.map((u) => [u.name, u.grenze]))
  return [...werte].map(([name, w]) => ({ name, median: medianVon(w), min: Math.min(...w), max: Math.max(...w), grenze: grenzen.get(name) ?? null, werte: w }))
}

export function alsMarkdown(zeilen, kopf) {
  const tabelle = zeilen.map((z) => `| ${z.name} | ${z.median} | ${z.min}–${z.max} | ${z.grenze ?? '–'} |`)
  return ['### Ladezeiten am Handy (Pixel 7, 4× CPU)', kopf, '', '| Messgröße | Median (ms) | min–max | Grenze |', '|---|---:|---|---:|', ...tabelle, ''].join('\n')
}

/** Schreibt die JSON-Datei nach `datei`; hängt die Tabelle an `$GITHUB_STEP_SUMMARY`, wenn die Variable gesetzt ist. */
export function ergebnisSchreiben({ datei, zeilen, laufzeitS, nurMessen, umgebung = process.env }) {
  const kopf = `Laufzeit ${laufzeitS} s · Stand ${umgebung.GITHUB_SHA?.slice(0, 9) ?? 'lokal'} · ${nurMessen ? 'nur gemessen, ohne Urteil' : 'mit Urteil'}`
  mkdirSync(path.dirname(path.resolve(datei)), { recursive: true })
  const stand = { gemessenAm: new Date().toISOString(), commit: umgebung.GITHUB_SHA ?? null, lauf: umgebung.GITHUB_RUN_ID ?? null, laufzeitS, nurMessen, messgroessen: zeilen }
  writeFileSync(datei, `${JSON.stringify(stand, null, 2)}\n`)
  if (umgebung.GITHUB_STEP_SUMMARY) appendFileSync(umgebung.GITHUB_STEP_SUMMARY, alsMarkdown(zeilen, kopf))
}
