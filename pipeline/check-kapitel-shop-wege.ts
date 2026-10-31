/**
 * Zusicherung zu „Crown Handler 3 zeigt maxdome/freenet über TMDB auf Chapter 2" (Daniel, 31.10.2026).
 * Die Eingaben stehen wörtlich so in `public/data/titles.json` (Stand 31.10.2026, Kennungen 137612, 15201, 101595, 2418, 10011613).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-kapitel-shop-wege.ts`
 */
import type { Title, WatchLink } from '../shared/types.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { loadWatchLinks } from './lib/curated.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import { entferneKapitelShopWege, kapitelNummer, kapitelShopFehler } from './lib/kapitel-shop-wege.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tmdb = (name: string, adresse: string): WatchLink =>
  ({ name, url: `https://www.themoviedb.org/movie/${adresse}/watch?locale=DE`, kind: 'stream', zugang: 'kauf', ueberTmdb: true }) as WatchLink
const beide = (adresse: string): WatchLink[] => [tmdb('maxdome', adresse), tmdb('freenet meinVOD', adresse)]
const titel = (id: number, namen: Partial<Title>, wege: WatchLink[], format = 'MOVIE'): Title =>
  ({ id, format, streams: [], keywords: [], genres: [], watchLinks: wege, ...namen }) as unknown as Title
const direkt = { name: 'maxdome', url: 'https://store.maxdome.de/princess-principal-crown-handler-chapter-1-mo45184708', kind: 'stream' } as WatchLink

const namen = (t: Title): string => (t.watchLinks ?? []).map((w) => w.name).join()
const fall = () => ({
  ch3: titel(137612, { titleDe: 'Princess Principal: Crown Handler 3' }, beide('893250-crown-handler-3')),
  akito4: titel(15201, { titleEn: 'Code Geass: Akito the Exiled - Memories of Hatred' }, beide('347187-4')),
  ch1: titel(101595, { titleEn: 'Princess Principal: ~Crown Handler~ 1' }, [direkt, tmdb('freenet meinVOD', '542507-crown-handler-1')]),
  schwert: titel(2418, { titleEn: 'Sword of the Stranger' }, beide('13980')),
  sam: titel(10011613, { titleDe: 'Sam: Ein fast perfekter Held' }, [tmdb('maxdome', '385722-bling')]),
  serie: titel(9000030, { titleEn: 'Beispielserie 2' }, beide('1234-beispielserie-2'), 'TV'),
  yt: titel(9000031, { titleEn: 'Film 3' }, [tmdb('YouTube', '555-film-3')]),
})

console.log('\nNummern aus Namen und TMDB-Kürzel:')
{
  const leer = {}
  pruefe('„Crown Handler 3" im Namen -> 3', kapitelNummer({ titleDe: 'Princess Principal: Crown Handler 3' }, '') === 3)
  pruefe('„Chapter 2" am Ende -> 2', kapitelNummer({ titleEn: 'X Chapter 2' }, '') === 2)
  pruefe('ohne Nummer im Namen, TMDB-Kürzel „347187-4" -> 4', kapitelNummer(leer, 'https://www.themoviedb.org/movie/347187-4/watch?locale=DE') === 4)
  pruefe('TMDB-Kürzel „893250-crown-handler-3" -> 3', kapitelNummer(leer, 'https://www.themoviedb.org/movie/893250-crown-handler-3/watch?locale=DE') === 3)
  pruefe('Kürzel „385722-bling" -> keine Nummer', kapitelNummer(leer, 'https://www.themoviedb.org/movie/385722-bling/watch?locale=DE') === null)
  pruefe('Kürzel ohne Wort „13980" -> keine Nummer', kapitelNummer({ titleEn: 'Sword of the Stranger' }, 'https://www.themoviedb.org/movie/13980/watch?locale=DE') === null)
}

