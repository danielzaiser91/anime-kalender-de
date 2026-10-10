/**
 * Pflicht in der PR-Prüfkette (Daniel, 10.10.2026): Ein PR, der die Seite sichtbar ändert (`web/src/`, `data/curated/`,
 * `data/dub-confirmed.yaml`), bringt entweder einen neuen Eintrag in `data/patchnotes.yaml` mit oder trägt in der
 * PR-Beschreibung eine Zeile „Patch Notes: keine – <Grund>“. Sonst ist die Prüfkette rot.
 *
 *   node tools/check-patchnotes-pflicht.mjs
 *
 * Läuft immer die Gegenproben der Regel; die echte Prüfung nur im Ereignis `pull_request` (Beschreibung und Basis aus der
 * Ereignisdatei der Action, kein Workflow-Zusatz nötig). Lokal und auf main ist sie ein Nullbefehl. Hinweis: Die Beschreibung
 * stammt aus dem Ereignis; wer sie nachträglich ändert, stößt die Prüfkette mit einem neuen Commit erneut an.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const YAML_PFAD = 'data/patchnotes.yaml'
const SICHTBAR = /^(web\/src\/|data\/curated\/|data\/dub-confirmed\.yaml$)/
const KEINE_ZEILE = /^\s*Patch Notes:\s*keine\s*[–—-]\s*\S/im

/** Texte der Einträge, die nachher in der Datei stehen und vorher nicht. */
export function neueTexte(vorher, nachher) {
  const texte = (roh) => (roh ? yaml.load(roh, { schema: yaml.JSON_SCHEMA }) : []).map((e) => e.text)
  const alt = new Set(texte(vorher))
  return texte(nachher).filter((t) => !alt.has(t))
}

/** Ergebnis der Regel für einen PR: `ok` und der Grund in einem Satz. */
export function bewerte({ dateien, neu, beschreibung }) {
  const sichtbar = dateien.filter((f) => SICHTBAR.test(f))
  if (!sichtbar.length) return { ok: true, grund: 'keine sichtbare Änderung' }
  if (neu.length) return { ok: true, grund: `neuer Eintrag in ${YAML_PFAD}: ${neu.join(' | ')}` }
  if (KEINE_ZEILE.test(beschreibung)) return { ok: true, grund: 'in der PR-Beschreibung ausgenommen' }
  return {
    ok: false,
    grund:
      `Sichtbare Änderung (${sichtbar.slice(0, 3).join(', ')}${sichtbar.length > 3 ? ', …' : ''}) ohne Patch-Notes-Eintrag.\n` +
      `  Entweder eine Zeile in ${YAML_PFAD} ergänzen (Nutzen für Besucher, höchstens 8 Wörter)\n` +
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
  ]
  const alt = '- {kategorie: bugfix, text: A}\n- {kategorie: bugfix, text: B}\n'
  const neu = neueTexte(alt, '- {kategorie: bugfix, text: B}\n- {kategorie: bugfix, text: C}\n')
  fall.push(['neueTexte: nur der hinzugekommene Text', null, neu.join() === 'C'])
  fall.push(['neueTexte ohne Vorfassung: alle', null, neueTexte('', alt).length === 2])
  // Ohne Eingabe steht in der dritten Spalte schon das Ergebnis der Probe (Wahrheitswert).
  const ergebnis = (eingabe, erwartet) => (eingabe ? bewerte(eingabe).ok === erwartet : erwartet)
  const fehler = fall.filter(([, eingabe, erwartet]) => !ergebnis(eingabe, erwartet))
  for (const [name] of fehler) console.error(`  ✖ Patch-Notes-Pflicht (Gegenprobe): ${name}`)
  if (fehler.length) process.exit(1)
  console.log(`  ✓ Patch-Notes-Pflicht: ${fall.length} Gegenproben`)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

function hatCommit(sha) {
  try {
    git('cat-file', '-e', `${sha}^{commit}`)
    return true
  } catch {
    return false
  }
}

/** Eingaben der Regel aus dem PR-Ereignis: geänderte Dateien gegen die Basis, alte und neue Fassung der Liste, Beschreibung. */
function ausEreignis() {
  const pr = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request
  const basis = pr.base.sha
  if (!hatCommit(basis)) git('fetch', '--no-tags', '--depth=1', 'origin', basis)
  const dateien = git('diff', '--name-only', basis, 'HEAD').split('\n').filter(Boolean)
  let vorher = ''
  try {
    vorher = git('show', `${basis}:${YAML_PFAD}`)
  } catch {
    /* Datei neu im PR. */
  }
  const nachher = existsSync(YAML_PFAD) ? readFileSync(YAML_PFAD, 'utf8') : ''
  return { dateien, neu: neueTexte(vorher, nachher), beschreibung: pr.body ?? '' }
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
