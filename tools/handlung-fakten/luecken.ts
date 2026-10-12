/** Die Lücke: Titel ohne deutsche Handlung in `public/data/synopses`, abzüglich der Titel, die der Bau aus dem aniSearch-Seitenarchiv füllt (`archivTexte`, PR 1009). */
import { readFileSync, readdirSync } from 'node:fs'
import { anisearchKennungen } from '../../pipeline/bau/anisearch-kennung.ts'
import { archivTexte } from '../../pipeline/lib/anisearch-archiv-text.ts'
import type { Title } from '../../shared/types.ts'
import type { Geschwister, Luecke } from './typen.ts'

interface Synopse {
  de?: string
  deSource?: { name?: string }
}
interface Mitglied {
  id: number
  name: string
  format?: string
  jpYear?: number
}

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T
const MIN_LAENGE = 30

function synopsen(): Map<number, Synopse> {
  const alle = new Map<number, Synopse>()
  for (const datei of readdirSync('public/data/synopses')) {
    for (const [id, s] of Object.entries(lies<Record<string, Synopse>>(`public/data/synopses/${datei}`))) alle.set(Number(id), s)
  }
  return alle
}

/** Reihenname für geratene Seiten: das frühe Fernsehformat der Reihe zuerst, dann die übrigen Mitglieder nach Jahr. */
function reiheNamen(mitglieder: Mitglied[]): string[] {
  const rang = (m: Mitglied) => (m.format === 'TV' ? 0 : m.format === 'MOVIE' ? 1 : 2)
  const sortiert = [...mitglieder].sort((a, b) => rang(a) - rang(b) || (a.jpYear ?? 9999) - (b.jpYear ?? 9999))
  return [...new Set(sortiert.map((m) => m.name))].slice(0, 3)
}

function geschwisterVon(t: Title, mitglieder: Mitglied[], titel: Map<number, Title>, syn: Map<number, Synopse>, offen: Set<number>, kennungen: Map<number, number>): Geschwister[] {
  const naehe = (m: Mitglied) => Math.abs((m.jpYear ?? 0) - (t.jpYear ?? 0))
  return mitglieder
    .filter((m) => m.id !== t.id && !offen.has(m.id) && titel.has(m.id))
    .sort((a, b) => naehe(a) - naehe(b))
    .map((m) => {
      const s = syn.get(m.id)
      const deText = s?.deSource?.name === 'anisearch.de' && s.de && s.de.length > MIN_LAENGE ? s.de : undefined
      return { id: m.id, name: m.name, malId: titel.get(m.id)!.malId, anisearchSeite: kennungen.get(m.id), deText }
    })
    .slice(0, 12)
}

export function findeLuecken(): Luecke[] {
  const titles = lies<Title[]>('public/data/titles.json')
  const franchises = lies<Record<string, Mitglied[]>>('public/data/franchises.json')
  const syn = synopsen()
  const hatDe = (id: number) => (syn.get(id)?.de?.length ?? 0) > MIN_LAENGE
  const kennungen = anisearchKennungen(titles.map((t) => ({ id: t.id, mal: t.malId })))
  const archiv = archivTexte(kennungen, hatDe)
  const offen = new Set(titles.filter((t) => !hatDe(t.id) && !archiv.has(t.id)).map((t) => t.id))
  const jeSeite = new Map<number, number>()
  for (const s of kennungen.values()) jeSeite.set(s, (jeSeite.get(s) ?? 0) + 1)
  const nachId = new Map(titles.map((t) => [t.id, t]))
  return titles
    .filter((t) => offen.has(t.id))
    .map((t) => {
      const mitglieder = franchises[String(t.franchiseId)] ?? []
      const seite = kennungen.get(t.id)
      return {
        id: t.id,
        malId: t.malId,
        anisearchSeite: seite,
        geteilt: seite !== undefined && (jeSeite.get(seite) ?? 0) > 1,
        titleDe: t.titleDe,
        titleEn: t.titleEn,
        titleRomaji: t.titleRomaji,
        format: t.format,
        episodes: t.episodes,
        jpYear: t.jpYear,
        franchiseId: t.franchiseId,
        genres: t.genres ?? [],
        studios: t.studios ?? [],
        reiheNamen: reiheNamen(mitglieder),
        geschwister: geschwisterVon(t, mitglieder, nachId, syn, offen, kennungen),
      }
    })
}
