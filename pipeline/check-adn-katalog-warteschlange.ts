/**
 * Zusicherungen zu `lib/adn-katalog-warteschlange.ts` (28.10.2026): Stand-Schlüssel ohne Archivdatei (388 von 661) kamen nie in die Warteschlange des
 * Katalog-Laufs; je Lauf wurden 273 gefragt. Schlüssel 50, 53, 57 stammen wörtlich aus `adn-katalog-stand.json` (Stempel 23.10.2026, ohne Archivdatei).
 */
import { aelteste, baueWarteschlange, fragWarteschlange, type LaufHilfen, mitTitelAusAntwort, standOhneKopf, warteschlangeZeile } from './lib/adn-katalog-warteschlange.ts'
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

// Zwei Grenzen (Entscheidung 28.10.2026): bekannte Serien bis `limit`, Gespenster zusätzlich höchstens 130, ältester Stempel zuerst.
{
  const bekannte = Array.from({ length: 273 }, (_, i) => ({ id: 2000 + i, title: `B${i}` }))
  const geister: Record<string, string> = {}
  for (let i = 0; i < 388; i++) geister[String(5000 + i)] = `2026-10-${String(1 + (i % 20)).padStart(2, '0')}T00:00:00.000Z`
  const q = baueWarteschlange(bekannte, geister, 600)
  const ids = q.alle.map((e) => e.id)
  pruefe('alle 273 bekannten bleiben bei Limit 600 in der Schlange', bekannte.every((e) => ids.includes(e.id)), ids.length)
  pruefe('Gespenster höchstens 130 je Lauf', q.alle.length === 273 + 130 && q.vorLimit === 273 + 388, { laenge: q.alle.length, vorLimit: q.vorLimit })
  pruefe('Gespenster stehen hinter den bekannten', ids.slice(0, 273).every((id) => id < 5000))
  const geisterIds = ids.slice(273).map(Number)
  const alleAlter = Object.entries(geister).map(([k, v]) => [Number(k), Date.parse(v)] as const).sort((a, b) => a[1] - b[1])
  const grenze = alleAlter[129][1]
  pruefe('es sind die 130 ältesten Stempel', geisterIds.every((id) => Date.parse(geister[String(id)]) <= grenze), geisterIds.length)
  pruefe('ein Gespenst-Schlüssel mit Archivdatei (bekannt) wird nicht doppelt gefragt', ids.length === new Set(ids).size)
  pruefe('Limit 0 fragt alle, auch alle Gespenster', baueWarteschlange(bekannte, geister, 0).alle.length === 273 + 388)
  pruefe('131 Gespenster bei Limit 5 → 130', baueWarteschlange([], Object.fromEntries(Array.from({ length: 131 }, (_, i) => [String(9000 + i), 'x'])), 5).alle.length === 130)
  pruefe('130 Gespenster → alle 130', baueWarteschlange([], Object.fromEntries(Array.from({ length: 130 }, (_, i) => [String(9000 + i), 'x'])), 5).alle.length === 130)
}

