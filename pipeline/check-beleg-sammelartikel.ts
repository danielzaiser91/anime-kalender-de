/**
 * Prüft den Zuschnitt des Beleg-Bilds bei einem Sammelartikel (ein Abschnitt je Titel, `pipeline/lib/beleg-bild.ts`, `beleg-stelle.ts`, `beleg-suche.ts`):
 * Der Ausschnitt muss bei der Überschrift des obersten Titels beginnen, nicht bei der Fundstelle des tiefsten (Psyren, 27.10.2026).
 * Aufruf: npx tsx pipeline/check-beleg-sammelartikel.ts   (Exit 1 bei Verstoß)
 */
import { chromium } from 'playwright'
import { belegAusschnitt } from './lib/beleg-bild.ts'
import { fensterStart } from './lib/beleg-stelle.ts'
import { gruppenJeAdresse, suchbegriffeJeAdresse, tageJeAdresse, zuordnungFuerLesen, type BestandLeser } from './lib/beleg-suche.ts'
import type { NewsEintrag, Release, Title } from '../shared/types.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, info = ''): void => {
  console.log(ok ? '✓' : '✗', name, info)
  if (!ok) fehler++
}

/** Vier Abschnitte (300, 1300, 2100 und 1300 Pixel); der Name „Psyren“ steht auch im Fließtext des Nachbarn darüber. Der erste Titel liegt 3792 Pixel über der Fundstelle des tiefsten: Das Fenster eines Sammelartikels (6000) fasst alle vier — mit Zwischenstück (`zwischen`) nicht mehr. */
const ABSCHNITT = (hoehe: number, kopf: string, text: string): string => `<section style="height:${hoehe}px"><h2>${kopf}</h2><p>${text}</p></section>`
const sammelartikel = (zwischen: number): string => `<article><h1>Deutsche Synchros im Herbst 2026</h1><p>Die Übersicht aller Titel mit deutscher Synchronfassung im Herbst.</p>${[
  ABSCHNITT(300, 'Reborn as a Space Mercenary', 'Aus der Feder des Machers von Psyren, mit viel Weltraum und noch mehr Söldnern.'),
  zwischen ? `<div style="height:${zwischen}px">Anderes Zeug ohne Titel dieser Übersicht.</div>` : '',
  ABSCHNITT(1300, 'PSYREN', 'Inhalt: Eine Gruppe Jugendlicher wird in eine Parallelwelt gezogen und muss überleben.'),
  ABSCHNITT(2100, 'Fillertitel Zwei Beispiel', 'Inhalt: Ein Text über einen weiteren Titel dieser Übersicht, ohne Datum.'),
  ABSCHNITT(1300, 'Die Tagebücher der Apothekerin Staffel 3', 'Die Tagebücher der Apothekerin Staffel 3 startet am 2. Oktober 2026 mit deutscher Synchronfassung.'),
].join('')}</article>`
const GRUPPEN = [
  { id: 1, suchen: ['Psyren'], tage: [] },
  { id: 2, suchen: ['Fillertitel Zwei Beispiel'], tage: [] },
  { id: 3, suchen: ['Die Tagebücher der Apothekerin Staffel 3'], tage: ['2026-10-02'] },
  { id: 4, suchen: ['Reborn as a Space Mercenary'], tage: [] },
  { id: 5, suchen: ['Ein Titel, den der Artikel nicht nennt'], tage: [] },
]

/** Breite des WebP-Bildes in Pixeln (Kopf `VP8X` oder `VP8 `): 520 bei einfacher, 1040 bei doppelter Auflösung. */
const bildBreite = (bild: Buffer): number => (bild.toString('latin1', 12, 16) === 'VP8X' ? 1 + bild.readUIntLE(24, 3) : bild.readUInt16LE(26) & 0x3fff)

