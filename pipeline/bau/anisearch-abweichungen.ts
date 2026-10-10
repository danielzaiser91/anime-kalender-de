import { log, readJson, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import type { AniListMedia } from '../lib/anilist.ts'
import type { AnisearchEintrag } from './01-quellen.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'
import { FELDER, type FeldName, type Spalte, type Urteil, anilistSpalte, anisearchSpalte, urteil } from './anisearch-spalte.ts'

/**
 * **Abweichungsliste AniList gegen aniSearch** (`data/anisearch-abweichungen.json`, Stufe B der AniList-Ablösung, 10.10.2026). Je Feld die Zähler
 * gleich / abweichend / nur AniList / nur aniSearch / beide leer; bei Abweichungen beide Werte, bei den „nur"-Fällen die Kennungen. Nichts davon
 * wird ausgeliefert: die Seite zeigt weiter den AniList-Wert, die Datei ist Messgrundlage für den Umzug.
 */
export const ABWEICHUNGEN_DATEI = 'data/anisearch-abweichungen.json'

export type FeldBericht = Record<Urteil, number> & {
  abweichungen: [number, unknown, unknown][]
  nurAnilistIds: number[]
  nurAnisearchIds: number[]
}
export type Bericht = {
  stand: string
  /** `verglichen` = Titel mit AniList-Wert und aniSearch-Info; die übrigen erklären, warum ein Titel fehlt. */
  titel: { gesamt: number; verglichen: number; ohneAnisearchEintrag: number; ohneInfo: number; nurAnisearch: number }
  felder: Record<FeldName, FeldBericht>
  /** Namen der Titel, die in einer Liste vorkommen, damit die Kennungen lesbar sind. */
  namen: Record<number, string>
}
export type Paar = { id: number; name: string; anilist: Spalte; anisearch: Spalte }

const leeresFeld = (): FeldBericht => ({ gleich: 0, abweichend: 0, nurAnilist: 0, nurAnisearch: 0, beideLeer: 0, abweichungen: [], nurAnilistIds: [], nurAnisearchIds: [] })

/** Zählt die Paare Feld für Feld aus. */
export function vergleichePaare(paare: Paar[]): Pick<Bericht, 'felder' | 'namen'> {
  const felder = Object.fromEntries(FELDER.map((f) => [f, leeresFeld()])) as Record<FeldName, FeldBericht>
  const namen: Record<number, string> = {}
  for (const p of paare) {
    for (const f of FELDER) {
      const u = urteil(f, p.anilist, p.anisearch)
      const b = felder[f]
      b[u]++
      if (u === 'abweichend') b.abweichungen.push([p.id, p.anilist[f], p.anisearch[f]])
      if (u === 'nurAnilist') b.nurAnilistIds.push(p.id)
      if (u === 'nurAnisearch') b.nurAnisearchIds.push(p.id)
      if (u === 'abweichend' || u === 'nurAnilist' || u === 'nurAnisearch') namen[p.id] = p.name
    }
  }
  return { felder, namen }
}

/** Zusicherung: je Feld ergeben die fünf Zähler genau die Zahl der verglichenen Titel — sonst ginge ein Titel unbemerkt verloren. */
export function pruefeZaehler(b: Pick<Bericht, 'felder' | 'titel'>): void {
  for (const f of FELDER) {
    const x = b.felder[f]
    const summe = x.gleich + x.abweichend + x.nurAnilist + x.nurAnisearch + x.beideLeer
    if (summe !== b.titel.verglichen) throw new Error(`aniSearch-Abweichungen: Feld ${f} zählt ${summe} statt ${b.titel.verglichen} Titel`)
  }
}

/** Kennungen, die aniSearchs eigene Brücke (MAL → aniSearch) je aniSearch-Eintrag nennt. */
export function malJeAnisearch(bruecke: Record<string, number>): Map<number, number[]> {
  const m = new Map<number, number[]>()
  for (const [mal, as] of Object.entries(bruecke)) m.set(as, [...(m.get(as) ?? []), Number(mal)])
  return m
}

type Quellen = { titles: Map<number, Title>; byMal: Record<string, AniListMedia>; byAniId: Record<string, AniListMedia>; anisearch: Record<string, AnisearchEintrag> }

/** Titel mit ihren beiden Spalten; die Zähler `titel` sagen, wer aus welchem Grund fehlt. */
export function sammlePaare({ titles, byMal, byAniId, anisearch }: Quellen, mal: Map<number, number[]>): { paare: Paar[]; titel: Bericht['titel'] } {
  const medien = new Map<number, AniListMedia>()
  for (const m of [...Object.values(byMal), ...Object.values(byAniId)]) if (m?.id) medien.set(m.id, m)
  const paare: Paar[] = []
  const titel = { gesamt: titles.size, verglichen: 0, ohneAnisearchEintrag: 0, ohneInfo: 0, nurAnisearch: 0 }
  for (const t of titles.values()) {
    if (t.id >= ANISEARCH_ID_BASIS) titel.nurAnisearch++
    else if (!anisearch[t.id]) titel.ohneAnisearchEintrag++
    else if (!anisearch[t.id]!.info) titel.ohneInfo++
    else {
      const e = anisearch[t.id]!
      paare.push({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anilist: anilistSpalte(t, medien.get(t.id)), anisearch: anisearchSpalte(e, mal.get(e.anisearchId ?? -1)) })
      titel.verglichen++
    }
  }
  return { paare, titel }
}

const zaehlerZeile = (b: Bericht): string =>
  FELDER.map((f) => `${f} ${b.felder[f].gleich}=/${b.felder[f].abweichend}≠/${b.felder[f].nurAnilist}A/${b.felder[f].nurAnisearch}S`).join(' · ')

/** Phase des Baus: vergleicht und schreibt die Liste — nur bei Änderung, damit der Stand nicht täglich committet wird. */
export function schreibeAnisearchAbweichungen(q: Quellen): void {
  const { paare, titel } = sammlePaare(q, malJeAnisearch(readJson<Record<string, number>>('data/anisearch-mal.json', {})))
  const bericht: Bericht = { stand: todayIso(), titel, ...vergleichePaare(paare) }
  pruefeZaehler(bericht)
  const alt = readJson<Partial<Bericht>>(ABWEICHUNGEN_DATEI, {})
  if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...bericht, stand: '' })) writeJson(ABWEICHUNGEN_DATEI, bericht)
  log(`aniSearch gegen AniList: ${titel.verglichen} von ${titel.gesamt} Titeln verglichen (${titel.ohneAnisearchEintrag} ohne Eintrag, ${titel.ohneInfo} ohne Info) — ${zaehlerZeile(bericht)} — Liste: ${ABWEICHUNGEN_DATEI}`)
}
