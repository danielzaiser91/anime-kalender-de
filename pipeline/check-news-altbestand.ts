/**
 * Zusicherungen: Eine Seite, die im vorigen Bestand schon als Watchlink stand, löst keine „weiterer Anbieter“-Meldung mit dem Bautag
 * aus (`lib/news-altbestand.ts`, 30.10.2026, Food Wars Fourth Plate). Der Auslöser kommt wörtlich aus `public/data/titles.json` vor PR 2428:
 * Stream Crunchyroll, Watchlink „Amazon Prime (Crunchyroll)“ B0CJPKQQNL; danach ist dieselbe Seite ein Stream mit deutscher Tonspur.
 * Läuft in `check:logic`. Fester Bestand, kein Netz, keine Uhr; der Bau läuft gegen einen Wegwerf-Ordner (`AK_ROOT`).
 */
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import type { DataMeta, NewsMeldung, Release, ReleaseEvent, StreamLink, Title } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'news-altbestand-'))
mkdirSync(join(wurzel, 'data'), { recursive: true })
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
/* Die Prüfungen im Bau lesen die handgepflegten Listen; große JSON-Zwischenstände bleiben draußen. */
const handDaten = join(import.meta.dirname, '..', 'data')
for (const datei of readdirSync(handDaten).filter((d) => d.endsWith('.yaml'))) copyFileSync(join(handDaten, datei), join(wurzel, 'data', datei))
cpSync(join(handDaten, 'curated'), join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { baueNews } = await import('./lib/news.ts')
const { adresseVergleich, traegeAltbestandEin, vorigeWatchAdressen } = await import('./lib/news-altbestand.ts')
const { bekannteSeitenAusBestand, schreibeKernUndNews } = await import('./bau/13-5-kerndateien.ts')
type NewsHistorie = Parameters<typeof baueNews>[4]

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const CR = 'https://www.crunchyroll.com/de/food-wars-shokugeki-no-soma'
const PRIME = 'https://www.amazon.de/gp/video/detail/B0CJPKQQNL'
const ANISEARCH = 'https://www.anisearch.de/article/161662,food-wars-shokugeki-no-soma-the-fourth-plate-komplettset-blu-ray'
const cr: StreamLink = { platform: 'crunchyroll', url: CR, dub: true, zugang: 'abo' } as StreamLink
const prime = (url = PRIME, extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'primevideo', url, dub: true, zugang: 'abo', ...extra }) as StreamLink
const titel = (id: number, streams: StreamLink[], watchLinks: Title['watchLinks'] = []): Title =>
  ({ id, franchiseId: id, slug: `food-wars-${id}`, titleEn: `Food Wars ${id}`, keywords: [], genres: [], streams, watchLinks }) as unknown as Title

/* Der vorige Bestand wörtlich: Fourth Plate (109963) mit Crunchyroll-Stream, Prime als Watchlink, dazu ein Kaufweg. */
const vorigerBestand = [
  titel(109963, [cr], [
    { name: 'Amazon Prime (Crunchyroll)', url: PRIME, kind: 'stream', zugang: 'abo' },
    { name: 'aniSearch', url: ANISEARCH, kind: 'buy', zugang: 'kauf' },
  ]),
]
const bekannt = vorigeWatchAdressen(vorigerBestand)
const altbestand = (): NewsHistorie => ({ zuerst: {}, anbieter: { '109963:crunchyroll': '0000-00-00' } })
const jetzt = (streams: StreamLink[], id = 109963): Title[] => [titel(id, streams)]
const weiterer = (titles: Title[], h: NewsHistorie): NewsMeldung[] =>
  baueNews(titles, [], [], [], h).flatMap((e) => e.meldungen.filter((m) => m.art === 'neu' && m.weiterer))

/* 1. Der Auslöser: ohne den Schritt entsteht die Meldung (die Kulisse trägt die Regel), mit dem Schritt nicht. */
const ohne = weiterer(jetzt([cr, prime()]), altbestand())
pruefe('Kulisse: ohne Altbestand-Eintrag entsteht „weiterer Anbieter“ für Prime', ohne.length === 1 && ohne[0]!.platform === 'primevideo', ohne)
const h1 = altbestand()
const eingetragen = traegeAltbestandEin(h1, jetzt([cr, prime()]), bekannt)
pruefe('Auslöser: der Weg bekommt die Altbestand-Marke', eingetragen.join() === '109963:primevideo' && h1.anbieter!['109963:primevideo'] === '0000-00-00', h1.anbieter)
pruefe('Auslöser: danach keine Meldung', weiterer(jetzt([cr, prime()]), h1).length === 0)

/* 2. Eine andere Seite desselben Anbieters ist neu und bleibt eine Meldung. */
const h2 = altbestand()
const neueSeite = jetzt([cr, prime('https://www.amazon.de/gp/video/detail/B0NEUESEITE')])
pruefe('Neue Seite: keine Marke', traegeAltbestandEin(h2, neueSeite, bekannt).length === 0 && !('109963:primevideo' in h2.anbieter!), h2.anbieter)
pruefe('Neue Seite: die Meldung bleibt', weiterer(neueSeite, h2).length === 1)

