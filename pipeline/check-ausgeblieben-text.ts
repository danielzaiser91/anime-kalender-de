/**
 * Zusicherung zum Satz „Folge n ist nicht erschienen, … für <Tag>" im Antwort-Kasten (15.10.2026):
 * Ein fortgeschriebener Tag (`estimated`) heißt „erwartet … (errechnet)", weil seine Herkunft offen ist
 * (Simulcast-Start, Meldetag, Wochentakt); nur ein vom Anbieter genannter Tag heißt „angekündigt".
 * Die Zeile darunter („Folge n wurde für den … erwartet") sagt dasselbe. Läuft in `check:logic`.
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { translate } from '../web/src/lib/i18n.tsx'
import { ausgebliebenTerminText } from '../web/src/components/detail/kasten-texte.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const T = translate as unknown as (k: string, v?: Record<string, string | number>) => string
const ereignis = (zusatz: Partial<ReleaseEvent>): ReleaseEvent =>
  ({ id: 'x@2026-10-14', date: '2026-10-14', episode: 12, name: 'X', releaseSlug: 'x', ...zusatz }) as unknown as ReleaseEvent

const geschaetzt = ausgebliebenTerminText(ereignis({ estimated: true, time: '19:25' }), T)
pruefe('errechneter Tag heißt „erwartet"', geschaetzt.startsWith('erwartet für'), geschaetzt)
pruefe('errechneter Tag heißt „errechnet"', geschaetzt.endsWith('(errechnet).'), geschaetzt)
pruefe('errechneter Tag behauptet keinen Wochentakt', !geschaetzt.includes('Wochentakt'), geschaetzt)
pruefe('errechneter Tag trägt Datum und Uhrzeit', geschaetzt.includes('14.10') && geschaetzt.includes('19:25'), geschaetzt)

const ohneZeit = ausgebliebenTerminText(ereignis({ estimated: true }), T)
pruefe('ohne Uhrzeit auch „erwartet … (errechnet)"', ohneZeit.startsWith('erwartet für') && ohneZeit.endsWith('(errechnet).'), ohneZeit)

const belegt = ausgebliebenTerminText(ereignis({ time: '19:25' }), T)
pruefe('genannter Tag heißt „angekündigt"', belegt.startsWith('angekündigt für'), belegt)
pruefe('genannter Tag heißt nicht „errechnet"', !belegt.includes('errechnet'), belegt)

const belegtOhneZeit = ausgebliebenTerminText(ereignis({}), T)
pruefe('genannter Tag ohne Uhrzeit heißt „angekündigt"', belegtOhneZeit.startsWith('angekündigt für'), belegtOhneZeit)

const naeherung = ausgebliebenTerminText(ereignis({ estimated: true, time: '08:00', timeEstimated: true }), T)
pruefe('geschätzte Uhrzeit trägt „≈"', naeherung.includes('≈ 08:00'), naeherung)

const ueberfaellig = T('antwort.vermerkUeberfaellig', { n: 12, datum: '14.10.' })
pruefe('Überfällig-Zeile sagt „erwartet … (errechnet)"', ueberfaellig.includes('erwartet (errechnet)'), ueberfaellig)
pruefe('Überfällig-Zeile sagt nicht „angekündigt"', !ueberfaellig.includes('angekündigt'), ueberfaellig)

if (fehler) process.exit(1)
console.log('check-ausgeblieben-text: ok')
