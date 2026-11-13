import yaml from 'js-yaml'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, ROOT } from '../lib/util.ts'
import { type AniListMedia } from '../lib/anilist.ts'
import { type Title } from '../../shared/types.ts'
import { FRANCHISE_RELATIONS, otherZaehlt } from '../../shared/mappings.ts'
import { NAMENSGEBUNDENE_RELATIONEN, namensanfangMindestens } from '../../shared/namensgebunden.ts'
import { anisearchRelationenKanten } from './anisearch-reihen-pruefliste.ts'
import { anisearchNamensKanten, anisearchReihenKanten } from './anisearch-titel.ts'

export function verbindeReihenVonHand({ titles, parent, union, find, echteCrossover }: {
  titles: Map<number, Title>
  parent: Map<number, number>
  union: (a: number, b: number) => void
  find: (id: number) => number
  echteCrossover: Map<number, number>
}) {
  {
    const datei = resolve(ROOT, 'data/reihen-von-hand.yaml')
    const eintraege = existsSync(datei)
      ? ((yaml.load(readFileSync(datei, 'utf8')) as Array<{ ids?: number[] }> | null) ?? [])
      : []
    const verbunden = verbindeKanten([...eintraege, ...anisearchReihenKanten(titles)], titles, parent, union)
      + verbindeAnisearch(titles, find, new Set(echteCrossover.keys()), parent, union)
    if (verbunden) log(`${verbunden} Reihen-Verbindung(en) aus Handdatei und aniSearch`)
  }
}

export function trenneEchteCrossover({ crossoverEltern, find, medienNachAniId, istReihenKante, parent, union }: {
  crossoverEltern: Map<number, number[]>
  find: (id: number) => number
  medienNachAniId: Map<number, AniListMedia>
  istReihenKante: (media: { title: { romaji: string | null; english: string | null; }; }, edge: { relationType: string; node?: { title?: { romaji: string | null; english: string | null; }; }; }) => boolean
  parent: Map<number, number>
  union: (a: number, b: number) => void
}) {
  const echteCrossover = new Map<number, number>()
  for (const [id, eltern] of crossoverEltern) {
    const reihen = new Set(eltern.map((e) => find(e)))
    if (reihen.size > 1) {
      echteCrossover.set(id, eltern[0])
      continue
    }
    const media = medienNachAniId.get(id)
    for (const edge of media?.relations?.edges ?? []) {
      if (!media || !istReihenKante(media, edge)) continue
      if (edge.node?.type !== 'ANIME') continue
      if (crossoverEltern.has(edge.node.id) && !echteCrossover.has(edge.node.id)) continue
      parent.set(edge.node.id, parent.get(edge.node.id) ?? edge.node.id)
      union(id, edge.node.id)
    }
  }
  return { echteCrossover }
}

/** Vereint die Titel jeder Kante mit dem ersten ihrer Liste (nur bekannte Titel); gibt die Zahl der Verbindungen zurück. */
function verbindeKanten(kanten: Array<{ ids?: number[] }>, titles: Map<number, Title>, parent: Map<number, number>, union: (a: number, b: number) => void): number {
  let verbunden = 0
  for (const e of kanten) {
    const ids = (e.ids ?? []).filter((id) => titles.has(id))
    for (const id of ids.slice(1)) {
      parent.set(id, parent.get(id) ?? id)
      parent.set(ids[0]!, parent.get(ids[0]!) ?? ids[0]!)
      union(ids[0]!, id)
      verbunden++
    }
  }
  return verbunden
}

/**
 * aniSearch-Verbindungen nach der MAL-Brücke: erst die Beziehungen (Alleinstehende wandern zu ihrer Reihe, Verschmelzungen zweier Reihen nur als Prüfliste), dann der Namensvorspann
 * für die, die danach noch allein stehen. Gibt die Zahl der Verbindungen zurück.
 */
function verbindeAnisearch(titles: Map<number, Title>, find: (id: number) => number, ausgenommen: Set<number>, parent: Map<number, number>, union: (a: number, b: number) => void): number {
  const beziehungen = verbindeKanten(anisearchRelationenKanten(titles, find, ausgenommen), titles, parent, union)
  return beziehungen + verbindeKanten(anisearchNamensKanten(titles, find), titles, parent, union)
}

