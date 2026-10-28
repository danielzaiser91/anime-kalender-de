/**
 * Test von `lib/cr-frisch.ts`: wann die gelesene Seite einer Crunchyroll-Serie noch gilt und wann sie neu drankommt.
 * Erwartete Werte stehen fest im Test. Die Fälle des Umbaus (Stand vor dem Herauslösen aus `scrape-crunchyroll-dub.ts`) und die der
 * Folgenkennung (zwei Folgen am selben Tag) stehen getrennt.
 */
import type { CrSerie } from './lib/crunchyroll-dub.ts'
import { crFrisch, type FrischKontext } from './lib/cr-frisch.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const kontext = (k: Partial<FrischKontext> = {}): FrischKontext => ({
  katalogJetzt: 'de',
  neuSeit: new Map(),
  nurNeu: false,
  nurFehler: false,
  befundGrenze: '2026-10-01',
  fehlerGrenze: '2026-10-21',
  ...k,
})
const serie = (s: Partial<CrSerie> = {}): CrSerie => ({ url: 'https://www.crunchyroll.com/de/series/GT00371866/x', seriesId: 'GT00371866', katalog: 'de', geprueftAm: '2026-10-27', ...s })

/* Umbau: dieselben Antworten wie die Schließung vorher. */
pruefe('Befund innerhalb seiner Frist: frisch', crFrisch(serie({ geprueftAm: '2026-10-05' }), kontext()))
pruefe('Befund genau an der Fristgrenze: frisch', crFrisch(serie({ geprueftAm: '2026-10-01' }), kontext()))
pruefe('Befund einen Tag vor der Fristgrenze: neu', !crFrisch(serie({ geprueftAm: '2026-09-30' }), kontext()))
pruefe('Nichtauskunft innerhalb der kurzen Frist: frisch', crFrisch(serie({ fehler: 'x', geprueftAm: '2026-10-21' }), kontext()))
pruefe('Nichtauskunft einen Tag davor: neu', !crFrisch(serie({ fehler: 'x', geprueftAm: '2026-10-20' }), kontext()))
pruefe('„nicht verfügbar“ zählt als Befund (lange Frist)', crFrisch(serie({ fehler: 'x', nichtVerfuegbar: true, geprueftAm: '2026-10-05' }), kontext()))
pruefe('anderer Katalog: neu, egal wie jung', !crFrisch(serie({ katalog: 'us' }), kontext()))
pruefe('Katalog nicht belegt: entscheidet nicht, die Frist gilt (wie vor dem Umbau)', crFrisch(serie({ katalog: undefined }), kontext()))
pruefe('ohne Zugang (kein Katalog gefragt): der Katalog entscheidet nicht', crFrisch(serie({ katalog: 'us' }), kontext({ katalogJetzt: undefined })))
pruefe('neue Folge nach dem letzten Blick: neu', !crFrisch(serie(), kontext({ neuSeit: new Map([['GT00371866', '2026-10-28']]) })))
pruefe('neue Folge am Tag des letzten Blicks: frisch (nur Datum)', crFrisch(serie(), kontext({ neuSeit: new Map([['GT00371866', '2026-10-27']]) })))
pruefe('neue Folge einer anderen Serie: ohne Wirkung', crFrisch(serie(), kontext({ neuSeit: new Map([['G4PH0WX5J', '2026-10-28']]) })))
pruefe('--nur-neu: abgelaufene Frist gilt als frisch', crFrisch(serie({ geprueftAm: '2026-08-01' }), kontext({ nurNeu: true })))
pruefe('--nur-neu: neue Folge nach dem Blick bleibt neu', !crFrisch(serie({ geprueftAm: '2026-08-01' }), kontext({ nurNeu: true, neuSeit: new Map([['GT00371866', '2026-10-28']]) })))
pruefe('--nur-fehler: ohne Fehler frisch, mit Fehler neu', crFrisch(serie({ geprueftAm: '2026-08-01' }), kontext({ nurFehler: true })) && !crFrisch(serie({ fehler: 'x' }), kontext({ nurFehler: true })))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
