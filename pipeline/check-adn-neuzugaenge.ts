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

console.log('\nSerie ohne Videos (Drossel: nach einer leeren Antwort 24 Stunden Ruhe, mit `vde` in der Liste sofort wieder):')
{
  const STUNDE = 3600_000
  const T0 = Date.parse('2026-10-14T06:00:00Z')
  const leere = (languages: string[]): ReadonlyMap<number, AdnListenEintrag> => new Map([[600, { ...film(600, 'Noch ohne deutsche Fassung'), languages }]])
  const stand = { '600': new Date(T0).toISOString() }
  const nach = (stunden: number, liste = leere([])) => unbekannteSerien(liste, new Set(), stand, T0 + stunden * STUNDE).length
  pruefe('Sechs Stunden nach der leeren Antwort wird nicht noch einmal gefragt', nach(6) === 0, nach(6))
  pruefe('Auch nach 23 Stunden nicht', nach(23) === 0)
  pruefe('Nach 24 Stunden wieder', nach(24) === 1)
  pruefe('Ohne Stand wird gefragt (nie beantwortet)', unbekannteSerien(leere([]), new Set(), {}, T0).length === 1)
  pruefe('Nennt die Liste jetzt `vde`, wird sofort gefragt', nach(6, leere(['vostde', 'vde'])) === 1)
  pruefe('Nennt die Liste nur Untertitel, bleibt die Ruhe', nach(6, leere(['vostde'])) === 0)

  // Ablauf über mehrere Läufe im Sechs-Stunden-Takt: ADN schaltet die Serie 30 Stunden nach der leeren Antwort frei, die Liste hinkt (nennt `vde` nicht).
  const freigabe = T0 + 30 * STUNDE
  let abrufe = 0
  let sichtbarNach: number | undefined
  const stand2: Record<string, string> = { '600': new Date(T0).toISOString() }
  for (let h = 6; h <= 72 && sichtbarNach === undefined; h += 6) {
    const jetzt = T0 + h * STUNDE
    const dran = unbekannteSerien(leere([]), new Set(), stand2, jetzt)
    const lauf = await sammleNeuzugaenge(dran, async (id) => (abrufe++, { videos: jetzt >= freigabe ? [video(id, ['vde'])] : [] }), keinePause)
    for (const id of lauf.gefragt) stand2[String(id)] = new Date(jetzt).toISOString()
    if (lauf.shows.length) sichtbarNach = h - 30
  }
  pruefe('Die Freigabe (hier nach 30 Stunden) wird spätestens 24 Stunden plus einen Lauf später sichtbar', sichtbarNach !== undefined && sichtbarNach <= 24 + 6, sichtbarNach)
  pruefe('Bis dahin gab es höchstens 3 Abrufe statt 8 (alle sechs Stunden)', abrufe <= 3, abrufe)
  const fehlerStand: Record<string, string> = {}
  const nachFehler = await sammleNeuzugaenge(unbekannteSerien(leere([]), new Set(), fehlerStand, T0), async () => ({ videos: [], abbruch: '503' }), keinePause)
  pruefe('Ein Abruffehler gilt nicht als Antwort: kein Stand, im nächsten Lauf wieder dran', nachFehler.gefragt.length === 0 && nachFehler.offen.join() === '600')
}

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
