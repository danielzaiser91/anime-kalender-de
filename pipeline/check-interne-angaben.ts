/**
 * Zusicherungen: Keine interne Notiz und keine Angabe aus der Pflege in veröffentlichten Daten (26.10.2026, Anlass: Beerus-Panel
 * mit „laut Daniels Sichtung“). Läuft in `check:logic`; der Bestandsteil steht in `check-interne-angaben-bestand.ts`.
 * Der Anlass-Text steht wörtlich aus `data/curated/streaming-herbst-2026.yaml` (Eintrag `dragon-ball-super-beerus-netflix`).
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type { NewsEintrag, NewsMeldung, Release, Title } from '../shared/types.ts'
import { interneAngaben } from './lib/interne-angaben.ts'
import { ohneNotiz, schreibeReleasesJson } from './lib/release-ohne-notiz.ts'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { felderAenderungen, haltFelderFest } from './lib/news-felder-fest.ts'
import type { DatiertNews } from './lib/news-verlauf.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const ANLASS =
  'Netflix startet am 18.10.2026, neue Folgen wöchentlich, laut Anime2You 1052708 mit japanischem Ton und Untertiteln („Sprache: Japanisch (UT)“). Folge 1 hat laut Daniels Sichtung (Netflix, 18.10.2026) keine deutsche Synchro; Folge 2 nennt Netflix für den 25.10.2026.'

/* 1. Der Leser nach Feldern: Anlass-Felder (note, hinweis, source) schlagen an, Namensfelder nicht. */
pruefe('Anlass: Notiz im Release', interneAngaben('releases.json', [{ note: ANLASS }]).length === 1)
pruefe('Anlass: hinweis in news.json', interneAngaben('news.json', [{ meldungen: [{ hinweis: ANLASS }] }]).length === 1)
pruefe('Anlass: source "Daniel" in timeSighting', interneAngaben('woche.json', { releases: [{ schedule: { timeSighting: { source: 'Daniel' } } }] }).length === 1)
pruefe('Ein Treffer nennt Datei, Feld und Ausschnitt', interneAngaben('releases.json', [{ note: ANLASS }])[0]!.startsWith('releases.json :: note :: ') === true)
pruefe('Sprecher "Daniel Fehlow" in voices/*.json (actor) ist erlaubt', interneAngaben('voices/12.json', [{ actor: 'Daniel Fehlow', character: 'Daniel Hunt' }]).length === 0)
pruefe('Sprecher in sprecher.json, Rolle in sprecher/*.json', interneAngaben('sprecher.json', [{ sprecher: 'Daniel Axt' }]).length === 0 && interneAngaben('sprecher/1.json', { rollen: ["Daniel's Mother (Ep 5)"] }).length === 0)
pruefe('Titelfelder: ohne-synchro.json und cartoons.json', interneAngaben('ohne-synchro.json', [{ titleEn: 'Dear Daniel', slug: 'dear-daniel-1', titleRomaji: 'Daniel no' }]).length === 0 && interneAngaben('cartoons.json', [{ titleDe: 'Der kleine Tiger Daniel', url: 'https://x/daniel' }]).length === 0)
pruefe('Synopse (de, en) und Folgentitel (f)', interneAngaben('synopses/1.json', { de: 'Daniel kämpft', en: 'Daniel' }).length === 0 && interneAngaben('folgen/1.json', [{ f: 'Daniel in Gefahr' }]).length === 0)
pruefe('synonyme.json: ganze Datei ausgenommen, Zahlen als Schlüssel', interneAngaben('synonyme.json', { 145059: ['Pokémon × Daniel Arsham'] }).length === 0)
pruefe('Dasselbe Feld in einer anderen Datei schlägt an (actor in news.json)', interneAngaben('news.json', [{ actor: 'Daniel Fehlow' }]).length === 1)
pruefe('Zahlenschlüssel erben das Feld des Elternteils', interneAngaben('releases.json', { note: { 0: 'Daniel' } }).length === 1 && interneAngaben('voices/1.json', { actor: { 0: 'Daniel Axt' } }).length === 0)
pruefe('Schreibweisen: Daniels, DANIEL, Zaiser', interneAngaben('releases.json', [{ note: 'Daniels' }, { note: 'DANIEL' }, { note: 'Zaiser' }]).length === 3)
pruefe('Zwei Treffer in einer Datei werden beide gezählt', interneAngaben('releases.json', [{ note: 'Daniel' }, { source: 'Daniel' }]).length === 2)
pruefe('Feld note ohne Namen: Verstoß in releases, woche, woche-kacheln', ['releases.json', 'woche.json', 'woche-kacheln.json'].every((d) => interneAngaben(d, [{ note: 'x' }]).length === 1))
pruefe('Feld note in anderer Datei (news.json) ohne Namen: kein Verstoß', interneAngaben('news.json', [{ note: 'x' }]).length === 0)
pruefe('Zwei Felder in einem Objekt: das zweite schlägt an', interneAngaben('releases.json', { a: 'ok', note: 'Daniel' }).length === 1)
pruefe('Namensfeld der einen Datei ist in der anderen kein Namensfeld', interneAngaben('voices/1.json', [{ note: 'Daniel Fehlow' }]).length === 1 && interneAngaben('sprecher.json', [{ actor: 'Daniel Axt' }]).length === 1)
pruefe('Ohne Namen, Zahlen, null, leer: kein Treffer', interneAngaben('releases.json', [{ note: 'Netflix, 24 Minuten.', n: 1, x: null }, {}, []]).length === 0)

