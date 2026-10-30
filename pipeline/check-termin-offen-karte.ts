/**
 * Zusicherung (30.10.2026, F77): Ist die Synchro angekündigt und der deutsche Termin offen, trägt eine eigene Karte „Termin offen“
 * den Anbieter, „Stand <Datum> · Quelle“ und den Knopf „Bescheid bei Termin“. Der Anbieter steht nur dort (nicht mehr als Nebenzeile
 * des Kastens und nicht unter „Weitere Anbieter“); der Knopf schaltet dieselbe Merkung wie das ☆ im Kopf (`onToggleFavorite`).
 * Gerendert wird der Rahmen, den `DetailPanel` benutzt, samt Klick. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { KastenRahmen } = await import('../web/src/components/detail/kasten-leer.tsx')
const { sortiereNachZugang } = await import('../web/src/components/detail/wege-sortieren.ts')
const { TEXTE_ZEILEN } = await import('../web/src/lib/i18n-zeilen.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* The Vermilion Mask, wörtlich aus dem Datenstand vom 30.10.2026 (Anbieter-Adresse, Ankündigung, beide Quellen). */
const LINEUP = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-anime-lineup-herbst-2026'
const SYNCHROS = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-deutsche-synchros-herbst-2026'
const SERIE = 'https://www.crunchyroll.com/de/watch/GE00384363JAJP'
const vermilion = {
  id: 195571,
  slug: 'the-vermilion-mask-195571',
  format: 'TV',
  jpYear: 2026,
  titleEn: 'The Vermilion Mask',
  genres: [],
  keywords: [],
  streams: [{ platform: 'crunchyroll', url: SERIE, kind: 'stream', zugang: 'abo' }],
  ankuendigung: { platform: 'crunchyroll', omuAb: '2026-10-10', synchro: 'angekuendigt', quellen: [LINEUP, SYNCHROS], stand: '2026-09-15' },
} as unknown as Title

const T = (k: string, v?: Record<string, string | number>): string => {
  const text = (TEXTE_ZEILEN as Record<string, string>)[k] ?? AUS_I18N[k] ?? k
  return text.replace(/\{(\w+)\}/g, (_, n: string) => String(v?.[n] ?? ''))
}
/* Die Schlüssel des Kastens liegen in `i18n.tsx`; hier nur die, die dieser Fall rendert (wörtlich von dort). */
const AUS_I18N: Record<string, string> = {
  'antwort.synchroAngekuendigt': 'Deutsche Synchro angekündigt',
  'antwort.omuAb': 'mit Untertiteln ab {wann}',
  'antwort.omuSeit': 'mit Untertiteln seit {wann}',
  'antwort.synchroTerminOffen': 'Synchro-Termin offen',
  'antwort.synchroOffen': 'Synchro offen',
  'antwort.ohneTitel': 'Noch keine deutsche Fassung',
  'antwort.ankuendigungQuelle': 'Laut {anbieter}, Stand {datum}',
  'detail.stand': 'Stand {datum}',
}

const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const gemerkt: number[] = []

const wurzel = createRoot(dom.wurzel as unknown as Element)
async function rendere(title: Title, antwort: object, favorites = new Set<number>(), verbunden = false): Promise<MiniKnoten> {
  const e = {
    antwort,
    title,
    releases: [],
    terminReleases: [],
    streamReleases: [],
    discAusgaben: [],
    discReleases: [],
    tvVorbei: [],
    wegeHinweis: undefined,
    kastenNotiz: undefined,
    folgenLuecke: null,
    folgenListe: false,
    sortiertNachZugang: sortiereNachZugang({ title }),
    t: T,
    today: '2026-10-30',
    favorites,
    onToggleFavorite: (id: number) => void gemerkt.push(id),
    verbindung: { verbunden, mail: verbunden ? 'a@b.de' : undefined },
    folgenAngabeFuer: () => '',
    dubZeilen: () => [],
    releaseJePlattform: new Map(),
  }
  await act(async () => wurzel.render(h(KastenRahmen, e as never)))
  return dom.wurzel
}
const OHNE = { art: 'ohne' }
const zaehle = (text: string, wort: string): number => text.split(wort).length - 1
const knopf = (w: MiniKnoten): MiniKnoten | undefined => w.finde((k) => k.tagName === 'BUTTON' && k.getAttribute('aria-pressed') !== null)[0]

