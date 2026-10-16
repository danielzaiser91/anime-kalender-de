/**
 * Zusicherungen zu `bau/13-1-weg-adresse-bezugsweg.ts` (16.10.2026): ein Prime-Weg aus einem Termin ohne Adresse nimmt die Adresse des
 * Prime-Bezugswegs desselben Titels, damit ihn die Prüfliste der Erweiterung aufnehmen kann. Läuft in `check:logic`.
 */
import type { StreamLink, Title, WatchLink } from '../shared/types.ts'
import { adresseAusBezugsweg, uebernehmeBezugswegAdressen } from './bau/13-1-weg-adresse-bezugsweg.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const AM = 'https://www.amazon.de/gp/video/detail/B0DP5DZW86'
const CR = 'https://www.amazon.de/gp/video/detail/B0CG79DT6Y'
const bezug = (name: string, url: string, kind: WatchLink['kind'] = 'stream'): WatchLink => ({ name, url, kind }) as WatchLink
const weg = (zusatz: Partial<StreamLink> = {}): StreamLink => ({ platform: 'primevideo', url: '', herkunft: 'termin', ...zusatz }) as StreamLink
const titel = (watchLinks: WatchLink[], streams: StreamLink[] = [weg()]): Title => ({ id: 1, streams, watchLinks }) as unknown as Title

const aniverse = bezug('Amazon Prime (Aniverse)', AM)
const crunchy = bezug('Amazon Prime (Crunchyroll)', CR)

pruefe('Ein einziger Prime-Bezugsweg gibt dem Weg seine Adresse', adresseAusBezugsweg(weg(), titel([aniverse])) === AM)
pruefe('Mit Kanal gilt der Bezugsweg desselben Kanals (Schreibweise egal)', adresseAusBezugsweg(weg({ kanal: 'aniverse' }), titel([crunchy, aniverse])) === AM)
pruefe('Ein Kanal ohne eigenen Bezugsweg bekommt keine fremde Adresse', adresseAusBezugsweg(weg({ kanal: 'ADN' }), titel([crunchy, aniverse])) === undefined)
pruefe('Ein Kanal-Weg nimmt nicht den einzigen Bezugsweg eines anderen Kanals', adresseAusBezugsweg(weg({ kanal: 'Crunchyroll' }), titel([aniverse])) === undefined)
pruefe('Ohne Kanal und mit zwei Kanälen: mehrdeutig, keine Übernahme', adresseAusBezugsweg(weg(), titel([crunchy, aniverse])) === undefined)
pruefe('Ein Weg mit Adresse behält sie', adresseAusBezugsweg(weg({ url: 'https://www.amazon.de/gp/video/detail/B000000000' }), titel([aniverse])) === undefined)
pruefe('Nur Prime: Disney+ bekommt keine Amazon-Adresse', adresseAusBezugsweg(weg({ platform: 'disneyplus' }), titel([aniverse])) === undefined)
pruefe('Ein Kaufweg (Disc, aniSearch) ist kein Bezugsweg zum Ansehen', adresseAusBezugsweg(weg(), titel([bezug('Amazon Prime (Aniverse)', AM, 'buy')])) === undefined)
pruefe('Ein anderer Anbieter (Apple TV) gibt keine Adresse', adresseAusBezugsweg(weg(), titel([bezug('Apple TV', 'https://tv.apple.com/de/show/x')])) === undefined)
pruefe('Ein Amazon-Name mit fremder Adresse zählt nicht', adresseAusBezugsweg(weg(), titel([bezug('Amazon Prime (Aniverse)', 'https://example.com/x')])) === undefined)
pruefe('Ein Amazon-Kaufangebot (Amazon Video) mit Prime-Adresse ist kein Prime-Weg', adresseAusBezugsweg(weg(), titel([bezug('Amazon Video', AM)])) === undefined)
pruefe('Eine Amazon-Suche ist keine Titelseite', adresseAusBezugsweg(weg(), titel([bezug('Amazon Prime (Aniverse)', 'https://www.amazon.de/s?k=x&i=instant-video')])) === undefined)
pruefe('Ohne Bezugswege keine Adresse', adresseAusBezugsweg(weg(), titel([])) === undefined)

const t = titel([aniverse], [weg(), weg({ platform: 'netflix' })])
const n = uebernehmeBezugswegAdressen([t, titel([crunchy, aniverse])])
pruefe('Gezählt und gesetzt wird nur der eindeutige Fall', n === 1 && t.streams[0]!.url === AM && t.streams[1]!.url === '', { n, streams: t.streams })

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-weg-adresse-bezugsweg: ok')
