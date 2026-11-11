import type { Release } from '../../shared/types.ts'
import { log } from '../lib/util.ts'
import { type EigenerEintrag, eigeneId } from './eigene-titel.ts'

/**
 * **Termin je Anbieter aus der Handzeile selbst** (`data/eigene-titel.yaml`). `releasesAus` (Phase 08) legt je Meldung nur einen Termin beim
 * ersten Anbieter an und verliert ihn, sobald der Artikel aus dem Feed fällt (Zorro am 08.11.2026, fünf Tage nach dem Start). Hier gilt, was die
 * Zeile belegt: je genannter Anbieter ein Termin, wo die Meldung noch keinen geliefert hat. Folgenzahl und Kanal nur, wenn die Zeile sie nennt.
 */
export function terminAusEintrag(e: EigenerEintrag, platform: string): Release {
  const id = eigeneId(e.nr)
  const film = e.format === 'MOVIE'
  return {
    slug: `auto-${id}-${platform}`,
    titleId: id,
    name: e.name,
    platform: platform as Release['platform'],
    ...(e.kanal && platform === 'primevideo' ? { kanal: e.kanal } : {}),
    releaseType: film ? 'movie' : 'batch',
    schedule: { firstEpisodeDate: e.tag, ...(e.folgen && !film ? { episodeCount: e.folgen } : {}), ...(e.geschaetzt ? { estimated: true } : {}) },
    year: Number(e.tag.slice(0, 4)),
    herkunft: `Aus data/eigene-titel.yaml (Zeile ${e.nr}): ${e.zitat}`,
    sources: e.sources,
  }
}

/** Die fehlenden Termine aller lebenden Zeilen ohne `zuId` (die zieht um, ihr Katalogtitel führt die Termine selbst); gibt nur neue zurück. */
export function termineAusEigenen(eintraege: EigenerEintrag[], releases: Pick<Release, 'titleId' | 'platform'>[]): Release[] {
  const neu: Release[] = []
  for (const e of eintraege) {
    if (e.widerrufen || e.zuId) continue
    for (const platform of e.anbieter) {
      if (releases.some((r) => r.titleId === eigeneId(e.nr) && r.platform === platform)) continue
      neu.push(terminAusEintrag(e, platform))
    }
  }
  if (neu.length) log(`${neu.length} Termine direkt aus data/eigene-titel.yaml: ${neu.map((r) => `${r.name} (${r.platform}, ${r.schedule.firstEpisodeDate})`).join(', ')}`)
  return neu
}