console.log('\nVermilion Mask: Synchro angekündigt, Termin offen')
{
  const w = await rendere(vermilion, OHNE)
  const text = w.textContent
  const karte = w.finde((k) => k.tagName === 'SECTION' && k.getAttribute('aria-label') === 'Termin offen')[0]
  pruefe('die Karte „Termin offen“ steht da', !!karte, text)
  pruefe('der Kasten trägt die Überschrift „Deutsche Synchro angekündigt“', text.includes('Deutsche Synchro angekündigt'))
  pruefe('Stand und Quelle in der Karte', !!karte && karte.textContent.includes('Stand 15.09.2026') && karte.textContent.includes('Quelle'), karte?.textContent)
  const quelle = karte?.finde((k) => k.tagName === 'A' && k.textContent.startsWith('Quelle'))[0]
  pruefe('die Quelle ist der Synchro-Artikel', quelle?.getAttribute('href') === SYNCHROS, quelle?.getAttribute('href'))
  pruefe('der Start mit Untertiteln steht in der Karte', !!karte && karte.textContent.includes('Mit Untertiteln seit 10.10.2026.'), karte?.textContent)
  pruefe('Crunchyroll steht genau einmal da (nicht mehr unter „Weitere Anbieter“, nicht in der Nebenzeile)', zaehle(text, 'Crunchyroll') === 1, text)
  pruefe('der Anbieter in der Karte ist der Link zur Serie', w.finde((k) => k.tagName === 'A' && k.getAttribute('href') === SERIE && k.textContent === 'Crunchyroll').length === 1)
  pruefe('keine Überschrift „Weitere Anbieter“ mehr', !text.includes('Weitere Anbieter'), text)
  pruefe('„Synchro-Termin offen“ steht nicht noch einmal als Nebenzeile', !text.includes('Synchro-Termin offen'), text)
  pruefe('der Knopf heißt „Bescheid bei Termin“', knopf(w)?.textContent.includes('Bescheid bei Termin') === true, knopf(w)?.textContent)
  pruefe('der Knopf ist noch nicht gedrückt', knopf(w)?.getAttribute('aria-pressed') === 'false')
  const kasten = w.finde((k) => k.tagName === 'SECTION' && k.getAttribute('aria-label') === null)[0]
  pruefe('der Kasten behält nur die Überschrift: keine Mindesthöhe', !!kasten && !(kasten.getAttribute('class') ?? '').includes('min-h-[11rem]'), kasten?.getAttribute('class'))
  pruefe('Tippziele ≥ 44 px: Knopf und Quelle haben min-h-11', (knopf(w)?.getAttribute('class') ?? '').includes('min-h-11') && (quelle?.getAttribute('class') ?? '').includes('min-h-11'))
  const taste = knopf(w)
  if (taste) klicke(dom.wurzel, taste)
  pruefe('der Klick schaltet die Merkung des Titels (wie das ☆ im Kopf)', JSON.stringify(gemerkt) === '[195571]', gemerkt)
}

console.log('\nStart mit Untertiteln liegt noch in der Zukunft')
{
  const spaeter = { ...vermilion, ankuendigung: { ...vermilion.ankuendigung!, omuAb: '2999-01-01' } } as Title
  const w = await rendere(spaeter, OHNE)
  pruefe('„Mit Untertiteln ab 01.01.2999.“', w.textContent.includes('Mit Untertiteln ab 01.01.2999.'), w.textContent)
}

console.log('\nVermilion Mask: schon gemerkt')
for (const [verbunden, hinweis] of [[true, 'Wir schreiben dir, sobald es einen Termin gibt.'], [false, 'Melde dich noch beim Newsletter an, dann sagen wir Bescheid.']] as const) {
  const w = await rendere(vermilion, OHNE, new Set([195571]), verbunden)
  pruefe(`gemerkt${verbunden ? ' (Newsletter verbunden)' : ' (nicht verbunden)'}: Knopf gedrückt, Hinweis „${hinweis}“`, knopf(w)?.getAttribute('aria-pressed') === 'true' && knopf(w)?.textContent.includes('Gemerkt') === true && w.textContent.includes(hinweis), w.textContent)
}

console.log('\nOhne Karte bleibt der Kasten, wie er war')
{
  const angekuendigt = vermilion.ankuendigung!
  const faelle: [string, Title, object][] = [
    ['Ankündigung ohne Synchro („offen“): Nebenzeile und Anbieter-Pille bleiben', { ...vermilion, ankuendigung: { ...angekuendigt, synchro: 'offen' } } as Title, OHNE],
    ['andere Antwort („widerlegt“): keine Karte', vermilion, { art: 'widerlegt', datum: '2026-10-03', grund: 'x' }],
    ['westlicher Titel: keine Karte', { ...vermilion, westlich: true } as Title, OHNE],
  ]
  for (const [name, title, antwort] of faelle) {
    const w = await rendere(title, antwort)
    pruefe(`${name}`, w.finde((k) => k.tagName === 'SECTION' && k.getAttribute('aria-label') === 'Termin offen').length === 0 && !w.textContent.includes('Bescheid bei Termin'), w.textContent)
    if (antwort === OHNE && !(title as { westlich?: boolean }).westlich) {
      pruefe('… die Pille des Anbieters steht weiter da (Link zur Serie)', w.finde((k) => k.tagName === 'A' && k.getAttribute('href') === SERIE).length === 1)
      pruefe('… die Nebenzeile nennt „Synchro offen“', w.textContent.includes('Synchro offen'), w.textContent)
    }
  }
}

await act(async () => wurzel.unmount())
dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-termin-offen-karte: ok (Karte, Anbieter einmal, Knopf bis onToggleFavorite, Gegenfälle ohne Karte)')
