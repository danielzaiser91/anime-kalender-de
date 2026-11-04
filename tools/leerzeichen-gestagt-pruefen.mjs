#!/usr/bin/env node
/**
 * Pre-commit-Prüfung: verschluckte Leerzeichen (`const x =await`, `f(a,b)`, `echo a>>$GITHUB_OUTPUT`) in gestagten Quelldateien.
 * Dieselbe Regel wie `pipeline/check-leerzeichen-gleich.ts` (Kette), nur über den Index statt über alle Dateien; sie scheiterte
 * trotz geschriebener Lehre immer wieder erst in der CI (PR 2690). Gelesen wird der gestagte Inhalt.
 * Eingebunden über `bash tools/quellen-commit-wache.sh --einrichten`.
 */
import { execFileSync } from 'node:child_process'
import { ORDNER, WORKFLOWS, meldungenFuer, wirdGeprueft } from '../pipeline/check-leerzeichen-gleich.ts'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, timeout: 30000 })

/** Gestagte, nicht gelöschte Dateien, die die Kette ebenfalls prüft (gleiche Ordner, gleiche Auswahl). */
export function gestagteQuellen(lies = git) {
  return lies('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
    .split('\0')
    .filter((d) => [...ORDNER, WORKFLOWS].some((o) => d.startsWith(`${o}/`)) && wirdGeprueft(d))
}

function main() {
  const meldungen = gestagteQuellen().flatMap((d) => meldungenFuer(d, git('show', `:${d}`)))
  if (!meldungen.length) return 0
  console.error(`leerzeichen-gestagt-pruefen: Commit angehalten (${meldungen.length} Treffer):`)
  for (const m of meldungen) console.error(`  ✖ ${m}`)
  return 1
}

if (import.meta.filename === process.argv[1]) process.exit(main())
