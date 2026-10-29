/**
 * Fälle zu `findeFremdZugeordnete` und `gegenBekannt` (29.10.2026) ohne `public/data`: die fünf echten Fehlzuordnungen vom
 * 29.10.2026 (Adressen wörtlich aus `prime-zugeordnet.json`, Besitzer aus `cartoons.json` und `dub-confirmed.yaml`) als
 * Rot-Beispiele, dazu Kontrollen. Läuft in `check:logic`; der Bestand wird in `check-zuordnung-fremd-bestand.ts` geprüft.
 */
import { ohneSprache } from './lib/fremde-adressen.ts'
import { findeFremdZugeordnete, type ZuordnungEintrag } from './lib/zuordnung-fremd.ts'
import { bekanntZeile, gegenBekannt } from './lib/zuordnung-fremd-bestand.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const KULIPARI = 'https://www.netflix.com/title/80057610'
const GRISAIA_SERIE = 'https://www.amazon.de/gp/video/detail/B0DMMT9B67'
const EIGEN = 'https://www.amazon.de/gp/video/detail/B0EIGEN001'
const SUCHE = 'https://www.amazon.de/s?k=Hero%20Mask&i=instant-video'
const NETFLIX_BELEG = 'https://www.netflix.com/title/81000004'
const streams = new Map([[ohneSprache(KULIPARI), ['cartoons.json:-74222']]])
const belege = [
  { anilistId: 145740, url: 'https://www.amazon.de/dp/B0DMMT9B67' },
  { anilistId: 145740, url: GRISAIA_SERIE },
  { anilistId: 900001, url: EIGEN },
  { anilistId: 900002, url: EIGEN },
  { anilistId: 900003, url: SUCHE },
  { anilistId: 900004, url: NETFLIX_BELEG },
]
const netflix = (titleId: number): ZuordnungEintrag => ({ titleId, plattform: 'netflix' })
const prime = (titleId: number, seite: string | null): ZuordnungEintrag => ({ titleId, plattform: 'primevideo', seite })
const finde = (z: [string, ZuordnungEintrag][]) => findeFremdZugeordnete(z, streams, belege)

const kulipari = finde([[KULIPARI, netflix(105096)]])
pruefe('Hero Mask an der Netflix-Seite des Cartoons Kulipari: Treffer mit Besitzer', kulipari.length === 1 && kulipari[0]!.titleId === 105096 && kulipari[0]!.besitzer.join() === 'cartoons.json:-74222', kulipari)
pruefe('Staffelmarke und Ländersegment ändern nichts', finde([['https://www.netflix.com/de-de/title/80057610#0', netflix(105096)]]).length === 1)
pruefe('Kontrolle: der Cartoon selbst an seiner Seite ist kein Treffer', finde([[KULIPARI, netflix(-74222)]]).length === 0)
pruefe('Kontrolle: Hero Mask an einer anderen Netflix-Seite ist kein Treffer', finde([['https://www.netflix.com/title/80200027', netflix(105096)]]).length === 0)

const grisaia = finde([['https://www.amazon.de/dp/B0DMMT9B67', prime(99470, 'B0DMMT9B67')]])
pruefe('Film 99470 an der Serienseite von 145740 (Handbeleg): Treffer, Adresse in Bau-Schreibweise', grisaia.length === 1 && grisaia[0]!.adresse === GRISAIA_SERIE && grisaia[0]!.besitzer.join() === 'Handbeleg:145740', grisaia)
pruefe('Handbeleg der eigenen Kennung an der Adresse: kein Treffer', finde([['https://www.amazon.de/dp/B0DMMT9B67', prime(145740, 'B0DMMT9B67')]]).length === 0)
pruefe('Gemeldete Adresse fremd, Seite der Rohfolge eigen: kein Treffer (der Bau nimmt die Seite)', finde([['https://www.amazon.de/dp/B0DMMT9B67', prime(99470, 'B0FREI0001')]]).length === 0)
pruefe('Gemeldete Adresse eigen, Seite der Rohfolge fremd: Treffer', finde([['https://www.amazon.de/dp/B0FREI0001', prime(99470, 'B0DMMT9B67')]]).length === 1)
pruefe('Prime ohne Seite zählt die gemeldete Adresse', finde([['https://www.amazon.de/dp/B0DMMT9B67', prime(99470, null)]]).length === 1)
pruefe('Sammelseite: Beleg der eigenen Kennung neben dem eines anderen Titels, kein Treffer', finde([[EIGEN, prime(900001, 'B0EIGEN001')]]).length === 0)
pruefe('Zweiter Titel an derselben Seite ohne eigenen Beleg: Treffer (Besitzer beide Belege)', finde([[EIGEN, prime(900009, 'B0EIGEN001')]])[0]?.besitzer.join() === 'Handbeleg:900001,Handbeleg:900002')
pruefe('Suchadresse trifft nie, auch wenn ein Beleg sie führt', finde([[SUCHE, prime(900009, null)]]).length === 0)
pruefe('Netflix-Seite eines Handbelegs, Staffelmarke im Schlüssel: Treffer', finde([[`${NETFLIX_BELEG}#0`, netflix(105096)]])[0]?.besitzer.join() === 'Handbeleg:900004')
pruefe('Kennung 74222 ist nicht der Besitzer -74222 (Ziffernfolge am Ende genügt nicht)', finde([[KULIPARI, netflix(74222)]]).length === 1)
pruefe('Leere Eingabe: keine Treffer', finde([]).length === 0)

const ein = { titleId: 99470, adresse: GRISAIA_SERIE, besitzer: [] }
const andere = { titleId: 105096, adresse: KULIPARI, besitzer: [] }
const bekannt = [bekanntZeile(ein), `1 ${EIGEN}`]
const stand = gegenBekannt([ein, andere], bekannt)
pruefe('Bekannte Zeile ist nicht neu, unbekannter Treffer ist neu', stand.neu.length === 1 && stand.neu[0]!.titleId === 105096, stand)
pruefe('Zeile ohne Treffer ist veraltet', stand.veraltet.join() === `1 ${EIGEN}`, stand)
pruefe('Gleiche Adresse an anderer Kennung ist neu', gegenBekannt([{ titleId: 7, adresse: GRISAIA_SERIE, besitzer: [] }], bekannt).neu.length === 1)
pruefe('Leere Bekannt-Liste: jeder Treffer ist neu, nichts veraltet', gegenBekannt([ein], []).neu.length === 1 && gegenBekannt([ein], []).veraltet.length === 0)

if (fehler) process.exit(1)
console.log(`check-zuordnung-fremd: ${faelle} Fälle grün, Zuordnung an fremder Adresse wird gemeldet.`)
