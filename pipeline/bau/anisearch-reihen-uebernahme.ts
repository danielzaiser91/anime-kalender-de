import { type Kante, type Namen, type Regel, REGEL, zaehlt } from './anisearch-reihen.ts'

/**
 * **Reihen aus aniSearch-Beziehungen übernehmen** (Stufe C der AniList-Ablösung, 11.10.2026). Die Messung (`anisearch-reihen-abweichungen.ts`) zeigt, wo aniSearch und die
 * AniList-Reihen (`franchiseId`) dasselbe sagen; übernommen wird nur, was nichts Bestehendes umhängt: **ein Alleinstehender wandert, eine Reihe nie.** Ein Titel, dessen Reihe nur
 * er selbst ist (AniList kennt die Beziehung nicht — oder AniList kennt den Titel gar nicht), kommt zu der einen Reihe, die aniSearch ihm über Titel ohne eigene Reihe erreichbar nennt.
 * Verbindet aniSearch zwei bestehende Reihen (Gintama-Brücke über „?") oder führt ein Alleinstehender in zwei Reihen, steht das auf der Prüfliste — der Weg dafür ist
 * `data/reihen-von-hand.yaml`. Reine Funktionen; Lesen und Schreiben in `anisearch-reihen-pruefliste.ts`.
 */
export type Kandidat = { id: number; name: string; anisearchId?: number }
export type ReiheRef = { id: number; name: string; titel: number }
/** `verschmilzt`: aniSearch verbindet zwei Reihen mit mehreren Titeln; `mehrdeutig`: Alleinstehende erreichen zwei oder mehr Reihen. */
export type Pruefzeile = { art: 'verschmilzt' | 'mehrdeutig'; reihen: ReiheRef[]; alleinstehende: string[]; beispiel: string }
export type Uebernahme = {
  /** Kanten im Format von `reihen-von-hand.yaml` (`ids[0]` ist ein Titel der Zielreihe). */
  kanten: { ids: number[] }[]
  angehaengt: number
  neueReihen: number
  pruefliste: Pruefzeile[]
}

type Nachbarn = Map<number, Map<number, string>>

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

/**
 * `titel`: alle Titel des Baus (mit Name und aniSearch-Kennung); `wurzel`: die Reihe je Titel zum Zeitpunkt der Übernahme (Union-Find des Baus);
 * `ausgenommen`: Titel, die nie umziehen (Crossover, die ihre Reihe aus dem ersten Elternteil erben).
 */
export function uebernimmReihen(titel: Kandidat[], kanten: Kante[], namen: Namen, wurzel: (id: number) => number, ausgenommen: Set<number> = new Set(), regel: Regel = REGEL): Uebernahme {
  const mitglieder = titel.filter((t) => !ausgenommen.has(t.id))
  const groesse = new Map<number, number>()
  for (const t of titel) groesse.set(wurzel(t.id), (groesse.get(wurzel(t.id)) ?? 0) + 1)
  const gross = (id: number): boolean => (groesse.get(wurzel(id)) ?? 0) > 1
  const namensliste = new Map(titel.map((t) => [t.id, t.name]))
  const name = (id: number): string => namensliste.get(id) ?? `#${id}`
  const ref = (id: number): ReiheRef => ({ id, name: name(id), titel: groesse.get(id) ?? 1 })
  const n = titelNachbarn(mitglieder, kanten, namen, regel)
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
  return ergebnis
}
