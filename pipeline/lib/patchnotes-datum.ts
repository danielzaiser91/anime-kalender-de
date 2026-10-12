import { execFileSync } from 'node:child_process'
import { toIsoDate } from '../../shared/time.ts'
import { warn } from './util.ts'

/** Eine Datei, die ein Commit neu angelegt hat: Berliner Tag des Commits und Dateiname ohne Endung. */
export interface Hinzufuegung {
  tag: string
  name: string
}

/** Tag des Commits, der eine Datei angelegt hat; bei gelöscht und neu angelegt zählt die neueste Hinzufügung. `hinzu`: neueste zuerst. */
export function einfuehrungstage(hinzu: Hinzufuegung[], gesucht: string[]): Map<string, string> {
  const tage = new Map<string, string>()
  for (const h of hinzu) if (!tage.has(h.name)) tage.set(h.name, h.tag)
  return new Map(gesucht.filter((n) => tage.has(n)).map((n) => [n, tage.get(n)!]))
}

/** Liest die Ausgabe von `git log --format=@%ct --name-only`: Zeilen mit „@“ sind Commit-Zeiten, die übrigen Dateipfade. */
export function hinzufuegungenAusLog(ausgabe: string): Hinzufuegung[] {
  const hinzu: Hinzufuegung[] = []
  let tag = ''
  for (const zeile of ausgabe.split('\n').filter(Boolean)) {
    if (zeile.startsWith('@')) tag = toIsoDate(new Date(Number(zeile.slice(1)) * 1000))
    else hinzu.push({ tag, name: zeile.replace(/^.*\//, '').replace(/\.yaml$/, '') })
  }
  return hinzu
}

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/** Der Deploy-Checkout ist flach; ohne die Historie der Dateien gäbe es für jeden Eintrag den Tag des Builds. */
function vertiefeFlachenKlon(): void {
  if (git('rev-parse', '--is-shallow-repository').trim() !== 'true') return
  git('fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin')
}

/** Ein Datum darf nie einen Datenlauf abbrechen: scheitert git, bekommt jeder Eintrag den heutigen Tag, mit Warnung. */
function allesHeute(gesucht: string[], heute: string, grund: unknown): Map<string, string> {
  warn(`Patch-Notes-Datum: git-Historie nicht lesbar, alle Einträge bekommen ${heute} (${(grund as Error).message})`)
  return new Map(gesucht.map((n) => [n, heute]))
}

/** Einführungstag je Dateiname aus der Git-Historie des Ordners; was dort nicht steht (noch nicht eingecheckt), bekommt den heutigen Tag. */
export function tageAusGit(ordner: string, gesucht: string[], heute: string): Map<string, string> {
  if (!gesucht.length) return new Map()
  let gefunden: Map<string, string>
  try {
    vertiefeFlachenKlon()
    // --no-renames: eine Umbenennung zählt als neue Datei (wer sie umbenennt, setzt `datum` von Hand).
    const log = git('log', '--no-renames', '--diff-filter=A', '--name-only', '--format=@%ct', '--', ordner)
    gefunden = einfuehrungstage(hinzufuegungenAusLog(log), gesucht)
  } catch (err) {
    return allesHeute(gesucht, heute, err)
  }
  for (const n of gesucht) if (!gefunden.has(n)) gefunden.set(n, heute)
  return gefunden
}
