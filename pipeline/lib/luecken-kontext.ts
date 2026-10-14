import { readdirSync } from 'node:fs'
import { readJson } from './util.ts'
import type { Title, Release, ReleaseEvent } from '../../shared/types.ts'
import type { KennungsZeile } from './ausgabe-kennung.ts'
import { BANNER_DATEI } from './tmdb-banner.ts'
import { ladeBewertungen } from './anisearch-bewertung.ts'
import type { Beleg, Kontext, Synopse } from './luecken-rahmen.ts'

const TAG_MS = 86_400_000
const tageBis = (datum: string, heute: string): number => Math.round((Date.parse(datum) - Date.parse(heute)) / TAG_MS)

function ladeSynopsen(): Record<number, Synopse> {
  const alle: Record<number, Synopse> = {}
  for (const datei of readdirSync('public/data/synopses')) Object.assign(alle, readJson(`public/data/synopses/${datei}`, {}))
  return alle
}

/** Termine je Titel in Tagen ab `heute`: Events und der erste Folgentermin der Veröffentlichungen. */
export function sammleTage(events: ReleaseEvent[], releases: Release[], heute: string): Map<number, number[]> {
  const tage = new Map<number, number[]>()
  const merke = (id: number, datum: string | undefined) => {
    if (!datum) return
    tage.set(id, [...(tage.get(id) ?? []), tageBis(datum, heute)])
  }
  for (const e of events) merke(e.titleId, e.date)
  for (const r of releases) merke(r.titleId, r.schedule?.firstEpisodeDate)
  return tage
}

/** Quellen je Titel; steht am Release nur `sources` ohne gelesenen Beleg, zählen sie als Quelle ohne Bild. */
export function sammleBelege(releases: Release[]): Map<number, Beleg> {
  const belege = new Map<number, Beleg>()
  for (const r of releases) {
    const b = belege.get(r.titleId) ?? { quellen: 0, mitBild: 0 }
    const q = r.quellen ?? []
    b.quellen += q.length > 0 ? q.length : (r.sources?.length ?? 0)
    b.mitBild += q.filter((x) => x.bild).length
    belege.set(r.titleId, b)
  }
  return belege
}

/** Liest Hauptbestand, Termine, Belege und aniSearch-Stimmen von der Platte (public/data, data/). */
export function ladeKontext(heute: string): Kontext {
  const alle = readJson<Title[]>('public/data/titles.json', [])
  const stimmenJeSeite = ladeBewertungen()
  const stimmen = new Map(alle.map((t) => [t.id, stimmenJeSeite.get(t.anisearchId ?? -1)?.stimmen ?? 0]))
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const events = readJson<ReleaseEvent[]>('public/data/events.json', [])
  const klein = readJson<{ id: number; grund: string }[]>('data/cover-klein.json', [])
  const kennungen = readJson<{ titel?: KennungsZeile[] }>('data/kennungen.json', {}).titel ?? []
  return {
    heute,
    stimmen,
    tage: sammleTage(events, releases, heute),
    synopsen: ladeSynopsen(),
    belege: sammleBelege(releases),
    hqGrund: new Map(klein.map((z) => [z.id, z.grund])),
    banner: readJson(BANNER_DATEI, {}),
    zuordnung: readJson('data/tmdb-titles.json', {}),
    ak: new Map(kennungen.map((z) => [z[1], z[0]])),
    alle,
  }
}
