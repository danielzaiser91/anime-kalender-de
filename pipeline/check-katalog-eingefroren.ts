/**
 * Zusicherungen zu den eingefrorenen AniList-Stammdaten (`data/stammdaten/anilist-eingefroren.json`, 11.10.2026):
 * die Datei ist heil, und der Bau lässt keinen ihrer Titel stillschweigend fallen. Läuft in `check:logic`.
 */
import { existsSync } from 'node:fs'
import { type KatalogEintrag } from './lib/anilist.ts'
import { EINGEFROREN_DATEI, ladeEingefrorene, mischeKatalog } from './lib/katalog-eingefroren.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const eintrag = (id: number, name: string): KatalogEintrag => ({ id, t: [name, null, null], format: 'OVA', jahr: 2000, folgen: 1, genres: [], score: null, cover: null, rel: [] })

const cache = [eintrag(1, 'a'), eintrag(2, 'b'), eintrag(4, 'd')]
const gemischt = mischeKatalog(cache, [eintrag(2, 'B'), eintrag(3, 'C')])
pruefe('Mischen: eingefrorene Kennung ersetzt den Cache-Eintrag', gemischt.find((e) => e.id === 2)?.t[0] === 'B')
pruefe('Mischen: nach Kennung sortiert, nichts doppelt', gemischt.map((e) => e.id).join() === '1,2,3,4', gemischt.map((e) => e.id))
pruefe('Mischen: ohne Cache leer, kein Teilkatalog aus der Datei', mischeKatalog([], [eintrag(3, 'C')]).length === 0)

pruefe(`Datei ${EINGEFROREN_DATEI} ist da`, existsSync(EINGEFROREN_DATEI))
const eingefroren = ladeEingefrorene()
pruefe('Datei: nicht leer', eingefroren.length > 0, eingefroren.length)
pruefe('Datei: jede Kennung höchstens einmal', new Set(eingefroren.map((e) => e.id)).size === eingefroren.length)
const kaputt = eingefroren.filter((e) => !(Number.isInteger(e.id) && Array.isArray(e.t) && e.t.length === 3 && Array.isArray(e.rel) && Array.isArray(e.genres)))
pruefe('Datei: jeder Eintrag hat Kennung, drei Namen, Genres und Relationen', kaputt.length === 0, kaputt.slice(0, 3).map((e) => e.id))
const ohneName = eingefroren.filter((e) => !e.t.some(Boolean))
pruefe('Datei: jeder Eintrag hat mindestens einen Namen', ohneName.length === 0, ohneName.slice(0, 3).map((e) => e.id))
const vollerCover = eingefroren.filter((e) => e.cover?.startsWith('http'))
pruefe('Datei: Cover ohne Adressvorsatz wie im Katalog', vollerCover.length === 0, vollerCover.slice(0, 3).map((e) => e.id))

/* Der Bau darf keinen eingefrorenen Titel verlieren: jeder steht in der Ausgabe (ohne Synchro oder Hauptbestand); 1 % Spiel für Zusammenführungen. */
const ausgabe = new Set<number>([...readJson<{ id: number }[]>('public/data/ohne-synchro.json', []), ...readJson<{ id: number }[]>('public/data/titles.json', [])].map((t) => t.id))
if (ausgabe.size && eingefroren.length) {
  const fehlen = eingefroren.filter((e) => !ausgabe.has(e.id)).map((e) => e.id)
  pruefe('Ausgabe: höchstens 1 % der eingefrorenen Titel fehlen in ohne-synchro.json und titles.json', fehlen.length <= eingefroren.length * 0.01, { anzahl: fehlen.length, beispiele: fehlen.slice(0, 5) })
}

if (verletzt) {
  console.error(`check-katalog-eingefroren: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-katalog-eingefroren: ok')
