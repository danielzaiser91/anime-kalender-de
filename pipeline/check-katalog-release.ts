/**
 * Zusicherung: `katalog` (Katalog-Release, Daniel 13.10.2026) steht nur an Terminen, deren ganze Staffel an ihrem Starttag erscheint,
 * und `belegt` nur mit ausdrücklichem Beleg (`data/katalog-release-von-hand.yaml`), sonst `abgeleitet`.
 * Fall und Gegenfall: Batch mit Erscheinungsdatum, nie „im Angebot seit“, ein Special, eine Doppelfolge, geratene Folgenzahl,
 * Finale-Tag, ausgebliebener Termin; dazu die fünf Befunde des Prüfers vom 13.10.2026 (Beelzebub, The Beginning After the End,
 * Honey Lemon Soda, Snowball Earth, Teil einer Staffel). Aufruf: `npm run check:logic`.
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { KATALOG_MIN_FOLGEN, schreibeKatalogRelease, type KatalogBelege } from '../shared/katalog-release.ts'
import { katalogBelegBestandFehler, katalogBelegFehler, katalogBelege, ladeKatalogBelegEintraege } from './lib/katalog-belege.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const OHNE: KatalogBelege = new Map()
const TEIL: KatalogBelege = new Map([['b', 'teil']])
const BELEGT: KatalogBelege = new Map([['b', 'belegt']])
const rel = (slug: string, o: Partial<Release> = {}): Release =>
  ({ slug, titleId: 1, name: slug, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 14 }, ...o }) as unknown as Release
const ev = (slug: string, episode: number | undefined, o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `${slug}@${episode ?? 'alle'}`, releaseSlug: slug, titleId: 1, name: 'X', date: '2026-10-18', releaseType: 'weekly', platform: 'crunchyroll', episode, episodeCount: 14, ...o }) as unknown as ReleaseEvent
const katalog = (events: ReleaseEvent[], releases: Release[], belege: KatalogBelege = OHNE): (string | undefined)[] => {
  schreibeKatalogRelease(events, releases, belege)
  return events.map((e) => e.katalog)
}
const batch = (n: number | undefined, o: Partial<Release> = {}, belege: KatalogBelege = OHNE) =>
  katalog([ev('b', undefined, { releaseType: 'batch', episodeCount: n })], [rel('b', { releaseType: 'batch', ...o })], belege)[0]
const woche = (tage: string[], zahl: number, start: string) => {
  const folgen = Array.from({ length: zahl }, (_, i) => ev('w', i + 1, { episodeCount: zahl, date: tage[i % tage.length]! }))
  const r = rel('w', { schedule: { firstEpisodeDate: start, episodeCount: zahl } as Release['schedule'] })
  return katalog(folgen, [r])
}

function katalogRelease(): void {
  console.log('\nKatalog-Release — die ganze Staffel an einem Tag:')
  pruefe('Batch mit 13 Folgen und Erscheinungsdatum, ohne Beleg: abgeleitet', batch(13) === 'abgeleitet', batch(13))
  pruefe('Gegenfall: Batch ohne Folgenzahl ist nur ein Starttermin aus einer Meldung', batch(undefined) === undefined)
  pruefe('Gegenfall „im Angebot seit“ (Katalogzugang) ist keiner', batch(13, { dateMeaning: 'available-from' }) === undefined)
  pruefe('Gegenfall: ein einzelnes Special', batch(1) === undefined)
  pruefe(`Gegenfall: unter ${KATALOG_MIN_FOLGEN} Folgen`, batch(KATALOG_MIN_FOLGEN - 1) === undefined)
  pruefe('Wochen-Release mit allen 12 Folgen an seinem Starttag: abgeleitet', woche(['2026-10-18'], 12, '2026-10-18').every((k) => k === 'abgeleitet'))
  const teil = Array.from({ length: 4 }, (_, i) => ev('w', 10 + i, { episodeCount: 13 }))
  pruefe('gegenprobe: Folge 10–13 am selben Tag (Finale-Tag) ist keiner', katalog(teil, [rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 13 } as Release['schedule'] })]).every((k) => !k))
  const geraten = Array.from({ length: 12 }, (_, i) => ev('w', i + 1, { episodeCount: 12 }))
  const geratenR = rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 12, episodeCountAssumed: true } as Release['schedule'] })
  pruefe('gegenprobe: geratene Folgenzahl macht keinen Katalog-Release', katalog(geraten, [geratenR]).every((k) => !k))
  const verpasst = [ev('w', 1, { episodeCount: 3 }), ev('w', 2, { episodeCount: 3 }), ev('w', 3, { episodeCount: 3, verpasst: { erwartetAm: '2026-10-18' } })]
  pruefe('gegenprobe: ein ausgebliebener Termin im Paket', katalog(verpasst, [rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 3 } as Release['schedule'] })]).every((k) => !k))
}

/** Die fünf Befunde des Prüfers (13.10.2026): jeder war mit dem alten Stand ein „Alle N Folgen auf einmal“. */
function befundeDesPruefers(): void {
  console.log('\nBefunde des Prüfers — nur mit Beleg „alle auf einmal“:')
  const beelzebub = 'Zum Start am 25.07.2026 standen 24 der 60 Folgen bereit; die restlichen Folgen kamen am 28.09.2026 hinzu, seitdem sind alle 60 da.'
  pruefe('Beelzebub: „24 der 60 Folgen zum Start“ ist kein Katalog-Release', batch(60, { herkunft: beelzebub }) === undefined, batch(60, { herkunft: beelzebub }))
  pruefe('Beelzebub: auch ohne diesen Text, wenn die Handdatei „teil“ sagt', batch(60, {}, TEIL) === undefined)
  pruefe('Gachiakuta: „12 von 24“ (Handdatei „teil“) ist keiner', batch(12, {}, TEIL) === undefined)
  const tage = Array.from({ length: 12 }, () => '2026-07-15')
  pruefe('The Beginning After the End: alle 12 Folgen am 15.07., Start war der 29.04. — Wochentakt mit Stempel, kein Release', woche(tage, 12, '2026-04-29').every((k) => !k))
  pruefe('Tamon’s B-side: alle 13 Folgen am 30.07., Start war der 07.05.', woche(Array.from({ length: 13 }, () => '2026-07-30'), 13, '2026-05-07').every((k) => !k))
  pruefe('Honey Lemon Soda: Batch plus Zahl, keine Quelle sagt „komplett“ — abgeleitet, nicht belegt', batch(12, { platform: 'disneyplus' }) === 'abgeleitet')
  pruefe('Beleg in der Handdatei (Quelle: „Episoden: 10 (komplett)“ zum Starttag) macht den Katalog-Release belegt', batch(10, {}, BELEGT) === 'belegt')
  pruefe('Cyberpunk: Edgerunners II ohne Handeintrag bleibt abgeleitet, „(komplett)“ heißt dort nur „Staffel danach vollständig“', batch(10) === 'abgeleitet' && !ladeKatalogBelegEintraege().some((e) => e.slug === 'cyberpunk-edgerunners-2-netflix'))
  const snow = rel('b', { releaseType: 'batch', herkunft: 'Crunchyroll führt nur die letzte Folge (13 von 13): abgeleitet als Komplettabwurf.' })
  const einzeln = (belege: KatalogBelege) => katalog([ev('b', undefined, { releaseType: 'batch', episodeCount: 13 })], [snow], belege)[0]
  pruefe('Snowball Earth: „Alle 13 auf einmal“ ist ohne Beobachtung abgeleitet', einzeln(OHNE) === 'abgeleitet', einzeln(OHNE))
  pruefe('Snowball Earth: mit beobachteten 13 Folgen am Tag belegt', einzeln(BELEGT) === 'belegt')
}

