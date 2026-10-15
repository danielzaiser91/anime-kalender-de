/**
 * Legt Bilder für eine PR-Beschreibung auf einen Zweig `bilder/<name>` und gibt die Markdown-Links aus.
 *
 *   node tools/pr-bilder.mjs <name> <bild.png> [<bild.png> …] [--ersetzen]
 *
 * Der Zweig hat keinen Vorgänger und enthält nur die Bilder (flach). Er entsteht mit `git hash-object`,
 * `git mktree` und `git commit-tree` direkt in der Objektdatenbank — es gibt weder Index noch `git commit`,
 * also läuft kein Pre-Commit-Hook und keiner muss abgeschaltet werden (14.10.2026: `core.hooksPath` ist ein `--no-verify`).
 * Ein vorhandener Zweig wird nur mit `--ersetzen` überschrieben.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDUNG = /\.(png|jpe?g|webp|gif)$/i
const NAME = /^[a-z0-9][a-z0-9-]*$/
const DATEINAME = /^[A-Za-z0-9_]/ // kein führender Bindestrich: git läse ihn als Option
const MAX_BYTES = 10 * 1024 * 1024

/** Fehlertexte zu Name und Bildliste; leer = in Ordnung. Dateinamen müssen im flachen Baum eindeutig sein. */
export function eingabeFehler(name, dateien) {
  const fehler = []
  if (!NAME.test(name ?? '')) fehler.push(`Name "${name}" ungültig: Kleinbuchstaben, Ziffern, Bindestrich.`)
  if (dateien.length === 0) fehler.push('Keine Bilddatei angegeben.')
  const namen = dateien.map((d) => path.basename(d))
  for (const datei of dateien) {
    if (!ENDUNG.test(datei)) fehler.push(`${datei}: kein Bild (png, jpg, webp, gif).`)
    else if (!DATEINAME.test(path.basename(datei))) fehler.push(`${datei}: Dateiname muss mit Buchstabe, Ziffer oder _ beginnen.`)
    else if (!existsSync(datei)) fehler.push(`${datei}: nicht gefunden.`)
    else if (statSync(datei).size > MAX_BYTES) fehler.push(`${datei}: größer als 10 MB, bitte verkleinern.`)
  }
  for (const doppelt of namen.filter((n, i) => namen.indexOf(n) !== i)) fehler.push(`${doppelt}: Dateiname kommt mehrfach vor.`)
  return fehler
}

/** Eingabe für `git mktree`: eine Zeile je Datei, `blobs` = Dateiname → Hash. */
export function baumZeilen(blobs) {
  return Object.entries(blobs).map(([datei, hash]) => `100644 blob ${hash}\t${datei}`).join('\n') + '\n'
}

/** `owner/repo` aus einer GitHub-Adresse (https oder ssh); sonst null. */
export function repoAus(adresse) {
  return /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(adresse.trim())?.[1] ?? null
}

/** Markdown-Zeilen für die PR-Beschreibung, je Bild eine. */
export function bildLinks(repo, name, dateien) {
  return dateien.map((d) => {
    const datei = path.basename(d)
    return `![${datei}](https://raw.githubusercontent.com/${repo}/bilder/${name}/${encodeURIComponent(datei)})`
  })
}

function git(args, eingabe) {
  const ausgabe = execFileSync(process.env.GIT || 'git', args, { input: eingabe, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] })
  return ausgabe.trim()
}

/** Legt Zweig-Inhalt an und schiebt ihn; gibt den Kopf-Hash zurück. */
export function bilderPushen(name, dateien, { ersetzen = false } = {}) {
  const blobs = {}
  for (const datei of dateien) blobs[path.basename(datei)] = git(['hash-object', '-w', '--no-filters', '--', datei])
  const baum = git(['mktree'], baumZeilen(blobs))
  const kopf = git(['commit-tree', baum, '-m', `Bilder für PR: ${name}`])
  git(['push', 'origin', `${ersetzen ? '+' : ''}${kopf}:refs/heads/bilder/${name}`])
  return kopf
}

function aufruf(argv) {
  const dateien = argv.filter((a) => a !== '--ersetzen')
  return { name: dateien.shift(), dateien, ersetzen: argv.includes('--ersetzen') }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { name, dateien, ersetzen } = aufruf(process.argv.slice(2))
  const fehler = eingabeFehler(name, dateien)
  if (fehler.length) {
    console.error(fehler.join('\n'))
    process.exit(1)
  }
  const kopf = bilderPushen(name, dateien, { ersetzen })
  const repo = repoAus(git(['remote', 'get-url', 'origin']))
  console.log(`bilder/${name} = ${kopf}`)
  if (repo) console.log(bildLinks(repo, name, dateien).join('\n'))
}
