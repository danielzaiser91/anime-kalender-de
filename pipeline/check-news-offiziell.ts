/**
 * Zusicherungen zur News-Art `offiziell` (Meldungen offizieller Websites, 13.10.2026; Daniel: Die Website eines Titels gilt als offiziell, wenn die Trailer-Beschreibung sie verlinkt):
 * - die Meldung steht an dem Tag, den die Seite ihr gibt, mit der Überschrift als Beleg, und wird nie umgeschrieben;
 * - **Fenster: eine freigegebene Meldung steht 365 Tage, die übrigen Arten 120** — und überlebt die Obergrenze von 400 Einträgen (Änderung wird spätestens nach 365 Tagen unsichtbar,
 *   nicht schon nach 120 und nicht nach dem 401. Eintrag);
 * - Freigabe: ein fehlerhafter Handeintrag bricht den Bau ab, das Werkzeug übernimmt den Vorschlag wörtlich;
 * - Satz in Seite, Mail und Beleg-Fenster, Panel der Kachel.
 */
import yaml from 'js-yaml'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { FENSTER_OFFIZIELL_TAGE, KATEGORIEN_OFFIZIELL, OFFIZIELL_DATEI, offiziellFehler, offizielleLaden, offizielleMeldungen, type OffizielleMeldung } from './lib/news-offiziell.ts'
import { eintragAusVorschlag, eintragText } from './lib/news-offiziell-freigabe.ts'
import { OFFIZIELL_SATZ } from '../shared/news-offiziell-satz.ts'
import { addDays, todayIso } from '../shared/time.ts'
import type { NewsEintrag, Title } from '../shared/types.ts'
import { newsKurz, newsSatz, artLabel } from '../web/src/lib/news-text.ts'
import { meldungenImPanel } from '../web/src/components/detail/neuigkeiten-regeln.ts'
import { newsSatz as mailSatz } from '../worker/src/mail-abschnitte.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = todayIso()
const vor = (tage: number): string => addDays(HEUTE, -tage)
const SNOWBALL = 196144

const titel = (id: number, mehr: Partial<Title> = {}): Title =>
  ({ id, slug: `titel-${id}`, titleDe: `Titel ${id}`, streams: [{ platform: 'crunchyroll', url: `https://www.crunchyroll.com/series/S${id}/x`, dub: true }], ...mehr }) as unknown as Title

const meldung = (id: string, datum: string, mehr: Partial<OffizielleMeldung> = {}): OffizielleMeldung => ({
  id,
  titleId: SNOWBALL,
  kategorie: 'staffel',
  datum,
  url: `https://snowballearth.net/en/news/detail.html?d=${id}`,
  titel: 'Season 2 Production Confirmed!',
  sprache: 'en',
  freigabe: 'Test, 13.10.2026',
  ...mehr,
})

/** Lädt eine Datei im Format der Handdatei aus einer Wegwerf-Kulisse, nie aus dem Repo. */
function ladenAusKulisse(text: string): OffizielleMeldung[] {
  const wurzel = mkdtempSync(join(tmpdir(), 'news-offiziell-'))
  try {
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, OFFIZIELL_DATEI), text)
    return offizielleLaden(wurzel)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}
const fehlerBeimLaden = (text: string): string => {
  try {
    ladenAusKulisse(text)
    return ''
  } catch (err) {
    return (err as Error).message
  }
}

const neueHistorie = (): NewsHistorie => ({ zuerst: {} }) as NewsHistorie
const bau = (titles: Title[], offizielle: OffizielleMeldung[], neu: { id: number; seit: string }[] = [], historie = neueHistorie()): NewsEintrag[] =>
  baueNews(titles, [], neu, [], historie, [], [], new Set(), offizielle)
const offizielle = (liste: NewsEintrag[]) => liste.flatMap((e) => e.meldungen.filter((m) => m.art === 'offiziell').map((m) => ({ e, m })))