/* 2. Der Auslieferungsweg: releases.json ohne note, alles andere unverändert, Eingabe nicht verändert. */
const rel = { titleId: 1, slug: 'r-1', platform: 'netflix', note: ANLASS, sources: ['https://example.org/1'], schedule: { firstEpisodeDate: '2099-01-01' } } as unknown as Release
const rel2 = { ...rel, slug: 'r-2', note: undefined } as unknown as Release
pruefe('ohneNotiz: note weg, Rest gleich', JSON.stringify(ohneNotiz(rel)) === JSON.stringify({ titleId: 1, slug: 'r-1', platform: 'netflix', sources: ['https://example.org/1'], schedule: { firstEpisodeDate: '2099-01-01' } }), ohneNotiz(rel))
pruefe('ohneNotiz verändert die Eingabe nicht', rel.note === ANLASS)
let geschrieben: { pfad: string; daten: unknown } | undefined
schreibeReleasesJson([rel, rel2], 'x/releases.json', (pfad, daten) => {
  geschrieben = { pfad, daten }
})
pruefe('schreibeReleasesJson: Pfad durchgereicht, keine Notiz in der Datei', geschrieben?.pfad === 'x/releases.json' && interneAngaben('releases.json', geschrieben.daten).length === 0 && !JSON.stringify(geschrieben.daten).includes('"note"'), geschrieben)
pruefe('schreibeReleasesJson: beide Releases bleiben, Reihenfolge gleich', (geschrieben?.daten as Release[]).map((r) => r.slug).join() === 'r-1,r-2')

/* 2b. Verdrahtung im Bau (Syntaxbaum, nicht Text): schreibeKernUndNews schreibt releases.json nur über schreibeReleasesJson. */
function releasesSchreiber(quelltext: string): { ueber: number; roh: number } {
  const datei = ts.createSourceFile('13-5.ts', quelltext, ts.ScriptTarget.Latest, true)
  const fn = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'schreibeKernUndNews')
  const zaehl = { ueber: 0, roh: 0 }
  const lauf = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.arguments.some((a) => /releases\.json/.test(a.getText(datei)))) {
      if (n.expression.text === 'schreibeReleasesJson' && n.arguments[0]?.getText(datei) === 'releases' && n.arguments[2]?.getText(datei) === 'writeJson') zaehl.ueber++
      if (n.expression.text === 'writeJson') zaehl.roh++
    }
    ts.forEachChild(n, lauf)
  }
  if (fn) lauf(fn)
  return zaehl
}
const bau = readFileSync(new URL('./bau/13-5-kerndateien.ts', import.meta.url), 'utf8')
const ist = releasesSchreiber(bau)
pruefe('Bau: releases.json genau einmal über schreibeReleasesJson, nie roh', ist.ueber === 1 && ist.roh === 0, ist)
pruefe('Bau-Sonde: roher writeJson wird erkannt', releasesSchreiber(bau.replace('schreibeReleasesJson(releases, ', 'writeJson(')).roh === 1)
pruefe('Bau-Sonde: Aufruf fehlt wird erkannt', releasesSchreiber(bau.replace('schreibeReleasesJson(releases, ', 'andere(releases, ')).ueber === 0)

