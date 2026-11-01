/**
 * Pflicht in der PR-Prüfkette (Daniel, 10.10.2026): Ein PR, der die Seite sichtbar ändert (`web/src/`, `shared/`, `data/curated/`,
 * `data/dub-confirmed.yaml`; nicht Zweige `daten/`, `claude/`), legt entweder eine neue Datei in `data/patchnotes/` an oder trägt in der
 * PR-Beschreibung eine Zeile „Patch Notes: keine – <Grund>“. Sonst ist die Prüfkette rot.
 * Wirkt die Änderung erst nach einem Lauf oder Bau, lautet die Zeile „Patch Notes: vertagt – <Grund>“ und der PR legt den Entwurf unter
 * `data/patchnotes/vorrat/` an; eine „keine“-Zeile mit Vertagungs-Grund ohne diese Datei ist rot (docs/wissen/betrieb.md, 01.11.2026).
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
const KEINE_ZEILE = /^\s*Patch Notes:\s*keine\s*[–—-]\s*(.*\S)/im
// „Patch Notes: vertagt – <Grund>“: die Wirkung kommt erst nach einem Lauf/Bau; der Entwurf liegt im Vorrat (Unterordner `vorrat/`).
const VORRAT = /^data\/patchnotes\/vorrat\/[^/]+\.yaml$/
const VERTAGT_ZEILE = /^\s*Patch Notes:\s*vertagt\s*[–—-]\s*\S/im
// Eine „keine“-Zeile, die in Wahrheit vertagt (Anlass: 7 von 94 Zeilen seit 29.10.2026, nie folgte ein Eintrag).
const VERTAGUNG_IM_GRUND =
  /sp[äa]ter|vertag|wirkt erst|(n[äa]chste[nm]?|folgenden) (\S+ )?\S*(lauf|bau|abruf|lesung|deploy)|(patch note|note) folgt/i

// „keine“ gilt nur mit einer Klasse am Anfang des Grundes (Umbau, Test, Werkzeug, CI, Doku, Erweiterung, intern). „Daten“ steht absichtlich nicht
// darin: Datenkorrekturen ändern, was Besucher sehen (Anlass: 10 sichtbare und 12 Daten-Titel-PRs unter 102 „keine“-PRs seit 29.10.2026, betrieb.md).
const GRUND_KLASSE = /^(rein\w*\s+)?(umbau|refactor\w*|tests?|testfäll?e?|werkzeug\w*|ci|doku\w*|erweiterung\w*|intern\w*)\b/i
// Titel `fix(prime)`, `feat(data)` …: die Zeile muss die gemessene Wirkung nennen („0 Titel“, „0 Termine“ …), nicht „kein sichtbarer Unterschied“.
const DATEN_TITEL = /^(fix|feat)\((prime|data)\)/i
const NULL_WIRKUNG = /\b0 (Titel|Termine|Meldungen|Wege|Zeilen)\b/i

/** Meldung, wenn die „keine“-Zeile ihren Grund nicht aus der festen Liste nimmt (oder bei Daten-Titeln die Wirkung nicht misst); sonst `null`. */
function grundFehler(beschreibung, titel, sichtbar) {
  const grund = KEINE_ZEILE.exec(beschreibung)?.[1]
  if (grund === undefined) return null
  if (sichtbar && !GRUND_KLASSE.test(grund.trim())) {
    return (
      `Der Grund der Zeile „Patch Notes: keine“ beginnt mit keiner Klasse: „${grund.slice(0, 60)}“.\n` +
      '  Erlaubt am Anfang: Umbau, Test, Werkzeug, CI, Doku, Erweiterung, intern. Ändert der PR Daten oder Anzeige, die Besucher sehen,\n' +
      '  legt er einen Eintrag in data/patchnotes/ an (oder einen Entwurf unter vorrat/ mit „Patch Notes: vertagt – <Grund>“).'
    )
  }
  if (DATEN_TITEL.test(titel) && !NULL_WIRKUNG.test(grund)) {
    return `Titel „${titel.slice(0, 40)}“ ändert Daten: „keine“ nennt die gemessene Wirkung („0 Titel ändern sich“, Beleg bau-vergleich), sonst Eintrag oder Vorrat.`
  }
  return null
}

/** Eintrags-Dateien, die der PR neu anlegt, aus der Ausgabe von `git diff --name-status --no-renames` (Zeilen „A<Tab>Pfad“). */
export function neueEintraege(nameStatus, muster = EINTRAG) {
  return nameStatus
    .split('\n')
    .map((z) => z.split('\t'))
    .filter(([status, pfad]) => status === 'A' && muster.test(pfad ?? ''))
    .map(([, pfad]) => pfad)
}

