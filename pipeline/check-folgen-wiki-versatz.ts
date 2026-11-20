/**
 * Wikipedia-Liste mit durchgehender Gesamtnummer (Pokémon Horizonte 158871: NR_GES 1235–1393, unsere Folgen ab 1).
 * Titel wörtlich aus `data/wikipedia-folgen.json` und `data/anisearch-folgen.json` (Stand 20.11.2026). Fälle: Versatz belegt,
 * Liste ab 1 bleibt, Versatz ohne Titelbeleg bleibt unverschoben, zu wenige Treffer, zu viele Abweichungen, und der Weg bis in
 * die Flaggen (`deutscheFolgen`: über unserer Höchstnummer zählt nur die belegt verschobene Liste).
 * Aufruf: `npm run check:logic`.
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { deutscheFolgen } from './bau/folgen-dateien.ts'
import { ohneWikiVersatz } from './bau/folgen-wiki-versatz.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${ist === undefined ? '' : ` — gefunden: ${JSON.stringify(ist)}`}`)
}

const TITEL = ['Der Anhänger, mit dem alles anfängt! Teil 1', 'Der Anhänger, mit dem alles anfängt! Teil 2', 'Bestimmt! Weil Felori bei mir ist!', 'Der Schatz nach dem Sturm!', 'Das Weiße Zygarde lässt die Erde erbeben!', 'Wo das Abenteuer hinführt']
const wiki = (erste: number, ead = '2024-02-02') => TITEL.map((dt, i) => ({ nr: erste + i, dt, ead }))
const as = (titel: (string | undefined)[]) => titel.map((de, i) => ({ nr: i + 1, ...(de ? { de } : {}) }))
const nummern = (l: { nr: number }[] | undefined) => (l ?? []).map((x) => x.nr).join(',')

console.log('Versatz einer Wikipedia-Liste')
const v = ohneWikiVersatz(wiki(1235), as(TITEL))
pruefe('Horizonte: 1235–1240 → 1–6, versetzt', nummern(v.folgen) === '1,2,3,4,5,6' && v.versetzt, v)
pruefe('Titel und Datum bleiben', v.folgen?.[5]?.dt === TITEL[5] && v.folgen?.[5]?.ead === '2024-02-02', v.folgen?.[5])
const ab1 = ohneWikiVersatz(wiki(1), as(TITEL))
pruefe('Liste ab 1 bleibt, nicht versetzt', nummern(ab1.folgen) === '1,2,3,4,5,6' && !ab1.versetzt, ab1)
const fremd = ohneWikiVersatz(wiki(1235), as(['A', 'B', 'C', 'D', 'E', 'F']))
pruefe('Versatz ohne Titelbeleg: unverändert', nummern(fremd.folgen) === '1235,1236,1237,1238,1239,1240' && !fremd.versetzt, fremd)
const zwei = ohneWikiVersatz(wiki(1235), as([TITEL[0], TITEL[1], 'X', 'Y']))
pruefe('Nur 2 gleiche Titel: unverändert', !zwei.versetzt, zwei)
const drei = ohneWikiVersatz(wiki(1235), as([TITEL[0], TITEL[1], TITEL[2]]))
pruefe('Genau 3 gleiche Titel, keine abweichend: versetzt', drei.versetzt, drei)
const fuenf = ohneWikiVersatz(wiki(1235), as([TITEL[0], TITEL[1], TITEL[2], TITEL[3], TITEL[4], 'Y']))
pruefe('5 gleich gegen 1 abweichend: versetzt', fuenf.versetzt, fuenf)
const vier = ohneWikiVersatz(wiki(1235), as([TITEL[0], TITEL[1], TITEL[2], TITEL[3], 'Y']))
pruefe('4 gleich gegen 1 abweichend: unverändert', !vier.versetzt, vier)
const ohneAs = ohneWikiVersatz(wiki(1235), undefined)
pruefe('Ohne aniSearch-Folgen: unverändert', !ohneAs.versetzt && nummern(ohneAs.folgen) === '1235,1236,1237,1238,1239,1240', ohneAs)
const leer = ohneWikiVersatz(undefined, as(TITEL))
pruefe('Ohne Liste: leer, nicht versetzt', leer.folgen === undefined && !leer.versetzt, leer)

console.log('Wirkung auf die Flaggen')
const netflix: StreamLink = { platform: 'netflix', url: 'https://www.netflix.com/title/81696980', zugang: 'abo', dub: true, dubRanges: [{ from: 2, to: 4, dub: true }] }
const t = { id: 900002, jpYear: 2023, streams: [netflix] } as unknown as Title
const text = (b: [number, number][]) => b.map(([a, c]) => `${a}-${c}`).join(',')
// Höchste Nummer unserer Liste = 4, die Wikipedia-Liste reicht bis 6.
const mit = deutscheFolgen(t, v.folgen, '2026-11-20', 4, undefined, v.versetzt)
pruefe('belegt versetzt: Liste gilt über 4 hinaus (1–6)', text(mit) === '1-6', mit)
const ohne = deutscheFolgen(t, wiki(1235), '2026-11-20', 4)
pruefe('unverschoben und über der Höchstnummer: Liste verworfen, nur der Weg (2–4)', text(ohne) === '2-4', ohne)
const vorher = deutscheFolgen(t, v.folgen, '2026-11-20', 4, undefined, false)
pruefe('verschoben ohne Beleg-Merker: Liste verworfen wie bisher', text(vorher) === '2-4', vorher)

if (fehler) {
  console.error(`✖ ${fehler} Fehler`)
  process.exit(1)
}
console.log('✓ check-folgen-wiki-versatz: 13 Fälle grün')
