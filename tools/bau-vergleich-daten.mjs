/**
 * Handdateien unter `data/` (ohne `data/cache/`, das liegt nicht im Repo) für `bau-vergleich.mjs`:
 * Der Kandidat baut auf dem Stand der Basis plus seinen eigenen Änderungen seit der Merge-Basis.
 * Das ganze `data/` des Kandidaten zu nehmen, hieße bei einem Kandidaten hinter der Basis, die
 * Sammler-Rohdaten von `main` als Unterschied zu melden. Eine Datei, die Basis und Kandidat beide
 * geändert haben, wird daher zusammengeführt (Diff Merge-Basis..Kandidat auf die Basis angewandt).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DATEN = ['data', ':(exclude)data/cache']

/** Änderungen des Kandidaten seit der Merge-Basis unter `data/`: `[{ status: 'A'|'M'|'D', pfad }]`. */
function eigeneAenderungen(git, basis, kandidat) {
  return git('-c', 'core.quotepath=off', 'diff', '--name-status', '--no-renames', `${basis}...${kandidat}`, '--', ...DATEN)
    .split('\n')
    .filter(Boolean)
    .map((zeile) => {
      const [status, pfad] = zeile.split('\t')
      return { status, pfad }
    })
}

/**
 * Wendet die eigenen Änderungen des Kandidaten (Merge-Basis..Kandidat) auf den Baum an, der den Stand der Basis hat.
 * Bei einem Konflikt bricht es ab: keine Seite wird still genommen.
 */
function wendeEigeneAn(git, imBaum, basisSha, sha) {
  const ordner = mkdtempSync(join(tmpdir(), 'bau-vergleich-diff-'))
  try {
    const diff = join(ordner, 'eigene.diff')
    git('diff', '--binary', '--no-renames', '--output', diff, `${basisSha}...${sha}`, '--', ...DATEN)
    try {
      imBaum('apply', '--3way', '--whitespace=nowarn', diff)
    } catch (fehler) {
      const meldung = `${fehler.stderr ?? ''}${fehler.stdout ?? ''}`.trim() || fehler.message
      throw new Error(
        `Konflikt: Die data/-Änderungen von ${sha.slice(0, 12)} lassen sich nicht auf den Stand von ${basisSha.slice(0, 12)} ` +
          `anwenden (Basis und Kandidat haben dieselbe Stelle geändert). Kandidat auf die Basis rebasen.\n${meldung}`,
      )
    }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

/**
 * Bringt den Baum von `sha` auf `public/data` und `data/` der Basis und legt die eigenen Änderungen des Kandidaten
 * (neu/geändert/gelöscht, mit der Basis zusammengeführt) darauf. Gibt die Änderungen zurück.
 */
export function setzeDatenstand(git, imBaum, basisSha, sha) {
  imBaum('rm', '-rfq', '--ignore-unmatch', 'data')
  imBaum('checkout', basisSha, '--', 'public/data', 'data')
  const eigene = sha === basisSha ? [] : eigeneAenderungen(git, basisSha, sha)
  if (eigene.length) wendeEigeneAn(git, imBaum, basisSha, sha)
  return eigene
}

/** Kürzt eine Dateiliste für die Ausgabe. */
const nenne = (dateien) => dateien.slice(0, 5).join(', ') + (dateien.length > 5 ? `, … (+${dateien.length - 5})` : '')

/** Hinweis für die Ausgabe „gleich“: Der Kandidat ändert Handdateien, ohne dass der Bau etwas anderes schreibt. */
export function gleichTrotzDatenHinweis(git, basis, kandidat) {
  const eigene = eigeneAenderungen(git, basis, kandidat).map((e) => e.pfad)
  if (!eigene.length) return []
  return [`Hinweis: Der Kandidat ändert ${eigene.length} Dateien unter data/ (${nenne(eigene)}); mitgebaut, der Bau schreibt trotzdem dasselbe.`]
}
