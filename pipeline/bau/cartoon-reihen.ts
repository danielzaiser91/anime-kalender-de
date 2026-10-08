import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import type { Title } from '../../shared/types.ts'
import { ROOT, log, readJson, warn } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'
import { bildeReihen, pruefeReihen, type CartoonReihe, type HandReihe, type ReihenEintrag } from '../lib/cartoon-reihen.ts'

export const REIHEN_DATEI = 'data/cartoon-reihen.json'
export const HAND_DATEI = 'data/cartoon-reihen-von-hand.yaml'
/** Gedächtnis der zu Animes umgezogenen Cartoons (`[Cartoon-Kennung, Anime-Kennung]`); fehlt die Datei, ist niemand umgezogen. */
const UMZUG_DATEI = 'data/cartoon-umzug.json'

export function ladeHandReihen(): HandReihe[] {
  const datei = resolve(ROOT, HAND_DATEI)
  return existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as HandReihe[] | null) ?? []) : []
}

/** Die Reihen der Cartoons; ein Umgezogener ist kein Cartoon mehr und stiftet keine Reihe. */
export function cartoonReihen(titel: Pick<Title, 'id' | 'titleEn'>[]): CartoonReihe[] {
  const daten = readJson<Record<string, ReihenEintrag>>(REIHEN_DATEI, {})
  const hand = ladeHandReihen()
  const umgezogen = new Set(readJson<[number, number][]>(UMZUG_DATEI, []).map(([cartoon]) => cartoon))
  const reihen = bildeReihen(daten, new Map(titel.map((t) => [t.id, t.titleEn ?? ''])), hand, umgezogen)
  const fehler = pruefeReihen(reihen, hand)
  if (fehler.length) throw new Error(`Cartoon-Reihen widersprüchlich:\n${fehler.join('\n')}`)
  return reihen
}

/** Setzt `franchiseId` (negativ, kleinste Kennung der Reihe) an den Cartoons, die eine belegte Reihe haben. */
export function ordneCartoonReihen(titel: Title[]): void {
  if (!Object.keys(readJson<object>(REIHEN_DATEI, {})).length && !ladeHandReihen().length) {
    warn(`Keine ${REIHEN_DATEI} — Cartoons bleiben ohne Reihe. Holen mit "npm run data:cartoon-reihen".`)
    return
  }
  const reihen = cartoonReihen(titel)
  const nachId = new Map(titel.map((t) => [t.id, t]))
  for (const r of reihen) for (const g of r.glieder) nachId.get(g)!.franchiseId = r.id
  log(`${reihen.length} Cartoon-Reihen, ${reihen.reduce((n, r) => n + r.glieder.length, 0)} Cartoons mit Reihe`)
}

/** Die Cartoons mit Reihe, wie `cartoons.json` sie ausliefert — für `franchises.json`. */
export function cartoonsMitReihe(): Title[] {
  return readJson<Title[]>(`${OUT}/cartoons.json`, []).filter((t) => t.franchiseId !== undefined)
}
