import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import type { TitelNamen } from './patchnotes-titel.ts'

/** Ein git-Aufruf: Argumente rein, Ausgabe zurück. */
export type Git = (...args: string[]) => string

const ORDNER = 'data/patchnotes'
const EINTRAG = /^data\/patchnotes\/[^/]+\.yaml$/

/** Pfade der Einträge, die der PR neu anlegt oder ändert (Zeilen „A|M<Tab>Pfad“ aus `git diff --name-status --no-renames`); Löschungen zählen nicht. */
export function geaenderteEintragsPfade(nameStatus: string): string[] {
  return nameStatus
    .split('\n')
    .map((z) => z.split('\t'))
    .filter(([status, pfad]) => (status === 'A' || status === 'M') && EINTRAG.test(pfad ?? ''))
    .map(([, pfad]) => pfad)
}

/** Dateiname ohne Endung und der Text, den die Seite zeigt (Text + Untertitel). */
export function eintragsText(pfad: string, inhalt: string): { name: string; text: string } {
  const eintrag = yaml.load(inhalt, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>
  return { name: pfad.slice(`${ORDNER}/`.length, -'.yaml'.length), text: `${String(eintrag.text ?? '')} | ${String(eintrag.untertitel ?? '')}` }
}

/** Die im PR neuen oder geänderten Einträge, gelesen aus dem Arbeitsbaum (Kopf des PR). */
export function geaenderteEintraege(basis: string, git: Git): { name: string; text: string }[] {
  const nameStatus = git('diff', '--name-status', '--no-renames', basis, 'HEAD', '--', ORDNER)
  return geaenderteEintragsPfade(nameStatus).map((p) => eintragsText(p, readFileSync(p, 'utf8')))
}

/** Titel und Cartoons der Basis (nie der Arbeitsbaum): der Bestand bewegt sich täglich, die Basis ist fest. */
export function basisTitel(basis: string, git: Git): TitelNamen[] {
  const lesen = (datei: string): TitelNamen[] => JSON.parse(git('show', `${basis}:public/data/${datei}`)) as TitelNamen[]
  return [...lesen('titles.json'), ...lesen('cartoons.json')]
}
