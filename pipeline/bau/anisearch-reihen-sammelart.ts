import type { Pruefzeile, ReiheRef } from './anisearch-reihen-uebernahme.ts'

/**
 * **Titel, die nur über eine Sammelart hängen, wandern im Katalog nicht** (Prüfer 11.10.2026: ein Alleinstehender mit „Anderes“ als einziger Kante landete in Final Fantasy VII,
 * „?“ lag bei 4 von 15 falsch). Sie kommen als `sammelart` auf die Prüfliste; zusammenhängende Titel dieser Art stehen in einer Zeile. Reine Funktion.
 */
export type Sammelfaelle = { titel: Set<number>; faelle: Pruefzeile[] }
type Nachbarn = Map<number, Map<number, string>>

/**
 * `voll`: Nachbarschaft mit allen zählenden Beziehungen, `kern`: ohne die Sammelarten (beide aus `titelNachbarn`, auch „gleiche Kennung“); Reihen mit mehreren Titeln und Anker wandern nie und sind Ziel.
 * `gross`, `wurzel`, `ref`, `name` wie in `uebernimmReihen`. Ein Titel zählt als „nur Sammelart“, wenn er Beziehungen hat, aber keine, die ohne Sammelarten zählt.
 */
export function sammelartFaelle(voll: Nachbarn, kern: Nachbarn, gross: (id: number) => boolean, wurzel: (id: number) => number, ref: (id: number) => ReiheRef, name: (id: number) => string): Sammelfaelle {
  const nur = new Set([...voll.keys()].filter((id) => !gross(id) && !kern.has(id)))
  const faelle: Pruefzeile[] = []
  const besucht = new Set<number>()
  for (const start of [...nur].sort((a, b) => a - b)) {
    if (besucht.has(start)) continue
    const gruppe = [start]
    besucht.add(start)
    for (let i = 0; i < gruppe.length; i++) {
      for (const nachbar of voll.get(gruppe[i]!)!.keys()) {
        if (nur.has(nachbar) && !besucht.has(nachbar)) {
          besucht.add(nachbar)
          gruppe.push(nachbar)
        }
      }
    }
    const aussen = gruppe.flatMap((id) => [...voll.get(id)!].filter(([n]) => !nur.has(n)).map(([n, art]) => ({ id, n, art })))
    const reihen = [...new Set(aussen.filter((e) => gross(e.n)).map((e) => wurzel(e.n)))].sort((a, b) => a - b)
    if (!reihen.length && gruppe.length < 2) continue
    const [n0, art0] = [...voll.get(start)!][0]!
    const e = aussen[0] ?? { id: start, n: n0, art: art0 }
    faelle.push({ art: 'sammelart', reihen: reihen.map(ref), alleinstehende: gruppe.sort((a, b) => a - b).map(name), beispiel: `${name(e.id)} —${e.art}→ ${name(e.n)}` })
  }
  return { titel: nur, faelle }
}
