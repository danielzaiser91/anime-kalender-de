/**
 * Zusicherung: die Marke „Zweitanbieter“ (`shared/zweitanbieter.ts`) — Fälle aus dem Datensatz vom 10.10.2026.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-zweitanbieter.ts`
 */
import type { PlatformId, Release, ReleaseEvent } from '../shared/types.ts'
import { ZWEITANBIETER_MIN_TAGE, schreibeZweitanbieter } from '../shared/zweitanbieter.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (titleId: number, platform: PlatformId, date: string, episode: number, o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `${titleId}-${platform}-${episode}-${date}`, releaseSlug: `${titleId}-${platform}`, titleId, date, episode, releaseType: 'weekly', platform, name: 'X', ...o }) as ReleaseEvent
const rel = (slug: string, o: Partial<Release> = {}): Release => ({ slug, ...o }) as Release
const lauf = (events: ReleaseEvent[], releases: Release[] = [], kanal = new Map<number, PlatformId>()) => schreibeZweitanbieter(events, releases, kanal)

console.log('\nZweitanbieter (Bau):')
{
  /* A Wild Last Boss Appeared S2 (25.10.2026): Prime über den Crunchyroll-Kanal ist Crunchyroll, kein zweiter Erster. */
  const prime = ev(2, 'primevideo', '2026-09-26', 1)
  const cr = ev(2, 'crunchyroll', '2026-10-24', 1)
  const nf = ev(2, 'netflix', '2026-11-20', 1)
  lauf([prime, cr, nf], [], new Map([[2, 'crunchyroll' as PlatformId]]))
  pruefe('Crunchyroll trägt kein „zuerst bei Prime“, wenn Prime der Crunchyroll-Kanal ist', cr.zweitanbieter === undefined, cr.zweitanbieter)
  pruefe('ein später Dritter nennt den echten Anbieter, nicht den Kanal', nf.zweitanbieter?.erster === 'crunchyroll', nf.zweitanbieter)
  const p2 = ev(3, 'primevideo', '2026-09-26', 1)
  const cr2 = ev(3, 'crunchyroll', '2026-10-24', 1)
  lauf([p2, cr2])
  pruefe('Kanal ohne eigenen Anbieter (Aniverse, Prime selbst): Marke bleibt', cr2.zweitanbieter?.erster === 'primevideo', cr2.zweitanbieter)
}
{
  /* Das Band der Unterwelt: Crunchyroll Folge 15 am 08.08.2026, Netflix zwei Monate später. */
  const cr = ev(1, 'crunchyroll', '2026-08-08', 15)
  const nf = ev(1, 'netflix', '2026-10-10', 15, { episodeCount: 24, episodeCountAssumed: true })
  lauf([cr, nf])
  pruefe('Netflix Folge 15 trägt „erster: Crunchyroll, seit 08.08.2026“', nf.zweitanbieter?.erster === 'crunchyroll' && nf.zweitanbieter.seit === '2026-08-08', nf.zweitanbieter)
  pruefe('der Erste (Crunchyroll) trägt keine Marke', cr.zweitanbieter === undefined)
}
{
  /* Dan Da Dan: ADN einen Tag vor Crunchyroll — beide Erste. */
  const adn = ev(2, 'adn', '2026-10-09', 3)
  const cr = ev(2, 'crunchyroll', '2026-10-10', 3)
  const gleich = ev(2, 'netflix', '2026-10-09', 3)
  lauf([adn, cr, gleich])
  pruefe('ein Tag Abstand: keine Marke', cr.zweitanbieter === undefined && gleich.zweitanbieter === undefined && adn.zweitanbieter === undefined)
  const sechs = ev(3, 'crunchyroll', '2026-10-10', 1)
  const sieben = ev(3, 'netflix', '2026-10-17', 1)
  const sechsTage = ev(3, 'adn', '2026-10-16', 1)
  lauf([sechs, sechsTage, sieben])
  pruefe(`Schwelle ${ZWEITANBIETER_MIN_TAGE} Tage: 6 Tage keine Marke, 7 Tage Marke`, sechsTage.zweitanbieter === undefined && sieben.zweitanbieter?.erster === 'crunchyroll')
}
{
  /* Je Folge, nicht je Staffel: Folge 25 gibt es nur bei Netflix. */
  const cr = ev(4, 'crunchyroll', '2026-04-04', 24)
  const nf24 = ev(4, 'netflix', '2026-10-10', 24)
  const nf25 = ev(4, 'netflix', '2026-10-17', 25)
  lauf([cr, nf24, nf25])
  pruefe('Folge 25 nur bei Netflix: keine Marke, Folge 24 schon', nf25.zweitanbieter === undefined && nf24.zweitanbieter !== undefined)
}
{
  /* TV, Disc und Kino liegen außerhalb der Regel, in beide Richtungen. */
  const tv = ev(5, 'tv', '2026-01-05', 1, { sender: 'RTL II' })
  const disc = ev(5, 'disc', '2026-01-06', 1, { releaseType: 'disc' })
  const kino = ev(5, 'kino', '2026-01-07', 1, { releaseType: 'movie' })
  const nf = ev(5, 'netflix', '2026-10-10', 1)
  const tvNachStream = ev(6, 'tv', '2026-10-20', 1, { sender: 'RTL II' })
  const streamZuerst = ev(6, 'netflix', '2026-01-01', 1)
  lauf([tv, disc, kino, nf, tvNachStream, streamZuerst])
  pruefe('TV, Disc und Kino davor machen den Stream nicht zum Zweitanbieter', nf.zweitanbieter === undefined, nf.zweitanbieter)
  pruefe('TV nach dem Stream trägt keine Marke', tvNachStream.zweitanbieter === undefined)
}
{
  /* Handbeleg „Premiere“ schlägt die Marke und wird gemeldet. */
  const cr = ev(7, 'crunchyroll', '2026-01-01', 1)
  const nf = ev(7, 'netflix', '2026-10-10', 1, { premiere: true })
  const r = lauf([cr, nf])
  pruefe('Premiere-Handbeleg: keine Marke, dafür eine Meldung', nf.zweitanbieter === undefined && r.kollisionen.length === 1 && r.anzahl === 0, r)
}
{
  /* „Im Angebot seit“ des Ersten ist ein Mindestwert. */
  const katalog = ev(8, 'crunchyroll', '2025-01-01', 1, { releaseSlug: 'kat', releaseType: 'batch' })
  const nf = ev(8, 'netflix', '2026-10-10', 1)
  lauf([katalog, nf], [rel('kat', { dateMeaning: 'available-from' })])
  const z = nf.zweitanbieter
  pruefe('Katalogdatum des Ersten: mindestens-Kennzeichen', z?.mindestens === true && z.seit === '2025-01-01', z)
  const allein = ev(9, 'netflix', '2026-10-10', 1)
  lauf([allein])
  pruefe('ein einziger Anbieter: keine Marke', allein.zweitanbieter === undefined)
}
{
  /* Ohne Folgennummer (Katalog, Batch) ist das Datum „Im Angebot seit“, nicht „erschienen am“: keine Marke; ein Film behält sie. */
  const cr = ev(10, 'crunchyroll', '2026-01-01', 1)
  const batch = ev(10, 'netflix', '2026-10-10', 1, { episode: undefined, releaseType: 'batch' })
  const filmCr = ev(11, 'primevideo', '2026-01-01', 1, { episode: undefined, releaseType: 'movie' })
  const film = ev(11, 'netflix', '2026-10-10', 1, { episode: undefined, releaseType: 'movie' })
  lauf([cr, batch, filmCr, film])
  pruefe('Termin ohne Folgennummer (Batch): keine Marke', batch.zweitanbieter === undefined, batch.zweitanbieter)
  pruefe('Film ohne Folgennummer: Marke bleibt', film.zweitanbieter?.erster === 'primevideo', film.zweitanbieter)
}
{
  /* Snowball Earth (13.10.2026): Crunchyroll rechnete Folge 1 auf den 20.07. zurück; Disney+ brachte sie am 24.09. wirklich. */
  const crGerechnet = ev(12, 'crunchyroll', '2026-07-20', 1, { estimated: true })
  const disney = ev(12, 'disneyplus', '2026-09-24', 1)
  lauf([crGerechnet, disney])
  pruefe('zurückgerechneter Erster belegt keinen Vorsprung: keine Marke am Disney+-Termin', disney.zweitanbieter === undefined, disney.zweitanbieter)
  const crBelegt = ev(13, 'crunchyroll', '2026-07-20', 1)
  const disney2 = ev(13, 'disneyplus', '2026-09-24', 1)
  lauf([crBelegt, disney2])
  pruefe('Gegenprobe: belegter Erster trägt die Marke weiter', disney2.zweitanbieter?.erster === 'crunchyroll', disney2.zweitanbieter)
}
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
