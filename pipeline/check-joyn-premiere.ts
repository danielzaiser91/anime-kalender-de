/**
 * Verdrahtung des TV-Premiere-Handbelegs (`premiereBelegtTv`) in Bau (`bau/10-termine.ts`) und Oberfläche
 * (`web/src/lib/tv-angabe.ts`, zwei Aufrufe) bei einem Titel mit Joyn-Weg (Yaiba, 05.11.2026). Fehlt das Argument, wird
 * die Folge 1 zur Wiederholung; mit Beleg am Release bleibt sie Premiere. Läuft in `check:logic`.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { schreibeTvAuskunft } from './bau/10-termine.ts'
import { tvAngabe, tvPremiere } from '../web/src/lib/tv-angabe.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`FEHLER: ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const QUELLE = 'https://example.org/belegt'
const joyn = {
  platform: 'joyn',
  url: 'https://www.joyn.de/serien/x',
  dub: true,
  dubRanges: [{ from: 1, to: 24, dub: true }],
}
const titel = { id: 900001, streams: [joyn] } as unknown as Title
const tv = (premiere: boolean): Release =>
  ({
    slug: 'x-tv',
    titleId: 900001,
    name: 'X',
    platform: 'tv',
    sender: 'ProSieben MAXX',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24, wochentage: [1, 2, 3, 4, 5] },
    ...(premiere ? { premiere: { weg: 'tv', quelle: QUELLE } } : {}),
    sources: [QUELLE],
  }) as unknown as Release

function bauPremiere(release: Release): boolean | undefined {
  const events: ReleaseEvent[] = expandEvents(release).filter((e) => e.episode === 1)
  schreibeTvAuskunft(events, [release], new Map([[900001, titel]]))
  return events[0]?.tvPremiere
}

console.log('\nTV-Premiere-Beleg bei Joyn-Weg (Bau und Oberfläche):')
pruefe('Bau: Folge 1 mit Beleg bleibt Premiere', bauPremiere(tv(true)) === true, bauPremiere(tv(true)))
pruefe('Bau: Folge 1 ohne Beleg ist Wiederholung (Kontrolle)', bauPremiere(tv(false)) === false, bauPremiere(tv(false)))

const rel = tv(true)
const ev = expandEvents(rel).find((e) => e.episode === 1) as ReleaseEvent
const daten = (r: Release) => ({ titleById: new Map([[900001, titel]]), releasesByTitle: new Map([[900001, [r]]]), releaseBySlug: new Map([[r.slug, r]]) })
pruefe('Oberfläche tvPremiere: mit Beleg Premiere', tvPremiere(ev, daten(rel)) === true)
pruefe('Oberfläche tvPremiere: ohne Beleg nicht (Kontrolle)', tvPremiere(ev, daten(tv(false))) === false)
pruefe('Oberfläche tvAngabe: mit Beleg Premiere', tvAngabe(rel, titel, [rel], '2026-11-04', '12:00')?.premiere === true, tvAngabe(rel, titel, [rel], '2026-11-04', '12:00'))
pruefe('Oberfläche tvAngabe: ohne Beleg nicht (Kontrolle)', tvAngabe(tv(false), titel, [tv(false)], '2026-11-04', '12:00')?.premiere === false)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'check-joyn-premiere: OK — Bau, tvPremiere, tvAngabe mit und ohne Beleg')
process.exit(fehler ? 1 : 0)
