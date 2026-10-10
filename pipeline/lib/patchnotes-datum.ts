import { execFileSync } from 'node:child_process'
import yaml from 'js-yaml'
import { toIsoDate } from '../../shared/time.ts'
import { warn } from './util.ts'

/** Eine Fassung der Patch-Notes-Datei in einem Commit: Berliner Tag des Commits und die Texte, die darin stehen. */
export interface Fassung {
  tag: string
  texte: Set<string>
}

/**
 * Tag des Commits, der einen Text eingeführt hat: Von der neuesten Fassung rückwärts läuft die Strecke, in der der Text
 * durchgehend steht; ihr ältester Commit zählt. Fehlt der Text schon in der neuesten Fassung (noch nicht eingecheckt), fehlt er im Ergebnis.
 */
export function einfuehrungstage(fassungen: Fassung[], gesucht: string[]): Map<string, string> {
  const tage = new Map<string, string>()
  const offen = new Set(gesucht)
  for (const f of fassungen) {
    if (!offen.size) break
    for (const t of [...offen]) {
      if (f.texte.has(t)) tage.set(t, f.tag)
      else offen.delete(t)
    }
  }
  return tage
}

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/** Der Deploy-Checkout ist flach; ohne die Historie der Datei gäbe es für jeden Eintrag den Tag des Builds. */
function vertiefeFlachenKlon(): void {
  if (git('rev-parse', '--is-shallow-repository').trim() !== 'true') return
  git('fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin')
}

/** Ein Datum darf nie einen Datenlauf abbrechen: scheitert git, bekommt jeder Text den heutigen Tag, mit Warnung. */
function allesHeute(gesucht: string[], heute: string, grund: unknown): Map<string, string> {
  warn(`Patch-Notes-Datum: git-Historie nicht lesbar, alle Einträge bekommen ${heute} (${(grund as Error).message})`)
  return new Map(gesucht.map((t) => [t, heute]))
}

/** Alle Fassungen der Datei, neueste zuerst; ein Commit ohne lesbare Fassung (gelöscht) zählt als leer. */
function fassungenAusGit(pfad: string): Fassung[] {
  const zeilen = git('log', '--format=%H %ct', '--', pfad).split('\n').filter(Boolean)
  return zeilen.map((z) => {
    const [hash, sekunden] = z.split(' ') as [string, string]
    let texte = new Set<string>()
    try {
      const roh = yaml.load(git('show', `${hash}:${pfad}`), { schema: yaml.JSON_SCHEMA })
      texte = new Set((roh as { text?: string }[]).map((e) => String(e.text)))
    } catch {
      /* Datei in diesem Commit gelöscht oder unlesbar: keine Texte. */
    }
    return { tag: toIsoDate(new Date(Number(sekunden) * 1000)), texte }
  })
}

/** Einführungstag je Text aus der Git-Historie; was dort nicht steht (noch nicht eingecheckt), bekommt den heutigen Tag. */
export function tageAusGit(pfad: string, gesucht: string[], heute: string): Map<string, string> {
  if (!gesucht.length) return new Map()
  let gefunden: Map<string, string>
  try {
    vertiefeFlachenKlon()
    gefunden = einfuehrungstage(fassungenAusGit(pfad), gesucht)
  } catch (err) {
    return allesHeute(gesucht, heute, err)
  }
  for (const t of gesucht) if (!gefunden.has(t)) gefunden.set(t, heute)
  return gefunden
}