function meldungSelbst(): void {
  console.log('\nDie Meldung')
  const l = bau([titel(SNOWBALL)], [meldung('a1', vor(108))])
  const o = offizielle(l)[0]
  pruefe('eine Meldung der Art offiziell, am Tag der Seite (nicht am Tag des Baus)', o?.e.am === vor(108) && o.m.art === 'offiziell', l.map((e) => e.am))
  pruefe('Kategorie, Quelle und Kachel stimmen', o?.m.kategorie === 'staffel' && o.m.quelle === meldung('a1', '').url && o.e.titelId === SNOWBALL, o?.m)
  const b = o?.m.belege?.[0]
  pruefe('der Beleg trägt Adresse, Anzeigename, Tag und die Überschrift wörtlich mit Sprache', b?.name === 'snowballearth.net' && b.veroeffentlichtAm === vor(108) && b.ueberschrift?.text === 'Season 2 Production Confirmed!' && b.ueberschrift.sprache === 'en', b)
  const historie = neueHistorie()
  bau([titel(SNOWBALL)], [meldung('a1', vor(108))], [], historie)
  const spaeter = offizielle(bau([titel(SNOWBALL)], [meldung('a1', vor(50), { titel: 'Anders geschrieben' })], [], historie))[0]
  pruefe('nie umschreiben: wird Tag oder Überschrift später korrigiert, bleibt die Meldung an ihrem ersten Tag', spaeter?.e.am === vor(108), spaeter?.e.am)
  const zwei = offizielle(bau([titel(SNOWBALL)], [meldung('b1', vor(30)), meldung('b2', vor(30), { titel: 'Cast', kategorie: 'termin' })]))
  pruefe('zwei Meldungen desselben Titels am selben Tag bleiben beide (die Adresse unterscheidet sie)', zwei.length === 2, zwei.length)
  pruefe('derselbe Eintrag zweimal in der Liste ergibt eine Meldung', offizielle(bau([titel(SNOWBALL)], [meldung('c1', vor(30)), meldung('c1', vor(30))])).length === 1)
  pruefe('ein Titel, der fehlt, ergibt keine Meldung und keinen Abbruch', bau([titel(1)], [meldung('d1', vor(30))]).length === 0)
}

function fenster(): void {
  console.log(`\nFenster: ${FENSTER_OFFIZIELL_TAGE} Tage für offiziell, 120 für die übrigen`)
  const sichtbar = (tage: number): boolean => offizielle(bau([titel(SNOWBALL)], [meldung('f1', vor(tage))])).length === 1
  pruefe('108 Tage alt (Snowball am 13.10.2026): sichtbar', sichtbar(108))
  pruefe('200 Tage alt: sichtbar (die übrigen Arten sind nach 120 weg)', sichtbar(200))
  pruefe(`${FENSTER_OFFIZIELL_TAGE} Tage alt: sichtbar`, sichtbar(FENSTER_OFFIZIELL_TAGE))
  pruefe(`${FENSTER_OFFIZIELL_TAGE + 1} Tage alt: nicht mehr`, !sichtbar(FENSTER_OFFIZIELL_TAGE + 1))
  const neuVor = (tage: number) => bau([titel(7)], [], [{ id: 7, seit: vor(tage) }]).length === 1
  pruefe('andere Arten: 119 Tage alt sichtbar, 150 Tage alt nicht (das Fenster von 120 Tagen bleibt)', neuVor(119) && !neuVor(150))
  /* Die Datei hat eine Obergrenze (400 Einträge); der Bau am 13.10.2026 lag genau darauf, und die Meldung vom 27.06. wäre als erste abgeschnitten worden. */
  const viele = Array.from({ length: 450 }, (_, i) => titel(1000 + i))
  const ohne = bau(viele, [], viele.map((t) => ({ id: t.id, seit: HEUTE })))
  const mit = bau([...viele, titel(SNOWBALL)], [meldung('g1', vor(108))], viele.map((t) => ({ id: t.id, seit: HEUTE })))
  pruefe('ohne offizielle Meldung bleiben 400 Einträge', ohne.length === 400, ohne.length)
  pruefe('mit offizieller Meldung: 400 jüngere Einträge verdrängen sie nicht (401 Einträge)', mit.length === 401 && offizielle(mit).length === 1, mit.length)
}