/**
 * **Ein Crossover gehört zwei Reihen an — und verschmilzt sie deshalb.**
 *
 * „Lupin III. vs Detektiv Conan" ist ein Lupin-Film und ein Conan-Film
 * zugleich, und AniList sagt das auch: Der Titel trägt **zwei**
 * `PARENT`-Kanten, eine zu „Detective Conan" (235), eine zu „Lupin the 3rd"
 * (1412). Union-Find kennt aber nur eine Zugehörigkeit je Knoten, also zog
 * dieser eine Film beide Reihen zusammen — und über „Lupin III. vs. Cat's
 * Eye" kam Cat's Eye gleich mit dazu.
 *
 * Das Ergebnis stand am 25.08.2026 im Panel: eine Reihe mit **114 Teilen**,
 * deren Name „Lupin III.: Teil 1" lautete, weil der Vertreter der älteste
 * Teil ist — und der ältere Lupin von 1971 schlägt Conan von 1996. Daniel:
 * „die reihe heißt detektiv conan, lupin muss davon getrennt werden."
 *
 * **Erkannt wird das an AniLists eigener Auskunft, nicht am Namen.** Ein
 * Namensmuster auf „vs" / „x" wurde gemessen und verworfen: Es trifft
 * „Hunter x Hunter", „SPY x FAMILY" und „HAIKYU!! LAND VS. AIR" — allesamt
 * gewöhnliche Teile ihrer eigenen Reihe. Es hätte drei echte Reihen zerlegt,
 * um zwei falsche zu trennen.
 *
 * Der Prüfstein sind stattdessen zwei `PARENT`-Kanten, die in **verschiedene**
 * Reihen zeigen. Gemessen am Bestand vom 25.08.2026:
 *
 * | | Zahl |
 * |---|---|
 * | Titel mit zwei oder mehr `PARENT`-Kanten | 24 |
 * | davon beide Eltern in derselben Reihe (unberührt) | 17 |
 * | **echte Crossover** | **7** |
 *
 * Die 17 harmlosen sind Specials und Kurzfilme, die zweimal auf dieselbe
 * Serie zeigen („Evangelion: Death & Rebirth", zwei One-Piece-Kurzfilme,
 * zwei Naruto-Specials). Sie werden ganz normal vereint — die Regel greift
 * nur dort, wo sie etwas trennt.
 *
 * Wirkung: Conan 114 → 63 Teile, Lupin 114 → 45, Cat's Eye 114 → 3.
 *
 * **Der Crossover selbst bleibt sichtbar.** Er verbindet die Reihen nicht
 * mehr, wird aber der Reihe seines ersten Elternteils zugeschlagen — „Lupin
 * III. vs Detektiv Conan" steht also weiter bei Conan. Ihn heimatlos zu
 * lassen wäre die schlechtere Antwort: Wer die Conan-Reihe durchsieht, sucht
 * genau diesen Film.
 */
