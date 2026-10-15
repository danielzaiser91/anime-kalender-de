import type { KatalogEintrag } from '../lib/anilist.ts'
import type { Kante, Namen } from './anisearch-reihen.ts'
import { type Kandidat, type Trennung, type Uebernahme, uebernimmReihen } from './anisearch-reihen-uebernahme.ts'

/** Beziehungsarten, die allein keine Reihe tragen (Prüfer 11.10.2026): ein Titel, der nur über sie hängt, wandert im Katalog nicht. */
const SAMMELARTEN: ReadonlySet<string> = new Set(['Anderes', 'Charakter', 'Crossover'])

/**
 * **Reihen aus aniSearch-Beziehungen auch für den AniList-Katalog** (Stufe C der AniList-Ablösung, Teil 3, 11.10.2026). Dieselbe Regel wie im Hauptbestand
 * (`anisearch-reihen-uebernahme.ts`: ein Alleinstehender wandert, eine Reihe nie), angewandt auf `ohne-synchro.json`. Der Hauptbestand und alles, was aus ihm
 * verschoben wurde, ist schon ausgeliefert und dient nur als Ziel (Anker): Er zieht nie um, auch wenn er allein steht. Reine Funktion; Lesen und Schreiben der Prüfliste
 * in `anisearch-reihen-pruefliste.ts`.
 */
export type Anker = { id: number; name: string; anisearchId?: number; reihe: number; mal?: number }
export type KatalogUebernahme = {
  reihe: Map<number, number>
  ergebnis: Uebernahme
  /** Paare aus einem allein stehenden Hauptbestandstitel und einer Reihe, die aniSearch verbindet: gehen nur über eine Änderung des Hauptbestands, stehen nicht auf der Prüfliste. */
  bestandEinzeln: number
}

/**
 * Ein ausgeschiedener Sammeltitel (`katalogWeg`: Katalogkennung → Kennung seiner Zeile) gibt die Reihe seiner Gruppe an die Zeile ab: Alle, die in `reihe` unter derselben Kennung hingen
 * wie er, hängen danach an der Reihe der Zeile (Anker). Ist die Zeile kein Anker oder gehört die Gruppe schon zu einer ausgelieferten Reihe, bleibt sie, wie sie ist.
 */
export function erbeReihe(reihe: Map<number, number>, katalogWeg: ReadonlyMap<number, number>, anker: Anker[]): Map<number, number> {
  const ankerReihe = new Map(anker.map((a) => [a.id, a.reihe]))
  const ausgeliefert = new Set(ankerReihe.values())
  const ziel = new Map<number, number>()
  for (const [sammel, zeile] of katalogWeg) {
    const gruppe = reihe.get(sammel)
    const erbe = ankerReihe.get(zeile)
    if (gruppe !== undefined && erbe !== undefined && !ausgeliefert.has(gruppe)) ziel.set(gruppe, erbe)
  }
  return new Map([...reihe].map(([id, r]) => [id, ziel.get(r) ?? r]))
}

/** `reihe`: Reihe je Katalogtitel aus `reihenFuerKatalog`; `katalog`: nur Titel, die wirklich ausgeliefert werden; `kennung`: aniSearch-Kennung je Katalogtitel; `getrennt`: die Handtrennungen (`reihen-von-hand.yaml`). */
export function uebernimmKatalogReihen(katalog: KatalogEintrag[], reihe: Map<number, number>, anker: Anker[], kennung: Map<number, number>, kanten: Kante[], namen: Namen, getrennt: Trennung[] = []): KatalogUebernahme {
  const ankerReihe = new Map(anker.map((a) => [a.id, a.reihe]))
  const frei = katalog.filter((e) => !ankerReihe.has(e.id))
  const titel: Kandidat[] = [
    ...anker.map((a) => ({ id: a.id, name: a.name, anisearchId: a.anisearchId })),
    ...frei.map((e) => ({ id: e.id, name: e.t[0] ?? e.t[1] ?? `#${e.id}`, anisearchId: kennung.get(e.id) })),
  ]
  const wurzel = (id: number): number => ankerReihe.get(id) ?? reihe.get(id) ?? id
  const crossover = new Set(frei.filter((e) => (e.eltern?.length ?? 0) >= 2).map((e) => e.id))
  const ergebnis = uebernimmReihen(titel, kanten, namen, wurzel, crossover, undefined, getrennt, new Set(ankerReihe.keys()), SAMMELARTEN)
  const neu = new Map(reihe)
  for (const k of ergebnis.kanten) for (const id of k.ids.slice(1)) neu.set(id, k.ids[0]!)
  const einzeln = (r: { id: number; titel: number }): boolean => r.titel === 1 && ankerReihe.has(r.id)
  const bestandEinzeln = ergebnis.pruefliste.filter((p) => p.art !== 'mehrdeutig' && p.art !== 'sammelart' && p.reihen.some(einzeln))
  ergebnis.pruefliste = ergebnis.pruefliste.filter((p) => !bestandEinzeln.includes(p))
  return { reihe: neu, ergebnis, bestandEinzeln: bestandEinzeln.length }
}
