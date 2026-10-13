/**
 * Zusicherung: **„≈" steht nur, wenn die Gesamtzahl wirklich nur angenommen ist** (Daniel, 13.10.2026,
 * „Das Band der Unterwelt": Netflix „Folge 16/≈24", Crunchyroll hatte das Finale am 10.10. gezeigt).
 * Läuft in `check:logic`; erfundene Releases, kein Netz.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { belegteGesamtzahl, hebeAnnahmeAuf } from './lib/folgenzahl-belegt.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

/** Crunchyroll hat alle `n` Folgen im Wochentakt gezeigt, die letzte am `letzte`. */
function crFertig(n: number, extra: Partial<Release['schedule']> = {}): Release {
  const observed: Record<number, string> = {}
  for (let i = 1; i <= n; i++) observed[i] = new Date(Date.UTC(2026, 3, 4 + 7 * (i - 1))).toISOString().slice(0, 10)
  return {
    slug: 'cr',
    titleId: 1,
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: observed[1]!, episodeCount: n, lastEpisodeDate: observed[n]!, observed, ...extra },
  } as Release
}

function netflix(first: number | undefined, count: number, extra: Partial<Release['schedule']> = {}): Release {
  return {
    slug: 'nf',
    titleId: 1,
    platform: 'netflix',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-09-19',
      ...(first ? { firstEpisodeNumber: first } : {}),
      episodeCount: count,
      episodeCountAssumed: true,
      wochentage: [6],
      ...extra,
    },
  } as Release
}

/* Fall: Das Band der Unterwelt — Netflix ab Folge 12, 13 Folgen = bis 24; Crunchyroll belegt 24. */
{
  const rels = [netflix(12, 13), crFertig(24)]
  const urteile = hebeAnnahmeAuf(rels)
  pruefe('Band der Unterwelt: Netflix verliert das Flag', rels[0]!.schedule.episodeCountAssumed === undefined, rels[0]!.schedule)
  pruefe('… und das Urteil nennt Beleg und Zahl', urteile.length === 1 && urteile[0]!.aufgehoben && urteile[0]!.belegtN === 24 && urteile[0]!.quelleSlug === 'cr', urteile)
  const folge16 = expandEvents(rels[0]!).find((e) => e.episode === 16)
  pruefe('… und Folge 16 trägt kein „≈" mehr, aber die Zahl 24', Boolean(folge16) && folge16!.episodeCount === 24 && !folge16!.episodeCountAssumed, folge16)
}
/* Gegenfall: die Folgen des Releases enden nicht bei der belegten Zahl — „≈" bleibt, die Abweichung wird gemeldet. */
{
  const rels = [netflix(12, 10), crFertig(24)]
  const urteile = hebeAnnahmeAuf(rels)
  pruefe('Abweichung: Flag bleibt', rels[0]!.schedule.episodeCountAssumed === true)
  pruefe('Abweichung: wird gemeldet', urteile.length === 1 && !urteile[0]!.aufgehoben && urteile[0]!.belegtN === 24, urteile)
}
/* Gegenfall: Crunchyroll läuft noch — drei Folgen sind kein Beleg für die Gesamtzahl. */
{
  const rels = [netflix(undefined, 12), crFertig(3, { lastEpisodeDate: undefined, episodeCount: 12 })]
  pruefe('laufende Staffel (Zahl ≠ Beobachtungen, kein Ende): kein Beleg', belegteGesamtzahl(rels[1]!) === undefined)
  pruefe('laufende Staffel: Flag bleibt, kein Urteil', hebeAnnahmeAuf(rels).length === 0 && rels[0]!.schedule.episodeCountAssumed === true)
}
/* Gegenfall: Ende ohne beobachtete letzte Folge (ADN-Art: nur lastEpisodeDate) und Lücken in den Beobachtungen. */
{
  const ohneBeobachtung = crFertig(24, { observed: undefined })
  pruefe('lastEpisodeDate ohne Beobachtungen: kein Beleg', belegteGesamtzahl(ohneBeobachtung) === undefined)
  const luecke = crFertig(24)
  delete luecke.schedule.observed![7]
  pruefe('Lücke in den Beobachtungen: kein Beleg', belegteGesamtzahl(luecke) === undefined)
  const falschesEnde = crFertig(24, { lastEpisodeDate: '2026-12-31' })
  pruefe('Ende, das nicht auf der letzten Folge liegt: kein Beleg', belegteGesamtzahl(falschesEnde) === undefined)
  const zaehltWeiter = crFertig(24, { firstEpisodeNumber: 13 })
  pruefe('Zählung beginnt nicht bei 1: kein Beleg', belegteGesamtzahl(zaehltWeiter) === undefined)
}
/* Beleg ohne lastEpisodeDate: lückenlos 1..N beobachtet und episodeCount = N, nicht angenommen. */
{
  const rels = [netflix(undefined, 12, { episodeCountSource: 'anisearch' }), crFertig(12, { lastEpisodeDate: undefined })]
  hebeAnnahmeAuf(rels)
  pruefe('1..N beobachtet, Zahl = N: Flag und aniSearch-Herkunft weg', rels[0]!.schedule.episodeCountAssumed === undefined && rels[0]!.schedule.episodeCountSource === undefined, rels[0]!.schedule)
}
/* Gegenfall: Beleg gehört zu einer anderen Titel-ID, oder der Release belegt sich nicht selbst. */
{
  const fremd = crFertig(24)
  fremd.titleId = 2
  const rels = [netflix(12, 13), fremd]
  pruefe('andere Titel-ID: Flag bleibt', hebeAnnahmeAuf(rels).length === 0 && rels[0]!.schedule.episodeCountAssumed === true)
  const allein = [netflix(12, 13, { observed: { 12: '2026-09-19', 24: '2026-12-05' }, lastEpisodeDate: '2026-12-05' })]
  pruefe('ein Release allein belegt sich nicht', hebeAnnahmeAuf(allein).length === 0 && allein[0]!.schedule.episodeCountAssumed === true)
}

if (fehler) {
  console.error(`${fehler} Fehler in check-folgenzahl-belegt`)
  process.exit(1)
}
console.log('check-folgenzahl-belegt: ok')