/* 3. Ein Weg mit zwei Seiten, von denen nur eine bekannt war, bleibt neu. */
const h3 = altbestand()
const zweiSeiten = jetzt([cr, prime(), prime('https://www.amazon.de/gp/video/detail/B0NEUESEITE')])
pruefe('Zwei Seiten, eine unbekannt: keine Marke', traegeAltbestandEin(h3, zweiSeiten, bekannt).length === 0)

/* 4. Dieselbe Seite in anderer Schreibweise (Schlussstrich, Anhang, Groß-/Kleinschreibung) ist dieselbe Seite. */
const h4 = altbestand()
const schreibweise = jetzt([cr, prime('https://www.amazon.de/gp/video/detail/b0cjpkqqnl/?ref=x')])
pruefe('Schreibweise: Schlussstrich, Anhang und Kleinschreibung zählen nicht', traegeAltbestandEin(h4, schreibweise, bekannt).join() === '109963:primevideo')
pruefe('Schreibweise: Adressvergleich selbst', adresseVergleich('HTTPS://WWW.Amazon.de/gp/video/detail/B0CJPKQQNL/?a=1#x') === 'www.amazon.de/gp/video/detail/b0cjpkqqnl')

/* 5. Bestehende Einträge bleiben unberührt; ein Gedächtnis ohne `anbieter` sät `baueNews` selbst. */
const h5: NewsHistorie = { zuerst: {}, anbieter: { '109963:crunchyroll': '0000-00-00', '109963:primevideo': '2026-10-01' } }
pruefe('Vorhandener Eintrag: Datum bleibt, nichts eingetragen', traegeAltbestandEin(h5, jetzt([cr, prime()]), bekannt).length === 0 && h5.anbieter!['109963:primevideo'] === '2026-10-01', h5.anbieter)
const h6: NewsHistorie = { zuerst: {} }
pruefe('Ohne anbieter-Feld: nichts geschrieben, Feld bleibt aus', traegeAltbestandEin(h6, jetzt([cr, prime()]), bekannt).length === 0 && h6.anbieter === undefined)

/* 6. Was nicht als Stream des vorigen Bestands galt, zählt nicht: nur Watchlinks (ein Stream desselben Titels ohne Ja ist eine echte Neuigkeit). */
const nurStream = vorigeWatchAdressen([titel(109963, [cr, prime(PRIME, { dub: false })])])
pruefe('Voriger Stream ohne Ja ist kein Watchlink: Meldung bleibt möglich', traegeAltbestandEin(altbestand(), jetzt([cr, prime()]), nurStream).length === 0)
pruefe('Leerer voriger Bestand: nichts bekannt', traegeAltbestandEin(altbestand(), jetzt([cr, prime()]), vorigeWatchAdressen([])).length === 0)

/* 7. Nichtauskunft und Wege ohne eigenes Ja werden nie eingetragen (Handbeleg, JustWatch, Ja nur geerbt, kein Ja, YouTube). */
for (const [name, s] of [
  ['Handbeleg', prime(PRIME, { herkunft: 'handbeleg' })],
  ['JustWatch', prime(PRIME, { herkunft: 'justwatch' })],
  ['kein Ja', prime(PRIME, { dub: false })],
  ['YouTube', { platform: 'youtube', url: PRIME, dub: true } as StreamLink],
] as const) {
  const h = altbestand()
  pruefe(`Weg ohne meldbares Ja (${name}): keine Marke`, traegeAltbestandEin(h, jetzt([cr, s]), bekannt).length === 0 && Object.keys(h.anbieter!).length === 1, h.anbieter)
}

/* 7b. Eine Seite ohne meldbares Ja (JustWatch) neben einer bekannten meldbaren zählt nicht mit; ebenso eine Seite eines anderen Anbieters. */
const gemischt = jetzt([cr, prime(), prime('https://www.amazon.de/gp/video/detail/B0JWSEITE', { herkunft: 'justwatch' })])
pruefe('JustWatch-Seite neben bekannter Seite: Weg wird markiert', traegeAltbestandEin(altbestand(), gemischt, bekannt).join() === '109963:primevideo')
pruefe('Seite eines anderen Anbieters (Crunchyroll, unbekannt) blockiert den Prime-Weg nicht', traegeAltbestandEin({ zuerst: {}, anbieter: {} }, jetzt([cr, prime()]), bekannt).join() === '109963:primevideo')
pruefe('Adressvergleich: gleicher Pfad bei anderem Anbieter ist eine andere Seite', adresseVergleich('https://www.a.de/x') !== adresseVergleich('https://www.b.de/x'))
pruefe('Keine Adresse: unlesbarer Text wird nur getrimmt und klein verglichen', adresseVergleich('  B0CJPKQQNL ') === 'b0cjpkqqnl')