/* 3. News: die Notiz eines Releases wird nie zum hinweis einer Meldung, auch kein früher festgehaltener (echter Weg: baueNews, haltFelderFest). */
const titel = { id: 1, franchiseId: 1, slug: 't-1', titleEn: 'T1', keywords: [], genres: [], streams: [], jpYear: 2010, deErstausgabe: { synchro: true, von: '2090-01-01' } } as unknown as Title
const ankuendigung = {
  titleId: 1,
  slug: 'r-1',
  platform: 'netflix',
  releaseType: 'series',
  automatisch: true,
  note: ANLASS,
  sprache: 'omu',
  schedule: { firstEpisodeDate: '2099-01-01', estimated: true },
  sources: ['https://example.org/1'],
} as unknown as Release
const historie: NewsHistorie = { zuerst: {} }
const eintraege = baueNews([titel], [ankuendigung], [], [], historie, [])
const meldungen = eintraege.flatMap((e) => e.meldungen)
pruefe('baueNews: die angekündigte Meldung entsteht (Testlage)', meldungen.some((m) => m.art === 'angekuendigt'), meldungen.map((m) => m.art))
pruefe('baueNews: kein hinweis aus der Release-Notiz (Fälle: estimated, automatisch, sprache)', meldungen.every((m) => m.hinweis === undefined) && interneAngaben('news.json', eintraege).length === 0, meldungen)
const alt = { art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', am: '2026-10-01', titel: { id: 1 }, schluessel: 'angekuendigt:r-1:2099-01-01', hinweis: ANLASS, kanal: 'K' } as unknown as DatiertNews
const festgehalten: NewsHistorie = { zuerst: {}, felder: { 'angekuendigt:r-1:2099-01-01': { hinweis: ANLASS, kanal: 'K' } } }
const nach = haltFelderFest(festgehalten, [alt], [])[0]!
pruefe('haltFelderFest: ein früher festgehaltener hinweis an „angekündigt“ fällt weg, kanal bleibt', nach.hinweis === undefined && nach.kanal === 'K', nach)
const neuMitHinweis = { ...alt, art: 'neu', hinweis: 'Seit 2 Jahren' } as unknown as DatiertNews
const nachNeu = haltFelderFest({ zuerst: {}, felder: { 'neu:r-1:2099-01-01': { hinweis: 'Seit 2 Jahren' } } }, [neuMitHinweis], [])[0]!
pruefe('haltFelderFest: der hinweis einer „neu“-Meldung bleibt (nur die Notiz fällt weg)', nachNeu.hinweis === 'Seit 2 Jahren', nachNeu)
const ohneHinweis = { ...alt, hinweis: undefined } as unknown as DatiertNews
pruefe('haltFelderFest: „angekündigt“ ohne hinweis bleibt dasselbe Objekt', haltFelderFest({ zuerst: {}, felder: { 'angekuendigt:r-1:2099-01-01': { kanal: 'K' } } }, [ohneHinweis], [])[0] === ohneHinweis)
const eintrag = (m: Partial<NewsMeldung>): NewsEintrag[] => [{ am: '2026-10-01', titelId: 1, titel: 'T', slug: 't', meldungen: [{ art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', ...m } as NewsMeldung] }]
pruefe('Wächter: Wegfall des hinweis an „angekündigt“ ist kein Fehler', felderAenderungen(eintrag({ hinweis: ANLASS }), eintrag({})).length === 0)
pruefe('Wächter: Wegfall des hinweis an „neu“ bleibt ein Fehler', felderAenderungen(eintrag({ art: 'neu', hinweis: 'a' }), eintrag({ art: 'neu' })).length === 1)
pruefe('Wächter: Wegfall des kanal an „angekündigt“ bleibt ein Fehler', felderAenderungen(eintrag({ kanal: 'K' }), eintrag({})).length === 1)

console.log(`check-interne-angaben: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
