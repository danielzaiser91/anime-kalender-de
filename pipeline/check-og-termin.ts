/**
 * Zusicherungen zur Datumszeile im Vorschaubild (14.10.2026): Erscheinen mehrere belegte Folgen am selben Tag (Avatar: Die sieben Häfen,
 * freitags drei), steht „Nächste Folgen" wie im Panel; eine Folge je Woche bleibt „Nächste Folge". Feste Daten, kein echter Titel.
 * Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { terminZeilen } from './lib/og-termin.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const HEUTE = '2026-03-10'

function plan(observed: Record<number, string>): Release {
  const tage = Object.values(observed).sort()
  return {
    slug: 'og-test',
    titleId: 1,
    name: 'Ogtest',
    platform: 'paramountplus',
    platformUrl: 'https://www.paramountplus.com/de/shows/test/',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: tage[0], lastEpisodeDate: tage[tage.length - 1], episodeCount: 6, observed },
    sources: [],
  } as unknown as Release
}

function datumsZeile(release: Release): string | undefined {
  return terminZeilen(release, expandEvents(release), HEUTE)[0]?.label
}

const block = plan({ 1: '2026-03-06', 2: '2026-03-06', 3: '2026-03-06', 4: '2026-03-13', 5: '2026-03-13', 6: '2026-03-13' })
pruefe('Block: drei Folgen am nächsten Tag = „Nächste Folgen"', datumsZeile(block) === 'Nächste Folgen', datumsZeile(block))

const einzeln = plan({ 1: '2026-03-06', 2: '2026-03-13', 3: '2026-03-20', 4: '2026-03-27', 5: '2026-04-03', 6: '2026-04-10' })
pruefe('Gegenprobe: eine Folge je Woche = „Nächste Folge"', datumsZeile(einzeln) === 'Nächste Folge', datumsZeile(einzeln))

const fertig = plan({ 1: '2026-03-02', 2: '2026-03-02', 3: '2026-03-02' })
pruefe('Gegenprobe: ohne künftigen Termin bleibt es „Erste Folge" (kein Plural)', datumsZeile(fertig) === 'Erste Folge', datumsZeile(fertig))

if (fehler) process.exit(1)
console.log('check-og-termin: ok')
