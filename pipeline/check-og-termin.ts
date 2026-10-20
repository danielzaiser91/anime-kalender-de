/**
 * Zusicherungen zur Datumszeile im Vorschaubild (14.10.2026): Erscheinen mehrere belegte Folgen am selben Tag (Avatar: Die sieben Häfen,
 * freitags drei), steht „Nächste Folgen" wie im Panel; eine Folge je Woche bleibt „Nächste Folge". Feste Daten, kein echter Titel.
 * Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { terminKopf, terminZeilen } from './lib/og-termin.ts'

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

/* TV-Sichtung (auto-21-tv-prosieben-maxx u. a.): Das Panel schließt `sichtung` aus dem Block aus (`folgenblockBis`), das Vorschaubild muss gleich entscheiden. */
const sichtung = { ...plan({ 1: '2026-03-13', 2: '2026-03-13', 3: '2026-03-13' }), platform: 'tv', tvLetzteSichtung: '2026-03-01' } as unknown as Release
pruefe('Sichtung: drei Folgen am Tag sind kein Block (wie im Panel)', datumsZeile(sichtung) === 'Nächste Folge', datumsZeile(sichtung))

/* Nummern mit Lücke am selben Tag (Folge 1 und 3): kein lückenloser Block, also Einzahl wie im Panel. */
const luecke = plan({ 1: '2026-03-13', 3: '2026-03-13', 4: '2026-03-20' })
pruefe('Lücke: Folge 1 und 3 am selben Tag sind kein Block', datumsZeile(luecke) === 'Nächste Folge', datumsZeile(luecke))

/* Kino-Bild: Datumsmarke, Folgen daneben, Uhrzeit darunter (`terminKopf`). */
function kopf(release: Release, heute = HEUTE) {
  return terminKopf(release, expandEvents(release), heute)
}
const eq = (name: string, ist: unknown, soll: unknown) => pruefe(name, JSON.stringify(ist) === JSON.stringify(soll), `${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)

eq('Kopf Block: Spanne 4–6 von 6, Datum ohne Jahr', kopf(plan({ 1: '2026-03-06', 2: '2026-03-06', 3: '2026-03-06', 4: '2026-03-13', 5: '2026-03-13', 6: '2026-03-13' })), { datum: 'Fr, 13.03.', folge: 'Folgen 4–6 von 6', fakt: 'Uhrzeit noch offen' })
eq('Kopf einzeln: Folge 2 von 6', kopf(plan({ 1: '2026-03-06', 2: '2026-03-13', 3: '2026-03-20', 4: '2026-03-27', 5: '2026-04-03', 6: '2026-04-10' }))?.folge, 'Folge 2 von 6')
eq('Kopf anderes Jahr: Jahr steht dabei', kopf(plan({ 1: '2026-03-06', 2: '2026-03-13' }), '2025-12-31')?.datum, 'Fr, 06.03.2026')
eq('Kopf ohne künftigen Termin: keine Folgen, Bedeutung darunter', kopf(fertig), { datum: 'Mo, 02.03.', folge: '', fakt: 'erste Folge' })
eq('Kopf ohne Termine: undefiniert', kopf({ ...fertig, schedule: { ...fertig.schedule, observed: {}, firstEpisodeDate: undefined, lastEpisodeDate: undefined, episodeCount: 0 } } as unknown as Release), undefined)

const angenommen = plan({ 1: '2026-03-13', 2: '2026-03-20' })
angenommen.schedule.episodeCountAssumed = true
eq('Kopf angenommene Folgenzahl trägt ≈', kopf(angenommen)?.folge, 'Folge 1 von ≈6')

const ohneZahl = plan({ 1: '2026-03-13', 2: '2026-03-20' })
ohneZahl.schedule.episodeCount = undefined
eq('Kopf ohne Folgenzahl: „Folge 1“', kopf(ohneZahl)?.folge, 'Folge 1')

const katalogZukunft = { ...plan({ 1: '2026-03-13' }), releaseType: 'batch', dateMeaning: 'available-from' } as unknown as Release
eq('Kopf Katalog künftig: Bedeutung vor der Uhrzeit, keine Folgen', kopf(katalogZukunft), { datum: 'Fr, 13.03.', folge: '', fakt: 'im Angebot ab diesem Tag · Uhrzeit noch offen' })
const katalogVorbei = { ...plan({ 1: '2026-03-02' }), releaseType: 'batch', dateMeaning: 'available-from' } as unknown as Release
eq('Kopf Katalog vorbei: „im Angebot seit diesem Tag"', kopf(katalogVorbei), { datum: 'Mo, 02.03.', folge: '', fakt: 'im Angebot seit diesem Tag' })
const disc = { ...plan({ 1: '2026-03-13' }), releaseType: 'disc' } as unknown as Release
eq('Kopf Disc künftig: „im Handel"', kopf(disc), { datum: 'Fr, 13.03.', folge: '', fakt: 'im Handel' })

eq('Kopf: ein Termin am heutigen Tag ist der künftige', kopf(plan({ 1: '2026-03-03', 2: '2026-03-10', 3: '2026-03-17' }))?.folge, 'Folge 2 von 6')
const staffelPaket = { ...plan({ 1: '2026-03-13', 2: '2026-03-13' }), releaseType: 'batch' } as unknown as Release
eq('Kopf Staffelpaket: keine Folgenzeile, auch mit Nummern', kopf(staffelPaket)?.folge, '')
const erst ={ ...plan({ 1: '2026-03-02' }), erstausgabe: true } as unknown as Release
eq('Kopf Erstausgabe vorbei: „Erstveröffentlichung"', kopf(erst)?.fakt, 'Erstveröffentlichung')

const mitZeit = plan({ 1: '2026-03-13' })
mitZeit.schedule.time = '18:00'
eq('Kopf belegte Uhrzeit: „18:00 Uhr"', kopf(mitZeit)?.fakt, '18:00 Uhr')
mitZeit.schedule.timeEstimated = true
eq('Kopf übliche Uhrzeit trägt ≈', kopf(mitZeit)?.fakt, '≈ 18:00 Uhr')

if (fehler) process.exit(1)
console.log('check-og-termin: ok')