/* 8. Mehrstaffel-Adresse: zwei Titel teilen dieselbe Seite; jeder bekommt seine eigene Marke, ein dritter mit anderer Seite nicht. */
const h8 = { zuerst: {}, anbieter: { '20923:crunchyroll': '0000-00-00', '109963:crunchyroll': '0000-00-00', '5:crunchyroll': '0000-00-00' } } as NewsHistorie
const mehrere = [titel(20923, [cr, prime()]), titel(109963, [cr, prime()]), titel(5, [cr, prime('https://www.amazon.de/gp/video/detail/B0ANDERE')])]
pruefe('Geteilte Seite: beide Titel markiert, der dritte nicht', traegeAltbestandEin(h8, mehrere, bekannt).sort().join() === '109963:primevideo,20923:primevideo', h8.anbieter)

/* 9. Verdrahtung: die ausgelieferte titles.json liefert die bekannten Seiten, der echte Bau-Schritt trägt ein und liefert keine Meldung. */
pruefe('Bestand ohne titles.json: keine bekannten Seiten', bekannteSeitenAusBestand().size === 0)
writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(vorigerBestand))
const ausDatei = [...bekannteSeitenAusBestand()].sort().join()
pruefe('Bestand aus titles.json: genau die Watchlink-Seiten, keine Streams', ausDatei === [adresseVergleich(ANISEARCH), adresseVergleich(PRIME)].sort().join(), ausDatei)
const meta = { generatedAt: '2026-10-30T00:00:00Z', titleCount: 1, releaseCount: 0, eventCount: 0 } as unknown as DataMeta
function bauSchritt(seiten: ReadonlySet<string>): { meldungen: NewsMeldung[]; historie: NewsHistorie } {
  writeFileSync(join(wurzel, 'data', 'news-historie.json'), JSON.stringify(altbestand()))
  const titles = new Map(jetzt([cr, prime()]).map((t) => [t.id, t]))
  schreibeKernUndNews({ releases: [] as Release[], events: [] as ReleaseEvent[], titles, meta, bekannteSeiten: seiten })
  const news = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'news.json'), 'utf8')) as { meldungen: NewsMeldung[] }[]
  return { meldungen: news.flatMap((e) => e.meldungen).filter((m) => m.art === 'neu' && m.weiterer), historie: JSON.parse(readFileSync(join(wurzel, 'data', 'news-historie.json'), 'utf8')) }
}
const mit = bauSchritt(bekannteSeitenAusBestand())
pruefe('Bau: bekannte Seite schreibt die Marke ins Gedächtnis', mit.historie.anbieter?.['109963:primevideo'] === '0000-00-00', mit.historie.anbieter)
pruefe('Bau: bekannte Seite erzeugt keine Meldung in news.json', mit.meldungen.length === 0, mit.meldungen)
const ohneSeiten = bauSchritt(new Set())
pruefe('Bau: ohne bekannte Seiten entsteht die Meldung (Kulisse unterscheidet sich)', ohneSeiten.meldungen.length === 1 && ohneSeiten.historie.anbieter?.['109963:primevideo'] !== '0000-00-00', ohneSeiten)

/* 10. Reihenfolge in `schreibeDatensatz` (Syntaxbaum): der vorige Bestand wird als Erstes gelesen, bevor irgendein Schritt titles.json neu schreibt, und geht an den News-Schritt. */
const quelle = ts.createSourceFile('x.ts', readFileSync(join(import.meta.dirname, 'bau', '13-schreiben.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
const datensatz = quelle.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'schreibeDatensatz')
const koerper = datensatz?.body?.statements ?? []
const erste = koerper[0]
const ersteGelesen = erste !== undefined && ts.isVariableStatement(erste) && erste.declarationList.declarations.length === 1 && erste.declarationList.declarations[0]!.name.getText(quelle) === 'bekannteSeiten' && erste.declarationList.declarations[0]!.initializer?.getText(quelle) === 'bekannteSeitenAusBestand()'
pruefe('schreibeDatensatz: erste Anweisung liest den vorigen Bestand', ersteGelesen, erste?.getText(quelle))
const aufrufe: ts.CallExpression[] = []
const sammle = (n: ts.Node): void => {
  if (ts.isCallExpression(n)) aufrufe.push(n)
  ts.forEachChild(n, sammle)
}
if (datensatz) sammle(datensatz)
const kernAufruf = aufrufe.find((a) => a.expression.getText(quelle) === 'schreibeKernUndNews')
const uebergeben = kernAufruf?.arguments[0] !== undefined && ts.isObjectLiteralExpression(kernAufruf.arguments[0]) && kernAufruf.arguments[0].properties.some((p) => ts.isShorthandPropertyAssignment(p) && p.name.text === 'bekannteSeiten')
pruefe('schreibeDatensatz: bekannteSeiten geht an schreibeKernUndNews', uebergeben, kernAufruf?.getText(quelle))
pruefe('schreibeDatensatz: bekannteSeitenAusBestand wird genau einmal aufgerufen', aufrufe.filter((a) => a.expression.getText(quelle) === 'bekannteSeitenAusBestand').length === 1)

rmSync(wurzel, { recursive: true, force: true })
console.log(`check-news-altbestand: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
