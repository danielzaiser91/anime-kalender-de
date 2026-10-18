/**
 * Zusicherungen zur Kalender-Plausibilität (`lib/kalender-plausibilitaet.ts`, 16.10.2026): je Regel ein Treffer und ein Nicht-Treffer.
 * Läuft hinter `check:logic`, liest keinen Bestand; die Zahlen am gebauten Bestand prüft `check-kalender-plausibilitaet-bestand.ts`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import type { NewsEintrag } from '../shared/news-typen.ts'
import { kanalSchluessel } from './lib/kanal-titel.ts'
import { plausibilitaet, REGELN, type Bestand, type Regel, type Treffer } from './lib/kalender-plausibilitaet.ts'
import { festschreiben, ueberschreitungen, type Grenzen, type TrefferJeRegel } from './lib/kalender-plausibilitaet-grenzen.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-16'
const titel = (id: number, extra: Partial<Title> = {}) => ({ id, titleRomaji: `T${id}`, streams: [], ...extra }) as unknown as Title
const release = (titleId: number, slug: string, schedule: Partial<Release['schedule']>, extra: Partial<Release> = {}) =>
  ({ titleId, slug, platform: 'crunchyroll', sources: ['https://quelle'], schedule, ...extra }) as unknown as Release
const ereignis = (titleId: number, id: string, date: string, extra: Partial<ReleaseEvent> = {}) =>
  ({ id, titleId, releaseSlug: `r${titleId}`, name: `T${titleId}`, date, platform: 'netflix', ...extra }) as unknown as ReleaseEvent
const news = (am: string, titelId: number, art = 'neu'): NewsEintrag => ({ am, titelId, meldungen: [{ art }] }) as unknown as NewsEintrag

function treffer(regel: Regel, teil: Partial<Bestand>): number[] {
  const b: Bestand = { titles: [], releases: [], events: [], news: [], urteile: {}, kanal: new Set(), heute: HEUTE, ...teil }
  return plausibilitaet(b)[regel].map((t) => t.titleId)
}

const gleich = (a: number[], b: number[]) => JSON.stringify(a) === JSON.stringify(b)
const gleichS = (a: unknown, b: string[]) => JSON.stringify(a) === JSON.stringify(b)
const urteil = { urteil: 'deutsch', art: 'gemessen' }

console.log('\nKalender-Plausibilität 1: erschienen, aber „Ohne bekannten Termin“')
{
  const r = (titleId: number, widerlegt?: boolean) => release(titleId, `r${titleId}`, { observed: { 1: '2026-10-01' } }, widerlegt ? { widerlegt: { am: '2026-10-02', grund: 'x', gemeldet: false } } : {})
  const jw = titel(3, { streams: [{ platform: 'netflix', url: 'n3', dubQuelle: 'justwatch', dubStand: '2026-10-01' }] as never })
  const gemessen = titel(4, { streams: [{ platform: 'netflix', url: 'n4' }] as never })
  const kanal = titel(5, { streams: [{ platform: 'primevideo', url: 'p5' }] as never })
  const angenommen = titel(6, { streams: [{ platform: 'netflix', url: 'n6' }] as never })
  const b = {
    titles: [titel(1), titel(2), jw, gemessen, kanal, angenommen, titel(7)],
    releases: [r(1), r(2, true), release(7, 'r7', { observed: { 1: '2026-10-20' } })],
    urteile: { '4|netflix|1': urteil, '5|primevideo|1': urteil, '6|netflix|1': { urteil: 'deutsch', art: 'angenommen' } },
    kanal: new Set([kanalSchluessel(5, 'p5')]),
  }
  const ids = treffer('erschienenOhneTermin', b)
  pruefe('beobachtete Folge, JustWatch und gemessenes Deutsch treffen', gleich(ids, [1, 3, 4]), ids)
  pruefe('widerlegter Termin, Prime-Kanal, nur angenommenes Urteil und Beobachtung in der Zukunft treffen nicht', !ids.some((id) => [2, 5, 6, 7].includes(id)), ids)
  pruefe('Titel mit laufendem Termin ist nicht „ohne Termin“', !treffer('erschienenOhneTermin', { titles: [titel(1)], releases: [release(1, 'r1', { firstEpisodeDate: '2026-10-01', observed: { 1: '2026-10-01' } })] }).length)
}

console.log('\nKalender-Plausibilität 2: belegtes Ende, trotzdem geschätzt')
{
  const ende = { firstEpisodeDate: '2026-07-01', lastEpisodeDate: '2026-09-30', episodeCount: 12 }
  const b = {
    titles: [titel(1), titel(2), titel(3), titel(4), titel(5), titel(6), titel(7), titel(8), titel(9)],
    releases: [
      release(1, 'r1', { ...ende, episodeCountAssumed: true }),
      release(2, 'r2', ende),
      release(3, 'r3', { firstEpisodeDate: '2026-07-01', episodeCount: 12, observed: { 12: '2026-09-30' } }),
      release(4, 'r4', { ...ende, lastEpisodeDate: '2026-12-30', episodeCountAssumed: true }),
      release(5, 'r5', ende),
      release(8, 'r8', { firstEpisodeDate: '2026-07-01', episodeCount: 12, episodeCountAssumed: false, observed: { 12: '2026-09-30' } }),
      release(9, 'r9', { firstEpisodeDate: '2026-07-01', episodeCount: 12, observed: { 12: HEUTE } }),
      release(6, 'r6', { firstEpisodeDate: '2026-07-01', episodeCount: 12, episodeCountAssumed: true, observed: { 12: HEUTE } }),
      release(7, 'r7', { ...ende, observed: { 12: '2026-09-23' } }),
    ],
    events: [ereignis(2, 'e2', '2026-10-07', { estimated: true }), ereignis(3, 'e3', '2026-09-30', { episodeCountAssumed: true }), ereignis(5, 'e5', '2026-09-23', { estimated: true }), ereignis(7, 'e7', '2026-09-27', { estimated: true }), ereignis(8, 'e8', '2026-09-30', { episodeCountAssumed: true }), ereignis(9, 'e9', HEUTE, { episodeCountAssumed: true })],
  }
  const ids = treffer('schaetzungNachEnde', b)
  pruefe('„≈“ am Termin, geschätzter Termin danach, „≈“ am Ereignis nach beobachtetem Finale treffen', gleich(ids, [1, 2, 3, 8, 9, 7]), ids)
  pruefe('Ende in der Zukunft und Schätzung vor dem Ende treffen nicht', !ids.includes(4) && !ids.includes(5), ids)
  pruefe('Geschätzte Folgenzahl: die beobachtete „letzte“ Folge am Tag ist kein belegtes Ende', !ids.includes(6), ids)
  pruefe('Ausdrücklich nicht geschätzt (false) und Finale genau am heutigen Tag zählen als belegtes Ende', ids.includes(8) && ids.includes(9), ids)
}

console.log('\nKalender-Plausibilität 3: „Sprache offen“ trotz gemessenem Deutsch')
{
  const wege = [
    { platform: 'netflix', url: 'n' },
    { platform: 'disneyplus', url: 'd', dub: true },
    { platform: 'primevideo', url: 'p' },
    { platform: 'crunchyroll', url: 'c' },
    { platform: 'wow', url: 'w', dubQuelle: 'justwatch', dubStand: '2026-10-01' },
  ]
  const b = {
    titles: [titel(1, { streams: wege as never })],
    urteile: { '1|netflix|1': urteil, '1|disneyplus|1': urteil, '1|primevideo|1': urteil, '1|crunchyroll|1': { urteil: 'kein deutsch', art: 'gemessen' }, '1|wow|1': urteil },
    kanal: new Set([kanalSchluessel(1, 'p')]),
  }
  const t = plausibilitaet({ releases: [], events: [], news: [], heute: HEUTE, ...b }).spracheOffenTrotzMeldung.map((x) => x.schluessel)
  pruefe('nur der offene Weg mit gemessenem Deutsch trifft', gleich(t as never, ['1|netflix'] as never), t)
}
{
  /* Was der Bau nicht belegen darf (`urteilDarfBelegen`), trifft nicht: Kanal am Prime-Weg, alle Termine des Anbieters gekennzeichnet. */
  const weg = (id: number, platform: string, extra = {}) => titel(id, { streams: [{ platform, url: `u${id}`, ...extra }] as never })
  const titles = [
    weg(20, 'netflix'),
    titel(21, { streams: [{ platform: 'primevideo', url: 'u21', kanal: 'Aniverse' }, { platform: 'netflix', url: 'n21' }] as never }),
    weg(22, 'netflix'),
    weg(23, 'netflix'),
    weg(24, 'netflix', { kanal: 'Aniverse' }),
    weg(25, 'crunchyroll'),
    weg(26, 'primevideo'),
    /* 27: Kanal-Adresse nach der gti-Brücke nur in `seite` (Your Name 21519). */
    weg(27, 'primevideo', { url: 'gti27', seite: 'k27' }),
  ]
  const termin = (titleId: number, platform: string, sprache?: string) => release(titleId, `r${titleId}${platform}${sprache}`, {}, { platform, sprache } as never)
  const releases = [termin(22, 'netflix', 'offen'), termin(22, 'netflix', 'omu'), termin(23, 'netflix', 'offen'), termin(23, 'netflix'), termin(25, 'netflix', 'offen')]
  const urteile = Object.fromEntries(titles.flatMap((x) => x.streams!.map((s) => [`${x.id}|${s.platform}|1`, urteil])))
  const t = treffer('spracheOffenTrotzMeldung', { titles, releases, urteile, kanal: new Set([kanalSchluessel(27, 'k27')]) })
  pruefe('Kanal am Prime-Weg (auch in `seite`) und lauter gekennzeichnete Termine treffen nicht, der Rest schon', gleich(t, [20, 21, 23, 24, 25, 26]), t)
}

