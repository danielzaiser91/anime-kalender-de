import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import type { FranchiseMember, Title } from '../../shared/types.ts'
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

export const EIGENE_DATEI = 'data/cartoon-eigene-serien.yaml'

interface EigeneSerien {
  ids: number[]
  grund: string
  quelle: string
}

/** Die Cartoons, die zur Reihe gehören, aber eine eigene Serie sind; ohne Beleg-Adresse bricht der Bau ab. */
export function ladeEigeneSerien(): EigeneSerien[] {
  const datei = resolve(ROOT, EIGENE_DATEI)
  const liste = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as EigeneSerien[] | null) ?? []) : []
  const ohneBeleg = liste.filter((e) => !e.ids?.length || !e.grund || !/^https:\/\//.test(e.quelle ?? ''))
  if (ohneBeleg.length) throw new Error(`${EIGENE_DATEI}: Eintrag ohne ids, grund oder https-Quelle (${JSON.stringify(ohneBeleg[0])})`)
  return liste
}

/** Setzt `eigenesWerk` an den Reihenmitgliedern, die eine eigene Serie sind — sie zählen nicht als Staffel (Korra, Die sieben Häfen). */
export function markiereEigeneWerke(reihen: Record<number, FranchiseMember[]>, eintraege = ladeEigeneSerien()): Record<number, FranchiseMember[]> {
  const eigene = new Set(eintraege.flatMap((e) => e.ids))
  const gesehen = new Set<number>()
  for (const mitglieder of Object.values(reihen)) {
    for (const m of mitglieder) {
      if (!eigene.has(m.id)) continue
      m.eigenesWerk = true
      gesehen.add(m.id)
    }
  }
  for (const id of eigene) if (!gesehen.has(id)) warn(`${EIGENE_DATEI}: ${id} steht in keiner Reihe`)
  return reihen
}
