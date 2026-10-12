/**
 * Zusicherungen zur Plattform Paramount+ (10.10.2026): Farbe mit Kontrast, Adresse, Zugangsart, Suchlink
 * und der Eintrag „Avatar: Die sieben Häfen" mit seinen Folgenblöcken. Läuft in `check:logic`.
 */
import { adressePasst, plattformAusAdresse } from '../shared/adresse-passt.ts'
import { platformSearchUrl } from '../shared/plattform-suche.ts'
import { expandEvents } from '../shared/logic.ts'
import { PLATFORMS, type Release } from '../shared/types.ts'
import { zugangsart } from '../shared/zugangsart.ts'
import { kontrast, rgb } from '../web/src/lib/kontrast.ts'
import { loadCurated } from './lib/curated.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, detail = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/* Gründe aus `web/src/styles.css`: Seite, Karte, zweite Fläche in Hell und Dunkel. */
const GRUENDE = ['#f5f4f0', '#ffffff', '#ebe9e3', '#0d0f14', '#151922', '#1b202a']
const farbe = PLATFORMS.paramountplus.color
const schwach = GRUENDE.filter((g) => kontrast(rgb(farbe), rgb(g)) < 3)
pruefe('Paramount+-Blau hält 3:1 gegen alle Gründe beider Themen', schwach.length === 0, schwach.join(', '))

pruefe('Paramount+ heißt „Paramount+"', PLATFORMS.paramountplus.name === 'Paramount+')
pruefe('paramountplus.com gehört zu Paramount+', adressePasst('https://www.paramountplus.com/de/shows/x/', 'paramountplus'))
pruefe('… und wird aus der Adresse erkannt', plattformAusAdresse('https://www.paramountplus.com/de/') === 'paramountplus')
pruefe('Paramount+ ist ein Abo', zugangsart('paramountplus') === 'abo')
pruefe('Suchlink führt auf die deutsche Suche', platformSearchUrl('paramountplus', 'Avatar')?.startsWith('https://www.paramountplus.com/de/search/') === true)

const eintrag = loadCurated().find((e) => e.slug === 'avatar-die-sieben-haefen-paramountplus')
pruefe('Avatar: Die sieben Häfen steht bei Paramount+', eintrag?.platform === 'paramountplus')
if (eintrag) {
  const release = { ...eintrag, titleId: eintrag.anilistId ?? -1, name: eintrag.titleDe ?? eintrag.slug, year: 2026 } as unknown as Release
  const je = new Map<string, number>()
  for (const e of expandEvents(release)) je.set(e.date, (je.get(e.date) ?? 0) + 1)
  const ist = [...je].sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => `${d}:${n}`).join(' ')
  pruefe('Folgenblöcke 3·3·3·4 am 09., 16., 23., 30.10.', ist === '2026-10-09:3 2026-10-16:3 2026-10-23:3 2026-10-30:4', ist)
}

if (fehler) process.exit(1)
console.log('check-paramount: ok')
