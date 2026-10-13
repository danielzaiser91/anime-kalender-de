/**
 * Invariante D-24 (11.10.2026): Wo aniSearch Deutsch als „Geplant“ führt, gilt die deutsche Fassung als noch nicht veröffentlicht (Daniel) —
 * „Auf Deutsch heute“ und ein künftiger Synchro-Start widersprechen einander.
 *
 * Anlass: Reincarnated as a Dragon Hatchling. Der deutsche Block von aniSearch wiederholte den Japan-Zeitraum (10.01.–28.03.2026, Publisher ADN),
 * daraus wurde „Auf Deutsch seit 10.01.2026“; der ADN-Termin vom 22.10.2026 (Start der Synchro) machte den ADN-Verweis zu `dub: true`, obwohl
 * ADN bis dahin nur Untertitel zeigt. Gegenprobe: `pipeline/check-invarianten.ts`.
 */
import type { Release, Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { loadDubChecks } from './dub-confirmed.ts'
import { dubsNachTitel } from './anisearch-marke.ts'

export interface GeplantQuelle {
  /** Titel, deren Deutsch bei aniSearch „Geplant“ ist (`p` in `data/anisearch-dubs.json`). */
  geplant: ReadonlySet<number>
  /** Handbelege mit `dub: true`: schlagen die Marke. */
  handbelegt: ReadonlySet<number>
}

export function ladeGeplantQuelle(): GeplantQuelle {
  return {
    geplant: new Set(Object.entries(dubsNachTitel()).filter(([, k]) => k === 'p').map(([id]) => Number(id))),
    handbelegt: new Set(loadDubChecks().filter((c) => c.dub === true && !c.nichtImBestand).map((c) => c.anilistId)),
  }
}

/** Das deutsche Datum eines „Geplant“-Titels stammt nie aus dem aniSearch-Block: nur Handbeleg (`synchro`) oder eine benannte Quelle (`quelle`) darf eines tragen. */
function erstausgabeAusGeplant(t: Title): string[] {
  const e = t.deErstausgabe
  if (!e || e.synchro || e.quelle) return []
  return [`Titel ${t.id} (${t.titleRomaji}): aniSearch führt Deutsch als „Geplant“, aber deErstausgabe nennt ${e.von ?? e.zeitraum ?? e.publisher} — „Auf Deutsch seit“ widerspricht dem`]
}

/** Ein Verweis mit `dub: true` ohne Handbeleg, dessen Termine auf dem Anbieter alle erst kommen, behauptet „Deutsch heute“ gegen „Deutsch ab Termin“. */
function dubTrotzKuenftigemStart(t: Title, releases: Release[], heute: string): string[] {
  return t.streams
    .filter((s) => s.dub === true && !s.dubRanges?.length)
    .filter((s) => {
      const termine = releases.filter((r) => r.titleId === t.id && r.platform === s.platform)
      return termine.length > 0 && termine.every((r) => r.schedule.firstEpisodeDate > heute)
    })
    .map((s) => `Titel ${t.id} (${t.titleRomaji}): ${s.platform} dub:true, aber aniSearch führt Deutsch als „Geplant“ und der Termin liegt erst nach dem ${heute}`)
}

export function geplantNichtDeutschHeute(releases: Release[], titles: Map<number, Title>, q: GeplantQuelle, heute = todayIso()): string[] {
  const fehler: string[] = []
  for (const id of q.geplant) {
    const t = titles.get(id)
    if (!t) continue
    fehler.push(...erstausgabeAusGeplant(t))
    if (!q.handbelegt.has(id)) fehler.push(...dubTrotzKuenftigemStart(t, releases, heute))
  }
  return fehler
}
