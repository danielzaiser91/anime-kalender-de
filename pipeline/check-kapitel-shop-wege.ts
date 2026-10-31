/**
 * Zusicherung zu „Crown Handler 3 zeigt maxdome/freenet über TMDB auf Chapter 2" (Daniel, 31.10.2026).
 * Die Eingaben stehen wörtlich so in `public/data/titles.json` (Stand 31.10.2026, Kennungen 137612, 15201, 101595).
 * Verworfen wird nur, was die Handliste mit Beleg nennt (Crown Handler 3 bis 6); Code Geass Akito 4 und 5 und Crown Handler 1 freenet bleiben.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-kapitel-shop-wege.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title, WatchLink } from '../shared/types.ts'
import { verwirfKapitelShopWege } from './bau/11-9-kapitel-shop.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { main as bestandMain } from './check-shop-wege-falsches-ziel-bestand.ts'
import { loadWatchLinks } from './lib/curated.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import { entferneKapitelShopWege, ladeShopWegeFalsch, type ShopWegFalsch } from './lib/kapitel-shop-wege.ts'

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
const direkt = (adresse: string): WatchLink => ({ name: 'maxdome', url: adresse, kind: 'stream' }) as WatchLink
const CH1 = 'https://store.maxdome.de/princess-principal-crown-handler-chapter-1-mo45184708'

const namen = (t: Title): string => (t.watchLinks ?? []).map((w) => w.name).join()
const fall = () => ({
  ch3: titel(137612, { titleDe: 'Princess Principal: Crown Handler 3' }, beide('893250-crown-handler-3')),
  ch3Direkt: titel(137612, { titleDe: 'Princess Principal: Crown Handler 3' }, [direkt('https://store.maxdome.de/mo1'), tmdb('YouTube', '893250-crown-handler-3')]),
  ch4: titel(186716, { titleDe: 'Princess Principal: Crown Handler 4' }, beide('1438229-crown-handler-4')),
  akito4: titel(15201, { titleEn: 'Code Geass: Akito the Exiled - Memories of Hatred' }, beide('347187-4')),
  akito5: titel(21178, { titleEn: 'Code Geass: Akito the Exiled - To The Beloved' }, beide('372751-5')),
  ch1: titel(101595, { titleEn: 'Princess Principal: ~Crown Handler~ 1' }, [direkt(CH1), tmdb('freenet meinVOD', '542507-crown-handler-1')]),
  golgo: titel(9000040, { titleEn: 'Golgo 13' }, beide('9999-golgo-13')),
  jjk0: titel(9000041, { titleEn: 'Jujutsu Kaisen 0' }, beide('9998-jujutsu-kaisen-0')),
})

/* Soll fest eingetragen (Beleg: Daniel, 31.10.2026), nicht aus der Datei gelesen. */
console.log('\nHandliste data/shop-wege-falsches-ziel.yaml:')
const liste = ladeShopWegeFalsch()
{
  pruefe('genau Crown Handler 3 bis 6', liste.map((e) => e.anilistId).join() === '137612,186716,204584,204585', liste.map((e) => e.anilistId))
  pruefe('je Eintrag maxdome und freenet meinVOD', liste.every((e) => e.anbieter.join() === 'maxdome,freenet meinVOD'))
  pruefe('je Eintrag Beleg und Datum', liste.every((e) => e.beleg.length > 10 && e.belegtAm === '2026-10-31'))
  pruefe('Code Geass Akito 4 und 5 stehen nicht darauf', !liste.some((e) => e.anilistId === 15201 || e.anilistId === 21178))
}

console.log('\nentferneKapitelShopWege:')
{
  const f = fall()
  const weg = entferneKapitelShopWege([f.ch3, f.ch4, f.akito4, f.akito5, f.ch1, f.golgo, f.jjk0], liste)
  pruefe('Crown Handler 3: maxdome und freenet fallen weg', namen(f.ch3) === '', namen(f.ch3))
  pruefe('Crown Handler 4: ebenso', namen(f.ch4) === '', namen(f.ch4))
  pruefe('Akito 4 behält beide Wege', namen(f.akito4) === 'maxdome,freenet meinVOD', namen(f.akito4))
  pruefe('Akito 5 behält beide Wege', namen(f.akito5) === 'maxdome,freenet meinVOD', namen(f.akito5))
  pruefe('Crown Handler 1 behält direkten maxdome-Weg und freenet über TMDB', namen(f.ch1) === 'maxdome,freenet meinVOD', namen(f.ch1))
  pruefe('„Golgo 13" und „Jujutsu Kaisen 0" bleiben unberührt', namen(f.golgo) === 'maxdome,freenet meinVOD' && namen(f.jjk0) === 'maxdome,freenet meinVOD')
  pruefe('Zählung: 4 verworfene Wege, Kennungen 137612 und 186716', weg.map((v) => v.id).join() === '137612,137612,186716,186716', weg.map((v) => v.id))
  const g = fall()
  entferneKapitelShopWege([g.ch3Direkt], liste)
  pruefe('Kennung auf der Liste: direkte Adresse bleibt, Anbieter außerhalb der Liste (YouTube) bleibt', g.ch3Direkt.watchLinks?.map((w) => w.name).join() === 'maxdome,YouTube', namen(g.ch3Direkt))
  const h = fall()
  entferneKapitelShopWege([h.ch3], [{ ...liste[0], anbieter: ['maxdome'] }])
  pruefe('Liste nennt nur maxdome: freenet bleibt', namen(h.ch3) === 'freenet meinVOD', namen(h.ch3))
  const i = fall()
  entferneKapitelShopWege([i.ch3], [{ ...liste[0], anilistId: 1 }])
  pruefe('andere Kennung auf der Liste: nichts fällt', namen(i.ch3) === 'maxdome,freenet meinVOD', namen(i.ch3))
}

