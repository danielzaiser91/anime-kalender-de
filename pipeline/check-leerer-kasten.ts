/**
 * Zusicherung (14.10.2026, Matrix Dreads): Ein Antwort-Kasten, der nur „Synchro offen“ sagen würde, entfällt ganz — keine leere Fläche,
 * keine Überschrift. Jede Zeile, die unter der Überschrift stehen könnte, hält ihn am Leben. „Noch keine deutsche Fassung“ (kein
 * Cartoon) bleibt. Gerendert wird der Rahmen, den `DetailPanel` benutzt. Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Title } from '../shared/types.ts'
import { BEWERTET, KastenRahmen, OHNE_WIRKUNG, kastenOhneInhalt } from '../web/src/components/detail/kasten-leer.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const matrix = { id: -306887, slug: 'm', format: 'TV', westlich: true, streams: [] } as unknown as Title
const leer = {
  antwort: { art: 'ohne' },
  title: matrix,
  releases: [],
  terminReleases: [],
  streamReleases: [],
  discAusgaben: [],
  discReleases: [],
  tvVorbei: [],
  wegeHinweis: undefined,
  kastenNotiz: undefined,
  folgenLuecke: null,
  folgenListe: false,
}
type Eingabe = Parameters<typeof kastenOhneInhalt>[0]
const mit = (extra: object): Eingabe => ({ ...leer, ...extra }) as unknown as Eingabe
const mitTitel = (extra: object): Eingabe => mit({ title: { ...matrix, ...extra } })

console.log('\nKasten ohne Inhalt entfällt:')
pruefe('Cartoon ohne jeden Beleg: leer', kastenOhneInhalt(mit({})) === true)

console.log('\nJede Quelle einer Zeile hält den Kasten:')
const quellen: [string, Eingabe][] = [
  ['Bezugsweg (watchLinks)', mitTitel({ watchLinks: [{ name: 'x' }] })],
  ['Stream', mitTitel({ streams: [{ platform: 'netflix' }] })],
  ['Release', mit({ releases: [{}] })],
  ['Termin-Pille', mit({ terminReleases: [{}] })],
  ['Stream-Release', mit({ streamReleases: [{}] })],
  ['Disc-Ausgabe', mit({ discAusgaben: [{}] })],
  ['Disc-Release', mit({ discReleases: [{}] })],
  ['TV-Rückblick', mit({ tvVorbei: [{}] })],
  ['Wege-Hinweis', mit({ wegeHinweis: 'Satz' })],
  ['Notiz', mit({ kastenNotiz: {} })],
  ['Folgenlücke', mit({ folgenLuecke: '3' })],
  ['Folgenliste (folgen/<id>.json)', mit({ folgenListe: true })],
  ['Merken-Hinweis (ohneSynchro)', mitTitel({ ohneSynchro: true })],
  ['Nebenzeile (deErstausgabe)', mitTitel({ deErstausgabe: { von: '2003-01-08' } })],
  ['Im Angebot seit', mitTitel({ angebotSeit: { date: '2024-01-01', platform: 'netflix' } })],
]
for (const [name, e] of quellen) pruefe(`${name}: Kasten bleibt`, kastenOhneInhalt(e) === false)

console.log('\nAndere Überschriften bleiben:')
pruefe('Anime ohne Fassung („Noch keine deutsche Fassung“): bleibt', kastenOhneInhalt(mitTitel({ westlich: undefined })) === false)
pruefe('JustWatch-Hinweis (dubHinweis): bleibt', kastenOhneInhalt(mitTitel({ dubHinweis: { quelle: 'justwatch', anbieter: ['Netflix'] } })) === false)
pruefe('Antwort „fertig“: bleibt', kastenOhneInhalt(mit({ antwort: { art: 'fertig' } })) === false)

console.log('\nDer Rahmen des Panels:')
const uebrige = {
  sortiertNachZugang: [],
  t: (k: string) => k,
  today: '2026-10-14',
  favorites: new Set(),
  verbindung: { verbunden: false },
  folgenAngabeFuer: () => '',
  dubZeilen: () => [],
  releaseJePlattform: new Map(),
  discOffen: false,
  setDiscOffen: () => undefined,
}
const rahmen = (e: Eingabe): string => renderToStaticMarkup(createElement(KastenRahmen, { ...uebrige, ...e } as never))
pruefe('leer: nichts gerendert', rahmen(mit({})) === '')
pruefe('nur Folgenliste: Rahmen bleibt', rahmen(mit({ folgenListe: true })).includes('data-kasten'))
const markup = rahmen(mit({ wegeHinweis: 'Satz', antwort: { art: 'ohne' } }))
pruefe('mit Zeile: Rahmen mit Marke `data-kasten` und Kasten', markup.includes('data-kasten') && markup.includes('<section'), markup.slice(0, 120))
pruefe('Folgenliste steht in eigener Karte hinter dem Kasten, nicht darin', markup.includes('data-folgen-karte') && markup.indexOf('data-folgen-karte') > markup.lastIndexOf('</section>'), markup.slice(-200))
pruefe('ohne Folgenliste bleibt die Karte leer (CSS `empty:hidden` blendet sie aus)', /empty:hidden[^>]*data-folgen-karte="true"><\/div>/.test(markup), markup.slice(-200))
const panel = readFileSync(new URL('../web/src/components/DetailPanel.tsx', import.meta.url), 'utf8')
pruefe('DetailPanel benutzt den Rahmen', /<AntwortBereichOderNichts\b/.test(panel) && !/<AntwortBereich\b(?!OderNichts)/.test(panel))
const leerQuelle = readFileSync(new URL('../web/src/components/detail/kasten-leer.tsx', import.meta.url), 'utf8')
pruefe('AntwortBereichOderNichts fragt das Verzeichnis der Folgenlisten', /folgenListe = useHatFolgenListe\(p\.title\.id\)/.test(leerQuelle) && /<KastenRahmen \{\.\.\.p\} folgenListe=\{folgenListe\} \/>/.test(leerQuelle))

console.log('\nJede Eingabe von AntwortBereich ist bewertet:')
const bereich = readFileSync(new URL('../web/src/components/detail/antwort-bereich.tsx', import.meta.url), 'utf8')
const kopf = /export function AntwortBereich\(\{([^}]*)\}/.exec(bereich)?.[1] ?? ''
const props = kopf.split(',').map((s) => s.trim()).filter(Boolean)
const bekannt: string[] = [...BEWERTET, ...OHNE_WIRKUNG]
pruefe('Props von AntwortBereich gelesen', props.length > 10, props.length)
pruefe('keine Eingabe ohne Urteil (in BEWERTET oder OHNE_WIRKUNG)', props.every((n) => bekannt.includes(n)), props.filter((n) => !bekannt.includes(n)))
pruefe('keine Eingabe in beiden Listen', BEWERTET.every((n) => !(OHNE_WIRKUNG as readonly string[]).includes(n)))
pruefe('keine Eingabe in den Listen, die es nicht gibt', bekannt.every((n) => props.includes(n)), bekannt.filter((n) => !props.includes(n)))

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
