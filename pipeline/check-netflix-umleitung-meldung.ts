/**
 * Netflix-Totmeldung „Umleitung auf Startseite“ (Fehltakt, 15.–17.11.2026): wird zurückgestellt (nicht zugeordnet, nicht abgehakt), nie zum Weg-Beleg.
 * Geprüft wird die Regel und der Weg durch `sperreAufPruefungen` (der Stapel von `fetch-pruefungen.ts`).
 */
import { readFileSync } from 'node:fs'
import { istFehlUmleitung } from './lib/netflix-umleitung-meldung.ts'
import { ohneGesperrtePruefungen, sperreAufPruefungen } from './lib/meldungen-stapel.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const NOTIZ = 'Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite'
const m = (id: number, rest: Record<string, unknown> = {}) => ({
  id,
  plattform: 'netflix',
  url: `https://www.netflix.com/title/${id}`,
  befund: 'weg',
  notiz: NOTIZ,
  gemeldet_am: '2026-11-15T19:08:37Z',
  ...rest,
})

pruefe('Anlass (Sonic X, 15.11. 19:08): zurückgestellt', istFehlUmleitung(m(60036794)))
pruefe('Meldung vom 17.11. (Daniel): zurückgestellt', istFehlUmleitung(m(81900358, { gemeldet_am: '2026-11-17T17:31:00Z' })))
pruefe('SQLite-Zeitform ohne T: zurückgestellt', istFehlUmleitung(m(1, { gemeldet_am: '2026-11-16 08:00:00' })))
pruefe('am Stichtag 20.11.: gilt wieder', !istFehlUmleitung(m(1, { gemeldet_am: '2026-11-20T00:00:00Z' })))
pruefe('Tag davor 19.11. 23:59: zurückgestellt', istFehlUmleitung(m(1, { gemeldet_am: '2026-11-19T23:59:59Z' })))
pruefe('andere Notiz (Kanal-Meldung): gilt', !istFehlUmleitung(m(1, { notiz: 'Kanal-Titel nicht gefunden' })))
pruefe('andere Plattform: gilt', !istFehlUmleitung(m(1, { plattform: 'primevideo' })))
pruefe('Befund dub (Folgenmeldung): gilt', !istFehlUmleitung(m(1, { befund: 'dub' })))
pruefe('ohne Notiz: gilt', !istFehlUmleitung(m(1, { notiz: null })))
pruefe('Notiz mit anderem Grund: gilt', !istFehlUmleitung(m(1, { notiz: 'Vom Durchgang als nicht bei Netflix gemeldet — Titelseite 404' })))

const stapel = [m(1), m(2, { befund: 'dub' }), m(3, { gemeldet_am: '2026-11-21T10:00:00Z' }), m(4)]
const r = ohneGesperrtePruefungen(stapel, [])
pruefe('Stapel: 1 und 4 zurückgestellt, 2 und 3 werden zugeordnet', [...r.zurueckgestellt].sort().join() === '1,4' && r.pruefungen.map((p) => p.id).join() === '2,3', r.zurueckgestellt)
pruefe('Stapel: nichts davon wird abgehakt (gesperrt ist die Abhakliste von fetch-pruefungen.ts)', r.gesperrt.length === 0, r.gesperrt)
const s = sperreAufPruefungen(stapel, [])
pruefe('sperreAufPruefungen (Weg des Abholers): dasselbe', s.zurueckgestellt.length === 2 && s.gesperrt.length === 0 && s.pruefungen.length === 2, s)
const fremd = [{ url: 'https://www.netflix.com/title/5', richtig: 'https://www.netflix.com/title/6', gti: ['77'], beleg: 'x'.repeat(50) }]
const beide = ohneGesperrtePruefungen([{ ...m(5), folge: '77' }, m(6)], fremd)
pruefe('fremde Zeile mit Umleitungs-Notiz: abgehakt, nicht zurückgestellt; die andere zurückgestellt', beide.gesperrt.join() === '5' && beide.zurueckgestellt.join() === '6', beide)

const dub = readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')
const rest = dub.split('\n').filter((z) => z.includes('— Umleitung auf Startseite')).length
pruefe('dub-confirmed.yaml trägt keinen Umleitungs-Beleg mehr', rest === 0, rest)

if (fehler) {
  console.error(`FEHL check-netflix-umleitung-meldung: ${fehler} Fälle`)
  process.exit(1)
}
console.log('check-netflix-umleitung-meldung: Regel (Notiz, Befund, Plattform, Stichtag), Stapel und Bestand geprüft.')
