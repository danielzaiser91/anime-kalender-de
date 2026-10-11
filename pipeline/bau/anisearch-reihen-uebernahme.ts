import { type Kante, type Namen, type Regel, REGEL, zaehlt } from './anisearch-reihen.ts'
import { sammelartFaelle } from './anisearch-reihen-sammelart.ts'

/**
 * **Reihen aus aniSearch-Beziehungen übernehmen** (Stufe C der AniList-Ablösung, 11.10.2026). Die Messung (`anisearch-reihen-abweichungen.ts`) zeigt, wo aniSearch und die
 * AniList-Reihen (`franchiseId`) dasselbe sagen; übernommen wird nur, was nichts Bestehendes umhängt: **ein Alleinstehender wandert, eine Reihe nie.** Ein Titel, dessen Reihe nur
 * er selbst ist (AniList kennt die Beziehung nicht — oder AniList kennt den Titel gar nicht), kommt zu der einen Reihe, die aniSearch ihm über Titel ohne eigene Reihe erreichbar nennt.
 * Verbindet aniSearch zwei bestehende Reihen (Gintama-Brücke über „?") oder führt ein Alleinstehender in zwei Reihen, steht das auf der Prüfliste — der Weg dafür ist
 * `data/reihen-von-hand.yaml`. Reine Funktionen; Lesen und Schreiben in `anisearch-reihen-pruefliste.ts`.
 */
export type Kandidat = { id: number; name: string; anisearchId?: number }
export type ReiheRef = { id: number; name: string; titel: number }
/** `verschmilzt`: aniSearch verbindet zwei Reihen mit mehreren Titeln; `mehrdeutig`: Alleinstehende erreichen zwei oder mehr Reihen; `universum`: nur „Gemeinsames Universum“ verbindet sie (Marvel-, Disney-Sammelbecken: wandert nie); `sammelart`: Titel, die nur über Sammelarten hängen (nur im Katalog, wandern nie). */
export type Pruefzeile = { art: 'verschmilzt' | 'mehrdeutig' | 'universum' | 'sammelart'; reihen: ReiheRef[]; alleinstehende: string[]; beispiel: string }
export type Uebernahme = {
  /** Kanten im Format von `reihen-von-hand.yaml` (`ids[0]` ist ein Titel der Zielreihe). */
  kanten: { ids: number[] }[]
  angehaengt: number
  neueReihen: number
  pruefliste: Pruefzeile[]
}

type Nachbarn = Map<number, Map<number, string>>

const UNIVERSUM = 'Gemeinsames Universum'
/** Die Regel der Messung, nur ohne „Gemeinsames Universum“: 7 von 11 Treffern lagen falsch (Blade/X-Men/Iron Man in einer Reihe, 11.10.2026, Prüfer). */
export const WANDERREGEL: Regel = { ...REGEL, [UNIVERSUM]: 'nie' }

/** Von Hand getrennt (`getrennt:` in `reihen-von-hand.yaml`): Titel-Kennungen, deren **Reihen** aniSearch-Beziehungen nie miteinander verbinden. */
export type Trennung = number[]

/** Die Kanten ohne die, die zwei verschiedene Reihen derselben Trennung verbinden — so entsteht weder eine Wanderung noch ein Prüflisten-Fall. */
export function ohneTrennungen(kanten: Kante[], titel: Kandidat[], wurzel: (id: number) => number, getrennt: Trennung[]): Kante[] {
  if (!getrennt.length) return kanten
  const reihenJeKennung = new Map<number, Set<number>>()
  for (const t of titel) if (t.anisearchId) reihenJeKennung.set(t.anisearchId, (reihenJeKennung.get(t.anisearchId) ?? new Set()).add(wurzel(t.id)))
  const sperren = getrennt.map((g) => new Set(g.map(wurzel)))
  const trennt = (s: Set<number>, k: Kante): boolean =>
    [...(reihenJeKennung.get(k.a) ?? [])].some((ra) => s.has(ra) && [...(reihenJeKennung.get(k.b) ?? [])].some((rb) => rb !== ra && s.has(rb)))
  return kanten.filter((k) => !sperren.some((s) => trennt(s, k)))
}

/** Die Regel ohne die genannten Arten. */
const ohneArten = (regel: Regel, arten: ReadonlySet<string>): Regel => Object.fromEntries(Object.entries(regel).filter(([art]) => !arten.has(art)))