/** Neu angelegte Vorrats-Dateien (`data/patchnotes/vorrat/<name>.yaml`). */
export const neueVorratEintraege = (nameStatus) => neueEintraege(nameStatus, VORRAT)

/** Meldung, wenn die Beschreibung vertagt (Zeile „vertagt“ oder „keine“ mit Vertagungs-Grund), der PR aber keinen Vorrats-Eintrag anlegt; sonst `null`. */
function vertagungOhneVorrat(beschreibung, vorrat) {
  if (vorrat.length) return null
  const vertagt = VERTAGT_ZEILE.test(beschreibung)
  const verkappt = VERTAGUNG_IM_GRUND.test(KEINE_ZEILE.exec(beschreibung)?.[1] ?? '')
  if (!vertagt && !verkappt) return null
  return (
    `Die Beschreibung vertagt die Patch Note (${vertagt ? '„vertagt“' : '„keine“ mit „später/nächster Lauf“'}), legt aber keinen Entwurf an.\n` +
    '  Neue Datei data/patchnotes/vorrat/<name>.yaml (Felder wie ein Eintrag, dazu wartetAuf und seit), Zeile „Patch Notes: vertagt – <Grund>“.\n' +
    '  Ist gar nichts Sichtbares zu erwarten: „Patch Notes: keine – <Grund>“ ohne „später“ und ohne „nächster Lauf“.'
  )
}

/** Ergebnis der Regel für einen PR: `ok` und der Grund in einem Satz. */
export function bewerte({ dateien, neu, beschreibung, zweig = '', vorrat = [], titel = '' }) {
  if (AUSGENOMMENE_ZWEIGE.test(zweig)) return { ok: true, grund: `Zweig ${zweig} (Daten-/Sammlerlauf) ausgenommen` }
  const vertagung = vertagungOhneVorrat(beschreibung, vorrat)
  if (vertagung) return { ok: false, grund: vertagung }
  const sichtbar = dateien.filter((f) => SICHTBAR.test(f))
  const fehlerGrund = neu.length || vorrat.length ? null : grundFehler(beschreibung, titel, sichtbar.length > 0)
  if (fehlerGrund) return { ok: false, grund: fehlerGrund }
  if (!sichtbar.length) return { ok: true, grund: vorrat.length ? `Vorrat: ${vorrat.join(' | ')}` : 'keine sichtbare Änderung' }
  if (neu.length) return { ok: true, grund: `neuer Eintrag: ${neu.join(' | ')}` }
  if (vorrat.length && VERTAGT_ZEILE.test(beschreibung)) return { ok: true, grund: `vertagt, Entwurf im Vorrat: ${vorrat.join(' | ')}` }
  if (KEINE_ZEILE.test(beschreibung)) return { ok: true, grund: 'in der PR-Beschreibung ausgenommen' }
  return {
    ok: false,
    grund:
      `Sichtbare Änderung (${sichtbar.slice(0, 3).join(', ')}${sichtbar.length > 3 ? ', …' : ''}) ohne Patch-Notes-Eintrag.\n` +
      `  Entweder eine neue Datei in ${ORDNER} anlegen (Nutzen für Besucher, höchstens 8 Wörter)\n` +
      '  oder in die PR-Beschreibung die Zeile „Patch Notes: keine – <Grund>“ schreiben und danach einen neuen Commit pushen.',
  }
}

