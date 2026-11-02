import type { Title } from '../../shared/types.ts'
import { abgleich } from './folgentitel-abgleich.ts'
import { titelJeKennung, type CrArchiv, type CrSerie } from './folgentitel-cr.ts'

/**
 * **Deutsche Folgentitel aus Crunchyroll, wo ein Verweis mehrere Staffeln führt** (Stufe 1b aus `docs/wissen/folgentitel-quellen.md`: Tales of Wedding Rings,
 * You and I Are Polar Opposites, Aoashi Staffel 2 …). `crFolgentitel` lässt diese Titel aus, weil die Nummern je Staffel bei 1 beginnen. Hier zählt genau eine
 * Staffel: Nummern lückenlos aufeinander (bei 1 oder als Fortsetzung der Vorstaffel, z. B. 25…36), erster deutscher Tag im Beginnjahr des Titels, höchstens
 * so viele Folgen wie unser Titel (laufende Staffeln sind kürzer; ohne Folgenzahl gilt jede Länge) und dieselbe Staffelzahl im Namen von Titel und Crunchyroll-Staffel
 * (Aoashi: Staffel 1 und 2 starten beide 2026). Dazu müssen die Titel, die wir schon haben, der Staffel inhaltlich gleichen (`abgleich` = „passt": mindestens drei gemeinsame
 * Nummern, vier Fünftel gleich); ohne Vergleich gibt es nichts, solche Titel ordnet `data/folgentitel-hand.yaml` einzeln zu, bis aniSearch drei Titel führt.
 * Nur Serienformate (TV, ONA); Specials und Filme tragen ihre Folgen in Sonderstaffeln.
 */
type Staffel = NonNullable<CrSerie['staffeln']>[number]

/** Erster deutscher Starttag (JJJJ-MM-TT) der Staffel oder `undefined`. */
function ersterTag(st: Staffel): string | undefined {
  return (st.deutscheFolgen ?? []).map((f) => f.verfuegbarAb?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort()[0]
}

/** Die Nummern der Staffel, wenn sie ohne Lücke und Doppelte aufeinander folgen; sonst `undefined`. */
function nummernLueckenlos(st: Staffel): number[] | undefined {
  const nr = (st.deutscheFolgen ?? []).map((f) => f.nummer).filter((n): n is number => Number.isInteger(n))
  if (nr.length !== (st.deutscheFolgen ?? []).length || !nr.length) return undefined
  const sortiert = [...nr].sort((a, b) => a - b)
  return sortiert.every((n, i) => n === sortiert[0] + i) ? sortiert : undefined
}

/** Die Titel der Staffel unter ihren Nummern ab 1. */
function titelDerStaffel(st: Staffel, archiv: CrArchiv): Map<number, string> {
  const anfang = (nummernLueckenlos(st) as number[])[0]
  const je = titelJeKennung(archiv)
  const aus = new Map<number, string>()
  for (const f of st.deutscheFolgen ?? []) {
    const t = f.guid ? je.get(f.guid) : undefined
    if (t && f.nummer) aus.set(f.nummer - anfang + 1, t)
  }
  return aus
}

/** Die Staffelzahl am Ende des Namens („Staffel 2", „Season 3", „Die Tagebücher der Apothekerin Staffel 3"); ohne Zahl die erste Staffel. */
function staffelZahl(name: string | undefined): number {
  return Number(/(?:staffel|season)\s*(\d+)\s*$/i.exec(name ?? '')?.[1] ?? /(\d+)\s*$/.exec(name ?? '')?.[1] ?? 1)
}

/** Unser Titel nennt seine Staffel im Namen („… Staffel 2", „… Season 3"); sonst gilt er als die erste. */
function titelStaffelZahl(titel: Title): number {
  const nennt = [titel.titleDe, titel.titleEn].map((n) => /(?:staffel|season)\s*(\d+)/i.exec(n ?? '')?.[1]).find(Boolean)
  return Number(nennt ?? 1)
}

const FORMATE = new Set(['TV', 'TV_SHORT', 'ONA'])

export function crFolgentitelGeteilt(titel: Title, serie: CrSerie | undefined, archiv: CrArchiv | undefined, vorhanden: ReadonlyMap<number, string>): Map<number, string> | undefined {
  if (!titel.streams.some((s) => s.platform === 'crunchyroll') || !serie || !archiv || !titel.jpYear || !FORMATE.has(titel.format ?? '')) return undefined
  const passend = (serie.staffeln ?? []).filter(
    (st) =>
      nummernLueckenlos(st) &&
      (st.deutscheFolgen?.length ?? 0) <= (titel.episodes ?? Infinity) &&
      Number(ersterTag(st)?.slice(0, 4)) === titel.jpYear &&
      staffelZahl(st.name) === titelStaffelZahl(titel),
  )
  if (passend.length !== 1) return undefined
  const aus = titelDerStaffel(passend[0], archiv)
  return aus.size && abgleich(vorhanden, aus) === 'passt' ? aus : undefined
}