console.log('\nverwirfKapitelShopWege (Zählzeile):')
{
  const f = fall()
  const zeilen: string[] = []
  const zeile = verwirfKapitelShopWege(new Map([[137612, f.ch3], [186716, f.ch4]]), liste, (z) => zeilen.push(z))
  pruefe('meldet genau eine Zeile', zeilen.length === 1 && zeilen[0] === zeile, zeilen)
  pruefe('Zeile nennt Zahl 4, beide Titel und beide Anbieter', zeile.startsWith('4 Telekom-Shop-Wege') && zeile.includes('Crown Handler 3 (137612): maxdome') && zeile.includes('Crown Handler 4 (186716): freenet meinVOD'), zeile)
  const leer: string[] = []
  const ohne = verwirfKapitelShopWege(new Map([[15201, fall().akito4]]), liste, (z) => leer.push(z))
  pruefe('nichts verworfen: keine Zeile, leere Rückgabe', leer.length === 0 && ohne === '', { leer, ohne })
}

console.log('\nBestandswache (Wegwerf-Wurzel):')
{
  const wurzel = mkdtempSync(join(tmpdir(), 'shop-wege-'))
  const schreibe = (titelListe: unknown[], yaml: string): void => {
    mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titelListe))
    writeFileSync(join(wurzel, 'data', 'shop-wege-falsches-ziel.yaml'), yaml)
  }
  const gut = '- anilistId: 137612\n  title: X\n  anbieter: [maxdome]\n  beleg: Beleg\n  belegtAm: "2026-10-31"\n'
  const f = fall()
  try {
    schreibe([f.ch3, f.akito4], gut)
    pruefe('Weg der Liste noch im Bestand: Exit 1', bestandMain(wurzel) === 1)
    schreibe([titel(137612, {}, [tmdb('freenet meinVOD', 'x-3')]), f.akito4], gut)
    pruefe('nur ein Anbieter außerhalb der Liste: Exit 0', bestandMain(wurzel) === 0)
    schreibe([titel(137612, {}, [direkt('https://store.maxdome.de/mo1')])], gut)
    pruefe('direkte Adresse beim Anbieter der Liste: Exit 0', bestandMain(wurzel) === 0)
    schreibe([f.akito4], gut)
    pruefe('Titel der Liste fehlt im Bestand: Warnung, Exit 0', bestandMain(wurzel) === 0)
    schreibe([f.ch3], '[]\n')
    pruefe('leere Liste: Exit 1', bestandMain(wurzel) === 1)
    schreibe([f.akito4], gut.replace('belegtAm: "2026-10-31"', ''))
    pruefe('Eintrag ohne Datum zählt nicht, Liste leer: Exit 1', bestandMain(wurzel) === 1)
    schreibe([f.akito4], gut.replace('beleg: Beleg', ''))
    pruefe('Eintrag ohne Beleg zählt nicht, Liste leer: Exit 1', bestandMain(wurzel) === 1)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

suchadressenInTemp()

/** Lässt den echten Abschluss laufen (Wege aus JustWatch, Bereinigung). */
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
  abschluss([f.ch3, f.ch1, f.akito4])
  pruefe('Chapter 3 ohne Telekom-Wege nach dem Abschluss', namen(f.ch3) === '', namen(f.ch3))
  pruefe('Chapter 1 behält direkten maxdome-Weg und freenet', namen(f.ch1).startsWith('maxdome,freenet meinVOD'), namen(f.ch1))
  pruefe('Akito 4 behält maxdome und freenet', namen(f.akito4).startsWith('maxdome,freenet meinVOD'), namen(f.akito4))
}

console.log('\nHandpflege Chapter 2 (watch-links.yaml):')
{
  const ch2 = loadWatchLinks().filter((e) => e.anilistId === 129759).flatMap((e) => e.links ?? [])
  pruefe('freenet meinVOD mit Kapitel-2-Kennung, ersetzt den TMDB-Weg', ch2.some((l) => l.name === 'freenet meinVOD' && l.url === 'https://shop.freenet-video.de/princess-principal-crown-handler-chapter-2-mo45184734' && l.ersetzt === true), ch2)
  pruefe('Chapter 3 trägt keinen Handweg', loadWatchLinks().every((e) => e.anilistId !== 137612))
}

const typ: ShopWegFalsch[] = liste
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : `\nAlle Zusicherungen halten (${typ.length} Handlisten-Einträge).`)
process.exit(verletzt ? 1 : 0)
