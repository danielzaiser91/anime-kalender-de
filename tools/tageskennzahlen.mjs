/**
 * Tageskennzahlen (Europe/Berlin) nach tools/kennzahlen/tage.jsonl: eine JSON-Zeile je Tag, damit Maßnahmen an Zahlen gemessen werden.
 * Quellen nur gh (REST; GraphQL ist in Cloud-Sitzungen gesperrt) und git, nie D1. Rechenregeln: tageskennzahlen-rechnen.mjs.
 *
 *   node tools/tageskennzahlen.mjs [--von=2026-10-01] [--bis=<gestern>]   schreibt die Datei neu (idempotent, gleiche Eingabe = gleiche Zeilen)
 *
 * Voraussetzung: git-Verlauf ab `--von` (bei flachem Klon: git fetch --shallow-since=<von minus 2 Tage> origin main).
 * Fehlt eine Kennzahl (Datei am Tag nicht vorhanden, keine Läufe), fehlt das Feld; nie geschätzt.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipBytes } from './kennzahlen.mjs'
import { bestimmeStufe } from './pr-stufe.mjs'
import { leseKette } from './pr-stufe-kette.mjs'
import {
  durchsatz, istBot, istRevert, medianDauerMin, rotStundenJeTag, stauAmTagesende, storyPoints,
  tageZwischen, tagBerlin, tagesBeginnMs, tagPlus,
} from './tageskennzahlen-rechnen.mjs'

const REPO = 'danielzaiser91/anime-kalender-de'
const AUSGABE = 'tools/kennzahlen/tage.jsonl'
const BAU = 'Bestand — zusammenführen und bauen'
const KETTE = 'PR-Prüfkette'
const SEITE = [['metaGzipKb', 'meta.json'], ['wocheKachelnGzipKb', 'woche-kacheln.json'], ['titlesGzipKb', 'titles.json']]
const MARKE = '\u0001COMMIT\u0001'

function ausfuehren(befehl, args, optionen = {}) {
  const r = spawnSync(befehl, args, { encoding: 'utf8', maxBuffer: 1 << 30, ...optionen })
  if (r.status !== 0) throw new Error(`${befehl} ${args.slice(0, 3).join(' ')} fehlgeschlagen: ${r.stderr.slice(0, 300)}`)
  return r.stdout
}

/** Netzabbrüche (connection reset über den Proxy) kommen vor: bis zu vier Versuche mit wachsender Pause. */
function mitWiederholung(f) {
  for (let versuch = 1; ; versuch++) {
    try {
      return f()
    } catch (fehler) {
      if (versuch === 4) throw fehler
      spawnSync('sleep', [String(versuch * 3)])
    }
  }
}

/** Alle Seiten einer REST-Liste; `--paginate` folgt Link-Adressen mit Numeric-ID, die der Proxy sperrt, daher eigene Seitenzählung. */
function gh(pfad, jq) {
  const alle = []
  for (let seite = 1; ; seite++) {
    const zeilen = mitWiederholung(() => ausfuehren('gh', ['api', `${pfad}&page=${seite}`, '--jq', jq], { timeout: 60_000 })).split('\n').filter(Boolean).map((z) => JSON.parse(z))
    alle.push(...zeilen)
    if (zeilen.length < 100) return alle
  }
}

/** Alle PRs (offen, gemergt, geschlossen) mit Zeitstempeln; `endeAt` = Merge oder Schließung. */
function holePrs() {
  const jq = '.[]|{number,author:.user.login,title,createdAt:.created_at,mergedAt:.merged_at,endeAt:(.merged_at // .closed_at)}|tojson'
  return gh(`repos/${REPO}/pulls?state=all&sort=created&direction=desc&per_page=100`, jq).map((p) => ({ ...p, bot: istBot(p) }))
}

/** Läufe aller Workflows in 3-Stunden-Fenstern (die API liefert je Abfrage höchstens 1000 Treffer). */
function holeLaeufe(von, bis) {
  const laeufe = []
  const jq = '.workflow_runs[]|{name,createdAt:.created_at,start:.run_started_at,ende:.updated_at,conclusion}|tojson'
  for (let t = von; t <= bis; t = tagPlus(t, 1)) {
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const f = (x) => `${t}T${String(x).padStart(2, '0')}:`
      const fenster = `${f(h)}00:00Z..${f(h + 2)}59:59Z`
      laeufe.push(...gh(`repos/${REPO}/actions/runs?created=${fenster}&per_page=100`, jq))
    }
  }
  return laeufe
}

/**
 * Commits mit Zeilenzahlen je Datei als [{ betreff, zeit, dateien }] (`--numstat`: der volle Diff wäre 2 GB, data/ ist riesig).
 * `dateien` hat die Gestalt von `liesDiff` mit leeren Zeilen als Platzhalter: Stufe 2 hängt nur an Pfad und Zeilenzahl,
 * Inhaltsregeln (Kommentar, Tatsachenzahl) können nur 0↔1 verschieben.
 */