// Fehlantwort (A4/A6): stempelt, zählt getrennt, die Serie rückt im nächsten Lauf nach hinten; fünf Fehler in Folge beenden den Lauf.
{
  const zeilen: string[] = []
  const archiviert: number[] = []
  const stand3: Record<string, string> = { '70': '2026-10-01T00:00:00.000Z' }
  const h = hilfen({ 70: { videos: [], abbruch: '503' }, 71: { videos: [ep(3, { id: 71, title: 'Gut' })] } }, ['T1', 'T2'], archiviert)
  const lauf = await fragWarteschlange([{ id: 70, title: '' }, { id: 71, title: '' }], stand3, { ...h, log: (t) => void zeilen.push(t) })
  pruefe('Fehlantwort: Stempel gesetzt, aber nicht entschieden', stand3['70'] === 'T1' && !lauf.auskunft.entschieden.has(70) && lauf.auskunft.gefragt.has(70), stand3)
  pruefe('Fehlantwort: Serie dahinter wird weiter gefragt', lauf.shows.length === 1 && stand3['71'] === 'T2')
  pruefe('Logzeile „N gefragt, davon M ohne Antwort“', zeilen.includes('ADN-Katalog: 2 gefragt, davon 1 ohne Antwort'), zeilen)
  pruefe('Archiv bleibt bei Fehlantwort unberührt', !archiviert.includes(70))
  const naechster = aelteste([{ id: 70, title: '' }, { id: 71, title: '' }, { id: 72, title: '' }], { ...stand3, '72': '2026-10-02T00:00:00.000Z', '70': '2026-10-28T10:00:00.000Z', '71': '2026-10-28T09:00:00.000Z' }, 3).map((e) => e.id)
  pruefe('nächster Lauf: ältere Stempel (72, 71) vor der Fehlserie (70)', JSON.stringify(naechster) === '[72,71,70]', naechster)
}
{
  // Umlauf über zwei Läufe: 6 stumme Gespenster vorn, danach gute; Bremse nach 5 Fehlern in Folge, Lauf 2 beginnt hinten bei den Ungefragten.
  const ids = [80, 81, 82, 83, 84, 85, 86, 87]
  const antworten: Record<number, { videos: AdnVideo[]; abbruch?: string }> = {}
  for (const id of ids.slice(0, 6)) antworten[id] = { videos: [], abbruch: 'franzoesisch' }
  const stand4: Record<string, string> = {}
  const eintraege = ids.map((id) => ({ id, title: '' }))
  let zaehler = 0
  const h4 = { ...hilfen(antworten, [], []), jetzt: () => `2026-11-01T00:00:${String(10 + zaehler++)}.000Z` }
  const l1 = await fragWarteschlange(aelteste(eintraege, stand4, 8), stand4, h4)
  pruefe('Lauf 1: nach fünf Fehlern in Folge beendet, fünf gefragt', l1.auskunft.gefragt.size === 5 && Object.keys(stand4).length === 5, l1.auskunft.gefragt.size)
  const reihe2 = aelteste(eintraege, stand4, 8).map((e) => e.id)
  pruefe('Lauf 2 beginnt bei den nie gefragten (85, 86, 87, dann 80…)', JSON.stringify(reihe2.slice(0, 3)) === '[85,86,87]', reihe2)
}

// A2: erstes Video ohne show.title, zweites mit; Übernahme von originalTitle und age nur, wenn der Eintrag sie nicht trägt.
{
  const ohneTitel = { show: { id: 50, title: '' } } as unknown as AdnVideo
  const mitTitel = { show: { id: 50, title: 'T2', originalTitle: 'O2', age: '16+' } } as unknown as AdnVideo
  const a = mitTitelAusAntwort({ id: 50, title: '' }, [ohneTitel, mitTitel])
  pruefe('Titel kommt vom ersten Video, das einen show.title trägt', a.title === 'T2' && a.originalTitle === 'O2' && a.age === '16+', a)
  const b = mitTitelAusAntwort({ id: 50, title: '', originalTitle: 'EO', age: '6+' }, [mitTitel])
  pruefe('originalTitle und age des Eintrags bleiben vor denen der Antwort', b.originalTitle === 'EO' && b.age === '6+', b)
  const c = mitTitelAusAntwort({ id: 50, title: '' }, [ohneTitel])
  pruefe('Video ohne show.title ergibt keinen Titel', c.title === '', c)
}

// Bremse und Archiv: vier Fehler, eine gute Antwort, vier Fehler laufen durch; leere Antwort archiviert nichts, gute schon.
{
  const antworten: Record<number, { videos: AdnVideo[]; abbruch?: string }> = {}
  for (const id of [90, 91, 92, 93, 95, 96, 97, 98]) antworten[id] = { videos: [], abbruch: '503' }
  antworten[94] = { videos: [ep(4, { id: 94, title: 'Mitte' })] }
  antworten[99] = { videos: [] }
  const archiviert: number[] = []
  const lauf = await fragWarteschlange(Array.from({ length: 10 }, (_, i) => ({ id: 90 + i, title: '' })), {}, hilfen(antworten, [], archiviert))
  pruefe('eine gute Antwort setzt die Fehlerfolge zurück: alle 10 gefragt', lauf.auskunft.gefragt.size === 10, lauf.auskunft.gefragt.size)
  pruefe('nur die beantwortete Serie mit Videos wird archiviert', archiviert.join() === '94', archiviert)
  pruefe('beantwortete Serien (94, 99) sind entschieden, Fehlserien nicht', [...lauf.auskunft.entschieden].sort().join() === '94,99', [...lauf.auskunft.entschieden])
}

console.log(verletzt ? `✖ ${verletzt} Zusicherung(en) verletzt` : '✓ adn-katalog-warteschlange: 39 Zusicherungen erfüllt')
process.exit(verletzt ? 1 : 0)
