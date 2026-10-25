/**
 * Zusicherungen: Die Wochenvorschau widerlegt keinen Tag, den der deutsche Katalog selbst als deutschen Erscheinungstag führt.
 *
 * Anlass (25.10.2026): Last Boss S2 stand in der Vorschau vom 05.10. am 24.10. nur als „ja“ (OmU); der Katalog datiert die
 * deutschen Folgen 1 und 2 auf 24.10., 13:30 UTC. Die Widerlegung strich den abgeleiteten Termin trotzdem — ebenso Aristocrat S3
 * am 18.10. (Katalog: 15:00 UTC). Die Fälle sind wörtlich die beiden mit Kennung, Tag und Zeitstempel aus dem Dub-Bestand.
 *
 * Aufruf: npx tsx pipeline/check-widerlegung-katalog.ts
 */
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import type { Release, Title } from '../shared/types.ts'
import { deutscheFolgeAmTag, sammleWiderlegungen, type Wochenprogramm } from './bau/widerlegung-woche.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const serie = (seriesId: string, zeitstempel: string[], katalog = 'de') => ({
  url: `https://www.crunchyroll.com/de/series/${seriesId}/x`,
  seriesId,
  katalog,
  staffeln: [{ name: 'Staffel 2', deutscheFolgen: zeitstempel.map((verfuegbarAb, i) => ({ nummer: i + 1, guid: `g${i}`, verfuegbarAb })) }],
})
const dub = (...serien: ReturnType<typeof serie>[]) => ({ scrapedAt: '2026-10-25', serien }) as unknown as CrDubData

pruefe('Folge am Tag (13:30 UTC = 15:30 Berlin am 24.10.)', deutscheFolgeAmTag(dub(serie('GT00361955', ['2026-10-24T13:30:00Z'])), 'GT00361955', '2026-10-24'))
pruefe('anderer Tag: nein', !deutscheFolgeAmTag(dub(serie('GT00361955', ['2026-10-24T13:30:00Z'])), 'GT00361955', '2026-10-25'))
pruefe('Berliner Tag, nicht UTC: 23.10. 22:30 UTC ist der 24.10.', deutscheFolgeAmTag(dub(serie('GT00361955', ['2026-10-23T22:30:00Z'])), 'GT00361955', '2026-10-24'))
pruefe('und nicht der 23.10.', !deutscheFolgeAmTag(dub(serie('GT00361955', ['2026-10-23T22:30:00Z'])), 'GT00361955', '2026-10-23'))
pruefe('andere Serie: nein', !deutscheFolgeAmTag(dub(serie('GG5H5XQMD', ['2026-10-24T13:30:00Z'])), 'GT00361955', '2026-10-24'))
pruefe('US-Katalog zählt nicht', !deutscheFolgeAmTag(dub(serie('GT00361955', ['2026-10-24T13:30:00Z'], 'us')), 'GT00361955', '2026-10-24'))
pruefe('Serie ohne datierte Folgen: nein', !deutscheFolgeAmTag(dub(serie('GT00361955', [])), 'GT00361955', '2026-10-24'))

const release = (slug: string, titleId: number, kennung: string, tag: string): Release =>
  ({ slug, titleId, platform: 'crunchyroll', platformUrl: `https://www.crunchyroll.com/de/series/${kennung}/x`, schedule: { firstEpisodeDate: tag } }) as unknown as Release
const woche: Wochenprogramm = {
  wocheAb: '2026-10-19',
  artikel: 'https://example.test/wochenprogramm',
  eintraege: [
    { seriesId: 'GT00361955', sprache: 'ja', datum: '2026-10-24' },
    { seriesId: 'GG5H5XQMD', sprache: 'ja', datum: '2026-10-20' },
    { seriesId: 'GG5H5XQMD', sprache: 'ja', datum: '2026-10-18' },
  ],
}
const titles = new Map<number, Title>()
const lastBoss = release('lb-24-10', 204389, 'GT00361955', '2026-10-24')
const bestand = dub(serie('GT00361955', ['2026-10-24T13:30:00Z', '2026-10-24T13:30:00Z']))
const katalog = (k: string, d: string) => deutscheFolgeAmTag(bestand, k, d)

const ohne = sammleWiderlegungen([lastBoss], titles, woche, {})
pruefe('Kontrolle: ohne Katalog-Beleg wird der Tag widerlegt (nur „ja“ in der Vorschau)', ohne.anzahl === 1 && Boolean(ohne.gedaechtnis['lb-24-10']), ohne)
const mit = sammleWiderlegungen([lastBoss], titles, woche, {}, katalog)
pruefe('Last Boss S2 am 24.10.: der Katalog datiert die deutsche Folge, keine Widerlegung', mit.anzahl === 0 && Object.keys(mit.gedaechtnis).length === 0, mit)

const gemerkt = { 'lb-24-10': { am: '2026-10-24', grund: 'alt', gemeldet: true } }
const altMit = sammleWiderlegungen([lastBoss], titles, woche, gemerkt, katalog)
pruefe('eine gemerkte Widerlegung desselben Tages fällt weg, wenn der Katalog den Tag belegt', Object.keys(altMit.gedaechtnis).length === 0, altMit)
const altOhne = sammleWiderlegungen([lastBoss], titles, woche, gemerkt)
pruefe('Kontrolle: ohne Beleg bleibt die gemerkte Widerlegung', Boolean(altOhne.gedaechtnis['lb-24-10']), altOhne)

const anderer = sammleWiderlegungen([release('ari', 185756, 'GG5H5XQMD', '2026-10-20')], titles, woche, {}, katalog)
pruefe('eine andere Serie wird nicht durch den Beleg einer fremden Serie gerettet', anderer.anzahl === 1, anderer)
const andererTag = sammleWiderlegungen([release('lb-25', 204389, 'GT00361955', '2026-10-25')], titles, { ...woche, eintraege: [{ seriesId: 'GT00361955', sprache: 'ja', datum: '2026-10-25' }] }, {}, katalog)
pruefe('ein Termin an einem Tag ohne deutsche Folge bleibt widerlegbar', andererTag.anzahl === 1, andererTag)
const ari = sammleWiderlegungen([release('ari', 185756, 'GG5H5XQMD', '2026-10-18')], titles, { ...woche, wocheAb: '2026-10-12' }, {}, (k, d) => deutscheFolgeAmTag(dub(serie('GG5H5XQMD', ['2026-10-18T15:00:00Z'])), k, d))
pruefe('Aristocrat S3 am 18.10. (Katalog 15:00 UTC): keine Widerlegung', ari.anzahl === 0, ari)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
