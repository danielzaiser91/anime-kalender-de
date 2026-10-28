/**
 * Zusicherungen zu `lib/adn-katalog-warteschlange.ts` (28.10.2026): Stand-Schlüssel ohne Archivdatei (388 von 661) kamen nie in die Warteschlange des
 * Katalog-Laufs; je Lauf wurden 273 gefragt. Schlüssel 50, 53, 57 stammen wörtlich aus `adn-katalog-stand.json` (Stempel 23.10.2026, ohne Archivdatei).
 */
import { aelteste, fragWarteschlange, type LaufHilfen, mitTitelAusAntwort, standOhneKopf, warteschlangeZeile } from './lib/adn-katalog-warteschlange.ts'
import type { AdnListenEintrag, AdnVideo } from './lib/adn-folgen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const stand = { '22': '2026-10-26T05:14:57.488Z', '50': '2026-10-23T20:02:14.538Z', '53': '2026-10-23T20:02:14.538Z', '57': '2026-10-23T20:02:14.538Z', kaputt: 'x', '0': 'x', '-5': 'x' }
const bekannt = new Set([22])

const ohne = standOhneKopf(stand, bekannt)
pruefe('Schlüssel ohne Archivdatei (50, 53, 57) kommen in die Warteschlange', JSON.stringify(ohne.map((e) => e.id)) === '[50,53,57]', ohne.map((e) => e.id))
pruefe('bekannte Kennung (22) wird nicht doppelt aufgenommen', !ohne.some((e) => e.id === 22))
pruefe('ungültige Schlüssel (kaputt, 0, -5) fallen heraus', ohne.length === 3, ohne.length)
pruefe('leerer Stand ergibt nichts', standOhneKopf({}, bekannt).length === 0)

// Umlauf: 661 Serien, Limit 400, Stempel wie im Lauf nach jeder Antwort setzen — nach zwei Läufen war jede Serie dran.
const alle: AdnListenEintrag[] = Array.from({ length: 661 }, (_, i) => ({ id: 1000 + i, title: `S${i}` }))
const laufStand: Record<string, string> = {}
const gesehen = new Set<number>()
for (let lauf = 1; lauf <= 2; lauf++) {
  const dran = aelteste(alle, laufStand, 400)
  for (const e of dran) {
    gesehen.add(e.id)
    laufStand[String(e.id)] = `2026-11-0${lauf}T05:00:00.000Z`
  }
  pruefe(`Lauf ${lauf}: genau 400 gefragt`, dran.length === 400, dran.length)
}
pruefe('nach zwei Läufen sind alle 661 Serien einmal gefragt worden', gesehen.size === 661, gesehen.size)
pruefe('Limit 0 fragt alle', aelteste(alle, {}, 0).length === 661)
pruefe('Limit über der Zahl fragt alle', aelteste(alle, {}, 700).length === 661)
const reihe = aelteste(alle.slice(0, 3), { '1000': '2026-10-01T00:00:00Z', '1001': '2026-09-01T00:00:00Z' }, 2).map((e) => e.id)
pruefe('ältester Stempel zuerst, nie gefragt vor allen', JSON.stringify(reihe) === '[1002,1001]', reihe)

const video = { show: { id: 50, title: 'Titel aus Antwort', originalTitle: 'Orig', age: '12+' } } as AdnVideo
pruefe('Titel kommt aus der Antwort, wenn der Eintrag keinen trägt', mitTitelAusAntwort({ id: 50, title: '' }, [video]).title === 'Titel aus Antwort')
pruefe('vorhandener Titel bleibt', mitTitelAusAntwort({ id: 50, title: 'Eigen' }, [video]).title === 'Eigen')
pruefe('ohne Videos bleibt der Titel leer', mitTitelAusAntwort({ id: 50, title: '' }, []).title === '')

pruefe('Logzeile nennt N von M', warteschlangeZeile(400, 661) === 'ADN-Katalog: 400 von 661 Serien in der Warteschlange gefragt', warteschlangeZeile(400, 661))

// Umbau-Beleg (A3): `aelteste` reiht wie der alte Aufruf in `fetchCatalog` (`alle.sort(nach Stempel).slice(0, limit)`), mit Gleichständen und fehlenden Stempeln.
const altStand: Record<string, string> = {}
for (let i = 0; i < 661; i += 1) if (i % 7 !== 0) altStand[String(1000 + i)] = `2026-10-${String(10 + (i % 15)).padStart(2, '0')}T0${i % 6}:00:00.000Z`
const alterAlt = (id: number): number => Date.parse(altStand[String(id)] ?? '') || 0
const alteReihe = [...alle].sort((a, b) => alterAlt(a.id) - alterAlt(b.id)).slice(0, 600).map((e) => e.id)
const neueReihe = aelteste(alle, altStand, 600).map((e) => e.id)
pruefe('Reihenfolge bei Limit 600 gleich dem alten Sortieraufruf', JSON.stringify(alteReihe) === JSON.stringify(neueReihe))

// Umlauf mit Attrappen (A1): `fragWarteschlange` ist der Schleifenkörper von `fetchCatalog`.
function hilfen(antworten: Record<number, { videos: AdnVideo[]; abbruch?: string }>, zeiten: string[], archiviert: number[]): LaufHilfen {
  return {
    ladeSerie: async (id) => antworten[id] ?? { videos: [] },
    archiviere: (id) => void archiviert.push(id),
    pause: async () => {},
    jetzt: () => zeiten.shift() ?? 'Z',
    log: () => {},
    warn: () => {},
  }
}
const ep = (id: number, show: object): AdnVideo => ({ id, show, number: '1', releaseDate: '2026-10-01T10:00:00Z', languages: ['vde'] }) as unknown as AdnVideo
{
  const zeiten = ['T1', 'T2']
  const archiviert: number[] = []
  const stand2: Record<string, string> = {}
  const lauf = await fragWarteschlange(
    [{ id: 50, title: '' }, { id: 51, title: 'Eigen' }],
    stand2,
    hilfen({ 50: { videos: [ep(1, { id: 50, title: 'Aus Antwort' })] }, 51: { videos: [ep(2, { id: 51, title: 'X' })] } }, zeiten, archiviert),
  )
  pruefe('Umlauf: Serie ohne Titel nimmt ihn aus der Antwort', lauf.shows.map((s) => s.title).sort().join('|') === 'Aus Antwort|Eigen', lauf.shows.map((s) => s.title))
  pruefe('Umlauf: Stempel und Archiv je beantworteter Serie', JSON.stringify(stand2) === '{"50":"T1","51":"T2"}' && archiviert.join() === '50,51', { stand2, archiviert })
}
{
  const lauf = await fragWarteschlange([{ id: 60, title: '' }], {}, hilfen({ 60: { videos: [] } }, [], []))
  pruefe('Umlauf: ohne Titel und ohne Videos entsteht keine Serie', lauf.shows.length === 0)
}

console.log(verletzt ? `✖ ${verletzt} Zusicherung(en) verletzt` : '✓ adn-katalog-warteschlange: 19 Zusicherungen erfüllt')
process.exit(verletzt ? 1 : 0)