function verbinde(n: Nachbarn, a: number, b: number, art: string): void {
  if (a === b) return
  for (const [x, y] of [[a, b], [b, a]] as const) n.set(x, (n.get(x) ?? new Map()).set(y, art))
}

/** Titel-Nachbarschaft: zählende Beziehungen zwischen den Kennungen, dazu Titel mit gleicher aniSearch-Kennung (dieselbe Einheit). */
export function titelNachbarn(titel: Kandidat[], kanten: Kante[], namen: Namen, regel: Regel = REGEL): Nachbarn {
  const jeKennung = new Map<number, number[]>()
  for (const t of titel) if (t.anisearchId) jeKennung.set(t.anisearchId, [...(jeKennung.get(t.anisearchId) ?? []), t.id])
  const n: Nachbarn = new Map()
  for (const ids of jeKennung.values()) ids.slice(1).forEach((id) => verbinde(n, ids[0]!, id, 'gleiche Kennung'))
  for (const k of kanten.filter((x) => zaehlt(x, regel, namen))) {
    for (const a of jeKennung.get(k.a) ?? []) for (const b of jeKennung.get(k.b) ?? []) verbinde(n, a, b, k.art)
  }
  return n
}

/** Zusammenhängende Alleinstehende (nur über Alleinstehende verbunden) samt den Reihen mit mehreren Titeln, an die sie unmittelbar grenzen. */
function alleinstehendeGruppen(n: Nachbarn, gross: (id: number) => boolean, wurzel: (id: number) => number): { gruppe: number[]; reihen: Set<number> }[] {
  const besucht = new Set<number>()
  const liste: { gruppe: number[]; reihen: Set<number> }[] = []
  for (const start of [...n.keys()].sort((a, b) => a - b)) {
    if (gross(start) || besucht.has(start)) continue
    const [gruppe, reihen, offen] = [[start], new Set<number>(), [start]]
    besucht.add(start)
    for (let id = offen.pop(); id !== undefined; id = offen.pop()) {
      for (const nachbar of n.get(id)!.keys()) {
        if (gross(nachbar)) reihen.add(wurzel(nachbar))
        else if (!besucht.has(nachbar)) {
          besucht.add(nachbar)
          gruppe.push(nachbar)
          offen.push(nachbar)
        }
      }
    }
    liste.push({ gruppe: gruppe.sort((a, b) => a - b), reihen })
  }
  return liste
}

/** Die Beziehungen zwischen zwei Reihen mit mehreren Titeln: je Paar die Zahl der Kanten und eine als Beispiel. */
function verschmelzendePaare(n: Nachbarn, gross: (id: number) => boolean, wurzel: (id: number) => number, name: (id: number) => string): Map<string, { reihen: [number, number]; kanten: number; beispiel: string }> {
  const paare = new Map<string, { reihen: [number, number]; kanten: number; beispiel: string }>()
  for (const [a, ns] of n) {
    if (!gross(a)) continue
    for (const [b, art] of ns) {
      const [ra, rb] = [wurzel(a), wurzel(b)]
      if (a > b || !gross(b) || ra === rb) continue
      const schluessel = `${Math.min(ra, rb)}|${Math.max(ra, rb)}`
      const alt = paare.get(schluessel)
      if (alt) alt.kanten++
      else paare.set(schluessel, { reihen: [Math.min(ra, rb), Math.max(ra, rb)], kanten: 1, beispiel: `${name(a)} —${art}→ ${name(b)}` })
    }
  }
  return paare
}

/** „Gemeinsames Universum“ verbindet nichts, zeigt aber, was zusammenpassen könnte: je Paar von Reihen, die nach der Übernahme verschieden bleiben, eine Zeile. */
function universumFaelle(titel: Kandidat[], kanten: Kante[], namen: Namen, verbunden: { ids: number[] }[], wurzel: (id: number) => number, ref: (id: number) => ReiheRef, name: (id: number) => string): Pruefzeile[] {
  const ziel = new Map(verbunden.flatMap((k) => k.ids.map((id): [number, number] => [id, k.ids[0]!])))
  const reiheVon = (id: number): number => ziel.get(id) ?? wurzel(id)
  const n = titelNachbarn(titel, kanten.filter((k) => k.art === UNIVERSUM), namen, { [UNIVERSUM]: REGEL[UNIVERSUM]! })
  const paare = new Map<string, Pruefzeile>()
  for (const [a, ns] of n) {
    for (const b of ns.keys()) {
      const [ra, rb] = [reiheVon(a), reiheVon(b)]
      if (a > b || ra === rb) continue
      const schluessel = `${Math.min(ra, rb)}|${Math.max(ra, rb)}`
      if (!paare.has(schluessel)) paare.set(schluessel, { art: 'universum', reihen: [Math.min(ra, rb), Math.max(ra, rb)].map(ref), alleinstehende: [], beispiel: `${name(a)} —${UNIVERSUM}→ ${name(b)}` })
    }
  }
  return [...paare.values()]
}

