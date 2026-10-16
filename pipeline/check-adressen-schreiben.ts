/**
 * Zusicherungen zum Schreiben der Adresse im Browser (`syncSharePath`, `navigiere`, `ersetzeAdresse`) mit gefälschtem
 * Ort und Verlauf: Unter `/t/<id>/` entsteht nie wieder `t=` im Hash, und eine alte Adresse wird tatsächlich umgeschrieben.
 * Aufruf: `npm run check:logic`.
 */
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'
import { ersetzeAdresse, navigiere, syncSharePath, type AppRoute, type Umgebung } from '../web/src/lib/router.ts'
import { todayIso } from '../shared/time.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Aufruf = [string, ...unknown[]]
function umgebung(pathname: string, hash: string, state: unknown = null): { umg: Umgebung; aufrufe: Aufruf[] } {
  const aufrufe: Aufruf[] = []
  const verlauf = {
    state,
    replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void aufrufe.push(['ersetzt', String(url)]),
    pushState: (_s: unknown, _t: string, url?: string | URL | null) => void aufrufe.push(['neu', String(url)]),
    back: () => void aufrufe.push(['zurueck']),
  }
  return { umg: { ort: { pathname, search: '', hash }, verlauf, base: '' }, aufrufe }
}
const route = (titel?: number): AppRoute => ({ view: 'woche', date: todayIso(), title: titel, filters: { ...EMPTY_FILTERS } }) as AppRoute

console.log('\nsyncSharePath schreibt die Adresse um:')
let t = umgebung('/', '#/woche?t=15957')
syncSharePath('15957', t.umg)
pruefe('Wurzel-Link mit t= → /t/15957/#/woche', t.aufrufe.length === 1 && t.aufrufe[0]![1] === '/t/15957/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche?t=15957')
syncSharePath('15957', t.umg)
pruefe('Seite mit dem alten Doppel (gleicher Pfad) → #/woche', t.aufrufe.length === 1 && t.aufrufe[0]![1] === '/t/15957/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche')
syncSharePath('15957', t.umg)
pruefe('Saubere Adresse bleibt, es wird nichts geschrieben', t.aufrufe.length === 0, t.aufrufe)
t = umgebung('/', '#/woche?t=-284833')
syncSharePath('avatar-284833', t.umg)
pruefe('Namens-Pfad (Cartoon) behält t=', t.aufrufe.length === 1 && t.aufrufe[0]![1] === '/t/avatar-284833/#/woche?t=-284833', t.aufrufe)

console.log('\nnavigiere und ersetzeAdresse schreiben unter /t/<id>/ kein t=:')
t = umgebung('/t/15957/', '#/woche')
let gesetzt = 0
navigiere(route(15957), { view: 'datenbank' }, { ...route(15957), view: 'datenbank' }, t.umg, () => void gesetzt++)
pruefe('Ansicht wechseln: Hash ohne t=', t.umg.ort.hash === '#/datenbank', t.umg.ort.hash)
t = umgebung('/', '#/woche')
navigiere(route(), { title: 15957 }, route(15957), t.umg, () => void gesetzt++)
pruefe('Panel öffnen von der Wurzel: neuer Eintrag mit t= (der Pfad kommt danach per syncSharePath)', t.aufrufe[0]?.[0] === 'neu' && t.aufrufe[0][1] === '/#/woche?t=15957', t.aufrufe)
t = umgebung('/t/15957/', '#/woche', { panel: true, tief: true })
navigiere(route(15957), { title: undefined }, route(), t.umg, () => void gesetzt++)
pruefe('Panel schließen (geteilter Link): Adresse wird ersetzt, ohne Titel', t.aufrufe.length === 1 && t.aufrufe[0]![1] === '/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche')
navigiere(route(15957), { title: undefined }, route(), t.umg, () => void gesetzt++)
pruefe('Panel schließen ohne Verlaufseintrag: der Pfad wird auf / zurückgesetzt', t.aufrufe.length === 1 && t.aufrufe[0]![1] === '/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche', { panel: true })
navigiere(route(15957), { title: undefined }, route(), t.umg, () => void gesetzt++)
pruefe('Panel schließen mit eigenem Verlaufseintrag: ein Schritt zurück', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'zurueck', t.aufrufe)
gesetzt = 0
t = umgebung('/', '#/woche')
navigiere(route(), {}, route(), t.umg, () => void gesetzt++)
pruefe('Gleicher Hash: die Route wird gesetzt, der Hash nicht angefasst', gesetzt === 1 && t.umg.ort.hash === '#/woche', gesetzt)
t = umgebung('/t/15957/', '#/datenbank')
const sortiert = { ...route(15957), view: 'datenbank', sort: 'titel' } as AppRoute
ersetzeAdresse(sortiert, t.umg, () => void gesetzt++)
pruefe('Schalter umlegen: ersetzt die Adresse ohne t=', t.aufrufe.length === 1 && t.aufrufe[0]![1] === '/t/15957/#/datenbank?sort=titel', t.aufrufe)
t = umgebung('/', '#/datenbank')
ersetzeAdresse(sortiert, t.umg, () => void gesetzt++)
pruefe('… an der Wurzel (Titel nicht im Pfad) bleibt t=', t.aufrufe[0]![1] === '/#/datenbank?t=15957&sort=titel', t.aufrufe)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAdresse schreiben: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
