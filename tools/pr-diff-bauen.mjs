/**
 * Baut den Diff für den PR-Prüfer je Datei aus der Dateiliste der GitHub-API (11.10.2026).
 *
 *   node tools/pr-diff-bauen.mjs <dateien.ndjson> <pr.diff> [<basis-sha> <kopf-sha>]     (je Zeile ein Objekt von `gh api …/pulls/N/files`)
 *
 * Ausgabe auf stdout: `ok`, `leer` (Liste erfolgreich abgerufen, aber ohne Datei) oder `unvollstaendig`. Warum je Datei: Eine große Datendatei (z. B. `data/anisearch-sprecher.json`,
 * 1,1 MB) füllte sonst das Limit, der Prüfer sah den Code nicht und musste zwingend „aendern" urteilen.
 *
 * Gestubbt wird nur, was die Positivliste trifft (siehe `stubbar`) und über GRENZE_STUB Byte Diff hat (oder dessen Diff
 * GitHub nicht liefert): .json/.jsonl/.yaml unter public/data/ und data/stammdaten/ (12.10.2026: maschinell erzeugte
 * Schnappschüsse mit eigenen Prüfungen) sowie die Dateien aus `tools/quellen-liste.sh` (Datenläufe).
 * Daten-JS (13.10.2026): eine geänderte `extension/*.js` aus der Liste wird nur gestubbt, wenn ihr Inhalt am PR-Kopf aus Git-Objekten
 * gelesen wird und ausschließlich aus Zeilen `globalThis.AK_NAME = <gültiges JSON>` besteht (`istDatenJs`). Jedes Zeichen darüber
 * hinaus (Funktion, Kommentar, zweite Anweisung, `;`) macht die Datei sichtbar; ohne lesbaren Inhalt gilt dasselbe (fail closed).
 * Alles andere unter data/ (Handdateien, Ankündigungen, Grenzen), Handbelege (`data/dub-confirmed.yaml`, `data/curated/`),
 * `data/cache/` und jede Code-, Workflow- oder Doku-Datei bleibt immer vollständig.
 * Fehlt der API-Diff einer nicht stubbaren Datei (die API liefert bei sehr großen Änderungen kein `patch`, z. B. `data/dub-confirmed.yaml`
 * mit +1.230 Zeilen, PR 792), holt `gitDiffRunner` ihn aus den vom Workflow geholten Git-Objekten (nur Objekte, kein Checkout des PR).
 * Bleibt auch das leer oder schlägt fehl, gilt weiter „nicht lieferbar" (fail closed).
 * Gesamtgrenze (25.10.2026): Würde der Diff GRENZE_GESAMT überschreiten, werden zusätzlich stubbare Dateien (dieselbe Positivliste, nie
 * NIE_STUB, nie Code/Doku) gestubbt, größte zuerst, bis der Rest passt (PR 1944: 90 Erzeugnis-Diffs je < 50 KB rissen die Grenze).
 * Ist der Rest über GRENZE_GESAMT Byte, fehlt der Diff einer nicht stubbaren Datei oder die Liste ist leer, ist der Zustand `unvollstaendig`.
 */
import { spawnSync } from 'node:child_process'
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
// Stammdaten-Schnappschüsse (z. B. anilist-eingefroren.json) sind maschinell erzeugt und haben eigene check-Skripte.
const STAMMDATEN = /^data\/stammdaten\/(?:[^/]+\/)*[^/]+\.(?:json|jsonl|yaml)$/
// Eingefrorener Ausschnitt aus public/data (Erzeugnis von tools/buehne-faelle.mjs, keine Handdatei); genau dieser Pfad.
const BUEHNE_FAELLE = 'web/buehne/faelle.json'
// Auch auf der Liste nie gestubbt: Handbelege lesen, data/cache/ gehört nie in einen PR (der Verstoß soll sichtbar sein).
// [\s\S] statt ., damit kein Zeichen entkommt.
const NIE_STUB = /^(data\/dub-confirmed\.yaml|data\/curated\/[\s\S]*|data\/cache\/[\s\S]*)$/
const STEUERZEICHEN = /[\x00-\x1f\x7f]/
const SHA = /^[0-9a-f]{40}$/
// Daten-JS der Erweiterung: genau ein Ordner, Dateiname ohne Sonderzeichen, und als Eintrag (nie als Ordner) in der Quellen-Liste.
const ERZEUGTES_JS = /^extension\/[A-Za-z0-9_-]+\.js$/
// Nur die Namen der Datenlisten: ein gestubbter Einzeiler darf kein vom Code gesetztes Global (z. B. AK_TAGESLIMIT) überschreiben.
const DATEN_JS_ZEILE = /^globalThis\.(?:AK_OFFENE_[A-Z0-9_]+|AK_PRIME_SUCHE) = (.+)$/