/**
 * `titel`: alle Titel des Baus (mit Name und aniSearch-Kennung); `wurzel`: die Reihe je Titel zum Zeitpunkt der Übernahme (Union-Find des Baus);
 * `ausgenommen`: Titel, die nie umziehen (Crossover, die ihre Reihe aus dem ersten Elternteil erben); `getrennt`: Handentscheidungen, siehe `ohneTrennungen`; `anker`: Titel, die nie umziehen,
 * aber als Reihe zählen, auch wenn sie allein stehen (der schon ausgelieferte Hauptbestand, wenn der Katalog übernommen wird).
 * `sammelarten`: Titel, deren Beziehungen nur aus diesen Arten bestehen, wandern nie und stehen als `sammelart` auf der Prüfliste (leer: wie bisher).
 */
export function uebernimmReihen(titel: Kandidat[], alleKanten: Kante[], namen: Namen, wurzel: (id: number) => number, ausgenommen: Set<number> = new Set(), regel: Regel = WANDERREGEL, getrennt: Trennung[] = [], anker: Set<number> = new Set(), sammelarten: ReadonlySet<string> = new Set()): Uebernahme {
  const kanten = ohneTrennungen(alleKanten, titel, wurzel, getrennt)
  const mitglieder = titel.filter((t) => !ausgenommen.has(t.id))
  const groesse = new Map<number, number>()
  for (const t of titel) groesse.set(wurzel(t.id), (groesse.get(wurzel(t.id)) ?? 0) + 1)
  const gross = (id: number): boolean => anker.has(id) || (groesse.get(wurzel(id)) ?? 0) > 1
  const namensliste = new Map(titel.map((t) => [t.id, t.name]))
  const name = (id: number): string => namensliste.get(id) ?? `#${id}`
  const ref = (id: number): ReiheRef => ({ id, name: name(id), titel: groesse.get(id) ?? 1 })
  const voll = titelNachbarn(mitglieder, kanten, namen, regel)
  const kern = sammelarten.size ? titelNachbarn(mitglieder, kanten, namen, ohneArten(regel, sammelarten)) : voll
  const sammel = sammelartFaelle(voll, kern, gross, wurzel, ref, name)
  const n = sammel.titel.size ? titelNachbarn(mitglieder.filter((t) => !sammel.titel.has(t.id)), kanten, namen, regel) : voll
  const ergebnis: Uebernahme = { kanten: [], angehaengt: 0, neueReihen: 0, pruefliste: [] }
  for (const { gruppe, reihen } of alleinstehendeGruppen(n, gross, wurzel)) {
    if (reihen.size === 1) {
      ergebnis.kanten.push({ ids: [[...reihen][0]!, ...gruppe] })
      ergebnis.angehaengt += gruppe.length
    } else if (reihen.size === 0 && gruppe.length > 1) {
      ergebnis.kanten.push({ ids: gruppe })
      ergebnis.neueReihen++
    } else if (reihen.size > 1) {
      ergebnis.pruefliste.push({ art: 'mehrdeutig', reihen: [...reihen].sort((a, b) => a - b).map(ref), alleinstehende: gruppe.map(name), beispiel: '' })
    }
  }
  for (const p of verschmelzendePaare(n, gross, wurzel, name).values()) {
    ergebnis.pruefliste.push({ art: 'verschmilzt', reihen: p.reihen.map(ref), alleinstehende: [], beispiel: `${p.beispiel} (${p.kanten} Kante${p.kanten === 1 ? '' : 'n'})` })
  }
  ergebnis.pruefliste.push(...universumFaelle(mitglieder, kanten, namen, ergebnis.kanten, wurzel, ref, name), ...sammel.faelle)
  return ergebnis
}
