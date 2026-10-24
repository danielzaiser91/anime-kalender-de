/**
 * Prüft nach dem Seitenbau (`dist/`): Jeder Titel, für den der Teilen-Knopf eine Adresse nennt,
 * hat unter `dist/t/<Slug>/` eine Seite mit og:title, og:description, og:image und canonical.
 * Titel ohne Seite (Katalog ohne Synchro) bekommen keinen Knopf (`teilbarerSlug`), nie einen toten Link.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cartoonMitSynchroBeleg, teilbarerSlug, teilenPfad } from '../shared/teilen.ts'
import type { Title } from '../shared/types.ts'
import { synchroBelegt } from '../shared/titles.ts'
import { todayIso } from '../shared/time.ts'
import { ROOT } from './lib/util.ts'
import { erreichbar } from './lib/seiten-erreichbar.ts'
import { SITE } from './lib/titel-seite.ts'
import { iconMaengel } from '../tools/icon-kennung.mjs'

const MAX_KLICKS = 3

const DIST = resolve(ROOT, 'dist')
const PFLICHT = ['og:title', 'og:description', 'og:url']

function lies<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(DIST, 'data', name), 'utf8')) as T
}

/** Alle Titelquellen, aus denen die Oberfläche einen Teilen-Knopf bilden kann, mit Art zur Zählung. */
function quellen(): [string, Title[]][] {
  const woche = lies<{ titles: Title[] }>('woche.json').titles
  const cartoons = lies<Title[]>('cartoons.json')
  const nurKern = [...lies<Title[]>('titles-core.json'), ...woche].filter((t) => t.id > 0)
  const nurCartoonKern = [...lies<Title[]>('titles-core.json'), ...woche].filter((t) => t.id < 0)
  return [
    ['Hauptbestand', [...lies<Title[]>('titles.json'), ...nurKern]],
    ['Cartoons', [...cartoons, ...nurCartoonKern]],
    ['Katalog ohne Synchro', lies<Title[]>('ohne-synchro.json')],
  ]
}