console.log('\nKalender-Plausibilität 4: Ereignis ohne News')
{
  const titles = [titel(1), titel(2, { franchiseId: 1 }), ...[3, 4, 5, 6, 7, 8, 9].map((id) => titel(id)), titel(10, { franchiseId: 11 }), titel(11), titel(12), titel(13)]
  const releases = [1, 2, 3, 4, 11, 12].map((id) => release(id, `r${id}`, { firstEpisodeDate: '2026-10-01' }))
  releases.push(release(9, 'r9', { firstEpisodeDate: '2026-07-01' }), release(13, 'r13', { firstEpisodeDate: '2026-08-20' }))
  const teil = { am: '2026-10-01', titelId: 99, meldungen: [{ art: 'neu', teilId: 12 }] } as unknown as NewsEintrag
  const b = {
    titles,
    releases,
    news: [news('2026-09-01', 99), news('2026-10-01', 1), news('2026-10-09', 6, 'folgen'), news('2026-10-06', 8, 'verspaetet'), news('2026-10-01', 10), teil],
    events: [
      ereignis(8, 'v8', '2026-10-05', { verpasst: { erwartetAm: '2026-10-05' } }),
      ereignis(9, 's9', '2026-10-05', { staffelstart: true }),
      ereignis(11, 's11', '2026-10-01', { staffelstart: true }),
      ereignis(12, 's12', '2026-10-01', { staffelstart: true }),
      ereignis(13, 's13', '2026-08-20', { staffelstart: true }),
      ereignis(2, 's2', '2026-10-01', { staffelstart: true }),
      ereignis(3, 's3', '2026-10-01', { staffelstart: true }),
      ereignis(4, 's4', '2026-10-01', { staffelstart: true, estimated: true }),
      ereignis(5, 'v5', '2026-10-05', { verpasst: { erwartetAm: '2026-10-05' } }),
      ereignis(6, 'c6', '2026-10-08', { platform: 'crunchyroll', episode: 3 }),
      ereignis(7, 'c7', '2026-10-08', { platform: 'crunchyroll', episode: 3 }),
      ereignis(7, 'c7b', '2026-10-15', { platform: 'crunchyroll', episode: 4 }),
      ereignis(7, 'c7c', '2026-09-10', { platform: 'crunchyroll', episode: 1 }),
    ],
  }
  const ids = treffer('ereignisOhneNews', b)
  pruefe('Start ohne Meldung, ausgebliebene Folge, Crunchyroll-Folge ohne Meldung treffen', gleich(ids, [3, 5, 7]), ids)
  pruefe('Meldung der Reihe oder eines Teils, geschätzter Start, Start innerhalb eines Termins, gemeldete Verspätung und Folge (ein Tag Versatz), Folge von gestern, vor dem News- oder Folgenfenster treffen nicht', ids.length === 3, ids)
}