/** Einträge unter data/ und extension/ aus dem QUELLEN-Feld von tools/quellen-liste.sh (Kommentare und Leerzeilen entfallen). */
export function ladeQuellen(text) {
  const start = text.indexOf('QUELLEN=(')
  const ende = text.indexOf('\n)', start)
  if (start < 0 || ende < 0) throw new Error('QUELLEN in quellen-liste.sh nicht gefunden')
  const zeilen = text.slice(start + 'QUELLEN=('.length, ende).split('\n').map((z) => z.trim())
  return zeilen.filter((z) => /^(?:data|extension)\/[A-Za-z0-9_./-]+$/.test(z))
}

const aufListe = (pfad, quellen) => quellen.some((q) => pfad === q || pfad.startsWith(q + '/'))

/** Darf diese Datei gestubbt werden? Nur Positivliste; `..` und Steuerzeichen treffen nie. */
export function stubbar(pfad, quellen) {
  if (typeof pfad !== 'string' || STEUERZEICHEN.test(pfad) || NIE_STUB.test(pfad) || pfad.split('/').includes('..')) return false
  if (ERZEUGNIS.test(pfad) || STAMMDATEN.test(pfad) || pfad === BUEHNE_FAELLE) return true
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

/** Diff einer Datei aus Git-Objekten (Pfade als eigene Argumente, nie über eine Shell); null bei Fehler oder leerer Ausgabe. */
export function gitDiffRunner(basis, kopf, lauf = spawnSync) {
  if (!SHA.test(basis ?? '') || !SHA.test(kopf ?? '')) return () => null
  return (d) => {
    const pfade = d.previous_filename && d.previous_filename !== d.filename ? [d.previous_filename, d.filename] : [d.filename]
    const args = ['-c', 'core.quotepath=false', 'diff', '--no-color', '--no-ext-diff', '--no-textconv', '-M', basis, kopf, '--', ...pfade]
    const r = lauf('git', args, { encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 })
    return r.status === 0 && typeof r.stdout === 'string' && r.stdout.trim() !== '' ? r.stdout.replace(/\n$/, '') : null
  }
}

/** Inhalt einer Datei am PR-Kopf aus Git-Objekten (kein Checkout); null bei Fehler. Der Pfad steht hinter der SHA und kann keine Option sein. */
export function gitInhaltRunner(kopf, lauf = spawnSync) {
  if (!SHA.test(kopf ?? '')) return () => null
  return (d) => {
    const r = lauf('git', ['cat-file', 'blob', `${kopf}:${d.filename}`], { encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 })
    return r.status === 0 && typeof r.stdout === 'string' ? r.stdout : null
  }
}

/** Nur Zeilen `globalThis.AK_NAME = <JSON>` (so schreiben die Generatoren der Erweiterung); `.` trifft weder CR noch U+2028/9. */
export function istDatenJs(text) {
  if (typeof text !== 'string') return false
  const zeilen = text.split('\n')
  if (zeilen.at(-1) === '') zeilen.pop()
  const jsonOk = (z) => {
    const m = DATEN_JS_ZEILE.exec(z)
    if (!m) return false
    try {
      JSON.parse(m[1])
      return true
    } catch {
      return false
    }
  }
  return zeilen.length > 0 && zeilen.every(jsonOk)
}

const datenJsPfad = (pfad, quellen) => typeof pfad === 'string' && !STEUERZEICHEN.test(pfad) && ERZEUGTES_JS.test(pfad) && quellen.includes(pfad)

/** Daten-JS: Pfade (neu und bei Umbenennung alt) als Eintrag der Liste, nicht gelöscht, Inhalt am Kopf besteht das Muster. */
const stubbaresJs = (d, quellen, inhalt) =>
  d.status !== 'removed' && (!d.previous_filename || datenJsPfad(d.previous_filename, quellen)) && istDatenJs(inhalt(d))

/** Stubbar nur, wenn auch der alte Pfad einer Umbenennung stubbar ist; sonst bliebe die Änderung einer lesbaren Datei ungelesen. */
function stubbareDatei(d, quellen, inhalt) {
  if (datenJsPfad(d.filename, quellen)) return stubbaresJs(d, quellen, inhalt)
  return stubbar(d.filename, quellen) && (!d.previous_filename || stubbar(d.previous_filename, quellen))
}

/** Ein Abschnitt je Datei. `fehlt` heißt: Diff nötig, aber nicht vorhanden. */
function abschnitt(d, quellen, gitDiff, inhalt) {
  const hatPatch = typeof d.patch === 'string' && d.patch !== ''
  const bytes = hatPatch ? Buffer.byteLength(d.patch) : null
  const aenderungen = (d.additions ?? 0) + (d.deletions ?? 0)
  const gross = bytes === null ? aenderungen > 0 : bytes > GRENZE_STUB
  if (!d.steuer && gross && stubbareDatei(d, quellen, inhalt)) {
    return { text: `${kopf(d)}\n${stubZeile(d, bytes)}`, gestubbt: true, fehlt: false }
  }
  if (hatPatch) return { text: `${kopf(d)}\n--- a/${d.previous_filename ?? d.filename}\n+++ b/${d.filename}\n${d.patch}`, gestubbt: false, fehlt: false }
  const ausGit = aenderungen > 0 && !d.steuer ? gitDiff(d) : null
  if (ausGit) return { text: ausGit, gestubbt: false, fehlt: false }
  // Ohne Patch und ohne Änderungen (reine Umbenennung, Moduswechsel, Binärdatei) gibt es nichts zu lesen.
  // Mit Änderungen, aber ohne Patch und nicht auf der Positivliste: nicht lieferbar → unvollstaendig (nie ok).
  const text = aenderungen > 0 ? 'Diff nicht lieferbar (von GitHub nicht geliefert)' : '(kein Textdiff)'
  return { text: `${kopf(d)}\n${text}`, gestubbt: false, fehlt: aenderungen > 0 }
}

/** Gesamtdiff über der Grenze: stubbare, noch lesbare Abschnitte größte zuerst durch ihren Stub ersetzen, bis die Summe passt. */
function stubbeBisPasst(sicher, teile, quellen, inhalt) {
  let summe = Buffer.byteLength(teile.map((t) => t.text).join('\n') + '\n')
  if (summe <= GRENZE_GESAMT) return
  const kandidaten = sicher
    .map((d, i) => ({ d, i, laenge: Buffer.byteLength(teile[i].text) }))
    .filter(({ d, i }) => !teile[i].gestubbt && !d.steuer && stubbareDatei(d, quellen, inhalt))
    .sort((a, b) => b.laenge - a.laenge)
  for (const { d, i, laenge } of kandidaten) {
    if (summe <= GRENZE_GESAMT) break
    const bytes = typeof d.patch === 'string' && d.patch !== '' ? Buffer.byteLength(d.patch) : null
    const text = `${kopf(d)}\n${stubZeile(d, bytes)}`
    summe -= laenge - Buffer.byteLength(text)
    teile[i] = { text, gestubbt: true, fehlt: false }
  }
}

/** Eingabe: Dateiobjekte der API und die Datenläufe-Liste (ladeQuellen). Ausgabe: { diff, zustand, gestubbt[] }. */
export function baueDiff(dateien, quellen, gitDiff = () => null, inhalt = () => null) {
  const steuer = (d) => STEUERZEICHEN.test(d.filename) || STEUERZEICHEN.test(d.previous_filename ?? '')
  const sicher = dateien.map((d) => ({ ...d, filename: maskiere(d.filename), previous_filename: maskiere(d.previous_filename), steuer: steuer(d) }))
  const teile = sicher.map((d) => abschnitt(d, quellen, gitDiff, inhalt))
  stubbeBisPasst(sicher, teile, quellen, inhalt)
  let diff = teile.map((t) => t.text).join('\n') + '\n'
  let zustand = 'ok'
  if (dateien.length >= API_MAXIMUM || teile.some((t) => t.fehlt)) zustand = 'unvollstaendig'
  // Erfolgreich abgerufene, aber leere Liste (PR ohne Dateiänderung): eigener Zustand, nur in der Abnahme zulässig (pr-eingang.mjs).
  if (dateien.length === 0) zustand = 'leer'
  if (Buffer.byteLength(diff) > GRENZE_GESAMT) {
    zustand = 'unvollstaendig'
    diff = Buffer.from(diff).subarray(0, GRENZE_GESAMT).toString()
  }
  const gestubbt = sicher.filter((_, i) => teile[i].gestubbt).map((d) => d.filename)
  return { diff, zustand, gestubbt }
}

function main() {
  const [eingabe, ausgabe, basis, kopf] = process.argv.slice(2)
  const zeilen = readFileSync(eingabe, 'utf8').split('\n').filter((z) => z.trim() !== '')
  const quellen = ladeQuellen(readFileSync(new URL('./quellen-liste.sh', import.meta.url), 'utf8'))
  const { diff, zustand, gestubbt } = baueDiff(zeilen.map((z) => JSON.parse(z)), quellen, gitDiffRunner(basis, kopf), gitInhaltRunner(kopf))
  writeFileSync(ausgabe, diff)
  for (const pfad of gestubbt) console.error(`gestubbt: ${pfad}`)
  console.log(zustand)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