/** Fälle der Vertagung (Name, Eingabe, Erwartung wie in `gegenproben`). Die Gründe stammen wörtlich aus PR 2547, 2532, 2528, 2515, 2388, 2362, 2354. */
function vertagungsFaelle(web) {
  const vorrat = ['data/patchnotes/vorrat/x.yaml']
  const keine = (grund) => `Patch Notes: keine – ${grund}`
  const echte = [
    'sichtbar höchstens 24 Fairy-Tail-Folgen mit eigenem Urteil nach dem nächsten Lauf.',
    'Bau-Korrektur ohne eigene sichtbare Neuerung (Spirou erscheint erst mit dem nächsten Cartoon-Lauf)',
    'Handliste wirkt erst nach dem nächsten Lauf; Sichtbarkeit hängt vom Datenbau ab.',
    'wirkt erst nach dem nächsten Cartoon-Abruf; die Patch Note folgt mit der Datenübernahme',
    'Pipeline-Korrektur, die Daten ändern sich erst im nächsten Lauf.',
    'Pipeline des Beleg-Laufs, die Wirkung zeigt sich erst mit der nächsten Lesung, nicht mit diesem PR.',
    'reine Datenkorrektur ohne eigene Anzeigetexte, wirkt erst mit dem nächsten Bestandsbau.',
  ]
  const pipeline = ['pipeline/x.ts']
  return [
    ...echte.map((g, i) => [`Vertagung ${i + 1} von 7 als „keine“ ohne Vorrat ist rot`, { dateien: pipeline, neu: [], beschreibung: keine(g) }, false]),
    ...echte.map((g, i) => [`Vertagung ${i + 1} von 7 als „keine“ mit Vorrat ist grün`, { dateien: pipeline, neu: [], beschreibung: keine(g), vorrat }, true]),
    ['vertagt ohne Vorrat ist rot', { dateien: web, neu: [], beschreibung: 'Patch Notes: vertagt – wirkt nach dem Bau' }, false],
    ['vertagt ohne Vorrat ist auch ohne sichtbare Änderung rot', { dateien: pipeline, neu: [], beschreibung: 'Patch Notes: vertagt – Bau' }, false],
    ['vertagt mit Vorrat ist grün', { dateien: web, neu: [], beschreibung: 'Patch Notes: vertagt – wirkt nach dem Bau', vorrat }, true],
    ['Vorrat ohne Zeile bei sichtbarer Änderung ist rot', { dateien: web, neu: [], beschreibung: '', vorrat }, false],
    ['vertagt ohne Grund zählt nicht als Zeile', { dateien: web, neu: [], beschreibung: 'Patch Notes: vertagt –', vorrat }, false],
    ['gewöhnliche „keine“-Zeile bleibt grün', { dateien: web, neu: [], beschreibung: keine('reiner Umbau, Ausgabe gleich') }, true],
    ['„keine“ mit „nächste“ im anderen Sinn bleibt grün', { dateien: web, neu: [], beschreibung: keine('Test für die nächste Frage') }, true],
    ['„keine“ mit „später“ allein ohne Vorrat ist rot', { dateien: web, neu: [], beschreibung: keine('Anzeige kommt später') }, false],
    ['Zweig daten/ mit Vertagung ist ausgenommen', { dateien: web, neu: [], beschreibung: keine('später'), zweig: 'daten/x' }, true],
  ]
}

// Echte Zeilen und Titel gemergter PRs (gh pr list, merged:>=2026-10-29, Stand 01.11.2026) gegen die Grundliste.
function grundFaelle(web) {
  const keine = (g) => `Patch Notes: keine – ${g}`
  const daten = ['data/curated/x.yaml']
  const pipeline = ['pipeline/x.ts']
  return [
    ['2332 sichtbar, Grund ohne Klasse ist rot', { dateien: web, neu: [], beschreibung: keine('Fehler bestand nur Stunden seit dem Ecchi-Merge (Dirigent, 29.10.).') }, false],
    ['2419 sichtbar, Grund ohne Klasse ist rot', { dateien: web, neu: [], beschreibung: keine('seltener Randfall nach Rückkehr, kein neues Verhalten') }, false],
    ['2428 Daten sichtbar, Grund ohne Klasse ist rot', { dateien: daten, neu: [], beschreibung: keine('reine Datenkorrektur (`data/…`), keine neue Anzeige.') }, false],
    ['Klasse Umbau am Anfang ist grün', { dateien: web, neu: [], beschreibung: keine('Umbau, Ausgabe gleich (bau-vergleich)') }, true],
    ['Klasse „reiner Umbau“ ist grün', { dateien: web, neu: [], beschreibung: keine('reiner Umbau ohne Wirkung') }, true],
    ['Klasse CI ist grün', { dateien: web, neu: [], beschreibung: keine('CI-Wächter') }, true],
    ['Klasse nicht am Anfang zählt nicht', { dateien: web, neu: [], beschreibung: keine('Datenkorrektur, nur ein Test dabei') }, false],
    ['Klasse ist ein ganzes Wort', { dateien: web, neu: [], beschreibung: keine('Testament der Anzeige') }, false],
    ['ohne sichtbare Dateien braucht der Grund keine Klasse', { dateien: pipeline, neu: [], beschreibung: keine('Pipeline-Korrektur') }, true],
    ['fix(prime) mit „kein sichtbarer Unterschied“ ist rot', { dateien: pipeline, neu: [], beschreibung: keine('Test: kein sichtbarer Unterschied'), titel: 'fix(prime): fünf Fremdzuordnungen sperren' }, false],
    ['fix(data) mit gemessener Null-Wirkung ist grün', { dateien: pipeline, neu: [], beschreibung: keine('Umbau, 0 Titel ändern sich (bau-vergleich)'), titel: 'fix(data): Liste zusammenlegen' }, true],
    ['feat(prime) wird wie fix(prime) behandelt', { dateien: pipeline, neu: [], beschreibung: keine('Werkzeug ohne Wirkung'), titel: 'feat(prime): Wächter für Seiten' }, false],
    ['docs(prime) ist kein Daten-Titel', { dateien: pipeline, neu: [], beschreibung: keine('Doku, nichts Sichtbares'), titel: 'docs(prime): CI-Abruf' }, true],
    ['neuer Eintrag ersetzt die Grundprüfung', { dateien: web, neu: ['A'], beschreibung: keine('egal'), titel: 'fix(prime): x' }, true],
  ]
}

