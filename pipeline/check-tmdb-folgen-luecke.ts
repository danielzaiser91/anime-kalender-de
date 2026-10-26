/**
 * Zusicherungen zu `lib/tmdb-folgen-luecke.ts`: Lücke nur im belegt deutschen Bereich (leer oder „Folge N"), Auswahl nur ohne Eintrag,
 * größte Lücke zuerst, Riegel, Probelauf `nurLuecke`. Die erwarteten Werte stehen hier fest, nicht aus dem Modul.
 * Aufruf: `npm run check:logic`.
 */
import { ABRUFE_JE_TITEL, LUECKE_ABRUFE, LUECKE_LIMIT, dubLuecke, streicheFremdeKennungen, waehleAbrufe, waehleLuecke, type FolgenDatei } from './lib/tmdb-folgen-luecke.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const datei = (f: (string | number)[][], de: [number, number][]): FolgenDatei => ({ f, de })

console.log('\nTMDB-Lücke: Zählung')
pruefe('leerer Titel im Dub-Bereich', dubLuecke(datei([[1, 'Anfang'], [2, '']], [[1, 2]])) === 1)
pruefe('Platzhalter „Folge 2" und „Episode 3"', dubLuecke(datei([[1, 'Anfang'], [2, 'Folge 2'], [3, 'Episode 3']], [[1, 3]])) === 2)
pruefe('genau eine Lücke zählt 1', dubLuecke(datei([[1, '']], [[1, 1]])) === 1)
pruefe('Lücke außerhalb des Dub-Bereichs zählt nicht', dubLuecke(datei([[1, 'Anfang'], [2, '']], [[1, 1]])) === 0)
pruefe('Bereichsgrenzen gelten beidseitig', dubLuecke(datei([[1, ''], [2, ''], [3, ''], [4, '']], [[2, 3]])) === 2)
pruefe('zweiter Bereich', dubLuecke(datei([[1, ''], [5, ''], [9, '']], [[1, 1], [9, 9]])) === 2)
pruefe('ohne Dub-Bereich keine Lücke', dubLuecke({ f: [[1, '']] }) === 0)
pruefe('ohne Datei keine Lücke', dubLuecke(undefined) === 0)
pruefe('Zeile mit Laufzeit (3 Felder)', dubLuecke(datei([[1, '', 24]], [[1, 1]])) === 1)
pruefe('echter Titel mit „Folge" im Text zählt nicht', dubLuecke(datei([[1, 'Die letzte Folge']], [[1, 1]])) === 0)
pruefe('Titel nur aus Leerzeichen', dubLuecke(datei([[1, '  ']], [[1, 1]])) === 1)

console.log('\nTMDB-Lücke: Auswahl')
const ke = (id: string, episodes: number | null): { id: string; t: { streams?: unknown[]; episodes?: number | null } } => ({ id, t: { streams: id.startsWith('s') ? [{}] : [], episodes } })
const k = (id: string): ReturnType<typeof ke> => ke(id, 12)
const ids = (l: { id: string }[]): string => l.map((x) => x.id).join(',')
const luecken: Record<string, number> = { a: 1, b: 5, c: 0, d: 5, e: 2, sf: 3 }
const l = (id: string): number => luecken[id] ?? 0
pruefe('größte Lücke zuerst, Gleichstand nach Katalog, ohne Lücke fehlt', ids(waehleLuecke(['a', 'b', 'c', 'd', 'e'].map(k), {}, l, 10)) === 'b,d,e,a')
pruefe('Titel mit Eintrag fehlt', ids(waehleLuecke(['a', 'b', 'e'].map(k), { b: {} }, l, 10)) === 'e,a')
pruefe('Riegel 2', ids(waehleLuecke(['a', 'b', 'd', 'e'].map(k), {}, l, 2)) === 'b,d')
pruefe('Riegel 1', ids(waehleLuecke(['a', 'e'].map(k), {}, l, 1)) === 'e')
pruefe('Riegel 0', ids(waehleLuecke(['a', 'e'].map(k), {}, l, 0)) === '')

console.log('\nTMDB-Lücke: Riegel aus dem Abrufbudget')
pruefe('900 Abrufe, 7 je Titel', LUECKE_ABRUFE === 900 && ABRUFE_JE_TITEL === 7)
pruefe('Standard-Limit 128 Titel', LUECKE_LIMIT === 128)