console.log('\nKalender-Plausibilität 5: Termin ohne Quelle')
{
  const ids = treffer('terminOhneBeleg', { titles: [titel(1), titel(2)], releases: [release(1, 'r1', {}, { sources: [] }), release(2, 'r2', {})] })
  pruefe('Termin ohne sources trifft, mit Quelle nicht', gleich(ids, [1]), ids)
}

console.log('\nKalender-Plausibilität 6: Prime-Termin nur mit Amazon-Suche')
{
  const such = 'https://www.amazon.de/s?k=Test&i=instant-video'
  const seite = 'https://www.amazon.de/dp/B0HKCYH1C6'
  const prime = (id: number, platformUrl?: string, extra: Partial<Release> = {}) => release(id, `p${id}`, {}, { platform: 'primevideo', releaseType: 'weekly', platformUrl, ...extra } as never)
  const releases = [
    prime(1, seite),
    prime(2, such),
    prime(3, undefined),
    prime(4, such, { releaseType: 'disc' } as never),
    prime(5, seite),
    prime(6, 'https://www.amazon.de/gp/video/detail/B0HG69RT1Y'),
    release(7, 'n7', {}, { platform: 'netflix', releaseType: 'weekly', platformUrl: 'https://www.netflix.com/search?q=x' } as never),
    prime(8, such, { releaseType: 'movie' } as never),
    prime(9, seite),
    prime(10, 'https://www.amazon.de/s/ref=nb_sb_noss?k=Test'),
    release(11, 'd11', {}, { platform: 'disneyplus', releaseType: 'weekly', platformUrl: 'https://www.disneyplus.com/search?q=x' } as never),
    prime(12, seite),
  ]
  const ids = treffer('primeOhneTitelseite', { titles: [titel(2, { titleDe: 'Zwei' })], releases })
  pruefe('Prime-Termine mit Suchadresse treffen (Serie und Film, beide Suchformen: /s?k= und /s/ref=…?k=)', gleich(ids, [2, 8, 10]), ids)
  pruefe('Titelseite, fehlende Adresse, Disc-Suche und fremde Anbieter (Netflix, Disney+ mit Suchlink) treffen nicht', !ids.some((id) => [1, 3, 4, 5, 6, 7, 9, 11, 12].includes(id)), ids)
  const text = plausibilitaet({ titles: [titel(2, { titleDe: 'Zwei' })], releases, events: [], news: [], urteile: {}, kanal: new Set(), heute: HEUTE }).primeOhneTitelseite[0]!
  pruefe('der Treffer nennt Titel und Termin', text.schluessel === 'p2' && text.text.includes('Zwei') && text.text.includes('p2'), text)
}