function gegenproben() {
  const web = ['web/src/App.tsx']
  const fall = [
    ['sichtbar, kein Eintrag, keine Zeile', { dateien: web, neu: [], beschreibung: 'x' }, false],
    ['sichtbar mit neuem Eintrag', { dateien: web, neu: ['A'], beschreibung: '' }, true],
    ['Daten sichtbar ohne Eintrag', { dateien: ['data/curated/x.yaml'], neu: [], beschreibung: '' }, false],
    ['Handbeleg ohne Eintrag', { dateien: ['data/dub-confirmed.yaml'], neu: [], beschreibung: '' }, false],
    ['Ausnahmezeile mit Gedankenstrich', { dateien: web, neu: [], beschreibung: 'a\nPatch Notes: keine – reiner Umbau\nb' }, true],
    ['Ausnahmezeile mit Bindestrich', { dateien: web, neu: [], beschreibung: 'Patch Notes: keine - Werkzeug' }, true],
    ['Ausnahmezeile ohne Grund', { dateien: web, neu: [], beschreibung: 'Patch Notes: keine –' }, false],
    ['Ausnahme mitten im Satz zählt nicht', { dateien: web, neu: [], beschreibung: 'Ich sage Patch Notes: keine – weil' }, false],
    ['nur Pipeline, Doku', { dateien: ['pipeline/x.ts', 'docs/a.md'], neu: [], beschreibung: '' }, true],
    ['shared/ zählt als sichtbar', { dateien: ['shared/logic.ts'], neu: [], beschreibung: '' }, false],
    ['shared/ mit Ausnahmezeile', { dateien: ['shared/logic.ts'], neu: [], beschreibung: 'Patch Notes: keine – Werkzeug' }, true],
    ['Zweig daten/ ausgenommen', { dateien: ['data/curated/x.yaml'], neu: [], beschreibung: '', zweig: 'daten/crunchyroll' }, true],
    ['Zweig claude/ ausgenommen', { dateien: ['shared/x.ts'], neu: [], beschreibung: '', zweig: 'claude/sammler' }, true],
    ['Zweig feat/ nicht ausgenommen', { dateien: ['shared/x.ts'], neu: [], beschreibung: '', zweig: 'feat/daten/x' }, false],
  ]
  const status = 'M\tdata/patchnotes/alt.yaml\nA\tdata/patchnotes/neu.yaml\nA\tdata/patchnotes/ordner/tief.yaml\nA\tdata/patchnotes/notiz.md\nA\tweb/src/x.ts\nD\tdata/patchnotes/weg.yaml\n'
  fall.push(['neueEintraege: nur neu angelegte Dateien direkt im Ordner', null, neueEintraege(status).join() === 'data/patchnotes/neu.yaml'])
  fall.push(['neueEintraege: leere Ausgabe ergibt nichts', null, neueEintraege('').length === 0])
  fall.push(['neueEintraege: Vorrats-Datei zählt nicht als Eintrag', null, neueEintraege('A\tdata/patchnotes/vorrat/x.yaml\n').length === 0])
  const vorratStatus = `${status}A\tdata/patchnotes/vorrat/v.yaml\nM\tdata/patchnotes/vorrat/m.yaml\nA\tdata/patchnotes/vorrat/t/x.yaml\n`
  fall.push(['neueVorratEintraege: nur neu angelegte Dateien im Unterordner', null, neueVorratEintraege(vorratStatus).join() === 'data/patchnotes/vorrat/v.yaml'])
  fall.push(...vertagungsFaelle(web))
  fall.push(...grundFaelle(web))
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
  return { dateien, neu: neueEintraege(nameStatus), vorrat: neueVorratEintraege(nameStatus), beschreibung: pr.body ?? '', zweig: pr.head.ref, titel: pr.title ?? '' }
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