function holeCommits(von) {
  const roh = ausfuehren('git', ['-c', 'core.quotepath=false', 'log', 'origin/main', `--since=${von}`, `--format=${MARKE}%cI\t%s`, '--numstat', '--no-renames'])
  return roh.split(MARKE).slice(1).map((block) => {
    const [kopf, ...rest] = block.split('\n')
    const [zeit, betreff] = [kopf.slice(0, kopf.indexOf('\t')), kopf.slice(kopf.indexOf('\t') + 1)]
    const dateien = rest.filter((z) => z.includes('\t')).map((z) => {
      const [hinzu, weg, pfad] = z.split('\t')
      const n = (x) => new Array(x === '-' ? 0 : Number(x)).fill('')
      return { pfad, quelle: null, hinzu: n(hinzu), weg: n(weg), modus: false, symlink: false, binaer: hinzu === '-', unlesbar: false }
    })
    return { zeit, betreff, dateien }
  })
}

/** PR-Nummer -> { punkte, stufe } aus dem Squash-Commit „… (#N)“. */
function punkteJePr(commits, kette) {
  const jePr = new Map()
  for (const c of commits) {
    const nummer = /\(#(\d+)\)$/.exec(c.betreff)?.[1]
    if (!nummer) continue
    const dateien = c.dateien
    const stufe = bestimmeStufe(dateien, kette).stufe
    jePr.set(Number(nummer), { stufe, punkte: storyPoints(dateien.map((d) => ({ pfad: d.pfad, zeilen: d.hinzu.length + d.weg.length })), stufe) })
  }
  return jePr
}

/** gzip-Größen (KB) am letzten Commit des Berlin-Tages; fehlende Datei = Feld fehlt. */
function seitenGroesse(tag) {
  const sha = ausfuehren('git', ['rev-list', '-1', `--before=${new Date(tagesBeginnMs(tagPlus(tag, 1))).toISOString()}`, 'origin/main']).trim()
  const felder = {}
  for (const [feld, datei] of SEITE) {
    const r = spawnSync('git', ['show', `${sha}:public/data/${datei}`], { maxBuffer: 1 << 30 })
    if (r.status === 0) felder[feld] = Number((gzipBytes(r.stdout) / 1024).toFixed(1))
  }
  return felder
}

/** Eine Zeile je Tag aus den gesammelten Rohdaten. */
function tageszeile(tag, daten) {
  const ende = tagesBeginnMs(tagPlus(tag, 1))
  const gemergt = daten.prs.filter((p) => p.mergedAt && tagBerlin(p.mergedAt) === tag).map((p) => ({ ...p, punkte: daten.punkte.get(p.number)?.punkte }))
  const imTag = (l) => tagBerlin(l.createdAt) === tag
  const laeufeTag = daten.laeufe.filter(imTag)
  const dauer = (name) => medianDauerMin(laeufeTag.filter((l) => l.name === name))
  const commits = daten.commits.filter((c) => tagBerlin(c.zeit) === tag)
  const zeile = {
    tag,
    ...durchsatz(gemergt),
    stau: stauAmTagesende(daten.prs, ende),
    reverts: commits.filter((c) => istRevert(c.betreff)).length,
    sammlerStandZurueck: commits.filter((c) => /Sammler-Stand zurückgenommen/.test(c.betreff)).length,
    rotLaeufe: laeufeTag.filter((l) => l.conclusion === 'failure' || l.conclusion === 'timed_out').length,
    bestandRotH: daten.rotJeTag[tag] ?? 0,
    seite: seitenGroesse(tag),
    bauDauerMedianMin: dauer(BAU),
    ketteDauerMedianMin: dauer(KETTE),
  }
  for (const k of ['bauDauerMedianMin', 'ketteDauerMedianMin']) if (zeile[k] === undefined) delete zeile[k]
  return zeile
}

function lies(argv, name, vorgabe) {
  return argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? vorgabe
}

function main(argv) {
  const jetzt = Date.now()
  const von = lies(argv, 'von', '2026-10-01')
  const bis = lies(argv, 'bis', tagPlus(tagBerlin(jetzt), -1))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis) || von > bis) {
    console.error(`FEHLER: --von=${von} und --bis=${bis} müssen Tage (JJJJ-MM-TT) sein, von nicht nach bis`)
    process.exit(1)
  }
  const prs = holePrs()
  const commits = holeCommits(tagPlus(von, -1))
  const laeufe = holeLaeufe(tagPlus(von, -1), tagPlus(bis, 1))
  const rotJeTag = rotStundenJeTag(laeufe.filter((l) => l.name === BAU), jetzt)
  const daten = { prs, commits, laeufe, rotJeTag, punkte: punkteJePr(commits, leseKette(process.cwd())) }
  const zeilen = tageZwischen(von, bis).map((tag) => JSON.stringify(tageszeile(tag, daten)))
  const ziel = resolve(AUSGABE)
  mkdirSync(dirname(ziel), { recursive: true })
  writeFileSync(ziel, `${zeilen.join('\n')}\n`)
  console.log(`${zeilen.length} Tage nach ${AUSGABE} (${von} bis ${bis}), ${prs.length} PRs, ${laeufe.length} Läufe, ${commits.length} Commits`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
