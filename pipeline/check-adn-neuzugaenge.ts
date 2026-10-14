/**
 * Zusicherungen zu `lib/adn-neuzugaenge.ts` (13.10.2026, vier Bleach-Filme): Eine neue Serie der ADN-Liste kommt im nächsten Lauf `--laufend`
 * (alle sechs Stunden, `.github/workflows/adn-laufende.yml`) in Archiv und Katalog, nicht erst im Wochenlauf. Ohne die Neuzugangs-Abfrage
 * ist „Änderung wird spätestens nach sechs Stunden sichtbar“ falsch: Der Film bliebe bis zum nächsten Montag unbekannt.
 */
import { readFileSync } from 'node:fs'
import { katalogMitNeuen, sammleNeuzugaenge, unbekannteSerien } from './lib/adn-neuzugaenge.ts'
import type { AdnListenEintrag, AdnVideo } from './lib/adn-folgen.ts'
import type { AdnShow } from './lib/adn.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const film = (id: number, title: string): AdnListenEintrag => ({ id, title, originalTitle: null, age: '12+' })
const video = (id: number, sprachen: string[]): AdnVideo =>
  ({ id: id * 10, number: 'Film', shortNumber: 'Film', type: 'MOV', releaseDate: '2026-10-12T07:00:00Z', languages: sprachen, url: `https://animationdigitalnetwork.com/de/video/${id}-x/${id * 10}-film`, show: { id, title: 'x', originalTitle: null, age: '12+' } }) as AdnVideo

const liste = new Map([film(197, 'Bleach: Memories of Nobody - Movie 1'), film(352, 'Bleach: Fade to Black - Movie 3'), film(500, 'Nur Untertitel'), film(1, 'Bekannte Serie')].map((e) => [e.id, e]))
const antworten: Record<number, { videos: AdnVideo[]; abbruch?: string }> = {
  197: { videos: [video(197, ['vostde', 'vde'])] },
  352: { videos: [], abbruch: '503' },
  500: { videos: [video(500, ['vostde'])] },
}
const gefragt: number[] = []
const lade = async (id: number) => {
  gefragt.push(id)
  return antworten[id] ?? { videos: [] }
}
const keinePause = async () => {}

console.log('\nWer ist neu:')
const neu = unbekannteSerien(liste, new Set([1]))
pruefe('Bekannte Serie (Katalog oder Archiv) wird nicht noch einmal gefragt', !neu.some((e) => e.id === 1), neu.map((e) => e.id))
pruefe('Drei neue Serien', neu.length === 3, neu.map((e) => e.id))

console.log('\nErster Lauf (spätestens nach sechs Stunden sichtbar):')
const ergebnis = await sammleNeuzugaenge(neu, lade, keinePause)
pruefe('Film mit vde steht im Katalog, mit Adresse der Serie und fromCatalog', ergebnis.shows.length === 1 && ergebnis.shows[0]!.showId === 197 && ergebnis.shows[0]!.url.endsWith('/de/video/197') && ergebnis.shows[0]!.fromCatalog === true, ergebnis.shows)
pruefe('Seine Folge trägt Datum und Uhrzeit in Berlin', ergebnis.shows[0]?.episodes[0]?.date === '2026-10-12' && ergebnis.shows[0]?.episodes[0]?.time === '09:00', ergebnis.shows[0]?.episodes)
pruefe('Serie nur mit Untertiteln: ins Archiv, nicht in den Katalog', ergebnis.archiv.has(500) && !ergebnis.shows.some((s) => s.showId === 500))
pruefe('Abruffehler: weder Archiv noch Katalog, im nächsten Lauf wieder neu', ergebnis.offen.join() === '352' && !ergebnis.archiv.has(352), ergebnis.offen)

console.log('\nZweiter Lauf:')
const katalog: AdnShow[] = katalogMitNeuen([], ergebnis.shows)
const bekannt = new Set([1, ...katalog.map((s) => s.showId), ...ergebnis.archiv.keys()])
pruefe('Nur der fehlgeschlagene Film ist noch unbekannt', unbekannteSerien(liste, bekannt).map((e) => e.id).join() === '352')
const zweimal = katalogMitNeuen(katalog, ergebnis.shows)
pruefe('Derselbe Eintrag kommt nicht doppelt in den Katalog', zweimal.length === 1)
const fremd = katalogMitNeuen([{ ...ergebnis.shows[0]!, title: 'Alter Stand' }], ergebnis.shows)
pruefe('Ein vorhandener Eintrag bleibt unverändert', fremd.length === 1 && fremd[0]!.title === 'Alter Stand')

console.log('\nTakt:')
const lauf = readFileSync('.github/workflows/adn-laufende.yml', 'utf8')
pruefe('Der Lauf alle sechs Stunden ruft data:adn:laufend auf (dort hängt die Neuzugangs-Abfrage)', lauf.includes('npm run data:adn:laufend'))
const paket = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
pruefe('data:adn:laufend ist fetch-adn.ts --laufend', paket.scripts['data:adn:laufend']?.includes('fetch-adn.ts --laufend') === true, paket.scripts['data:adn:laufend'])
const quelle = readFileSync('pipeline/fetch-adn.ts', 'utf8')
pruefe('--laufend ruft holeNeueSerien auf', /--laufend[\s\S]*?await holeNeueSerien\(\)/.test(quelle))
pruefe('Der Katalogeintrag und die Katalogdatei stehen in tools/quellen-liste.sh', /data\/adn-catalog\.json/.test(readFileSync('tools/quellen-liste.sh', 'utf8')))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
