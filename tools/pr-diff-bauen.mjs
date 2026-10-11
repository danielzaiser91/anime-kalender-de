/**
 * Baut den Diff für den PR-Prüfer je Datei aus der Dateiliste der GitHub-API (11.10.2026).
 *
 *   node tools/pr-diff-bauen.mjs <dateien.ndjson> <pr.diff>     (je Zeile ein Objekt von `gh api …/pulls/N/files`)
 *
 * Ausgabe auf stdout: `ok` oder `unvollstaendig`. Warum je Datei: Eine große Datendatei (z. B. `data/anisearch-sprecher.json`,
 * 1,1 MB) füllte sonst das Limit, der Prüfer sah den Code nicht und musste zwingend „aendern" urteilen.
 *
 * Gestubbt wird nur, was die Positivliste trifft (siehe `stubbar`) und über GRENZE_STUB Byte Diff hat (oder dessen Diff
 * GitHub nicht liefert): .json/.jsonl/.yaml unter public/data/ und die Dateien aus `tools/quellen-liste.sh` (Datenläufe).
 * Alles andere unter data/ (Handdateien, Ankündigungen, Grenzen), Handbelege (`data/dub-confirmed.yaml`, `data/curated/`),
 * `data/cache/` und jede Code-, Workflow- oder Doku-Datei bleibt immer vollständig.
 * Ist der Rest über GRENZE_GESAMT Byte, fehlt der Diff einer nicht stubbaren Datei oder die Liste ist leer, ist der Zustand `unvollstaendig`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const GRENZE_STUB = 50000
export const GRENZE_GESAMT = 400000
// Die API liefert höchstens 3000 Dateien; bei genau so vielen fehlt vermutlich der Rest.
const API_MAXIMUM = 3000

// Positivliste: (a) Erzeugnisse des Bestandsbaus unter public/data, (b) die Dateien, die ein Datenlauf schreibt
// (`tools/quellen-liste.sh`, die eine Liste; Einträge sind Dateien oder Ordner). Handdateien unter data/ stehen nicht darin.
const DATEI_ENDUNG = /\.(?:json|jsonl|yaml)$/
const ERZEUGNIS = /^public\/data\/(?:[^/]+\/)*[^/]+\.(?:json|jsonl|yaml)$/
// Auch auf der Liste nie gestubbt: Handbelege lesen, data/cache/ gehört nie in einen PR (der Verstoß soll sichtbar sein).
// [\s\S] statt ., damit kein Zeichen entkommt.
const NIE_STUB = /^(data\/dub-confirmed\.yaml|data\/curated\/[\s\S]*|data\/cache\/[\s\S]*)$/
const STEUERZEICHEN = /[\x00-\x1f\x7f]/

/** Einträge unter data/ aus dem QUELLEN-Feld von tools/quellen-liste.sh (Kommentare und Leerzeilen entfallen). */
export function ladeQuellen(text) {
  const start = text.indexOf('QUELLEN=(')
  const ende = text.indexOf('\n)', start)
  if (start < 0 || ende < 0) throw new Error('QUELLEN in quellen-liste.sh nicht gefunden')
  const zeilen = text.slice(start + 'QUELLEN=('.length, ende).split('\n').map((z) => z.trim())
  return zeilen.filter((z) => /^data\/[A-Za-z0-9_./-]+$/.test(z))
}

const aufListe = (pfad, quellen) => quellen.some((q) => pfad === q || pfad.startsWith(q + '/'))

/** Darf diese Datei gestubbt werden? Nur Positivliste; `..` und Steuerzeichen treffen nie. */
export function stubbar(pfad, quellen) {
  if (typeof pfad !== 'string' || STEUERZEICHEN.test(pfad) || NIE_STUB.test(pfad) || pfad.split('/').includes('..')) return false
  if (ERZEUGNIS.test(pfad)) return true
  return pfad.startsWith('data/') && DATEI_ENDUNG.test(pfad) && aufListe(pfad, quellen)
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
function abschnitt(d, quellen) {
  const hatPatch = typeof d.patch === 'string' && d.patch !== ''
  const bytes = hatPatch ? Buffer.byteLength(d.patch) : null
  const aenderungen = (d.additions ?? 0) + (d.deletions ?? 0)
  if (!d.steuer && stubbar(d.filename, quellen) && (bytes === null ? aenderungen > 0 : bytes > GRENZE_STUB)) {
    return { text: `${kopf(d)}\n${stubZeile(d, bytes)}`, gestubbt: true, fehlt: false }
  }
  if (hatPatch) return { text: `${kopf(d)}\n--- a/${d.previous_filename ?? d.filename}\n+++ b/${d.filename}\n${d.patch}`, gestubbt: false, fehlt: false }
  // Ohne Patch und ohne Änderungen (reine Umbenennung, Moduswechsel, Binärdatei) gibt es nichts zu lesen.
  // Mit Änderungen, aber ohne Patch und nicht auf der Positivliste: nicht lieferbar → unvollstaendig (nie ok).
  const text = aenderungen > 0 ? 'Diff nicht lieferbar (von GitHub nicht geliefert)' : '(kein Textdiff)'
  return { text: `${kopf(d)}\n${text}`, gestubbt: false, fehlt: aenderungen > 0 }
}

/** Eingabe: Dateiobjekte der API und die Datenläufe-Liste (ladeQuellen). Ausgabe: { diff, zustand, gestubbt[] }. */
export function baueDiff(dateien, quellen) {
  const sicher = dateien.map((d) => ({ ...d, filename: maskiere(d.filename), previous_filename: maskiere(d.previous_filename), steuer: STEUERZEICHEN.test(d.filename) }))
  const teile = sicher.map((d) => abschnitt(d, quellen))
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
  const quellen = ladeQuellen(readFileSync(new URL('./quellen-liste.sh', import.meta.url), 'utf8'))
  const { diff, zustand, gestubbt } = baueDiff(zeilen.map((z) => JSON.parse(z)), quellen)
  writeFileSync(ausgabe, diff)
  for (const pfad of gestubbt) console.error(`gestubbt: ${pfad}`)
  console.log(zustand)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
