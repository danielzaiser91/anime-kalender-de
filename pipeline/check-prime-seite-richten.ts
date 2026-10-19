/**
 * Zusicherungen: Ein Prime-Weg wird mit `url` und `seite` gerichtet, und der Kanal findet ihn auch über `seite`
 * (Deploy 18.10.2026: `/dp/` in der Prüfliste der Erweiterung, Blue Giant ohne „aniverse"). Erfundene Wege, kein Netz.
 */
import { readFileSync } from 'node:fs'
import type { StreamLink } from '../shared/types.ts'
import { richtePrimeWeg } from './bau/13-1-prime-richten.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const GTI = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.4c1cc6d9-a6ed-4b7a-ae11-1f5a8c442ed0'
const weg = (extra: Partial<StreamLink>): StreamLink => ({ platform: 'primevideo', url: GTI, ...extra }) as StreamLink
const kanaele = new Map<string, string | undefined>([['amazon:b0d3xz42t9', 'aniverse']])

const bruecke = weg({ seite: 'https://www.amazon.de/dp/B0D3XZ42T9' })
const n = richtePrimeWeg(bruecke, kanaele)
pruefe('gti-Brücke: `seite` wird unter /gp/video/detail/ gerichtet', bruecke.seite === 'https://www.amazon.de/gp/video/detail/B0D3XZ42T9', bruecke)
pruefe('gti-Brücke: die gti-Adresse in `url` bleibt', bruecke.url === GTI, bruecke)
pruefe('gti-Brücke: der Kanal kommt über `seite` (Blue Giant)', bruecke.kanal === 'aniverse', bruecke)
pruefe('Gerichtete Adressen werden gezählt', n === 1, n)

const beide = weg({ url: 'https://www.amazon.de/dp/B0D3XZ42T9', seite: 'https://www.amazon.de/dp/B0D3XZ42T9?ref=x' })
pruefe('url und seite beide gerichtet, Zahl 2', richtePrimeWeg(beide, kanaele) === 2 && !/\/dp\//.test(`${beide.url} ${beide.seite}`), beide)

const ohneSeite = weg({})
pruefe('Ohne `seite`: nichts erfunden, kein Kanal', richtePrimeWeg(ohneSeite, kanaele) === 0 && ohneSeite.seite === undefined && ohneSeite.kanal === undefined, ohneSeite)

const andere = weg({ seite: 'https://www.amazon.de/dp/B0AAAAAAAA' })
richtePrimeWeg(andere, kanaele)
pruefe('Fremde ASIN: kein Kanal', andere.kanal === undefined, andere)

const eigener = weg({ url: 'https://www.amazon.de/dp/B0D3XZ42T9', seite: 'https://www.amazon.de/dp/B0AAAAAAAA' })
richtePrimeWeg(eigener, kanaele)
pruefe('Kanal über `url` hat Vorrang vor `seite`', eigener.kanal === 'aniverse', eigener)

const quelle = readFileSync(new URL('./bau/13-1-anreichern.ts', import.meta.url), 'utf8')
pruefe('13-1-anreichern ruft richtePrimeWeg(s, kanalJeAdresse) für jeden Prime-Weg', quelle.includes('gerichtet += richtePrimeWeg(s, kanalJeAdresse)'))

if (fehler) process.exit(1)
console.log('check-prime-seite-richten: ok')