console.log('\nentferneKapitelShopWege:')
{
  const f = fall()
  const weg = entferneKapitelShopWege(Object.values(f))
  pruefe('Crown Handler 3: maxdome und freenet über TMDB fallen weg', namen(f.ch3) === '', namen(f.ch3))
  pruefe('Akito 4 (Nummer nur im TMDB-Kürzel): beide fallen weg', namen(f.akito4) === '', namen(f.akito4))
  pruefe('Crown Handler 1: direkter maxdome-Weg bleibt, freenet über TMDB fällt', namen(f.ch1) === 'maxdome', namen(f.ch1))
  pruefe('Film ohne Nummer behält beide Wege', namen(f.schwert) === 'maxdome,freenet meinVOD', namen(f.schwert))
  pruefe('„Sam" (Kürzel ohne Nummer) behält maxdome', namen(f.sam) === 'maxdome', namen(f.sam))
  pruefe('Serie (TV) mit Nummer im Namen behält beide Wege', namen(f.serie) === 'maxdome,freenet meinVOD', namen(f.serie))
  pruefe('anderer Anbieter (YouTube) bei nummeriertem Film bleibt', namen(f.yt) === 'YouTube', namen(f.yt))
  pruefe('Zählung: 5 verworfene Wege, mit Nummern 3, 4, 3, 4, 1', weg.map((v) => v.nummer).join() === '3,3,4,4,1', weg.map((v) => v.nummer))
}

console.log('\nkapitelShopFehler (Zusicherung für den Bau):')
{
  const f = fall()
  const fehler = kapitelShopFehler([f.ch3, f.sam])
  pruefe('meldet beide Wege von Chapter 3', fehler.length === 2 && fehler.every((m) => m.includes('137612')), fehler)
  pruefe('verändert die Titel nicht', namen(f.ch3) === 'maxdome,freenet meinVOD', namen(f.ch3))
  pruefe('sauberer Bestand meldet nichts', kapitelShopFehler([f.schwert, f.serie]).length === 0)
}

suchadressenInTemp()

/** Lässt den echten Abschluss laufen (Wege aus JustWatch, Bereinigung, Zusicherung am Ende). */
function abschluss(titles: Title[]): void {
  schliesseWegeAb({
    titles: new Map(titles.map((t) => [t.id, t])),
    anisearch: {},
    releases: [],
    zugangJeAdresse: new Map(),
    tmdbMehrdeutig: new Set(),
    toteAdressen: new Set(),
    linkBefunde: {},
    verweiseEntfernt: [],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
    alleChecks: [],
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
}

console.log('\nschliesseWegeAb ruft die Regel auf:')
{
  const f = fall()
  abschluss([f.ch3, f.ch1, f.schwert])
  pruefe('Chapter 3 ohne Telekom-Wege nach dem Abschluss', namen(f.ch3) === '', namen(f.ch3))
  pruefe('Chapter 1 behält den direkten Weg, verliert den TMDB-Weg', namen(f.ch1) === 'maxdome', namen(f.ch1))
  pruefe('Film ohne Nummer behält maxdome und freenet', namen(f.schwert).startsWith('maxdome,freenet meinVOD'), namen(f.schwert))
}

console.log('\nHandpflege der Crown-Handler-Adressen (data/watch-links.yaml):')
{
  const eintraege = loadWatchLinks()
  const ch = (id: number) => eintraege.find((e) => e.anilistId === id)?.links ?? []
  pruefe('Chapter 1: maxdome-Adresse mit Kapitel 1 im Namen', ch(101595).some((l) => l.name === 'maxdome' && l.url.endsWith('chapter-1-mo45184708') && l.ersetzt === true))
  pruefe('Chapter 2: maxdome und freenet mit Kapitel-2-Kennung', ch(129759).map((l) => l.url).join() === 'https://store.maxdome.de/mo45184724,https://shop.freenet-video.de/princess-principal-crown-handler-chapter-2-mo45184734', ch(129759))
  pruefe('Chapter 3 trägt keinen Handweg', ch(137612).length === 0)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