console.log('\nKalender-Plausibilität: Wächter „Treffer dürfen nur sinken“ (Kulisse)')
{
  const t = (schluessel: string): Treffer => ({ titleId: 1, schluessel, text: schluessel })
  const leer = () => Object.fromEntries(REGELN.map((r) => [r, [] as Treffer[]])) as TrefferJeRegel
  const grenzen: Grenzen = { _hinweis: 'x', vorkommen: { terminOhneBeleg: 2 }, bekannt: { terminOhneBeleg: ['a', 'b'] } }
  const mit = (...s: string[]) => ({ ...leer(), terminOhneBeleg: s.map(t) })
  const dir = mkdtempSync(join(tmpdir(), 'plausi-'))
  const datei = join(dir, 'grenzen.json')
  const vorher = JSON.stringify(grenzen)
  writeFileSync(datei, vorher)

  pruefe('gleiche Zahl ist grün', !ueberschreitungen(mit('a', 'b'), grenzen).length)
  const rot = ueberschreitungen(mit('a', 'b', 'c'), grenzen)
  pruefe('ein Treffer mehr ist rot und nennt nur den neuen Schlüssel', rot.length === 1 && rot[0].includes('c') && !rot[0].includes('a —'), rot)
  pruefe('Festschreiben bei Anstieg lehnt ab und lässt die Datei unverändert', festschreiben(mit('a', 'b', 'c'), grenzen, datei).length === 1 && readFileSync(datei, 'utf8') === vorher)
  pruefe('Festschreiben bei Senkung übernimmt Zahl und Schlüssel', festschreiben(mit('a'), grenzen, datei).length === 0)
  const neu = JSON.parse(readFileSync(datei, 'utf8')) as Grenzen
  pruefe('die Datei trägt die gesenkte Zahl und den verbliebenen Schlüssel', neu.vorkommen.terminOhneBeleg === 1 && gleichS(neu.bekannt.terminOhneBeleg, ['a']), neu)
  rmSync(dir, { recursive: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nKalender-Plausibilität: alle Zusicherungen erfüllt.')
