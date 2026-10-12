/**
 * Zusicherungen zu den eingefrorenen AniList-Stammdaten (`data/stammdaten/anilist-eingefroren.json`, 11.10.2026):
 * die Datei ist heil und die Mischung ersetzt nur die eingefrorenen Kennungen. Läuft in `check:logic`; die Prüfung am gebauten Bestand steht in `check-katalog-eingefroren-bestand.ts` (`check:bestand`).
 */
import { existsSync } from 'node:fs'
import { type KatalogEintrag } from './lib/anilist.ts'
import { EINGEFROREN_DATEI, ladeEingefrorene, mischeKatalog } from './lib/katalog-eingefroren.ts'

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

if (verletzt) {
  console.error(`check-katalog-eingefroren: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-katalog-eingefroren: ok')
