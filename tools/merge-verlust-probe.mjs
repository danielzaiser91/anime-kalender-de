/**
 * Merge-Verlust-Probe: zeigt vor dem Push, welche Zeilen von main der Kopf verloren hat.
 * Aufruf: node tools/merge-verlust-probe.mjs [basis=origin/main] [kopf=HEAD]
 * Eine Zeile gilt als verloren, wenn ihr Text (ohne führendes `-`, getrimmt, nicht leer)
 * nirgends im Inhalt der Datei auf <kopf> steht. Exit 1 bei Verlust oder gelöschter Datei.
 */
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const FRIST_MS = 60_000

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: FRIST_MS, windowsHide: true })
  if (r.error || r.status !== 0) throw new Error(`git ${args.join(' ')} fehlgeschlagen: ${r.error?.message ?? r.stderr}`)
  return r.stdout
}

/** Geänderte Dateien als { datei, geloescht } (Umbenennungen zählen als gelöscht + neu). */
export function geaenderteDateien(basis, kopf, cwd) {
  const aus = git(['diff', '--name-status', '--no-renames', '-z', `${basis}...${kopf}`], cwd)
  const teile = aus.split('\0').filter((t) => t !== '')
  const liste = []
  for (let i = 0; i + 1 < teile.length; i += 2) liste.push({ datei: teile[i + 1], geloescht: teile[i] === 'D' })
  return liste
}

/** Entfernte Zeilen (ohne Kopfzeilen vor dem ersten Hunk) aus einem Diff. */
export function entfernteZeilen(diff) {
  const zeilen = []
  let imHunk = false
  for (const z of diff.split('\n')) {
    if (z.startsWith('@@')) imHunk = true
    else if (imHunk && z.startsWith('-')) zeilen.push(z.slice(1))
  }
  return zeilen
}

/** Zeilen, deren getrimmter Text nicht als Teilstring im Inhalt steht. */
export function verloren(zeilen, inhalt) {
  return zeilen.map((z) => z.trim()).filter((t) => t !== '' && !inhalt.includes(t))
}

export function pruefe(basis, kopf, cwd) {
  const befunde = []
  for (const { datei, geloescht } of geaenderteDateien(basis, kopf, cwd)) {
    if (geloescht) {
      befunde.push({ datei, geloescht: true, zeilen: [] })
      continue
    }
    const diff = git(['diff', '--no-renames', '-U0', `${basis}...${kopf}`, '--', datei], cwd)
    const inhalt = git(['show', `${kopf}:${datei}`], cwd)
    const weg = verloren(entfernteZeilen(diff), inhalt)
    if (weg.length) befunde.push({ datei, geloescht: false, zeilen: weg })
  }
  return befunde
}

export function bericht(befunde) {
  const aus = []
  let summe = 0
  for (const b of befunde) {
    if (b.geloescht) {
      aus.push(`${b.datei}: gelöscht`)
      continue
    }
    aus.push(`${b.datei}: ${b.zeilen.length} verloren`)
    for (const z of b.zeilen) aus.push(`  - ${z.slice(0, 120)}`)
    summe += b.zeilen.length
  }
  const geloescht = befunde.filter((b) => b.geloescht).length
  aus.push(`Merge-Verlust-Probe: ${summe} Zeilen verloren, ${geloescht} Dateien gelöscht`)
  return aus.join('\n')
}

function main() {
  const [basis = 'origin/main', kopf = 'HEAD'] = process.argv.slice(2)
  const befunde = pruefe(basis, kopf, process.cwd())
  console.log(bericht(befunde))
  return befunde.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
