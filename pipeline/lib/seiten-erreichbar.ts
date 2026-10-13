/**
 * Welche Seiten von `dist/` erreicht ein Crawler von der Startseite aus, und nach wie vielen Klicks?
 * Gefolgt wird nur `<a href>` auf Adressen der eigenen Seite, deren Datei in `dist/` liegt (kein JavaScript, kein `#`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Pfad der Seite ohne führenden/abschließenden Schrägstrich ('' = Startseite) → Datei in `dist/`. */
function seitenDatei(dist: string, pfad: string): string {
  return resolve(dist, pfad, 'index.html')
}

/** Die Pfade, auf die ein Link der Seite zeigt (nur eigene Seite, ohne Anker und Suchteil). */
export function eigeneLinks(html: string, site: string): string[] {
  const pfade = new Set<string>()
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = m[1]!
    if (!href.startsWith(site)) continue
    pfade.add(href.slice(site.length).split(/[#?]/)[0]!.replace(/\/$/, ''))
  }
  return [...pfade]
}

/** Breitensuche ab der Startseite: Pfad → kleinste Klickzahl. */
export function erreichbar(dist: string, site: string, maxKlicks = 4): Map<string, number> {
  const klicks = new Map<string, number>([['', 0]])
  let rand = ['']
  for (let stufe = 1; stufe <= maxKlicks && rand.length; stufe++) {
    const naechste: string[] = []
    for (const pfad of rand) {
      const datei = seitenDatei(dist, pfad)
      if (!existsSync(datei)) continue
      for (const ziel of eigeneLinks(readFileSync(datei, 'utf8'), site)) {
        if (klicks.has(ziel) || !existsSync(seitenDatei(dist, ziel))) continue
        klicks.set(ziel, stufe)
        naechste.push(ziel)
      }
    }
    rand = naechste
  }
  return klicks
}
