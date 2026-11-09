/**
 * Zusicherungen zum Merker von `tvPremiere` (05.11.2026, Filterklick laggte 3,8 s): Antwort und Termin-Zerlegung werden
 * je Datensatz bzw. Release gemerkt, und `istPremiere` zerlegt über die hereingereichte Funktion. Erfundene Daten.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { istPremiere } from '../shared/tv-signale.ts'
import { tvPremiere } from '../web/src/lib/tv-angabe.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

const titel = { id: 900001, streams: [] } as unknown as Title
function tvRelease(slug: string, extra: Partial<Release> = {}): Release {
  return {
    slug,
    titleId: 900001,
    name: slug,
    platform: 'tv',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-11-10',
      firstEpisodeNumber: 5,
      episodeCount: 12,
    },
    year: 2026,
    sources: ['https://example.org/x'],
    ...extra,
  } as Release
}
function termin(slug: string, episode: number): ReleaseEvent {
  return { id: `${slug}@${episode}`, releaseSlug: slug, titleId: 900001, date: '2026-11-10', releaseType: 'weekly', platform: 'tv', name: slug, episode } as ReleaseEvent
}
function datensatz(r: Release) {
  return { titleById: new Map([[900001, titel]]), releasesByTitle: new Map([[900001, [r]]]), releaseBySlug: new Map([[r.slug, r]]) }
}

/* Die hereingereichte Zerlegung wird benutzt: ohne sie (Mutant „entfalte ignoriert“) bliebe der Zähler 0. */
{
  const r = tvRelease('a')
  let aufrufe = 0
  istPremiere(5, '2026-11-10', titel, [r], undefined, undefined, undefined, () => (aufrufe++, [] as ReleaseEvent[]))
  pruefe('istPremiere zerlegt die TV-Releases über die hereingereichte Funktion', aufrufe === 1)
}

/* Der Merker: gleiche Frage, gleiche Antwort, auch wenn sich die Grundlage danach (nur in dieser Probe) ändert. */
{
  const r = tvRelease('b', { premiere: { weg: 'tv' } } as Partial<Release>)
  const d = datensatz(r)
  const ev = termin('b', 5)
  const erst = tvPremiere(ev, d)
  pruefe('Handbeleg „Premiere im Fernsehen“: Premiere', erst === true)
  r.premiere = undefined
  const ohne = tvPremiere({ ...ev, id: 'neu' }, d)
  pruefe('Kontrolle: anderer Termin (anderer Schlüssel) rechnet neu', ohne !== erst)
  pruefe('gleicher Termin: gemerkte Antwort', tvPremiere(ev, d) === erst)
  pruefe('anderer Datensatz (neue Maps): rechnet neu', tvPremiere(ev, datensatz(r)) === ohne)
}

/* Die Termin-Zerlegung eines Release wird über Fragen hinweg gemerkt (Mutant „termineMerken nicht übergeben“). */
{
  const r = tvRelease('c', { premiere: { weg: 'tv' } } as Partial<Release>)
  let leseZugriffe = 0
  const schedule = r.schedule
  Object.defineProperty(r, 'schedule', { get: () => (leseZugriffe++, schedule) })
  const d = datensatz(r)
  tvPremiere(termin('c', 5), d)
  const nachErster = leseZugriffe
  tvPremiere(termin('c', 6), d)
  tvPremiere(termin('c', 7), d)
  pruefe('weitere Fragen zum selben Release zerlegen es nicht neu', nachErster > 0 && leseZugriffe === nachErster)
}

if (fehler) process.exit(1)
console.log('TV-Premiere-Merker: 6 Zusicherungen halten.')
