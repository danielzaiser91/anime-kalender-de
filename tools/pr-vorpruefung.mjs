/**
 * Vorprüfung vor dem Einreichen eines PR (16.10.2026): fängt mechanisch, was der CI-Prüfer sonst mit „ändern“ zurückgibt
 * (Bericht workflow-engpass-2026-10-16: 57 % Beschreibung passt nicht zum Diff, 26 % Form, dazu fehlende Patch Notes).
 *
 *   node tools/pr-vorpruefung.mjs [--titel "<Titel>"] [--text "<PR-Text>"]
 *
 * Der PR-Text kommt aus `--text` bzw. der Umgebungsvariable PR_TEXT; fehlt er, gilt der Titel (wie in pr-einreichen.sh).
 * Der Diff ist `git diff origin/main...HEAD` (nur Committetes). Exit 1 bei jedem roten Befund, Hinweise (gelb) brechen nicht ab.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bewerte, neueEintraege } from './check-patchnotes-pflicht.mjs'
import { anhebungRot } from './extension-version.mjs'
import { listenEintraege, listenFehler } from './liste-pruefen.mjs'

const PRUEFLISTEN = ['tools/check-logic-liste.txt', 'tools/check-bestand-liste.txt']

/** Sortierung und Dubletten der Prüflisten, gleiche Regel wie check:logic (tools/liste-pruefen.mjs); `lies` liefert den Text oder null. */
export function listenRot(lies, listen = PRUEFLISTEN) {
  return listen.flatMap((name) => {
    const text = lies(name)
    return text === null ? [] : listenFehler(listenEintraege(text), name)
  })
}

// Pfade in Fließtext: mindestens ein Ordner, Endung; ohne Platzhalter (`*`, `<slug>`) und ohne URL-Anteile.
const PFAD = /(?<![\w./@:-])((?:[\w.@-]+\/)+[\w.@-]*\w\.[a-z0-9]{1,5})(?![\w/])/gi
// Stichwort im Text, das einen Ordner als erwähnt gelten lässt, obwohl der Pfad nicht dasteht.
// Lokal per .git/info/exclude ausgeschlossen: im Worktree nicht prüfbar, ob es die Datei gibt.
const LOKAL = /^daniel-zum-abarbeiten\//
const BEREICH_WORT = { 'data/patchnotes': /patch[- ]?notes/i }

/** Pfade, die der Text als Datei nennt (Inline-Code-Zeichen gestrichen). */
export function genanntePfade(text) {
  return [...new Set([...text.replaceAll('`', ' ').matchAll(PFAD)].map((m) => m[1]))]
}

function elternPfade(datei) {
  const teile = datei.split('/')
  return teile.slice(0, -1).map((_, i) => teile.slice(0, i + 1).join('/'))
}

/** Erwähnt der Text die Datei: voller Pfad, Dateiname, Name ohne Endungen, ein Elternordner oder ein Stichwort für den Bereich. */
export function istErwaehnt(datei, text) {
  const name = basename(datei)
  if (text.includes(datei) || text.includes(name)) return true
  const kern = name.split('.')[0]
  if (kern.length >= 4 && text.includes(kern)) return true
  return elternPfade(datei).some((eltern) => {
    const wort = BEREICH_WORT[eltern]
    if (wort?.test(text)) return true
    return eltern.includes('/') ? text.includes(eltern) : text.includes(`${eltern}/`)
  })
}

/** Befunde zu Text und Diff: `rot` bricht das Einreichen ab, `gelb` ist ein Hinweis. */
export function pruefeText({ dateien, text, existiert }) {
  const rot = []
  const gelb = []
  if (!text.trim()) rot.push('PR-Text ist leer.')
  const ungenannt = dateien.filter((d) => !istErwaehnt(d, text))
  if (ungenannt.length) {
    const zeige = ungenannt.slice(0, 8).join(', ')
    rot.push(`Geänderte Dateien, die der PR-Text nicht erwähnt (${ungenannt.length}): ${zeige}${ungenannt.length > 8 ? ', …' : ''}`)
  }
  for (const pfad of genanntePfade(text)) {
    if (dateien.some((d) => d === pfad || d.endsWith(`/${pfad}`))) continue
    if (LOKAL.test(pfad)) continue
    if (existiert(pfad)) gelb.push(`Text nennt ${pfad}, die Datei ist aber nicht Teil des Diffs.`)
    else rot.push(`Text nennt ${pfad}, die es weder im Diff noch im Repo gibt.`)
  }
  return { rot, gelb }
}

