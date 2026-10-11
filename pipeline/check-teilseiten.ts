/**
 * Prüft nach dem Seitenbau (`dist/`): Jeder Titel, für den der Teilen-Knopf eine Adresse nennt,
 * hat unter `dist/t/<Slug>/` eine Seite mit og:title, og:description, og:image und canonical.
 * Titel ohne Seite (Katalog ohne Synchro) bekommen keinen Knopf (`teilbarerSlug`), nie einen toten Link.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { teilbarerSlug, teilenPfad } from '../shared/teilen.ts'
import type { Title } from '../shared/types.ts'
import { ROOT } from './lib/util.ts'

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
  return fehlend.length ? `${teilenPfad(slug)} ohne ${fehlend.join(', ')}` : undefined
}

function main(): void {
  const fehler: string[] = []
  for (const [art, titel] of quellen()) {
    const teilbar = new Map(titel.map((t) => [t.id, teilbarerSlug(t)]))
    const mitSlug = [...teilbar.values()].filter((s): s is string => s !== undefined)
    const schlecht = mitSlug.map(mangel).filter((m): m is string => m !== undefined)
    console.log(`[teilseiten] ${art}: ${teilbar.size} Titel, ${mitSlug.length} mit Knopf, ${schlecht.length} ohne gültige Seite`)
    fehler.push(...schlecht)
  }
  if (fehler.length) {
    console.error(`[teilseiten] ${fehler.length} Fehler, die ersten:\n${fehler.slice(0, 15).join('\n')}`)
    process.exit(1)
  }
}

main()