console.log('\nTMDB-Lücke: gemeinsame Auswahl')
const alt = { geholtAm: '2026-09-01', folgen: [{ s: 1, e: 1, titel: 'Der Anfang', en: 'Ep 1', datum: '2026-08-20' }] }
const w = (nurLuecke: boolean, limit: number, bestand = {}, alterTage = 30): string =>
  ids(waehleAbrufe({ alle: ['a', 'b', 'sf', 'sx', 'sy'].map(k), bestand: { sx: alt, ...bestand }, heute: '2026-10-24', alterTage, limit, nurLuecke, luecke: l }))
pruefe('Lückentitel (auch ohne Anbieter) vor den Fälligen mit Anbieter', w(false, 10) === 'b,sf,a,sx,sy', w(false, 10))
pruefe('Lücketitel mit Anbieter erscheint nur einmal', w(false, 10).split(',').filter((x) => x === 'sf').length === 1)
pruefe('Titel ohne Anbieter und ohne Lücke bleibt draußen', !w(false, 10).includes('c'))
pruefe('Gesamtlimit 2', w(false, 2) === 'b,sf')
const viele = Array.from({ length: 130 }, (_, i) => k(`z${i}`))
const alle = (nurLuecke: boolean, limit: number): number =>
  waehleAbrufe({ alle: viele, bestand: {}, heute: '2026-10-24', alterTage: 30, limit, nurLuecke, luecke: () => 1 }).length
pruefe('Lückenanteil im regulären Lauf auf 128 begrenzt', alle(false, 400) === 128, alle(false, 400))
pruefe('Probelauf ist ebenfalls auf 128 gedeckelt, auch mit größerem Limit', alle(true, 129) === 128 && alle(true, 400) === 128)
pruefe('Probelauf unter dem Deckel folgt dem eigenen Limit', alle(true, 20) === 20 && alle(true, 128) === 128)
pruefe('Probelauf nur Lücke', w(true, 10) === 'b,sf,a', w(true, 10))
pruefe('Grundfrist des Aufrufs gilt: 60 Tage lassen den 53 Tage alten Eintrag draußen', w(false, 10, {}, 60) === 'b,sf,a,sy', w(false, 10, {}, 60))
const folgen = (alle: ReturnType<typeof k>[], nurLuecke: boolean): string => ids(waehleAbrufe({ alle, bestand: {}, heute: '2026-10-24', alterTage: 30, limit: 10, nurLuecke, luecke: l }))
pruefe('Unbekannte Folgenzahl: Lückentitel zählt', folgen([ke('a', null)], true) === 'a')
pruefe('Eine Folge: kein Lückentitel', folgen([ke('a', 1)], true) === '')
pruefe('Zwei Folgen: Lückentitel', folgen([ke('a', 2)], true) === 'a')
pruefe('Unbekannte Folgenzahl: regulär nicht fällig', folgen([ke('sy', null)], false) === '')
pruefe('Zwei Folgen: regulär fällig', folgen([ke('sy', 2)], false) === 'sy')
pruefe('Eine Folge: regulär nicht fällig', folgen([ke('sy', 1)], false) === '')
pruefe('Probelauf: Limit 1', w(true, 1) === 'b')
pruefe('Probelauf: Titel mit Eintrag fehlt', w(true, 10, { b: alt }) === 'sf,a')

console.log('\nTMDB-Lücke: überholte Kennung')
const folgenBestand: Record<string, { tmdbId?: number }> = { 1: { tmdbId: 10 }, 2: { tmdbId: 20 }, 3: { tmdbId: 30 } }
const gestrichen = streicheFremdeKennungen(folgenBestand, { 1: { tmdbId: 10 }, 2: { tmdbId: 21 } })
pruefe('andere und fehlende Kennung wird gestrichen, gleiche bleibt', gestrichen.join() === '2,3' && Object.keys(folgenBestand).join() === '1', [gestrichen, folgenBestand])
const ohneTitel: Record<string, { tmdbId?: number }> = { 1: { tmdbId: 10 } }
pruefe('leere tmdb-titles.json streicht nichts', streicheFremdeKennungen(ohneTitel, {}).length === 0 && Object.keys(ohneTitel).join() === '1', ohneTitel)

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Lücke: alle Zusicherungen halten.')