async function sammelartikelFall(zwischen: number): Promise<void> {
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await seite.setContent(`<!doctype html><html><body style="margin:0">${sammelartikel(zwischen)}</body></html>`)
  const alleNamen = GRUPPEN.flatMap((g) => g.suchen)
  const b = await belegAusschnitt(seite, alleNamen, ['2026-10-02'], GRUPPEN)
  await browser.close()
  const m = typeof b === 'object' ? b.markierungen : undefined
  const grund = typeof b === 'object' ? b.ohneMarke : undefined
  const wort = zwischen ? 'Zwischenstück' : 'Sammelartikel'
  pruefe(`${wort}: Bild entsteht`, typeof b === 'object')
  pruefe(`${wort}: der Titel mitten im Artikel hat seine Marke`, Boolean(m?.['1']), JSON.stringify(m?.['1']))
  pruefe(`${wort}: auch Titel 2 und 3 haben eine Marke`, Boolean(m?.['2'] && m['3']))
  pruefe(`${wort}: ein Titel, den der Artikel nicht nennt, hat den Grund nicht-gefunden`, grund?.['5'] === 'nicht-gefunden' && !m?.['5'], JSON.stringify(grund))
  if (!m?.['1'] || !m['2'] || !m['3']) return
  /* Die Abschnitte sind gleich hoch: stehen die Marken auf den Überschriften, sind ihre Abstände gleich — eine Marke im Fließtext des Nachbarn verschöbe die erste. */
  const abstand1 = m['2'][1] - m['1'][1]
  const abstand2 = m['3'][1] - m['2'][1]
  pruefe(`${wort}: die Marke sitzt auf der Überschrift, nicht im Fließtext des Nachbarn`, Math.abs(abstand1 / abstand2 - 1300 / 2100) < 0.03, `Abstände ${abstand1.toFixed(3)} / ${abstand2.toFixed(3)}`)
  if (typeof b !== 'object') return
  if (zwischen) {
    pruefe('Zwischenstück: der Titel über dem Fenster hat keine Marke (kein falsches Bild), aber den Grund ausserhalb', !m['4'] && grund?.['4'] === 'ausserhalb', JSON.stringify(grund))
  } else {
    pruefe('Sammelartikel: auch der oberste Titel, 3792 Pixel über dem tiefsten, hat seine Marke (Rayearth)', Boolean(m['4']) && !grund?.['4'], JSON.stringify(grund))
    pruefe('Sammelartikel: der Ausschnitt über 3600 Pixel ist einfach aufgelöst (Breite 520)', bildBreite(b.bild) === 520, String(bildBreite(b.bild)))
  }
}

function fensterFaelle(): void {
  pruefe('Fenster: höchste Fundstelle, die mit der untersten zusammen passt, minus 16', fensterStart([400, 1800, 3300], 4800, 3600) === 1784)
  pruefe('Fenster: eine Fundstelle zu weit oben bleibt draußen', fensterStart([100, 3300], 4800, 3600) === 3284)
  pruefe('Fenster: genau an der Grenze passt', fensterStart([1232], 4800, 3600) === 1216)
  pruefe('Fenster: eine Zeile darunter passt nicht', fensterStart([1231], 4800, 3600) === undefined)
  pruefe('Fenster: Fundstelle nahe dem Seitenanfang wird nicht negativ', fensterStart([5], 100, 3600) === 0)
  pruefe('Fenster: ohne Fundstelle kein Fenster', fensterStart([], 4800, 3600) === undefined)
}

/** Psyren: Meldung (`news.json`) nennt die Adresse, kein Release trägt sie. */
function newsFaelle(): void {
  const url = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/x'
  const release = { titleId: 3, name: 'Apothekerin', sources: [url], schedule: { firstEpisodeDate: '2026-10-02' } } as unknown as Release
  const titles = [{ id: 1, titleEn: 'Psyren (TV)' }, { id: 3, titleRomaji: 'Kusuriya' }] as unknown as Title[]
  const news = [
    { am: '2026-09-15', titelId: 1, titel: 'Psyren', slug: 'p', meldungen: [{ belege: [{ url, name: 'CR' }] }] },
    { am: '2026-09-15', titelId: 9, titel: 'Teilreihe', slug: 't', meldungen: [{ teilId: 5, quelle: url }, { quelle: 'kein Link' }] },
  ] as unknown as NewsEintrag[]
  const dateien: Record<string, unknown> = { 'releases.json': [release], 'titles.json': titles, 'news.json': news }
  const lese = (<T>(pfad: string, vorgabe: T): T => (dateien[pfad.split('/').pop()!] as T | undefined) ?? vorgabe) as BestandLeser
  const z = zuordnungFuerLesen(lese)
  const g = z.gruppen.get(url) ?? []
  pruefe('Gruppen: Titel nur aus einer Meldung erscheint', g.some((x) => x.id === 1 && x.suchen.includes('Psyren') && x.suchen.includes('Psyren (TV)') && x.tage.length === 0))
  pruefe('Gruppen: die Teilreihe der Meldung zählt mit ihrer Kennung', g.some((x) => x.id === 5 && x.suchen.join() === 'Teilreihe'))
  pruefe('Gruppen: der Titel mit Termin behält Namen und Tag', g.some((x) => x.id === 3 && x.tage.join() === '2026-10-02' && x.suchen.includes('Kusuriya')))
  pruefe('Gruppen: genau drei Titel, keine Meldung ohne Adresse', g.length === 3, String(g.length))
  pruefe('Gruppen: ohne Meldungen wie bisher nur der Titel mit Termin', (gruppenJeAdresse([release], titles).get(url) ?? []).length === 1)
  const s = z.suchbegriffe.get(url) ?? []
  pruefe('Zuordnung: die Starttage kommen weiter aus den Terminen', z.tage.get(url)?.join() === '2026-10-02')
  pruefe('Suchbegriffe: Name aus der Meldung steht darin', s.includes('Psyren') && s.includes('Teilreihe') && s.includes('Apothekerin'))
  pruefe('Suchbegriffe: auch die anderen Namen des Meldungstitels stehen darin', s.includes('Psyren (TV)'))
  pruefe('Gruppen: eine Quelle, die keine Adresse ist, wird kein Schlüssel', !z.gruppen.has('kein Link') && !z.suchbegriffe.has('kein Link'))
  pruefe('Suchbegriffe: ohne Meldungen fehlt er', !(suchbegriffeJeAdresse([release], titles).get(url) ?? []).includes('Psyren'))
}

