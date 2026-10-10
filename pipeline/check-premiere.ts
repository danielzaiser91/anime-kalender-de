/**
 * Zusicherungen zu `Release.premiere` (Handbeleg „Premiere“ / „Premiere*“, 10.10.2026): Prüfung, Bau und
 * `istPremiere`. Läuft in `check:logic`. Erfundene Testdaten, kein echter Titel.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { istPremiere } from '../shared/tv-signale.ts'
import { premiereHinweis, premiereLabel } from '../shared/premiere.ts'
import { premiereFehler, premiereWarnungen, schreibePremiere } from './lib/premiere.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

const QUELLE = 'https://example.org/belegt'
function release(slug: string, extra: Partial<Release> = {}): Release {
  return {
    slug,
    titleId: 1,
    name: slug,
    platform: 'netflix',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-11-05' },
    year: 2026,
    sources: [QUELLE],
    ...extra,
  } as Release
}
function termin(slug: string, date: string, extra: Partial<ReleaseEvent> = {}): ReleaseEvent {
  return {
    id: `${slug}@${date}`,
    releaseSlug: slug,
    titleId: 1,
    date,
    releaseType: 'weekly',
    platform: 'netflix',
    name: slug,
    ...extra,
  } as ReleaseEvent
}

// Prüfung
const gut = release('stream-disc', { premiere: { weg: 'stream', quelle: QUELLE, vorher: 'disc', vorherDatum: '2023-01-12' } })
pruefe('gültiger Beleg mit Disc davor besteht', premiereFehler([gut]).length === 0)
pruefe('gültiger Beleg ohne Vorgänger besteht', premiereFehler([release('tv', { platform: 'tv', premiere: { weg: 'tv', quelle: QUELLE } })]).length === 0)
pruefe('Quelle außerhalb von sources fällt auf', premiereFehler([release('a', { premiere: { weg: 'stream', quelle: 'https://example.org/andere' } })]).length === 1)
pruefe('vorher ohne Datum fällt auf', premiereFehler([release('a', { premiere: { weg: 'stream', quelle: QUELLE, vorher: 'disc' } })]).length === 1)
pruefe('Datum nach dem Release fällt auf', premiereFehler([release('a', { premiere: { weg: 'stream', quelle: QUELLE, vorher: 'kino', vorherDatum: '2026-11-05' } })]).length === 1)
pruefe('Datum ohne vorher fällt auf', premiereFehler([release('a', { premiere: { weg: 'stream', quelle: QUELLE, vorherDatum: '2020-01-01' } })]).length === 1)
pruefe('weg tv auf einem Streaming-Release fällt auf', premiereFehler([release('a', { premiere: { weg: 'tv', quelle: QUELLE } })]).length === 1)
pruefe('weg stream auf einer Disc fällt auf', premiereFehler([release('a', { releaseType: 'disc', premiere: { weg: 'stream', quelle: QUELLE } })]).length === 1)
pruefe(
  'früherer Termin desselben Titels widerlegt die Premiere, eine frühere Disc nicht',
  premiereFehler([release('a', { premiere: { weg: 'stream', quelle: QUELLE } }), release('b', { schedule: { firstEpisodeDate: '2026-10-01' } })]).length === 1 &&
    premiereFehler([release('a', { premiere: { weg: 'stream', quelle: QUELLE } }), release('d', { releaseType: 'disc', schedule: { firstEpisodeDate: '2026-10-01' } })]).length === 0,
)
const premStream = release('a', { premiere: { weg: 'stream', quelle: QUELLE } })
pruefe(
  'selber Tag: anderer Weg schließt die Premiere aus, derselbe Weg (gemeinsamer Start) nicht',
  premiereFehler([premStream, release('tvgleich', { platform: 'tv', schedule: { firstEpisodeDate: '2026-11-05' } })]).length === 1 &&
    premiereFehler([premStream, release('streamgleich', { platform: 'crunchyroll', schedule: { firstEpisodeDate: '2026-11-05' } })]).length === 0,
)

// Warnung: Handbeleg ohne vorher gegen ältere deutsche Erstausgabe
const altTitel = { id: 1, deErstausgabe: { von: '2023-01-12', synchro: true } } as unknown as Title
pruefe(
  'Warnung bei Handbeleg ohne vorher gegen ältere Erstausgabe, nicht mit vorher und nicht bei jüngerer',
  premiereWarnungen([premStream], new Map([[1, altTitel]])).length === 1 &&
    premiereWarnungen([gut], new Map([[1, altTitel]])).length === 0 &&
    premiereWarnungen([premStream], new Map([[1, { id: 1, deErstausgabe: { von: '2026-12-04', synchro: true } } as unknown as Title]])).length === 0,
)

// Bau
const stream =release('s', { premiere: { weg: 'stream', quelle: QUELLE, vorher: 'disc', vorherDatum: '2023-01-12' } })
const evs = [termin('s', '2026-11-05'), termin('s', '2026-11-12')]
const bau = schreibePremiere(evs, [stream])
pruefe('Streaming: nur der erste Termin trägt Premiere*', evs[0].premiere === true && evs[0].premiereVorher === 'disc' && !evs[1].premiere && !evs[1].premiereVorher && bau.anzahl === 1)
const tv = release('t', { platform: 'tv', premiere: { weg: 'tv', quelle: QUELLE } })
const tvEvs = [termin('t', '2026-11-05', { platform: 'tv', tvPremiere: true }), termin('t', '2026-11-06', { platform: 'tv', tvPremiere: false })]
const tvBau = schreibePremiere(tvEvs, [tv])
pruefe('Fernsehen: ohne vorher kein Zusatzfeld, eine belegte Wiederholung meldet den Widerspruch', !('premiere' in tvEvs[0]) && !('premiereVorher' in tvEvs[0]) && tvBau.widersprueche.length === 1 && tvBau.anzahl === 1)

// istPremiere: Handbeleg ist gleichwertig zur Wikipedia-Erstausgabe, eine belegte Wiederholung schlägt ihn
const titel = { id: 1, streams: [] } as unknown as Title
pruefe('istPremiere: ohne Beleg keine Aussage, mit Handbeleg Premiere', istPremiere(1, '2026-11-05', titel, []) === undefined && istPremiere(1, '2026-11-05', titel, [], undefined, undefined, true) === true)
pruefe('istPremiere: früheres Datum der Folge schlägt den Handbeleg', istPremiere(1, '2026-11-05', titel, [], { 1: '2026-01-01' }, undefined, true) === false)

// Texte
pruefe('Tooltip und Beschriftung', premiereHinweis('netflix', 'disc') === 'Erstmals im Streaming auf Deutsch. Vorher nur auf Disc.' && premiereHinweis('tv', 'kino') === 'Erstmals im TV auf Deutsch. Vorher nur im Kino.' && premiereLabel('disc') === 'Premiere*' && premiereLabel() === 'Premiere')

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'Premiere: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
