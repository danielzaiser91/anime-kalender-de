import type { Title } from '../../shared/types.ts'
import { deutscheFolgenNachDemEnde, type CrDubData, type CrSerie, type CrStaffel } from './crunchyroll-dub.ts'
import { kennungAusZiel } from './crunchyroll-api.ts'
import { titelStaffelNr, zerlege } from './cr-staffel-nummer.ts'

/** Eine Serie mit der Kennung, jüngster Abruf zuerst (bei gleichem Datum der frühere Eintrag). */
export function frischesteSerieJeKennung(crDub: CrDubData): Map<string, CrSerie> {
  const je = new Map<string, CrSerie>()
  for (const s of crDub.serien) {
    if (!s.seriesId || s.nichtVerfuegbar || s.katalog !== 'de' || !s.deutschImAngebot) continue
    const bisher = je.get(s.seriesId)
    if (!bisher || (s.geprueftAm ?? '') > (bisher.geprueftAm ?? '')) je.set(s.seriesId, s)
  }
  return je
}

/** Blockname, der nur eine Staffelnummer trägt („Season 1“, „Staffel 2“) — sonst `null`. */
function nurStaffelNr(block: CrStaffel): number | null {
  const z = zerlege(block.name ?? '')
  return z.nr !== null && z.kern === '' ? z.nr : null
}

/**
 * Deutscher Block „Season N“ gehört dem einen TV-Titel der Serie mit Staffelnummer N (ohne Nummer im Namen: 1).
 * Anlass 27.10.2026: Tonikaku Kawaii verlor das Ja, als der Prüflauf den Block von „TONIKAWA: Over The Moon For You“ in „Season 1“ umbenannte
 * und der Namensvergleich (`beurteileJeBlock`) nichts mehr fand. Eng: genau ein Kandidat, Block hat deutsche Folgen, Folgenzahl
 * des Blocks höchstens 2 über unserer (Specials), keine Nummern hinter dem Ende des Titels.
 */
export function titelFuerStandardnameBlock(block: CrStaffel, kandidaten: Title[]): Title | null {
  const nr = nurStaffelNr(block)
  if (nr === null || !(block.deutscheFolgen?.length ?? block.deutsch ?? 0)) return null
  const passend = kandidaten.filter((t) => t.format === 'TV' && (titelStaffelNr(t) ?? 1) === nr)
  if (passend.length !== 1) return null
  const t = passend[0]!
  const abstand = (block.folgen ?? 0) - (t.episodes ?? 0)
  if (!t.episodes || abstand < 0 || abstand > 2) return null
  if (deutscheFolgenNachDemEnde([block], t.episodes)) return null
  return t
}

/** Setzt `dub: true` auf noch offene Crunchyroll-Verweise, deren Titel einen Standardnamen-Block führt. Gibt die Titelnummern zurück. */
export function ordneStandardnamenBloeckeZu({ crDub, nachUrl }: { crDub: CrDubData; nachUrl: Map<string, Title[]> }): number[] {
  const gesetzt: number[] = []
  for (const [kennung, serie] of frischesteSerieJeKennung(crDub)) {
    const adressen = new Set(crDub.serien.filter((s) => s.seriesId === kennung).map((s) => s.url))
    const gehoert = (url: string) => adressen.has(url) || kennungAusZiel(url) === kennung
    const gruppe = new Map<number, Title>()
    for (const [url, ts] of nachUrl) if (gehoert(url)) for (const t of ts) gruppe.set(t.id, t)
    for (const block of serie.staffeln ?? []) {
      const t = titelFuerStandardnameBlock(block, [...gruppe.values()])
      const stream = t?.streams.find((s) => s.platform === 'crunchyroll' && s.dub === undefined && gehoert(s.url))
      if (!t || !stream) continue
      stream.dub = true
      gesetzt.push(t.id)
    }
  }
  return gesetzt
}
