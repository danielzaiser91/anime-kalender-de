/**
 * Pflicht in der PR-Prüfkette (Daniel, 10.10.2026): Ein PR, der die Seite sichtbar ändert (`web/src/`, `shared/`, `data/curated/`,
 * `data/dub-confirmed.yaml`; nicht Zweige `daten/`, `claude/`), legt entweder eine neue Datei in `data/patchnotes/` an oder trägt in der
 * PR-Beschreibung eine Zeile „Patch Notes: keine – <Grund>“. Sonst ist die Prüfkette rot.
 *
 *   node tools/check-patchnotes-pflicht.mjs
 *
 * Läuft immer die Gegenproben der Regel; die echte Prüfung nur im Ereignis `pull_request` (Beschreibung und Basis aus der
 * Ereignisdatei der Action, kein Workflow-Zusatz nötig). Lokal und auf main ist sie ein Nullbefehl. Hinweis: Die Beschreibung
 * stammt aus dem Ereignis; wer sie nachträglich ändert, stößt die Prüfkette mit einem neuen Commit erneut an.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ladeBasis } from './pr-basis.mjs'

const ORDNER = 'data/patchnotes/'
const EINTRAG = /^data\/patchnotes\/[^/]+\.yaml$/
// `shared/` zählt ganz: die Web-Anzeige nutzt es, eine Einzelprüfung der Importe wäre brüchig; Daten-PRs befreit die Beschreibung.
const SICHTBAR = /^(web\/src\/|shared\/|data\/curated\/|data\/dub-confirmed\.yaml$)/
// Sammler- und Datenläufe (Zweige `daten/…`, `claude/…`) schreiben keine Patch Notes.
const AUSGENOMMENE_ZWEIGE = /^(daten|claude)\//
const KEINE_ZEILE = /^\s*Patch Notes:\s*keine\s*[–—-]\s*\S/im

/** Eintrags-Dateien, die der PR neu anlegt, aus der Ausgabe von `git diff --name-status --no-renames` (Zeilen „A<Tab>Pfad“). */
export function neueEintraege(nameStatus) {
  return nameStatus
    .split('\n')
    .map((z) => z.split('\t'))
    .filter(([status, pfad]) => status === 'A' && EINTRAG.test(pfad ?? ''))
    .map(([, pfad]) => pfad)
}

/** Ergebnis der Regel für einen PR: `ok` und der Grund in einem Satz. */
export function bewerte({ dateien, neu, beschreibung, zweig = '' }) {
  if (AUSGENOMMENE_ZWEIGE.test(zweig)) return { ok: true, grund: `Zweig ${zweig} (Daten-/Sammlerlauf) ausgenommen` }
  const sichtbar = dateien.filter((f) => SICHTBAR.test(f))
  if (!sichtbar.length) return { ok: true, grund: 'keine sichtbare Änderung' }
  if (neu.length) return { ok: true, grund: `neuer Eintrag: ${neu.join(' | ')}` }
  if (KEINE_ZEILE.test(beschreibung)) return { ok: true, grund: 'in der PR-Beschreibung ausgenommen' }
  return {
    ok: false,
    grund:
      `Sichtbare Änderung (${sichtbar.slice(0, 3).join(', ')}${sichtbar.length > 3 ? ', …' : ''}) ohne Patch-Notes-Eintrag.\n` +
      `  Entweder eine neue Datei in ${ORDNER} anlegen (Nutzen für Besucher, höchstens 8 Wörter)\n` +
      '  oder in die PR-Beschreibung die Zeile „Patch Notes: keine – <Grund>“ schreiben und danach einen neuen Commit pushen.',
  }
}

