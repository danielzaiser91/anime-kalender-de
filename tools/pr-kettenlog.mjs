/**
 * Kettenlog für den CI-Prüfer (.github/workflows/pr-pruefer.yml): der Prüfer darf kein Bash und kann das Job-Log der
 * PR-Prüfkette nicht lesen, soll aber Ergebniszeilen daraus zitieren. Dieser Schritt (mit GITHUB_TOKEN) legt sie ab.
 *
 *   node tools/pr-kettenlog.mjs <kopf-sha> <ordner> <frist-sekunden>      (Exit immer 0)
 *
 * Schreibt `<ordner>/kettenlog.txt` (Übersicht: Jobtabelle plus Ergebniszeilen, klein genug für Read) und
 * `<ordner>/kettenlog-voll.txt` (alle Logzeilen der abgeschlossenen Jobs ohne Zeitstempel, für Grep). Die Kette startet
 * zeitgleich mit dem Prüfer: der Schritt wartet bis zur Frist auf das Ende des Laufs und sagt in der Datei ausdrücklich,
 * wenn er keinen oder nur einen unfertigen Lauf fand ("nicht beurteilt" ist dann richtig, sonst nie).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TAKT_MS = 15_000
export const JE_JOB_ERGEBNIS = 450
export const ZEILE_MAX = 300
const ERGEBNIS = /(alles in Ordnung|Prüfungen grün|: (ok|grün)\b|\b\d+ von \d+\b|\b\d+ Fehler\b|\bFEHL\b|##\[error\]|^\s*[✖✕✗]|Process completed with exit code)/
// Ein Name landet in einer Textdatei, die der Prüfer liest: Steuerzeichen raus.
const sauber = (text) => String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 80)

/** Logzeilen ohne BOM, ANSI, Zeitstempel, Befehls- und Gruppenrauschen; zu lange Zeilen gekürzt. */
export function bereinige(rohLog) {
  return String(rohLog)
    .replace(/^﻿/, '')
    .split('\n')
    .map((z) => z.replace(/\r$/, '').replace(/\u001b\[[0-9;]*m/g, '').replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, ''))
    .filter((z) => z.trim() !== '' && !z.startsWith('[command]') && !/^##\[(group|endgroup|debug)\]/.test(z))
    .map((z) => (z.length > ZEILE_MAX ? `${z.slice(0, ZEILE_MAX)} …` : z))
}

/** Ergebniszeilen (Schlusszeilen der Wächter, Fehlerzeilen) eines bereinigten Logs, ohne Dopplungen, höchstens `max`. */
export function ergebniszeilen(zeilen, max = JE_JOB_ERGEBNIS) {
  const treffer = [...new Set(zeilen.filter((z) => ERGEBNIS.test(z)))]
  if (treffer.length <= max) return treffer
  // Zu viele: Fehler zuerst, dann die letzten (die Schlusszeilen stehen hinten).
  const rot = treffer.filter((z) => /\bFEHL\b|##\[error\]|^\s*[✖✕✗]|exit code|\b[1-9]\d* Fehler\b/.test(z))
  const rest = treffer.filter((z) => !rot.includes(z))
  return [...rot, ...rest.slice(-Math.max(0, max - rot.length))].slice(0, max)
}

const jobZeile = (j) => `- ${sauber(j.name)}: ${j.status === 'completed' ? j.conclusion || 'ohne Ergebnis' : `läuft noch (${j.status})`}`

/** Kopf mit Aussage über den Lauf: abgeschlossen, unfertig oder gar nicht gefunden. */
export function kopfZeilen({ kopf, lauf, jobs }) {
  if (!lauf) return [`Kein abgeschlossener Kettenlauf für ${kopf}: nichts zu zitieren, "nicht beurteilt" ist richtig.`]
  const offen = jobs.filter((j) => j.status !== 'completed')
  const z = [`Lauf ${lauf.id} der PR-Prüfkette für ${kopf}: ${lauf.status === 'completed' ? `abgeschlossen (${lauf.conclusion})` : `NOCH NICHT ABGESCHLOSSEN (${lauf.status})`}`]
  if (offen.length) z.push(`${offen.length} Job(s) liefen beim Abruf noch; ihre Zeilen fehlen hier, "nicht beurteilt" gilt für sie.`)
  return [...z, 'Jobs:', ...jobs.map(jobZeile)]
}

/** Beide Dateitexte aus Kopfdaten und den Logs der abgeschlossenen Jobs ({ name, status, conclusion, log }). */
export function baueDateien({ kopf, lauf, jobs }) {
  const kopfz = kopfZeilen({ kopf, lauf, jobs })
  const uebersicht = [...kopfz]
  const voll = [...kopfz]
  for (const j of lauf ? jobs : []) {
    if (j.status !== 'completed') continue
    const zeilen = bereinige(j.log ?? '')
    uebersicht.push('', `=== ${sauber(j.name)} (${j.conclusion || 'ohne Ergebnis'}) ===`, ...ergebniszeilen(zeilen))
    voll.push('', `=== ${sauber(j.name)} (${j.conclusion || 'ohne Ergebnis'}) ===`, ...zeilen)
  }
  return { uebersicht: `${uebersicht.join('\n')}\n`, voll: `${voll.join('\n')}\n` }
}

/** Wartet im Takt bis der Lauf abgeschlossen ist oder die Frist abläuft; liefert { lauf, jobs } wie zuletzt gesehen. */
export async function ermittleLauf({ holeLauf, holeJobs, warte, jetzt, frist, takt = TAKT_MS }) {
  const ende = jetzt() + frist
  for (;;) {
    let lauf = null
    let jobs = []
    try {
      lauf = holeLauf()
      if (lauf) jobs = holeJobs(lauf.id)
    } catch {
      lauf = null
    }
    if ((lauf && lauf.status === 'completed') || jetzt() + takt > ende) return { lauf, jobs }
    await warte(takt)
  }
}

/** `gh` als Funktion: Argumente rein, stdout raus; scheitert der Aufruf, wirft sie. */
export function ghAufruf(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')} Exit ${r.status}`)
  return r.stdout
}

/** Neuester Lauf von pr-pruefung.yml zum Kopf (höchste Kennung), sonst null. */
export function holeLauf(repo, sha, gh) {
  const roh = gh(['api', `repos/${repo}/actions/workflows/pr-pruefung.yml/runs?head_sha=${sha}&event=pull_request&per_page=30`,
    '-q', '.workflow_runs[] | [.id, .status, (.conclusion // "")] | @tsv'])
  const laeufe = roh.split('\n').filter(Boolean).map((z) => {
    const [id, status, conclusion] = z.split('\t')
    return { id: Number(id), status, conclusion }
  })
  return laeufe.sort((a, b) => b.id - a.id)[0] ?? null
}

export function holeJobs(repo, runId, gh) {
  const roh = gh(['api', '--paginate', `repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
    '-q', '.jobs[] | [.id, .name, .status, (.conclusion // "")] | @tsv'])
  return roh.split('\n').filter(Boolean).map((z) => {
    const [id, name, status, conclusion] = z.split('\t')
    return { id: Number(id), name, status, conclusion }
  })
}

/** Jobs mit ihren Logs; ein nicht abrufbares Log steht als Fehlzeile im Log des Jobs. */
export function mitLogs(repo, jobs, gh) {
  return jobs.map((j) => {
    if (j.status !== 'completed') return j
    try {
      return { ...j, log: gh(['api', `repos/${repo}/actions/jobs/${j.id}/logs`]) }
    } catch (e) {
      return { ...j, log: `##[error]Log nicht abrufbar: ${e.message}` }
    }
  })
}

/** Holt Lauf und Logs (mit Wartefrist in ms) und schreibt beide Dateien in `ordner`; gibt die Statuszeile zurück. */
export async function schreibeKettenlog({ repo, sha, ordner, frist, gh, warte, jetzt }) {
  const { lauf, jobs } = await ermittleLauf({
    holeLauf: () => holeLauf(repo, sha, gh),
    holeJobs: (id) => holeJobs(repo, id, gh),
    warte,
    jetzt,
    frist,
  })
  const { uebersicht, voll } = baueDateien({ kopf: sha, lauf, jobs: lauf ? mitLogs(repo, jobs, gh) : [] })
  fs.mkdirSync(ordner, { recursive: true })
  fs.writeFileSync(path.join(ordner, 'kettenlog.txt'), uebersicht)
  fs.writeFileSync(path.join(ordner, 'kettenlog-voll.txt'), voll)
  return `Kettenlog ${sha.slice(0, 9)}: ${lauf ? `Lauf ${lauf.id} (${lauf.status})` : 'kein Lauf'}, ${uebersicht.split('\n').length} Übersichtszeilen, ${voll.split('\n').length} Zeilen gesamt`
}

async function main() {
  const [sha, ordner, fristS] = process.argv.slice(2)
  const repo = process.env.GITHUB_REPOSITORY
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !repo || !ordner) {
    console.error('Aufruf: pr-kettenlog.mjs <kopf-sha> <ordner> <frist-sekunden> (GITHUB_REPOSITORY gesetzt)')
    return
  }
  console.error(await schreibeKettenlog({
    repo,
    sha,
    ordner,
    gh: ghAufruf,
    jetzt: Date.now,
    frist: Number(fristS) * 1000 || 0,
    warte: (ms) => new Promise((fertig) => setTimeout(fertig, ms)),
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