export function crossoverKandidaten({ byAniId, byMal }: {
  byAniId: Record<string, AniListMedia>
  byMal: Record<string, AniListMedia>
}) {
  /*
    Nachgeschlagen wird über die **AniList-Kennung**, nicht über den Index von
    `byMal` — der ist nach MAL-Kennung geschlüsselt, und dieselbe Zahl meint
    dort einen anderen Anime.
  */
  const medienNachAniId = new Map<number, (typeof byAniId)[number]>()
  for (const media of [...Object.values(byMal), ...Object.values(byAniId)]) {
    if (media?.id && !medienNachAniId.has(media.id)) medienNachAniId.set(media.id, media)
  }
  /**
   * Zählt diese Kante als Reihenzugehörigkeit?
   *
   * Die sieben eindeutigen Arten immer; `OTHER` nur, wenn die Namen beider
   * Seiten zusammenpassen — sonst klebt AniLists Sammelbecken Gundam an
   * Patlabor. Begründung und Messwerte bei `otherZaehlt` in
   * `shared/mappings.ts`; dieselbe Regel steckt im Katalog-Abruf
   * (`lib/anilist.ts`), damit beide Wege dieselben Reihen bauen.
   */
  const istReihenKante = (
    media: { title: { romaji: string | null; english: string | null } },
    edge: {
      relationType: string
      node?: { title?: { romaji: string | null; english: string | null } }
    },
  ): boolean =>
    FRANCHISE_RELATIONS.has(edge.relationType) ||
    (NAMENSGEBUNDENE_RELATIONEN.has(edge.relationType) &&
      otherZaehlt(
        [media.title.romaji, media.title.english],
        [edge.node?.title?.romaji, edge.node?.title?.english], namensanfangMindestens(edge.relationType),
      ))

  const crossoverEltern = new Map<number, number[]>()
  for (const [id, media] of medienNachAniId) {
    const eltern = (media.relations?.edges ?? [])
      .filter((e) => e.relationType === 'PARENT' && e.node?.type === 'ANIME')
      .map((e) => e.node!.id)
    if (eltern.length >= 2) crossoverEltern.set(id, eltern)
  }
  return { crossoverEltern, istReihenKante, medienNachAniId }
}

export function bildeReihen({ byAniId, byMal, titles }: {
  byAniId: Record<string, AniListMedia>
  byMal: Record<string, AniListMedia>
  titles: Map<number, Title>
}) {
  // Staffeln, Cours und Specials derselben Serie bekommen eine gemeinsame ID,
  // damit die Datenbank sie auf Wunsch zu einer Karte bündeln kann.
  // Welche Beziehungen zählen, steht in `shared/mappings.ts` — der
  // Katalog-Abruf braucht dieselbe Liste.
  const parent = new Map<number, number>()
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!
    let cur = id
    while (parent.get(cur) !== undefined && parent.get(cur) !== cur) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // Die kleinere ID gewinnt — das ist in aller Regel die erste Staffel.
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  const { crossoverEltern, istReihenKante, medienNachAniId } = crossoverKandidaten({ byAniId, byMal })

  // Erster Durchgang: alles vereinen, was keinen Kandidaten berührt.
  for (const media of [...Object.values(byMal), ...Object.values(byAniId)]) {
    if (!media?.id) continue
    parent.set(media.id, parent.get(media.id) ?? media.id)
    if (crossoverEltern.has(media.id)) continue
    for (const edge of media.relations?.edges ?? []) {
      if (!istReihenKante(media, edge)) continue
      if (edge.node?.type !== 'ANIME') continue
      if (crossoverEltern.has(edge.node.id)) continue
      parent.set(edge.node.id, parent.get(edge.node.id) ?? edge.node.id)
      union(media.id, edge.node.id)
    }
  }

  /*
    Zweiter Durchgang: Wer trennt wirklich? Ein Kandidat, dessen Eltern jetzt
    dieselbe Wurzel tragen, ist kein Crossover — seine Kanten werden nachträglich
    vereint, als wäre nichts gewesen.
  */
  const { echteCrossover } = trenneEchteCrossover({ crossoverEltern, find, medienNachAniId, istReihenKante, parent, union })

  /*
    **Wo AniList eine Kante vergessen hat, verbindet `data/reihen-von-hand.yaml`** (21.09.2026).
    Danganronpa 3 zerfiel in zwei Reihen, weil AniList Future Arc und Despair Arc nicht
    miteinander verbindet — im Panel fehlten zwei Teile.
  */
  verbindeReihenVonHand({ titles, parent, union, find, echteCrossover })

  for (const title of titles.values()) title.franchiseId = find(title.id)
  // Der Crossover erbt die Reihe seines ersten Elternteils, ohne sie zu verbinden.
  for (const [id, ersterElternteil] of echteCrossover) {
    const t = titles.get(id)
    if (t) t.franchiseId = find(ersterElternteil)
  }
  if (echteCrossover.size) {
    log(`${echteCrossover.size} Crossover trennen keine Reihen mehr (${crossoverEltern.size} geprüft)`)
  }
}
