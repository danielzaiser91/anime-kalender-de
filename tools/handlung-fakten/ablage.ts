/** Ablage der Faktenkarten im nicht getrackten Cache: je Titel `<id>.json`, `<id>.md` (für den Schreiber), `<id>.quellsaetze.md` (Stichpunkt-Schritt) und `<id>.quellen.json` (Texte für die Wortnähe). */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { AnisearchFakten } from './anisearch-karte.ts'
import { kartenMarkdown, quellsaetzeMarkdown } from './karte.ts'
import type { Karte } from './karte.ts'
import type { Fund } from './seiten.ts'
import { CACHE } from './typen.ts'
import type { Luecke } from './typen.ts'
import { sauber } from './wikitext.ts'

export const KARTEN = `${CACHE}/karten`

export interface Quelltext {
  name: string
  text: string
}

/** Alle Texte, mit denen ein eigener Text verglichen wird: die ganzen Wikipedia-Seiten, jede aniSearch-Beschreibung der Seite, die Texte der Reihenmitglieder. */
export function quelltexteVon(l: Luecke, funde: Fund[], as?: AnisearchFakten): Quelltext[] {
  const raus: Quelltext[] = funde.map((f) => ({ name: `Wikipedia ${f.sprache}:${f.seite}`, text: sauber(f.text) }))
  for (const b of as?.beschreibungen ?? []) raus.push({ name: `aniSearch ${as!.id} (${b.sprache})`, text: b.text })
  for (const g of l.geschwister) if (g.deText) raus.push({ name: `aniSearch-Text zu „${g.name}“`, text: g.deText })
  return raus
}

export function schreibeKarte(k: Karte, quelltexte: Quelltext[]): void {
  mkdirSync(KARTEN, { recursive: true })
  writeFileSync(`${KARTEN}/${k.id}.json`, JSON.stringify(k, null, 1))
  writeFileSync(`${KARTEN}/${k.id}.md`, kartenMarkdown(k))
  writeFileSync(`${KARTEN}/${k.id}.quellsaetze.md`, quellsaetzeMarkdown(k))
  writeFileSync(`${KARTEN}/${k.id}.quellen.json`, JSON.stringify(quelltexte))
}

export const leseKartenMarkdown = (id: number): string => readFileSync(`${KARTEN}/${id}.md`, 'utf8')

export const leseKarte = (id: number): Karte => JSON.parse(readFileSync(`${KARTEN}/${id}.json`, 'utf8'))

export const leseQuelltexte = (id: number): Quelltext[] => JSON.parse(readFileSync(`${KARTEN}/${id}.quellen.json`, 'utf8'))
