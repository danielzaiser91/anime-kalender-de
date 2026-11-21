/**
 * CI-Prüfer: Übernahme statt neuer Prüfung (21.11.2026). Gilt am vorigen Kopf ein „ok“ und ist der eigene Diff des neuen Kopfes gleich
 * (nur main nachgezogen, pr-eigener-diff.mjs), schreibt der Job `uebernahme` in pr-pruefer.yml ein Übernahme-Urteil, und Mutationsprobe
 * und Prüfer-Review entfallen. Übernommen wird nur ein bestehendes „ok“; ein geltendes „aendern“ oder ein eigener Commit führt zur vollen Prüfung.
 * Aufruf (Workflow, Fassung von main, kein PR-Code): PR, HEAD_SHA, GH_TOKEN, GH_REPO. Exit immer 0; bei Übernahme `uebernommen=1`
 * in $GITHUB_OUTPUT. Jeder Fehler heißt volle Prüfung.
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { mitLimit, LIMIT_STAPEL_MS } from './kind-mit-limit.mjs'
import { FREI, geltendeUrteile } from './pr-nachrechnen-pruefer.mjs'
import { compareKennung, diffGleich } from './pr-eigener-diff.mjs'
import { VERTRAUT } from './pr-nachtraege.mjs'

export const MARKE_UEBERNAHME = '<!-- pruefer-uebernahme -->'
/** Login des CI-Prüfers in `gh pr view --json comments` (GraphQL, ohne „[bot]“). */
export const CI_PRUEFER = 'github-actions'

/**
 * Urteile zählen hier nur vom CI-Prüfer oder von Inhaber/Mitglied/Mitarbeiter: sonst könnte ein Fremder mit einem „ok“-Kommentar
 * Approve und übersprungene Prüfung auslösen (Prüfer PR 4480, Befund 1).
 */
export function vertrauterAutor(c) {
  return c.author?.login === CI_PRUEFER || VERTRAUT.has(c.authorAssociation)
}

/**
 * null = volle Prüfung; sonst { von, schon }: `von` ist der Kopf des übernommenen „ok“, `schon` heißt, der jetzige Kopf trägt bereits
 * eine Übernahme (Neustart nach Nachtrag: nichts Neues schreiben). Ein echtes „ok“ am jetzigen Kopf bleibt beim bisherigen Weg (null).
 */
export function uebernahme(comments, commits, gleich) {
  const kopf = commits.length === 0 ? '' : commits[commits.length - 1].oid
  const urteile = geltendeUrteile(comments.filter(vertrauterAutor), kopf, gleich)
  const letztes = urteile[urteile.length - 1]
  if (letztes === undefined || !FREI.includes(letztes.wort) || letztes.kopf === null || kopf === '') return null
  if (!kopf.startsWith(letztes.kopf)) return { von: letztes.kopf, schon: false }
  return String(letztes.body).includes(MARKE_UEBERNAHME) ? { von: letztes.kopf, schon: true } : null
}

/** Kommentartext; die erste Zeile hat die Form, die `urteilAus` und pr-pruefer-nach-kette.mjs als Urteil des Kopfes lesen. */
export function uebernahmeKommentar(kopf, von) {
  return `**Prüfer-Review** für ${kopf.slice(0, 9)} - Urteil: **ok**\n\n`
    + `Übernommen vom „ok“ für ${von}: eigener Diff unverändert (nur main nachgezogen), keine neue Prüfung.\n\n${MARKE_UEBERNAHME}\n`
}

/** Ablauf; `gh(args)` eingespeist, `schreibe(name, inhalt)` legt eine Datei an. Rückgabe: true bei Übernahme. */
export function lauf({ pr, kopf, gh, schreibe, melde }) {
  const daten = JSON.parse(gh(['pr', 'view', pr, '--json', 'comments,commits,baseRefName,headRefOid']))
  const commits = daten.commits ?? []
  if (daten.headRefOid !== kopf || commits[commits.length - 1]?.oid !== kopf) {
    melde(`Übernahme: nein (Kopf ${kopf.slice(0, 9)} ist nicht der aktuelle)`)
    return false
  }
  const gleich = diffGleich(compareKennung(gh, daten.baseRefName ?? 'main'), commits, kopf)
  const u = uebernahme(daten.comments ?? [], commits, gleich)
  if (u === null) {
    melde('Übernahme: nein (kein „ok“ an einem Kopf mit gleichem eigenem Diff), volle Prüfung')
    return false
  }
  if (!u.schon) {
    const datei = schreibe('uebernahme.md', uebernahmeKommentar(kopf, u.von))
    gh(['pr', 'comment', pr, '--body-file', datei])
    gh(['pr', 'review', pr, '--approve', '--body', `Urteil: ok, übernommen von ${u.von} (eigener Diff gleich). Stand ${kopf.slice(0, 9)}.`])
  }
  melde(`Übernahme: ja, „ok“ von ${u.von} gilt für ${kopf.slice(0, 9)}${u.schon ? ' (schon übernommen, nichts Neues geschrieben)' : ''}`)
  return true
}

function main() {
  const ordner = fs.mkdtempSync(`${process.env.RUNNER_TEMP ?? '.'}/uebernahme-`)
  const gh = (args) => mitLimit('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, { limitMs: LIMIT_STAPEL_MS })
  const schreibe = (name, inhalt) => {
    fs.writeFileSync(`${ordner}/${name}`, inhalt)
    return `${ordner}/${name}`
  }
  try {
    const ja = lauf({ pr: process.env.PR, kopf: process.env.HEAD_SHA, gh, schreibe, melde: (t) => console.log(t) })
    if (ja && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'uebernommen=1\n')
  } catch (e) {
    console.log(`Übernahme: nein (Fehler: ${e.message}), volle Prüfung`)
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
