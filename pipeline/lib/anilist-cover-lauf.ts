import type { Title } from '../../shared/types.ts'
import { log, readJson, sleep, writeJson } from './util.ts'
import { messeCover, ungemessene, type CoverMasse } from './anilist-cover-masse.ts'

/** Datei mit Maßen und Größe der AniList-Cover (`lib/anilist-cover-masse.ts`). */
export const COVER_MASSE_DATEI = 'data/anilist-cover-masse.json'
/** Höchstens so viele Cover je Lauf (rund 1 Minute bei 150 ms Pause); der Rest kommt im nächsten Lauf. */
const JE_LAUF = 200

async function holeCover(url: string): Promise<{ status: number; bytes: Buffer }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) }
}

/** Misst neue AniList-Cover der Titel nach (neue Titel ohne Messung zeigen sonst das Standardbild als Link-Vorschau). */
export async function messeNeueAnilistCover(titel: Title[], bestand: CoverMasse, limit = JE_LAUF): Promise<number> {
  const offen = ungemessene(titel.map((t) => t.coverImage), bestand)
  const gemessen = await messeCover(offen, bestand, limit, holeCover, () => sleep(150))
  log(`AniList-Cover: ${offen.length} ohne Messung, ${gemessen} gemessen (höchstens ${limit} je Lauf)`)
  return gemessen
}

/** Lauf-Schritt: liest den Bestand, misst und schreibt ihn zurück. */
export async function messeAnilistCoverImLauf(): Promise<void> {
  const bestand = readJson<CoverMasse>(COVER_MASSE_DATEI, {})
  const titel = [...readJson<Title[]>('public/data/titles.json', []), ...readJson<Title[]>('public/data/ohne-synchro.json', [])]
  if (await messeNeueAnilistCover(titel, bestand)) writeJson(COVER_MASSE_DATEI, bestand)
}