/** Die Handdatei selbst: gültig, und jede Kennung steht einmal da. */
function handdatei(): void {
  console.log('\nHanddatei data/katalog-release-von-hand.yaml:')
  const eintraege = ladeKatalogBelegEintraege()
  const fehler = katalogBelegFehler(eintraege)
  pruefe(`${eintraege.length} Einträge, jeder mit Art, https-Quelle und kurzem Zitat`, eintraege.length > 0 && fehler.length === 0, fehler)
  const kaputt = katalogBelegFehler([{ slug: 'a', art: 'komplett', url: 'http://x', zitat: 'Episoden: 12' }, { slug: 'a', art: 'egal', url: '', zitat: '' }])
  pruefe('gegenprobe: ohne „(komplett)“, ohne https, doppelte Kennung, falsche Art, leeres Zitat sind Fehler', kaputt.length >= 6, kaputt)
  const eins = { slug: 'a', art: 'komplett', url: 'https://x/1', zitat: 'Episoden: 12 (komplett)' }
  const ok = katalogBelegBestandFehler([eins], [{ slug: 'a', sources: ['https://x/1'] }])
  const tot = katalogBelegBestandFehler([eins, { ...eins, slug: 'erfunden' }], [{ slug: 'a', sources: ['https://x/1'] }])
  const ohneQuelle = katalogBelegBestandFehler([eins], [{ slug: 'a', sources: ['https://x/2'] }])
  const abruf = katalogBelegBestandFehler([{ ...eins, art: 'beobachtet' }], [{ slug: 'a', sources: [] }])
  pruefe('Bestandsregel: Kennung da und Quelle in den sources — kein Fehler', ok.length === 0, ok)
  pruefe('gegenprobe: eine erfundene Kennung ist tot', tot.length === 1 && tot[0]!.includes('erfunden'), tot)
  pruefe('gegenprobe: eine Quelle außerhalb der sources ist ein Fehler', ohneQuelle.length === 1, ohneQuelle)
  pruefe('Art „beobachtet“ braucht keine Quelle in den sources', abruf.length === 0, abruf)
  pruefe('Art „teil“ führt zu „teil“, die übrigen zu „belegt“', [...katalogBelege(eintraege).values()].every((v) => v === 'belegt' || v === 'teil'))
}

katalogRelease()
befundeDesPruefers()
handdatei()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
