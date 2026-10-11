/**
 * Baut den Diff für den PR-Prüfer je Datei aus der Dateiliste der GitHub-API (11.10.2026).
 *
 *   node tools/pr-diff-bauen.mjs <dateien.ndjson> <pr.diff>     (je Zeile ein Objekt von `gh api …/pulls/N/files`)
 *
 * Ausgabe auf stdout: `ok` oder `unvollstaendig`. Warum je Datei: Eine große Datendatei (z. B. `data/cartoon-folgen.json`,
 * 1,1 MB) füllte sonst das Limit, der Prüfer sah den Code nicht und musste zwingend „aendern" urteilen.
 *
 * Gestubbt wird nur, was in STUB_PFAD steht und über GRENZE_STUB Byte Diff hat (oder dessen Diff GitHub nicht
 * liefert): Datendateien unter data/ (.json, .jsonl, .yaml) und public/data/. Handbelege (`data/dub-confirmed.yaml`, `data/cache/`,
 * `data/curated/`) und jede Code-, Workflow- oder Doku-Datei bleiben immer vollständig.
 * Ist der Rest über GRENZE_GESAMT Byte, fehlt eine Datei ohne Diff oder die Liste ist leer, ist der Zustand `unvollstaendig`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const GRENZE_STUB = 50000
export const GRENZE_GESAMT = 400000
// Die API liefert höchstens 3000 Dateien; bei genau so vielen fehlt vermutlich der Rest.
const API_MAXIMUM = 3000

const STUB_PFAD = /^(data\/(?:[^/]+\/)*[^/]+\.(?:json|jsonl|yaml)|public\/data\/(?:[^/]+\/)*[^/]+\.(?:json|jsonl|yaml))$/
// data/cache/ gehört nie in einen PR; der Prüfer soll den Verstoß im vollen Diff sehen. [\s\S] statt ., damit kein Zeichen entkommt.
const NIE_STUB = /^(data\/dub-confirmed\.yaml|data\/curated\/[\s\S]*|data\/cache\/[\s\S]*)$/
const STEUERZEICHEN = /[\x00-\x1f\x7f]/

/** Darf diese Datei gestubbt werden? Anker und Ausschluss sind absichtlich eng; `..` und Steuerzeichen treffen nie. */
export function stubbar(pfad) {
  if (typeof pfad !== 'string' || STEUERZEICHEN.test(pfad)) return false
  return STUB_PFAD.test(pfad) && !NIE_STUB.test(pfad) && !pfad.split('/').includes('..')
}

/** Pfade sind Fremddaten: Steuerzeichen (Zeilenumbruch!) werden als \xNN ausgegeben, damit kein Pfad Zeilen in den Prüfer-Text einschleust. */
const maskiere = (pfad) => pfad?.replace(/[\x00-\x1f\x7f]/g, (c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))

function kopf(d) {
  const alt = d.previous_filename ?? d.filename
  const zeilen = [`diff --git a/${alt} b/${d.filename}`]
  if (d.status === 'added') zeilen.push('new file mode 100644')
  if (d.status === 'removed') zeilen.push('deleted file mode 100644')
  if (d.status === 'renamed') zeilen.push(`rename from ${alt}`, `rename to ${d.filename}`)
  return zeilen.join('\n')
}

function stubZeile(d, bytes) {
  const grund = bytes === null ? 'Diff von GitHub nicht geliefert' : `${bytes} Byte Diff`
  return `Datendatei ${d.filename}: ${grund}, +${d.additions ?? 0}/−${d.deletions ?? 0} Zeilen — nicht gelesen; Inhalt prüfen die CI-Checks (check:quellen, check:logic).`
}

/** Ein Abschnitt je Datei. `fehlt` heißt: Diff nötig, aber nicht vorhanden. */
function abschnitt(d) {
  const hatPatch = typeof d.patch === 'string' && d.patch !== ''
  const bytes = hatPatch ? Buffer.byteLength(d.patch) : null
  const aenderungen = (d.additions ?? 0) + (d.deletions ?? 0)
  if (!d.steuer && stubbar(d.filename) && (bytes === null ? aenderungen > 0 : bytes > GRENZE_STUB)) {
    return { text: `${kopf(d)}\n${stubZeile(d, bytes)}`, gestubbt: true, fehlt: false }
  }
  if (hatPatch) return { text: `${kopf(d)}\n--- a/${d.previous_filename ?? d.filename}\n+++ b/${d.filename}\n${d.patch}`, gestubbt: false, fehlt: false }
  // Ohne Patch und ohne Änderungen (reine Umbenennung, Moduswechsel, Binärdatei) gibt es nichts zu lesen.
  return { text: `${kopf(d)}\n(kein Textdiff)`, gestubbt: false, fehlt: aenderungen > 0 }
}

/** Eingabe: Dateiobjekte der API. Ausgabe: { diff, zustand, gestubbt[] }. */
export function baueDiff(dateien) {
  const sicher = dateien.map((d) => ({ ...d, filename: maskiere(d.filename), previous_filename: maskiere(d.previous_filename), steuer: STEUERZEICHEN.test(d.filename) }))
  const teile = sicher.map(abschnitt)
  let diff = teile.map((t) => t.text).join('\n') + '\n'
  let zustand = 'ok'
  if (dateien.length === 0 || dateien.length >= API_MAXIMUM || teile.some((t) => t.fehlt)) zustand = 'unvollstaendig'
  if (Buffer.byteLength(diff) > GRENZE_GESAMT) {
    zustand = 'unvollstaendig'
    diff = Buffer.from(diff).subarray(0, GRENZE_GESAMT).toString()
  }
  const gestubbt = sicher.filter((_, i) => teile[i].gestubbt).map((d) => d.filename)
  return { diff, zustand, gestubbt }
}

function main() {
  const [eingabe, ausgabe] = process.argv.slice(2)
  const zeilen = readFileSync(eingabe, 'utf8').split('\n').filter((z) => z.trim() !== '')
  const { diff, zustand, gestubbt } = baueDiff(zeilen.map((z) => JSON.parse(z)))
  writeFileSync(ausgabe, diff)
  for (const pfad of gestubbt) console.error(`gestubbt: ${pfad}`)
  console.log(zustand)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