function mangel(slug: string): string | undefined {
  if (!/^-?[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return `Adresse nicht ASCII/klein: ${slug}`
  const datei = resolve(DIST, teilenPfad(slug), 'index.html')
  if (!existsSync(datei)) return `Seite fehlt: ${teilenPfad(slug)}`
  const html = readFileSync(datei, 'utf8')
  const fehlend = PFLICHT.filter((m) => !html.includes(`property="${m}" content="`))
  if (!/property="og:image" content="https:\/\/[^"]+"/.test(html)) fehlend.push('og:image')
  if (!html.includes(`href="https://`) || !html.includes('rel="canonical"')) fehlend.push('canonical')
  /* Rücklink zur Startseite und Brotkrumen auf jeder Titelseite (nicht auf den Weiterleitungen). */
  if (!html.includes('"@type":"BreadcrumbList"')) fehlend.push('BreadcrumbList')
  if (!html.includes(`<nav aria-label="Brotkrumen"`) || !html.includes(`<a href="${SITE}"`)) fehlend.push('Brotkrumen mit Link zur Startseite')
  return fehlend.length ? `${teilenPfad(slug)} ohne ${fehlend.join(', ')}` : undefined
}

/** Eine Seite ohne belegte Synchro sagt weder „mit deutscher Synchronisation“ noch `inLanguage: de` (nichts behaupten, was nicht belegt ist). */
function synchroZusageMangel(slug: string): string | undefined {
  const html = readFileSync(resolve(DIST, teilenPfad(slug), 'index.html'), 'utf8')
  const zusagen = [
    html.includes('Alle Termine mit deutscher Synchronisation') ? 'Überschrift „mit deutscher Synchronisation“' : '',
    html.includes('"inLanguage":"de"') ? 'inLanguage de' : '',
  ].filter(Boolean)
  return zusagen.length ? `${teilenPfad(slug)}: Synchro nicht belegt, aber ${zusagen.join(' und ')}` : undefined
}

/** Die Sitemap nennt Cartoon-Seiten genau dann, wenn ihre deutsche Synchro belegt ist (`dub: true`), nicht schon „laut JustWatch“. */
function sitemapMaengel(): string[] {
  const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8')
  const cartoons = lies<Title[]>('cartoons.json').filter((t) => t.slug)
  const mangel = cartoons
    .filter((t) => sitemap.includes(`/${teilenPfad(t.slug)}<`) !== cartoonMitSynchroBeleg(t))
    .map((t) => `Sitemap und Synchro-Beleg widersprechen sich: ${teilenPfad(t.slug)}`)
  console.log(`[teilseiten] Sitemap: ${cartoons.filter(cartoonMitSynchroBeleg).length} von ${cartoons.length} Cartoon-Seiten, ${mangel.length} Abweichungen`)
  return mangel
}

/** `lastmod` der Titelseiten stammt aus Daten: nie nach heute, und nicht überall derselbe Tag. */
function lastmodMaengel(): string[] {
  const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8')
  const stempel = [...sitemap.matchAll(/<loc>[^<]*\/t\/[^<]+<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]!)
  const heute = todayIso()
  const tage = new Set(stempel)
  console.log(`[teilseiten] lastmod: ${stempel.length} Titelseiten mit Datum, ${tage.size} verschiedene Tage`)
  const mangel: string[] = []
  if (stempel.some((d) => d > heute)) mangel.push('Sitemap: lastmod in der Zukunft')
  if (stempel.length > 20 && tage.size < 2) mangel.push(`Sitemap: alle ${stempel.length} Titelseiten mit demselben lastmod ${[...tage][0]}`)
  return mangel
}

/** Die gebaute Startseite trägt den Suchbegriff in Titel, Überschrift und Text. */
function startseitenMaengel(): string[] {
  const html = readFileSync(resolve(DIST, 'index.html'), 'utf8')
  const titel = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? ''
  const mangel: string[] = []
  if (!titel.includes('Deutscher Anime-Kalender')) mangel.push(`Startseite: <title> ohne „Deutscher Anime-Kalender“: ${titel}`)
  if (!/<h1[^>]*>Deutscher Anime-Kalender<\/h1>/.test(html)) mangel.push('Startseite: Überschrift „Deutscher Anime-Kalender“ fehlt im ausgelieferten HTML')
  if (!html.includes('deutsche Anime-Kalender zeigt')) mangel.push('Startseite: Einleitungstext fehlt im ausgelieferten HTML')
  return mangel
}

/** Jede Titelseite der Sitemap ist von der Startseite aus über Links erreichbar (höchstens 3 Klicks), ohne JavaScript. */
function erreichbarkeitsMaengel(): string[] {
  const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8')
  const adressen = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!).filter((u) => u.startsWith(`${SITE}t/`))
  const klicks = erreichbar(DIST, SITE, MAX_KLICKS)
  const mangel = adressen.filter((u) => !klicks.has(u.slice(SITE.length).replace(/\/$/, '')))
  console.log(`[teilseiten] Erreichbarkeit: ${adressen.length - mangel.length} von ${adressen.length} Titelseiten der Sitemap in höchstens ${MAX_KLICKS} Klicks von der Startseite`)
  return mangel.map((u) => `Von der Startseite nicht erreichbar (Verzeichnis fehlt?): ${u}`)
}

/** Die Sammelseite führt auch Termine ohne belegte Synchro und verspricht deshalb nie „mit deutscher Synchro“. */
function uebersichtMaengel(): string[] {
  const html = readFileSync(resolve(DIST, 'termine', 'index.html'), 'utf8')
  return /mit deutscher Synchro/i.test(html) ? ['/termine/ verspricht „mit deutscher Synchro“, führt aber Termine ohne belegte Synchro'] : []
}

/** Icon-Adressen in Startseite, Sammelseite, einer Titelseite, 404 und Manifest tragen `?v=` passend zum Dateiinhalt. */
function iconAdressMaengel(): string[] {
  const titelSeite = readdirSync(resolve(DIST, 't')).sort()[0]
  const seiten = ['index.html', 'termine/index.html', `t/${titelSeite}/index.html`, '404.html', 'manifest.webmanifest']
  const mangel = seiten.flatMap((s) => iconMaengel(readFileSync(resolve(DIST, s), 'utf8'), DIST, s))
  console.log(`[teilseiten] Icon-Adressen: ${seiten.length} Dateien geprüft, ${mangel.length} ohne passendes ?v=`)
  return mangel
}

function main(): void {
  const fehler: string[] = [...startseitenMaengel(), ...erreichbarkeitsMaengel(), ...lastmodMaengel(), ...uebersichtMaengel(), ...iconAdressMaengel()]
  for (const [art, titel] of quellen()) {
    const teilbar = new Map(titel.map((t) => [t.id, teilbarerSlug(t)]))
    const mitSlug = [...teilbar.values()].filter((s): s is string => s !== undefined)
    const schlecht = mitSlug.map(mangel).filter((m): m is string => m !== undefined)
    console.log(`[teilseiten] ${art}: ${teilbar.size} Titel, ${mitSlug.length} mit Knopf, ${schlecht.length} ohne gültige Seite`)
    fehler.push(...schlecht)
    const unbelegt = titel.filter((t) => !synchroBelegt(t)).map((t) => teilbar.get(t.id)).filter((s): s is string => s !== undefined && existsSync(resolve(DIST, teilenPfad(s), 'index.html')))
    const zusagen = unbelegt.map(synchroZusageMangel).filter((m): m is string => m !== undefined)
    console.log(`[teilseiten] ${art}: ${unbelegt.length} Seiten ohne belegte Synchro, ${zusagen.length} mit Synchro-Zusage`)
    fehler.push(...zusagen)
  }
  fehler.push(...sitemapMaengel())
  if (fehler.length) {
    console.error(`[teilseiten] ${fehler.length} Fehler, die ersten:\n${fehler.slice(0, 15).join('\n')}`)
    process.exit(1)
  }
}

main()
