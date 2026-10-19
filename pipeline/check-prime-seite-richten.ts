/**
 * Zusicherungen: Ein Prime-Weg wird mit `url` und `seite` gerichtet, und der Kanal findet ihn auch über `seite`
 * (Deploy 18.10.2026: `/dp/` in der Prüfliste der Erweiterung, Blue Giant ohne „aniverse"). Erfundene Wege, kein Netz.
 */
import { readFileSync } from 'node:fs'
import type { StreamLink } from '../shared/types.ts'
import type { Title } from '../shared/types.ts'
import { unbedingteAufrufe } from './lib/unbedingte-aufrufe.ts'
import { richtePrimeWeg, richtePrimeWege } from './bau/13-1-prime-richten.ts'

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

const zweiKanaele = new Map<string, string | undefined>([
  ['amazon:b0d3xz42t9', 'aniverse'],
  ['amazon:b0bbbbbbbb', 'crunchyroll'],
])
const eigener = weg({ url: 'https://www.amazon.de/dp/B0D3XZ42T9', seite: 'https://www.amazon.de/dp/B0BBBBBBBB' })
richtePrimeWeg(eigener, zweiKanaele)
pruefe('Kanal über `url` hat Vorrang vor dem anderen Kanal von `seite`', eigener.kanal === 'aniverse', eigener)

const behalten = weg({ kanal: 'Alt', seite: 'https://www.amazon.de/dp/B0AAAAAAAA' })
richtePrimeWeg(behalten, kanaele)
pruefe('Vorhandener Kanal bleibt, wenn die Map nichts findet', behalten.kanal === 'Alt', behalten)

const leerEintrag = weg({ kanal: 'Alt', seite: 'https://www.amazon.de/dp/B0D3XZ42T9' })
richtePrimeWeg(leerEintrag, new Map([['amazon:b0d3xz42t9', undefined]]))
pruefe('Map-Eintrag ohne Kanal löscht den vorhandenen nicht', leerEintrag.kanal === 'Alt', leerEintrag)

const titel = [
  { id: 1, streams: [weg({ seite: 'https://www.amazon.de/dp/B0D3XZ42T9' }), { platform: 'netflix', url: 'https://www.amazon.de/dp/B0D3XZ42T9', seite: 'https://www.amazon.de/dp/B0D3XZ42T9' }] },
  { id: 2 },
  { id: 3, streams: [weg({ url: 'https://www.amazon.de/dp/B0CCCCCCCC' })] },
] as unknown as Title[]
const anzahl = richtePrimeWege(titel, kanaele)
pruefe('richtePrimeWege: zählt nur Prime-Wege (2 Adressen in 1, 1 in 3)', anzahl === 2, anzahl)
pruefe('richtePrimeWege: Prime-Weg gerichtet, Kanal gesetzt', titel[0]!.streams![0]!.seite === 'https://www.amazon.de/gp/video/detail/B0D3XZ42T9' && titel[0]!.streams![0]!.kanal === 'aniverse', titel[0])
pruefe('richtePrimeWege: Netflix-Weg unberührt', titel[0]!.streams![1]!.url === 'https://www.amazon.de/dp/B0D3XZ42T9', titel[0]!.streams![1])
pruefe('richtePrimeWege: Titel ohne Wege geht durch, späterer Titel wird gerichtet', titel[2]!.streams![0]!.url === 'https://www.amazon.de/gp/video/detail/B0CCCCCCCC', titel[2])

/* Der Bau ruft es unbedingt auf (geparst: `0 &&`, `if (…) continue` davor und ein leeres Argument würden auffallen). */
const quelle = readFileSync(new URL('./bau/13-1-anreichern.ts', import.meta.url), 'utf8')
const aufruf = unbedingteAufrufe(quelle, 'schreibeSynopsenUndReichereAn').find((a) => a.name === 'richtePrimeWege')
pruefe('13-1-anreichern ruft richtePrimeWege(allTitles, kanalJeAdresse) unbedingt auf', aufruf?.args.join('|') === 'allTitles|kanalJeAdresse', aufruf)

if (fehler) process.exit(1)
console.log('check-prime-seite-richten: ok')
