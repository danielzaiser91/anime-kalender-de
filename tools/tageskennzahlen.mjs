/**
 * Tageskennzahlen (Europe/Berlin) nach tools/kennzahlen/tage.jsonl: eine JSON-Zeile je Tag, damit Maßnahmen an Zahlen gemessen werden.
 * Quellen nur gh (REST; GraphQL ist in Cloud-Sitzungen gesperrt) und git, nie D1. Rechenregeln: tageskennzahlen-rechnen.mjs.
 *
 *   node tools/tageskennzahlen.mjs [--von=2026-10-01] [--bis=<gestern>] [--lehren=<lehren.md>|--ohne-lehren]   schreibt die Datei neu (idempotent, gleiche Eingabe = gleiche Zeilen); Volllauf ≈ 5000 Abrufe
 *   node tools/tageskennzahlen.mjs --anhaengen [--von=…] [--bis=…]   Regelfall: nur diese Tage ersetzen/einsortieren, Rest bleibt; ohne --von ab dem Tag nach der letzten Zeile
 *
 * Voraussetzung: git-Verlauf ab `--von` (bei flachem Klon: git fetch --shallow-since=<von minus 2 Tage> origin main).
 * Fehlt eine Kennzahl (Datei am Tag nicht vorhanden, keine Läufe), fehlt das Feld; nie geschätzt.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dateiInhalt, pruefeKontingent, tagNachLetzterZeile } from './tageskennzahlen-anhaengen.mjs'
import { gzipBytes } from './kennzahlen.mjs'
import { bestimmeStufe } from './pr-stufe.mjs'
import { leseKette } from './pr-stufe-kette.mjs'
import { aktualisiereAnsicht } from './kennzahlen-daten-erzeugen.mjs'
import { lehrenAmTag, lehrenJeTag, unzugeordnet } from './kennzahlen-lehren.mjs'
import { medianCiGruenBisMergeH, qualitaet, urteileJePr } from './tageskennzahlen-pruefung.mjs'
import {
  durchsatz, istBot, istRevert, medianDauerMin, rotStundenJeTag, stauAmTagesende, storyPoints,
  tageZwischen, tagBerlin, tagesBeginnMs, tagPlus,
} from './tageskennzahlen-rechnen.mjs'

const REPO = 'derNamenloseDaniel/anime-kalender-de'
const AUSGABE = 'tools/kennzahlen/tage.jsonl'
const LEHREN = 'daniel-zum-abarbeiten/berichte/lehren.md'
const BAU = 'Bestand — zusammenführen und bauen'
const KETTE = 'PR-Prüfkette'
const SEITE = [['metaGzipKb', 'meta.json'], ['wocheKachelnGzipKb', 'woche-kacheln.json'], ['titlesGzipKb', 'titles.json']]
const URTEILE_VORLAUF_TAGE = 14 // längste PR-Lebensdauer: Urteile eines PR, der vor `--von` begann, zählen mit
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
  const jq = '.[]|{number,author:.user.login,title,headSha:.head.sha,createdAt:.created_at,mergedAt:.merged_at,endeAt:(.merged_at // .closed_at)}|tojson'
  return gh(`repos/${REPO}/pulls?state=all&sort=created&direction=desc&per_page=100`, jq).map((p) => ({ ...p, bot: istBot(p) }))
}

/** Läufe aller Workflows in 3-Stunden-Fenstern (die API liefert je Abfrage höchstens 1000 Treffer). */
function holeLaeufe(von, bis) {
  const laeufe = []
  const jq = '.workflow_runs[]|{name,headSha:.head_sha,createdAt:.created_at,start:.run_started_at,ende:.updated_at,conclusion}|tojson'
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
 * Prüfer-Urteile des CI-Prüfers seit `von` (Kommentare des Bots, Zählweise in tageskennzahlen-pruefung.mjs).
 * Eigene Seitenzählung: das jq filtert, die Seite endet erst, wenn die ungefilterte Liste unter 100 Kommentaren bleibt.
 * Keine Rückwärts-Schrägstriche im jq (der Befehls-Hook halbiert sie): Zeichenklassen statt Escapes.
 * Grenze: GitHub bricht die Kommentarliste nach rund 330 Seiten mit HTTP 422 ab (15.11.2026: 105 Seiten seit 2026-09-17, ~230 Kommentare am Tag);
 * bei der Vorgabe `--von` ist sie rund Februar 2027 erreicht, dann Kommentare je PR laden. Beginn: siehe `URTEILE_VORLAUF_TAGE`.
 */
export function holeUrteile(von, abruf = ausfuehren) {
  const treffer = '.[]|select(.user.login=="github-actions[bot]" and (.body|startswith("**Prüfer-Review**")))'
  const felder = '{pr:(.issue_url|split("/")|last|tonumber),zeit:.created_at,kopf:(.body|capture("^[*][*]Prüfer-Review[*][*] für (?<k>[0-9a-f]+)").k),urteil:(.body|capture("Urteil: [*][*](?<u>[^*]+)[*][*]").u)}'
  const jq = `{n:length,e:[${treffer}|${felder}]}|tojson`
  const zeilen = []
  for (let seite = 1; ; seite++) {
    const pfad = `repos/${REPO}/issues/comments?since=${von}T00:00:00Z&per_page=100&page=${seite}`
    const antwort = JSON.parse(mitWiederholung(() => abruf('gh', ['api', pfad, '--jq', jq], { timeout: 60_000 })))
    zeilen.push(...antwort.e)
    if (antwort.n < 100) return zeilen
  }
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

/** Qualität, CI-grün-bis-Merge und Lehren des Tages; ohne belegbare Quelle fehlt das Feld (nie 0 geraten). */
export function pruefungsfelder(tag, gemergt, daten) {
  const hand = gemergt.filter((p) => !p.bot)
  const felder = {
    pruefer: qualitaet(hand, daten.urteile),
    medianCiGruenBisMergeHandH: medianCiGruenBisMergeH(hand, daten.laeufe),
    lehren: lehrenAmTag(daten.lehren, tag),
  }
  return Object.fromEntries(Object.entries(felder).filter(([, v]) => v !== undefined))
}

/** Eine Zeile je Tag aus den gesammelten Rohdaten. */
export function tageszeile(tag, daten) {
  const ende = tagesBeginnMs(tagPlus(tag, 1))
  const gemergt = daten.prs.filter((p) => p.mergedAt && tagBerlin(p.mergedAt) === tag).map((p) => ({ ...p, punkte: daten.punkte.get(p.number)?.punkte }))
  const imTag = (l) => tagBerlin(l.createdAt) === tag
  const laeufeTag = daten.laeufe.filter(imTag)
  const dauer = (name) => medianDauerMin(laeufeTag.filter((l) => l.name === name))
  const commits = daten.commits.filter((c) => tagBerlin(c.zeit) === tag)
  const zeile = {
    tag,
    ...durchsatz(gemergt),
    ...pruefungsfelder(tag, gemergt, daten),
    stau: stauAmTagesende(daten.prs, ende),
    reverts: commits.filter((c) => istRevert(c.betreff)).length,
    sammlerStandZurueck: commits.filter((c) => /Sammler-Stand zurückgenommen/.test(c.betreff)).length,
    rotLaeufe: laeufeTag.filter((l) => l.conclusion === 'failure' || l.conclusion === 'timed_out').length,
    bestandRotH: daten.rotJeTag[tag] ?? 0,
    seite: daten.seite(tag),
    bauDauerMedianMin: dauer(BAU),
    ketteDauerMedianMin: dauer(KETTE),
  }
  for (const k of ['bauDauerMedianMin', 'ketteDauerMedianMin']) if (zeile[k] === undefined) delete zeile[k]
  return zeile
}

/** lehren.md liegt lokal (nicht im Repo): fehlt sie, bricht der Lauf ab, statt das Feld still aus allen Tagen zu streichen (`ohne` = ausdrücklich ohne). */
export function leseLehren(pfad, ohne = false) {
  if (ohne) return ''
  if (!existsSync(pfad)) throw new Error(`lehren.md fehlt (${pfad}): im Hauptordner aufrufen, mit --lehren=<Datei> auf sie zeigen oder ausdrücklich --ohne-lehren angeben`)
  return readFileSync(pfad, 'utf8')
}

function lies(argv, name, vorgabe) {
  return argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? vorgabe
}

/** Text der Lehren-Datei nach `--lehren=<Datei>` (sonst Vorgabe) bzw. `--ohne-lehren`. */
export function leseLehrenAusArgumenten(argv) {
  return leseLehren(lies(argv, 'lehren', LEHREN), argv.includes('--ohne-lehren'))
}

/** Die Zeilen der Datei aus den Quellen `q` (in `main` gh und git, im Test Attrappen); `q.warne` meldet Zeilen, die kein Lehren-Eintrag wurden. */
export function erzeugeZeilen(von, bis, jetzt, q) {
  const lehrenText = q.lehrenText() // zuerst: fehlt die Datei, bricht der Lauf ab, bevor die 24 Minuten Abrufe beginnen
  const prs = q.prs()
  const commits = q.commits(tagPlus(von, -1))
  const laeufe = q.laeufe(tagPlus(von, -1), tagPlus(bis, 1))
  const rotJeTag = rotStundenJeTag(laeufe.filter((l) => l.name === BAU), jetzt)
  const frei = unzugeordnet(lehrenText)
  if (frei.length > 0) q.warne(`WARNUNG: ${frei.length} Zeilen der Lehren-Datei mit Datum am Anfang sind keinem Eintrag zugeordnet, z. B. „${frei[0].slice(0, 80)}“`)
  const urteile = urteileJePr(q.urteile(tagPlus(von, -URTEILE_VORLAUF_TAGE)))
  const daten = { prs, commits, laeufe, rotJeTag, urteile, lehren: lehrenJeTag(lehrenText), seite: q.seite, punkte: punkteJePr(commits, q.kette()) }
  return { zeilen: tageZwischen(von, bis).map((tag) => JSON.stringify(tageszeile(tag, daten))), anzahl: [prs.length, laeufe.length, commits.length] }
}

function kontingentOderAbbruch(tage) {
  try {
    pruefeKontingent(Number(ausfuehren('gh', ['api', 'rate_limit', '--jq', '.resources.core.remaining'], { timeout: 60_000 }).trim()), tage)
  } catch (fehler) {
    console.error(`FEHLER (Kontingent): ${fehler.message}`)
    process.exit(1)
  }
}

function bestehendeZeilen() {
  return existsSync(AUSGABE) ? readFileSync(AUSGABE, 'utf8') : ''
}

function main(argv) {
  const jetzt = Date.now()
  const anhaengen = argv.includes('--anhaengen')
  const von = lies(argv, 'von', anhaengen ? tagNachLetzterZeile(bestehendeZeilen(), '2026-10-01') : '2026-10-01')
  const bis = lies(argv, 'bis', tagPlus(tagBerlin(jetzt), -1))
  if (anhaengen && !argv.some((a) => a.startsWith('--von=')) && von > bis) {
    console.log(`Nichts zu tun: ${AUSGABE} reicht schon bis ${bis}`) // zweiter Lauf am selben Tag ist kein Fehler
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis) || von > bis) {
    console.error(`FEHLER: --von=${von} und --bis=${bis} müssen Tage (JJJJ-MM-TT) sein, von nicht nach bis`)
    process.exit(1)
  }
  const q = {
    prs: () => { // erster Abruf nach dem Lehren-Check: fehlt die Datei, kostet das keine Anfrage
      kontingentOderAbbruch(tageZwischen(von, bis).length)
      return holePrs()
    },
    commits: holeCommits,
    laeufe: holeLaeufe,
    urteile: holeUrteile,
    seite: seitenGroesse,
    warne: console.error,
    kette: () => leseKette(process.cwd()),
    lehrenText: () => leseLehrenAusArgumenten(argv),
  }
  let ergebnis
  try {
    ergebnis = erzeugeZeilen(von, bis, jetzt, q)
  } catch (fehler) {
    if (!String(fehler.message).startsWith('lehren.md fehlt')) throw fehler
    console.error(`FEHLER: ${fehler.message}`)
    process.exit(1)
  }
  const { zeilen, anzahl: [prs, laeufe, commits] } = ergebnis
  const ziel = resolve(AUSGABE)
  mkdirSync(dirname(ziel), { recursive: true })
  writeFileSync(ziel, dateiInhalt(bestehendeZeilen(), zeilen, anhaengen))
  console.log(`${zeilen.length} Tage nach ${AUSGABE} (${von} bis ${bis}), ${prs} PRs, ${laeufe} Läufe, ${commits} Commits`)
  aktualisiereAnsicht()
  console.log('Ansicht: tools/kennzahlen/kernpunkte.yaml und daten.js nachgezogen')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