/** Regeln aus dem Prüfer-Prompt, die sich am Dateinamen entscheiden. */
export function pruefeDateien({ dateien, text, zweig }) {
  const rot = []
  const daten = /^daten\//.test(zweig)
  const cache = dateien.filter((d) => d.startsWith('data/cache/'))
  if (cache.length && !daten) rot.push(`Dateien unter data/cache/ gehören nicht in einen PR: ${cache.slice(0, 3).join(', ')}`)
  const workflows = dateien.some((d) => d.startsWith('.github/workflows/'))
  if (workflows && !/workflow/i.test(text)) rot.push('Workflows geändert, der PR-Text benennt das nicht ausdrücklich („Workflow“).')
  const pruefungen = dateien.some((d) => /(^|\/)(check-[^/]+|pruefung\.ts)$/.test(d) || d === 'package.json')
  if (pruefungen && !/pr[uü]fung|check|package\.json/i.test(text)) rot.push('Prüfungen oder package.json geändert, der PR-Text benennt das nicht ausdrücklich.')
  return { rot }
}

/** Gesamturteil über alle mechanischen Regeln (ohne Umfang, der läuft als eigener Prozess). */
export function vorpruefe({ dateien, neu, text, zweig, existiert }) {
  const patch = bewerte({ dateien, neu, beschreibung: text, zweig })
  const t = pruefeText({ dateien, text, existiert })
  const d = pruefeDateien({ dateien, text, zweig })
  const rot = [...(patch.ok ? [] : [`Patch-Notes-Pflicht: ${patch.grund}`]), ...t.rot, ...d.rot]
  return { rot, gelb: t.gelb }
}

/** Gibt es den Pfad im Repo: voll, auf der Platte oder als Endstück eines bekannten Pfads (Text kürzt gern `pipeline/` weg). */
export function existiertIn(bekannt, aufPlatte) {
  return (pfad) => bekannt.has(pfad) || aufPlatte(pfad) || [...bekannt].some((b) => b.endsWith(`/${pfad}`))
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 })

function umfangRot() {
  try {
    execFileSync(process.execPath, ['tools/umfang-pruefen.mjs'], { encoding: 'utf8', stdio: 'pipe' })
    return []
  } catch (e) {
    return [`check:umfang rot:\n${String(e.stdout ?? '') + String(e.stderr ?? '')}`.trimEnd()]
  }
}

/** Der PR darf die Version der Erweiterung nicht selbst anheben (zählt nach dem Merge der Workflow). */
function versionRot() {
  const pfad = 'extension/manifest.json'
  const lies = (quelle) => {
    try {
      return git('show', quelle)
    } catch {
      return null
    }
  }
  const rot = anhebungRot(lies(`origin/main:${pfad}`), lies(`HEAD:${pfad}`))
  return rot === null ? [] : [rot]
}

function argWert(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main() {
  const titel = argWert('--titel') ?? ''
  const text = argWert('--text') || process.env.PR_TEXT || titel
  git('fetch', '-q', 'origin', 'main')
  const nameStatus = git('diff', '--name-status', '--no-renames', 'origin/main...HEAD')
  const dateien = nameStatus.split('\n').filter(Boolean).map((z) => z.split('\t')[1])
  const bekannt = new Set(git('ls-tree', '-r', '--name-only', 'origin/main').split('\n'))
  const zweig = git('rev-parse', '--abbrev-ref', 'HEAD').trim()
  const urteil = vorpruefe({
    dateien,
    neu: neueEintraege(nameStatus),
    text,
    zweig,
    existiert: existiertIn(bekannt, existsSync),
  })
  const lies = (name) => (existsSync(name) ? readFileSync(name, 'utf8') : null)
  const rot = [...urteil.rot, ...listenRot(lies), ...umfangRot(), ...versionRot()]
  for (const h of urteil.gelb) console.log(`  ! Hinweis: ${h}`)
  for (const r of rot) console.error(`  ✖ Vorprüfung: ${r}`)
  if (rot.length) {
    console.error(`Vorprüfung rot (${rot.length}): der CI-Prüfer würde „ändern“ sagen. Text/Commit anpassen, dann erneut einreichen.`)
    process.exit(1)
  }
  console.log(`  ✓ Vorprüfung: ${dateien.length} Dateien, Beschreibung, Patch Notes und Umfang passen.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
