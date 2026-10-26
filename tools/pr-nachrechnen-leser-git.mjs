/**
 * Git-Anschluss der Leser-Regel (`pr-nachrechnen-leser.mjs`): holt Kopf und main des PR in den Checkout des Aufrufers und liest
 * von dort (`git show`, `git grep`); jeder Fehler wird zum Grund „nicht ermittelbar“, der PR gilt dann als veraltet.
 */
import { execFileSync } from 'node:child_process'
import { LESBAR, bewegtesGelesen, geaenderteSkripte, ohneKommentare } from './pr-nachrechnen-leser.mjs'

const SUCHORDNER = ['pipeline', 'shared', 'tools', 'web', 'worker', 'extension', '.github']

export function gitAufruf(args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Dateien auf `main`, die den Namen einer bewegten Datei außerhalb von Kommentarzeilen nennen. */
export function suchLeser(git, main, bewegt) {
  let aus = ''
  try {
    aus = git(['grep', '-n', '-F', ...bewegt.flatMap((b) => ['-e', b.split('/').pop()]), main, '--', ...SUCHORDNER])
  } catch (e) {
    if (e.status !== 1) throw e
  }
  const dateien = new Set()
  for (const zeile of aus.split(/\r?\n/)) {
    const m = new RegExp(`^${main}:([^:]+):\\d+:(.*)$`).exec(zeile)
    if (m !== null && LESBAR.test(m[1]) && ohneKommentare(m[2]).trim() !== '') dateien.add(m[1])
  }
  return [...dateien].sort()
}

const zeigen = (git, ref, pfad) => {
  try {
    return git(['show', `${ref}:${pfad}`])
  } catch {
    return null
  }
}

/** Leser für `botSprungAusnahme`: (bewegt, prDateien, { nummer, kopf, main }) -> null | Grund. */
export const gitLeser = (git) => (bewegt, pr, refs) => {
  try {
    git(['fetch', '-q', 'origin', `refs/pull/${refs.nummer}/head`, refs.main])
    const lies = (pfad) => zeigen(git, refs.kopf, pfad) ?? zeigen(git, refs.main, pfad)
    const paketSkripte = pr.includes('package.json') ? geaenderteSkripte(zeigen(git, refs.main, 'package.json'), zeigen(git, refs.kopf, 'package.json')) : null
    return bewegtesGelesen({ bewegt, pr, leser: suchLeser(git, refs.main, bewegt), lies, paketSkripte })
  } catch (e) {
    return `Leser nicht ermittelbar (${String(e.message).split('\n')[0].slice(0, 120)})`
  }
}