function gegenproben() {
  const web = ['web/src/App.tsx']
  const fall = [
    ['sichtbar, kein Eintrag, keine Zeile', { dateien: web, neu: [], beschreibung: 'x' }, false],
    ['sichtbar mit neuem Eintrag', { dateien: web, neu: ['A'], beschreibung: '' }, true],
    ['Daten sichtbar ohne Eintrag', { dateien: ['data/curated/x.yaml'], neu: [], beschreibung: '' }, false],
    ['Handbeleg ohne Eintrag', { dateien: ['data/dub-confirmed.yaml'], neu: [], beschreibung: '' }, false],
    ['Ausnahmezeile mit Gedankenstrich', { dateien: web, neu: [], beschreibung: 'a\nPatch Notes: keine – reiner Umbau\nb' }, true],
    ['Ausnahmezeile mit Bindestrich', { dateien: web, neu: [], beschreibung: 'Patch Notes: keine - Technik' }, true],
    ['Ausnahmezeile ohne Grund', { dateien: web, neu: [], beschreibung: 'Patch Notes: keine –' }, false],
    ['Ausnahme mitten im Satz zählt nicht', { dateien: web, neu: [], beschreibung: 'Ich sage Patch Notes: keine – weil' }, false],
    ['nur Pipeline, Doku', { dateien: ['pipeline/x.ts', 'docs/a.md'], neu: [], beschreibung: '' }, true],
    ['shared/ zählt als sichtbar', { dateien: ['shared/logic.ts'], neu: [], beschreibung: '' }, false],
    ['shared/ mit Ausnahmezeile', { dateien: ['shared/logic.ts'], neu: [], beschreibung: 'Patch Notes: keine – Technik' }, true],
    ['Zweig daten/ ausgenommen', { dateien: ['data/curated/x.yaml'], neu: [], beschreibung: '', zweig: 'daten/crunchyroll' }, true],
    ['Zweig claude/ ausgenommen', { dateien: ['shared/x.ts'], neu: [], beschreibung: '', zweig: 'claude/sammler' }, true],
    ['Zweig feat/ nicht ausgenommen', { dateien: ['shared/x.ts'], neu: [], beschreibung: '', zweig: 'feat/daten/x' }, false],
  ]
  const status = 'M\tdata/patchnotes/alt.yaml\nA\tdata/patchnotes/neu.yaml\nA\tdata/patchnotes/ordner/tief.yaml\nA\tdata/patchnotes/notiz.md\nA\tweb/src/x.ts\nD\tdata/patchnotes/weg.yaml\n'
  fall.push(['neueEintraege: nur neu angelegte Dateien direkt im Ordner', null, neueEintraege(status).join() === 'data/patchnotes/neu.yaml'])
  fall.push(['neueEintraege: leere Ausgabe ergibt nichts', null, neueEintraege('').length === 0])
  // Ohne Eingabe steht in der dritten Spalte schon das Ergebnis der Probe (Wahrheitswert).
  const ergebnis = (eingabe, erwartet) => (eingabe ? bewerte(eingabe).ok === erwartet : erwartet)
  const fehler = fall.filter(([, eingabe, erwartet]) => !ergebnis(eingabe, erwartet))
  for (const [name] of fehler) console.error(`  ✖ Patch-Notes-Pflicht (Gegenprobe): ${name}`)
  if (fehler.length) process.exit(1)
  console.log(`  ✓ Patch-Notes-Pflicht: ${fall.length} Gegenproben`)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

/** Eingaben der Regel aus dem PR-Ereignis: geänderte und neu angelegte Dateien gegen die Basis, Beschreibung. */
function ausEreignis() {
  const pr = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request
  const basis = ladeBasis(git)
  const nameStatus = git('diff', '--name-status', '--no-renames', basis, 'HEAD')
  const dateien = nameStatus.split('\n').filter(Boolean).map((z) => z.split('\t')[1])
  return { dateien, neu: neueEintraege(nameStatus), beschreibung: pr.body ?? '', zweig: pr.head.ref }
}

function main() {
  gegenproben()
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    return console.log('  – Patch-Notes-Pflicht: nur im PR-Ereignis geprüft (hier nicht).')
  }
  const urteil = bewerte(ausEreignis())
  if (!urteil.ok) {
    console.error(`  ✖ Patch-Notes-Pflicht: ${urteil.grund}`)
    process.exit(1)
  }
  console.log(`  ✓ Patch-Notes-Pflicht: ${urteil.grund}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
