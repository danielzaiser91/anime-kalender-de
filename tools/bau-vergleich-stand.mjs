/**
 * Stand einer Datei auf einer Seite von `bau-vergleich.mjs`. Die Ablage einer Seite enthält nur, was der Bau gegenüber dem
 * eingecheckten Stand geändert hat. Fehlt eine Datei auf einer Seite, ist sie dort unverändert, also gleich dem Stand
 * der Basis (`git show`) — ohne ihn gäbe es für diese Seite einen leeren Text und nur Textzeilen statt des Feldvergleichs
 * (13.10.2026: neuer Eintrag in `patchnotes.json`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beschreibeUnterschied } from './vergleich-unterschied.mjs'

/** Stand der Basis; '' für eine Datei, die es dort nicht gibt. */
function standDerBasis(git, basis, pfad, glatt) {
  // `ls-tree` meldet eine fehlende Datei leise; `show` schriebe „fatal:“ auf die Konsole.
  if (!git('ls-tree', '--name-only', basis, '--', pfad)) return ''
  return glatt(git('show', `${basis}:${pfad}`))
}

/**
 * Text von `pfad` auf der Seite `ordner`. Fehlt er dort, gilt der Stand der Basis. Das gilt nicht für Handdateien unter
 * `data/`, die der Kandidat selbst ändert (`eigene`): sein eingecheckter Stand ist mit der Basis zusammengeführt, nicht der der Basis.
 */
export function liesSeite({ git, basis, glatt, eigene }, ordner, pfad, istKandidat) {
  if (existsSync(join(ordner, pfad))) return readFileSync(join(ordner, pfad), 'utf8')
  if (istKandidat && eigene.has(pfad)) return ''
  return standDerBasis(git, basis, pfad, glatt)
}

/** Zeilen der Ausgabe für `pfad`: Feldvergleich, auch wenn nur eine Seite die Datei geschrieben hat. */
export function beschreibeDatei(kontext, a, b, pfad) {
  return beschreibeUnterschied(pfad, liesSeite(kontext, a, pfad, false), liesSeite(kontext, b, pfad, true))
}
