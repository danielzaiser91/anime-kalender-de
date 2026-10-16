/**
 * Zusicherungen zum JustWatch-Befund (Titel je Kennung) und zum Prime-Häkchen nur mit Beleg. Die Regel „Deutsch laut JustWatch“
 * je Seite prüft `check-jw-seite.ts`, den Bestand nach einem Bau `check-jw-vertrauen-bestand.ts`. Läuft in `check:logic`.
 */
import { titelJeJustwatchKennung, type JwBefund } from './lib/jw-vertrauen.ts'
import { primeHakenOhneBeleg, primeTitelMitBeleg } from './lib/haken-beleg.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const URL = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.8cbba00e-0d43-4c48-bdfa-437e5762c51d'
const befund = (angebote: JwBefund['angebote'], zusatz: Partial<JwBefund> = {}): JwBefund => ({ geprueftAm: '2026-10-01', jwId: 'ts1', angebote, ...zusatz })
const jeKennung = titelJeJustwatchKennung({ a: befund([]), b: befund([]), c: befund([], { jwId: 'ts2' }), d: befund([], { jwId: undefined }) })
pruefe('Titel je JustWatch-Kennung zählt gleiche Kennungen', jeKennung.get('ts1') === 2 && jeKennung.get('ts2') === 1 && jeKennung.size === 2)

// Volles Häkchen bei Prime nur mit Handbeleg, Messurteil oder Meldung (der Bau bricht sonst ab, `11-6-jw-vertrauen.ts`).
const primeWeg = (id: number, dub?: boolean) => ({ id, titleRomaji: 'X', streams: [{ platform: 'primevideo', url: URL, dub }] }) as unknown as Title
const belege = (id: number) =>
  primeTitelMitBeleg(
    [{ anilistId: id, platform: 'primevideo', dub: true, checkedAt: '2026-10-01' }],
    { '2|primevideo|1': { urteil: 'deutsch' }, '9|primevideo|1': { urteil: 'kein deutsch' } },
    { a: { titleId: 3, plattform: 'primevideo', folgen: [{ sprachen: ['Deutsch'] }] } },
  )
const ohneBeleg = (id: number, dub?: boolean) => primeHakenOhneBeleg([primeWeg(id, dub)], belege(1)).length
pruefe('Haken mit Handbeleg gilt', ohneBeleg(1, true) === 0)
pruefe('Haken mit Messurteil gilt', ohneBeleg(2, true) === 0)
pruefe('Haken mit Meldung aus der angemeldeten Sitzung gilt', ohneBeleg(3, true) === 0)
pruefe('Haken ohne jeden Beleg wird gemeldet', ohneBeleg(4, true) === 1)
pruefe('Messurteil „kein deutsch" belegt kein Häkchen', ohneBeleg(9, true) === 1)
pruefe('Weg ohne Urteil (auch mit Umriss) ist kein Fehler', ohneBeleg(4, undefined) === 0)
const handNein = primeTitelMitBeleg([{ anilistId: 5, platform: 'primevideo', dub: false, checkedAt: '2026-10-01' }], {}, {})
pruefe('Hand-Nein ist kein Beleg für ein Häkchen', primeHakenOhneBeleg([primeWeg(5, true)], handNein).length === 1)

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-vertrauen: ok')
