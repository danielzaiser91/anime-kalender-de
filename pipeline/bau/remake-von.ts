import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ausstrahlungsZeit, istStaffel } from '../../shared/titles.ts'
import type { FranchiseMember, Title } from '../../shared/types.ts'
import { ROOT, warn } from '../lib/util.ts'
import { ladeBeziehungen } from './anisearch-reihen-pruefliste.ts'
import type { Kante } from './anisearch-reihen.ts'

/**
 * **Welche Serie eine Neuverfilmung von welcher ist** (`FranchiseMember.remakeVon`, Daniel 26.10.2026: Yaiba 2025
 * stand als „Staffel 2" der Reihe, ist aber ein Remake von Staffel 1). Zwei Wege: die aniSearch-Beziehung `Remake`
 * (beidseitig eingetragen, die spätere Serie ist die Neuverfilmung) und `data/remake-von-hand.yaml`.
 * Gezählt wird nur Serie gegen Serie (TV/ONA) innerhalb derselben Reihe; die Reihenzugehörigkeit bleibt.
 */
export const REMAKE_HAND_DATEI = 'data/remake-von-hand.yaml'

export interface RemakeVonHand {
  remake: number
  original: number
  grund: string
  quelle: string
}

/** Die Handeinträge; ohne Grund oder https-Quelle bricht der Bau ab, fehlt die Datei, gibt es keine. */
export function ladeRemakeVonHand(datei = resolve(ROOT, REMAKE_HAND_DATEI)): RemakeVonHand[] {
  const liste = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as RemakeVonHand[] | null) ?? []) : []
  const kaputt = liste.filter((e) => !Number.isInteger(e.remake) || !Number.isInteger(e.original) || !e.grund || !/^https:\/\//.test(e.quelle ?? ''))
  if (kaputt.length) throw new Error(`${REMAKE_HAND_DATEI}: Eintrag ohne remake, original, grund oder https-Quelle (${JSON.stringify(kaputt[0])})`)
  return liste
}

type Zeit = Pick<Title, 'id' | 'jpYear' | 'jpStart'>

/** Remake-Paare (Neuverfilmung → Original) aus den aniSearch-Kanten: die spätere Serie ist die Neuverfilmung, mindestens ein Jahr später. */
export function remakePaareAusKanten(kanten: Kante[], titel: (Zeit & { anisearchId?: number })[]): Map<number, number> {
  const nachKennung = new Map<number, (Zeit & { anisearchId?: number })[]>()
  for (const t of titel) if (t.anisearchId) nachKennung.set(t.anisearchId, [...(nachKennung.get(t.anisearchId) ?? []), t])
  const paare = new Map<number, number>()
  for (const k of kanten.filter((x) => x.art === 'Remake')) {
    for (const a of nachKennung.get(k.a) ?? []) {
      for (const b of nachKennung.get(k.b) ?? []) {
        if (!a.jpYear || !b.jpYear || Math.abs(a.jpYear - b.jpYear) < 1) continue
        const [neu, alt] = a.jpYear > b.jpYear ? [a, b] : [b, a]
        if (!paare.has(neu.id)) paare.set(neu.id, alt.id)
      }
    }
  }
  return paare
}

/** Neuverfilmung → Original aus beiden Wegen; ein Handeintrag schlägt die aniSearch-Kante. */
export function alleRemakePaare(titel: (Zeit & { anisearchId?: number })[], quellen: { kanten?: Kante[]; hand?: RemakeVonHand[] } = {}): Map<number, number> {
  const paare = remakePaareAusKanten(quellen.kanten ?? ladeBeziehungen().kanten, titel)
  for (const e of quellen.hand ?? ladeRemakeVonHand()) paare.set(e.remake, e.original)
  return paare
}

/** Eine Neuverfilmung zählt als eigene Linie nur, wenn beide Serien (TV/ONA) sind und das Original früher startete. */
export function zaehltAlsNeuverfilmung(neu: Pick<FranchiseMember, 'format' | 'jpYear' | 'jpStart' | 'id'>, original: Pick<FranchiseMember, 'format' | 'jpYear' | 'jpStart' | 'id'>): boolean {
  return istStaffel(neu.format) && istStaffel(original.format) && ausstrahlungsZeit(original).localeCompare(ausstrahlungsZeit(neu)) < 0
}

/** Setzt `remakeVon` an den Neuverfilmungen, deren Original in derselben Reihe steht; beide müssen Serien sein. */
export function markiereRemakes(
  reihen: Record<number, FranchiseMember[]>,
  titel: (Zeit & { anisearchId?: number })[],
  quellen: { kanten?: Kante[]; hand?: RemakeVonHand[] } = {},
): Record<number, FranchiseMember[]> {
  const hand = quellen.hand ?? ladeRemakeVonHand()
  const paare = alleRemakePaare(titel, { ...quellen, hand })
  const gesehen = new Set<number>()
  for (const mitglieder of Object.values(reihen)) {
    for (const m of mitglieder) {
      const original = paare.get(m.id)
      const vorlage = mitglieder.find((x) => x.id === original)
      if (!vorlage || !zaehltAlsNeuverfilmung(m, vorlage)) continue
      m.remakeVon = vorlage.id
      gesehen.add(m.id)
    }
  }
  for (const e of hand) if (!gesehen.has(e.remake)) warn(`${REMAKE_HAND_DATEI}: ${e.remake} ist keine Neuverfilmung von ${e.original} in derselben Reihe`)
  return reihen
}