function freigabe(): void {
  console.log('\nFreigabe')
  const ok = meldung('h1', '2026-06-27')
  pruefe('ein vollständiger Eintrag hat keine Fehler', offiziellFehler(ok).length === 0, offiziellFehler(ok))
  const schlecht: [string, Partial<Record<keyof OffizielleMeldung, unknown>>][] = [
    ['Kategorie unbekannt', { kategorie: 'goodies' }],
    ['Tag kein Datum', { datum: '27.06.2026' }],
    ['Adresse ohne https', { url: 'http://snowballearth.net/x' }],
    ['Überschrift fehlt', { titel: '' }],
    ['Sprache dreistellig', { sprache: 'eng' }],
    ['ohne Freigabe', { freigabe: '' }],
    ['Kachel fehlt', { titleId: undefined }],
  ]
  for (const [name, aus] of schlecht) pruefe(`Fehler: ${name}`, offiziellFehler({ ...ok, ...aus }).length === 1, offiziellFehler({ ...ok, ...aus }))
  pruefe('doppelte Kennung ist ein Fehler', offiziellFehler(ok, new Set(['h1'])).length === 1)
  pruefe('alle vier Kategorien sind gültig', KATEGORIEN_OFFIZIELL.every((k) => offiziellFehler({ ...ok, kategorie: k }).length === 0))
  const eintrag = (id: string, kategorie = 'staffel') =>
    `  - id: ${id}\n    titleId: ${SNOWBALL}\n    kategorie: ${kategorie}\n    datum: "2026-06-27"\n    url: https://snowballearth.net/en/news/detail.html?d=${id}\n    titel: Season 2\n    sprache: en\n    freigabe: Test\n`
  const echt = ladenAusKulisse(`eintraege:\n${eintrag('h1')}`)
  pruefe('eine Kulissen-Datei im Format der Handdatei wird geladen und führt Snowball Earth (staffel)', echt.length === 1 && echt[0]!.titleId === SNOWBALL && echt[0]!.kategorie === 'staffel', echt)
  const unbekannt = fehlerBeimLaden(`eintraege:\n${eintrag('h1', 'goodies')}`)
  pruefe('ein fehlerhafter Handeintrag bricht das Laden ab und nennt die Nummer', unbekannt.includes('Eintrag 1') && unbekannt.includes('h1'), unbekannt)
  const doppelt = fehlerBeimLaden(`eintraege:\n${eintrag('h1')}${eintrag('h1')}`)
  pruefe('dieselbe Kennung zweimal bricht das Laden ab', doppelt.includes('Eintrag 2'), doppelt)
  const vorschlag = { id: 'x9', titel: 'Titel mit: Doppelpunkt "und" Anführungszeichen', datum: '2026-06-27', url: 'https://a.example/n/1?d=2&e=3', sprache: 'ja', titelIds: [5, 6] }
  let ohneKachel = ''
  try {
    eintragAusVorschlag(vorschlag, { kategorie: 'film', freigabe: 'Test' }, new Set())
  } catch (err) {
    ohneKachel = (err as Error).message
  }
  pruefe('mehrere mögliche Kacheln: ohne Wahl wirft das Werkzeug und nennt sie', ohneKachel.includes('5, 6'), ohneKachel)
  const e = eintragAusVorschlag(vorschlag, { kategorie: 'film', titleId: 6, freigabe: 'Test' }, new Set())
  const zurueck = (yaml.load(`eintraege:\n${eintragText(e)}`) as { eintraege: OffizielleMeldung[] }).eintraege[0]
  pruefe('der angehängte Block ergibt beim Lesen denselben Eintrag (Doppelpunkt, Anführungszeichen, Datum bleiben Text)', JSON.stringify(zurueck) === JSON.stringify(e), zurueck)
  const einzigeKachel = eintragAusVorschlag({ ...vorschlag, titelIds: [5] }, { kategorie: 'film', freigabe: 'Test' }, new Set())
  pruefe('eine einzige mögliche Kachel wird übernommen', einzigeKachel.titleId === 5)
  pruefe('ein Vorschlag ohne Menschen-Angaben (Kategorie, Freigabe) wird nicht zum Eintrag', (() => {
    try {
      eintragAusVorschlag({ ...vorschlag, titelIds: [5] }, {}, new Set())
      return false
    } catch {
      return true
    }
  })())
  const l = offizielleMeldungen([titel(SNOWBALL)], [ok])
  pruefe('eine Liste ohne Fehler wird zu Meldungen', l.length === 1 && l[0]!.schluessel === 'offiziell:h1')
}

function texte(): void {
  console.log('\nSatz, Pille, Beleg-Fenster, Panel')
  const m = (kategorie: OffizielleMeldung['kategorie']) => offizielle(bau([titel(SNOWBALL)], [meldung('i1', vor(10), { kategorie })]))[0]!.m
  for (const k of KATEGORIEN_OFFIZIELL) {
    pruefe(`Seite, Kurzform und Mail sagen dasselbe (${k}): „${OFFIZIELL_SATZ[k]}“`, newsSatz(m(k)) === OFFIZIELL_SATZ[k] && newsKurz(m(k)) === OFFIZIELL_SATZ[k] && mailSatz(m(k)) === `Offizielle Website: ${OFFIZIELL_SATZ[k]}`, [newsSatz(m(k)), mailSatz(m(k))])
  }
  pruefe('die Pille heißt „Offizielle Website“, der Satz wiederholt es nicht', artLabel(m('staffel')) === 'Offizielle Website' && !newsSatz(m('staffel')).includes('Website'))
  const l = bau([titel(SNOWBALL)], [meldung('j1', vor(200))])
  const zeilen = meldungenImPanel(l, SNOWBALL, HEUTE)
  pruefe('das Panel der Kachel zeigt die 200 Tage alte Meldung (sie ist kein vorbeigegangener Termin)', zeilen.length === 1 && zeilen[0]!.m.art === 'offiziell', zeilen.length)
  pruefe('keine Meldung für eine andere Kachel', meldungenImPanel(l, 999, HEUTE).length === 0)
}

meldungSelbst()
fenster()
freigabe()
texte()

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nNews-Art offiziell: alle Zusicherungen erfüllt')