/** Ein Artikel für einen Titel bleibt bei Fenster 3600 und doppelter Auflösung: Liegt die Fundstelle 4600 px unter dem Kopf, beginnt das Bild 500 px davor (Marke weit unten). */
async function einzelFall(): Promise<void> {
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const html = `<article><h1>Ein Titel im Artikel</h1><p>Vorspann.</p><div style="height:4500px">Anderes Zeug.</div>${ABSCHNITT(300, 'Einzeltitel Beispiel', 'Inhalt: Der einzige Titel dieses Artikels.')}</article>`
  await seite.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`)
  const b = await belegAusschnitt(seite, ['Einzeltitel Beispiel'], [], [{ id: 1, suchen: ['Einzeltitel Beispiel'], tage: [] }])
  await browser.close()
  pruefe('Einzeltitel: Bild entsteht', typeof b === 'object')
  if (typeof b !== 'object') return
  pruefe('Einzeltitel: das Fenster bleibt 3600 — das Bild beginnt vor der Fundstelle, nicht beim Kopf', (b.markierung?.[1] ?? 0) > 0.5 && (b.markierung?.[1] ?? 1) < 0.95, JSON.stringify(b.markierung))
  pruefe('Einzeltitel: doppelte Auflösung bleibt (Breite 1040)', bildBreite(b.bild) === 1040, String(bildBreite(b.bild)))
}

/** Verschiebungsartikel (Anime2You, 18.08.2026): Der Absatz „Betroffen sind …" nennt den Titel ohne Datum, die Tabelle darunter nennt ihn mit Datum. */
const VERSCHIEBUNG = (mitTabelle: boolean): string => `<article><h1>Sechs Blu-ray-Termine von AniMoon und Crunchyroll verschoben</h1><p>Betroffen sind unter anderem Virgin Road – Vol. 1 und Wind Breaker – Vol. 2 von AniMoon.</p><div style="height:1200px">Anderes Zeug.</div>${
  mitTabelle ? '<table><tr><td>Virgin Road – Vol. 1 (Limited Edition)</td><td>28.08.</td><td>11.09.</td></tr><tr><td>Anderer Titel – Vol. 3</td><td>04.09.</td><td>18.09.</td></tr></table>' : ''
}</article>`

async function verschiebungsFall(): Promise<void> {
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const gruppe = { id: 1, suchen: ['Virgin Road – Vol. 1', 'Virgin Road'], tage: ['2026-09-11'] }
  const ohneTag = { id: 2, suchen: ['Wind Breaker – Vol. 2'], tage: ['2026-09-18'] }
  await seite.setContent(`<!doctype html><html><body style="margin:0">${VERSCHIEBUNG(false)}</body></html>`)
  const nurAbsatz = await belegAusschnitt(seite, ['Virgin Road'], ['2026-09-11'], [gruppe])
  await seite.setContent(`<!doctype html><html><body style="margin:0">${VERSCHIEBUNG(true)}</body></html>`)
  const mitTabelle = await belegAusschnitt(seite, ['Virgin Road'], ['2026-09-11'], [gruppe])
  const ohneDatum = await belegAusschnitt(seite, ['Virgin Road'], [], [])
  const zwei = await belegAusschnitt(seite, ['Virgin Road', 'Wind Breaker'], ['2026-09-11'], [gruppe, ohneTag])
  /* Der Name steht nur in der Überschrift h1: `stuetzstelle` liest sie nicht, die zweite Suche in `messeAusschnitt` schon — ohne Termin gilt sie weiter. */
  await seite.setContent('<!doctype html><html><body style="margin:0"><article><h1>Zorro Staffel 2 startet bald auf Deutsch</h1><p>Ein Absatz mit genug Text, damit das Bild nicht einfarbig ist und der Ausschnitt etwas zu zeigen hat.</p><p>Noch ein Absatz mit Text, der keinen Namen nennt.</p></article></body></html>')
  const kurzerName = await belegAusschnitt(seite, ['Zorro'], [], [])
  await browser.close()
  pruefe('Verschiebung: Absatz ohne Datum bekommt keine Marke, obwohl er den Titel nennt', typeof nurAbsatz === 'object' && !nurAbsatz.markierung, JSON.stringify(typeof nurAbsatz === 'object' ? nurAbsatz.markierung : nurAbsatz))
  pruefe('Verschiebung: die Tabellenzeile mit dem Datum bekommt die Marke, weit unter dem Absatz', typeof mitTabelle === 'object' && (mitTabelle.markierung?.[1] ?? 0) > 0.3, JSON.stringify(typeof mitTabelle === 'object' ? mitTabelle.markierung : mitTabelle))
  pruefe('Verschiebung: ohne Termin gilt weiter eine Stelle mit dem Titel (kein Termin zu belegen)', typeof ohneDatum === 'object' && Boolean(ohneDatum.markierung),JSON.stringify(typeof ohneDatum === 'object' ? ohneDatum.markierung : ohneDatum))
  pruefe('Ohne Termin sucht `messeAusschnitt` den Namen weiter selbst (Name nur in der Überschrift)', typeof kurzerName === 'object' && Boolean(kurzerName.markierung), JSON.stringify(typeof kurzerName === 'object' ? kurzerName.markierung : kurzerName))
  pruefe('Verschiebung: Sammelartikel — der Titel mit Datum hat seine Marke, der ohne Datum im Text den Grund', typeof zwei === 'object' && Boolean(zwei.markierungen?.['1']) && !zwei.markierungen?.['2'] && zwei.ohneMarke?.['2'] === 'nicht-gefunden', JSON.stringify(typeof zwei === 'object' ? [zwei.markierungen, zwei.ohneMarke] : zwei))
}

/** Eine überholte Quelle nennt ihren alten Tag: Er gehört zu den Tagen ihrer Adresse, ein Text statt eines Tags nicht. */
function sagtFaelle(): void {
  const alt = 'https://www.anime2you.de/news/1042244/x/'
  const neu = 'https://www.anisearch.de/article/198024,y'
  const r = {
    titleId: 1,
    name: 'Virgin Road – Vol. 1',
    sources: [alt, neu],
    schedule: { firstEpisodeDate: '2026-11-06' },
    quellen: [{ url: alt, sagt: '2026-09-11' }, { url: neu, sagt: '2026-11-06' }, { url: alt, sagt: 'bald' }],
  } as unknown as Release
  const g = gruppenJeAdresse([r], []).get(alt)?.[0]?.tage ?? []
  pruefe('Tage: die überholte Adresse nennt ihren alten Tag und den heutigen', g.sort().join() === '2026-09-11,2026-11-06', g.join())
  pruefe('Tage: die aktuelle Adresse nennt nur ihren Tag (nicht den alten der anderen)', (gruppenJeAdresse([r], []).get(neu)?.[0]?.tage ?? []).join() === '2026-11-06')
  const t = tageJeAdresse([r])
  pruefe('Tage je Adresse: alter und heutiger Tag, kein Text', t.get(alt)?.sort().join() === '2026-09-11,2026-11-06', JSON.stringify([...t]))
}

fensterFaelle()
sagtFaelle()
newsFaelle()
await sammelartikelFall(0)
await sammelartikelFall(2600)
await einzelFall()
await verschiebungsFall()
console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Sammelartikel-Zuschnitt: Fenster, Meldungstitel und Marken je Titel in Ordnung')
process.exit(fehler ? 1 : 0)
