/**
 * Prüft den Zuschnitt des Beleg-Bilds bei einem Sammelartikel (ein Abschnitt je Titel, `pipeline/lib/beleg-bild.ts`, `beleg-stelle.ts`, `beleg-suche.ts`):
 * Der Ausschnitt muss bei der Überschrift des obersten Titels beginnen, nicht bei der Fundstelle des tiefsten (Psyren, 27.10.2026).
 * Aufruf: npx tsx pipeline/check-beleg-sammelartikel.ts   (Exit 1 bei Verstoß)
 */
import { chromium } from 'playwright'
import { belegAusschnitt } from './lib/beleg-bild.ts'
import { fensterStart } from './lib/beleg-stelle.ts'
import { gruppenJeAdresse, suchbegriffeJeAdresse } from './lib/beleg-suche.ts'
import type { NewsEintrag, Release, Title } from '../shared/types.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, info = ''): void => {
  console.log(ok ? '✓' : '✗', name, info)
  if (!ok) fehler++
}

/** Vier Abschnitte à 1500 Pixel; der Name „Psyren“ steht auch im Fließtext des Nachbarn darüber. Der tiefste Titel (mit Datum) liegt über 3600 Pixel unter dem Kopf. */
const ABSCHNITT = (kopf: string, text: string): string => `<section style="height:1500px"><h2>${kopf}</h2><p>${text}</p></section>`
const SAMMELARTIKEL = `<article><h1>Deutsche Synchros im Herbst 2026</h1><p>Die Übersicht aller Titel mit deutscher Synchronfassung im Herbst.</p>${[
  ABSCHNITT('Reborn as a Space Mercenary', 'Aus der Feder des Machers von Psyren, mit viel Weltraum und noch mehr Söldnern.'),
  ABSCHNITT('PSYREN', 'Inhalt: Eine Gruppe Jugendlicher wird in eine Parallelwelt gezogen und muss überleben.'),
  ABSCHNITT('Fillertitel Zwei Beispiel', 'Inhalt: Ein Text über einen weiteren Titel dieser Übersicht, ohne Datum.'),
  ABSCHNITT('Die Tagebücher der Apothekerin Staffel 3', 'Die Tagebücher der Apothekerin Staffel 3 startet am 2. Oktober 2026 mit deutscher Synchronfassung.'),
].join('')}</article>`
const GRUPPEN = [
  { id: 1, suchen: ['Psyren'], tage: [] },
  { id: 2, suchen: ['Fillertitel Zwei Beispiel'], tage: [] },
  { id: 3, suchen: ['Die Tagebücher der Apothekerin Staffel 3'], tage: ['2026-10-02'] },
  { id: 4, suchen: ['Reborn as a Space Mercenary'], tage: [] },
]

async function sammelartikelFall(): Promise<void> {
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await seite.setContent(`<!doctype html><html><body style="margin:0">${SAMMELARTIKEL}</body></html>`)
  const alleNamen = GRUPPEN.flatMap((g) => g.suchen)
  const b = await belegAusschnitt(seite, alleNamen, ['2026-10-02'], GRUPPEN)
  await browser.close()
  const m = typeof b === 'object' ? b.markierungen : undefined
  pruefe('Sammelartikel: Bild entsteht', typeof b === 'object')
  pruefe('Sammelartikel: der Titel mitten im Artikel hat seine Marke', Boolean(m?.['1']), JSON.stringify(m?.['1']))
  pruefe('Sammelartikel: auch Titel 2 und 3 haben eine Marke', Boolean(m?.['2'] && m['3']))
  if (!m?.['1'] || !m['2'] || !m['3']) return
  /* Die Abschnitte sind gleich hoch: stehen die Marken auf den Überschriften, sind ihre Abstände gleich — eine Marke im Fließtext des Nachbarn verschöbe die erste. */
  const abstand1 = m['2'][1] - m['1'][1]
  const abstand2 = m['3'][1] - m['2'][1]
  pruefe('Sammelartikel: die Marke sitzt auf der Überschrift, nicht im Fließtext des Nachbarn', Math.abs(abstand1 / abstand2 - 1) < 0.05, `Abstände ${abstand1.toFixed(3)} / ${abstand2.toFixed(3)}`)
  pruefe('Sammelartikel: der Titel über dem Fenster hat keine Marke (kein falsches Bild)', !m['4'])
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
  const g = gruppenJeAdresse([release], titles, news).get(url) ?? []
  pruefe('Gruppen: Titel nur aus einer Meldung erscheint', g.some((x) => x.id === 1 && x.suchen.includes('Psyren') && x.suchen.includes('Psyren (TV)') && x.tage.length === 0))
  pruefe('Gruppen: die Teilreihe der Meldung zählt mit ihrer Kennung', g.some((x) => x.id === 5 && x.suchen.join() === 'Teilreihe'))
  pruefe('Gruppen: der Titel mit Termin behält Namen und Tag', g.some((x) => x.id === 3 && x.tage.join() === '2026-10-02' && x.suchen.includes('Kusuriya')))
  pruefe('Gruppen: genau drei Titel, keine Meldung ohne Adresse', g.length === 3, String(g.length))
  pruefe('Gruppen: ohne Meldungen wie bisher nur der Titel mit Termin', (gruppenJeAdresse([release], titles).get(url) ?? []).length === 1)
  const s = suchbegriffeJeAdresse([release], titles, news).get(url) ?? []
  pruefe('Suchbegriffe: Name aus der Meldung steht darin', s.includes('Psyren') && s.includes('Teilreihe') && s.includes('Apothekerin'))
  pruefe('Suchbegriffe: ohne Meldungen fehlt er', !(suchbegriffeJeAdresse([release], titles).get(url) ?? []).includes('Psyren'))
}

fensterFaelle()
newsFaelle()
await sammelartikelFall()
console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Sammelartikel-Zuschnitt: Fenster, Meldungstitel und Marken je Titel in Ordnung')
process.exit(fehler ? 1 : 0)
