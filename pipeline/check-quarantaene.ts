/**
 * Zusicherungen zur Titel-Quarantäne (18.10.2026): die Bau-Phase `11-9-quarantaene.ts`, die Helfer in `lib/quarantaene.ts`,
 * `neueTreffer` der Kalender-Grenzen und die Verdrahtung im Bau (geparst mit `unbedingteAufrufe`). Läuft in `check:logic`;
 * die Prüfungen selbst (Marken, Leser) prüft `tools/quarantaene-pruefungen.test.ts`, das Gate `tools/quarantaene.test.mjs`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { liesMarken } from '../tools/quarantaene.mjs'
import { stelleZurueck, vermerkeQuarantaene } from './bau/11-9-quarantaene.ts'
import { ladeQuarantaene, meldeVerletzte, mitZurueckgestellten, nimmVerlaufHeraus, ohneZurueckgestellte, setzeVerlaufEin, zurueckgestellt } from './lib/quarantaene.ts'
import { meldeNeueTreffer, neueTreffer, type Grenzen, type TrefferJeRegel } from './lib/kalender-plausibilitaet-grenzen.ts'
import { REGELN } from './lib/kalender-plausibilitaet.ts'
import { unbedingteAufrufe, type Aufruf } from './lib/unbedingte-aufrufe.ts'
import type { TerminGedaechtnis, TerminVerlauf } from './lib/news-verlauf.ts'
import type { DataMeta, Release, ReleaseEvent, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const quelle = (datei: string): string => readFileSync(new URL(datei, import.meta.url), 'utf8')
const stelle = (aufrufe: Aufruf[], name: string): number => aufrufe.find((x) => x.name === name)?.stelle ?? -1
const args = (aufrufe: Aufruf[], name: string): string | undefined => aufrufe.find((x) => x.name === name)?.args.join('|')
/** Was `f` mit console.log druckt (die Marken). */
function mitProtokoll(f: () => void): string {
  const zeilen: string[] = []
  const log = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    f()
  } finally {
    console.log = log
  }
  return zeilen.join('\n')
}


// Phase: Titel 3 und 4 (Mitte) gehen samt Releases und Terminen, eine Kennung ohne Titel (99) kommt nicht in die Liste, ihre Releases und Termine bleiben.
{
  const titles = new Map([1, 2, 3, 4, 5].map((id) => [id, { id } as Title]))
  const releases = [1, 3, 2, 99, 3, 4, 5].map((titleId, i) => ({ titleId, slug: `r${titleId}-${i}` }) as Release)
  const events = [3, 1, 99, 4, 2, 3].map((titleId, i) => ({ titleId, slug: `e${i}` }) as unknown as ReleaseEvent)
  const liste = [3, 99, 4].map((titleId) => ({ titleId, pruefung: 'p', grund: `g${titleId}` }))
  const zurueck = stelleZurueck({ titles, releases, events }, liste)
  const soll = [
    { titleId: 3, pruefung: 'p', grund: 'g3', releases: ['r3-1', 'r3-4'] },
    { titleId: 4, pruefung: 'p', grund: 'g4', releases: ['r4-5'] },
  ]
  pruefe('stelleZurueck: nur vorhandene Titel, je mit ihren Releases', gleich(zurueck, soll), zurueck)
  pruefe('stelleZurueck: Titel entfernt', gleich([...titles.keys()], [1, 2, 5]), [...titles.keys()])
  pruefe('stelleZurueck: Releases entfernt', gleich(releases.map((r) => r.slug), ['r1-0', 'r2-2', 'r99-3', 'r5-6']), releases)
  pruefe('stelleZurueck: Termine entfernt', gleich(events.map((e) => e.titleId), [1, 99, 2]), events)
  const leer = stelleZurueck({ titles, releases, events }, [])
  pruefe('stelleZurueck: leere Liste ändert nichts', !leer.length && titles.size === 3 && releases.length === 4 && events.length === 3)
}

// Meta: das Feld fehlt ohne Quarantäne (Leser unterscheiden „nichts zurückgestellt“ nicht von „alter Bestand“).
{
  const ohne = {} as DataMeta
  vermerkeQuarantaene(ohne, [])
  pruefe('vermerkeQuarantaene: ohne Liste kein Feld', !('quarantaene' in ohne))
  const mit = {} as DataMeta
  const liste = [{ titleId: 7, pruefung: 'p', grund: 'g', releases: ['a'] }]
  vermerkeQuarantaene(mit, liste)
  pruefe('vermerkeQuarantaene: Liste steht in meta', gleich(mit.quarantaene, liste))
  const drei = {} as DataMeta
  vermerkeQuarantaene(drei, [5, 6, 7].map((titleId) => ({ ...liste[0]!, titleId })))
  pruefe('vermerkeQuarantaene: alle Einträge', gleich(drei.quarantaene?.map((e) => e.titleId), [5, 6, 7]), drei.quarantaene)
  const z = zurueckgestellt({ quarantaene: [...liste, { titleId: 8, pruefung: 'p', grund: 'g', releases: ['b', 'c'] }] })
  pruefe('zurueckgestellt: Kennungen und Releases', gleich([...z.ids], [7, 8]) && gleich([...z.releases], ['a', 'b', 'c']), z)
  const keine = zurueckgestellt({})
  pruefe('zurueckgestellt: ohne Feld leer', keine.ids.size === 0 && keine.releases.size === 0)
  const bekannt = mitZurueckgestellten(new Set([1, 2]), { quarantaene: [{ ...liste[0]!, titleId: 9 }, { ...liste[0]!, titleId: 1 }, ...liste] })
  pruefe('mitZurueckgestellten: bekannte samt zurückgestellten', gleich([...bekannt], [1, 2, 9, 7]), [...bekannt])
  pruefe('mitZurueckgestellten: ohne Feld unverändert', gleich([...mitZurueckgestellten(new Set([3]), {})], [3]))
}

// Liste aus BAU_QUARANTAENE: ohne Variable nichts, mit Variable die Datei — auch als Vorgabe der Helfer.
{
  const ordner = mkdtempSync(join(tmpdir(), 'check-quarantaene-'))
  const datei = join(ordner, 'q.json')
  writeFileSync(datei, JSON.stringify([{ titleId: 2, pruefung: 'p', grund: 'g' }, { titleId: 4, pruefung: 'p', grund: 'g' }]))
  const vorher = process.env.BAU_QUARANTAENE
  delete process.env.BAU_QUARANTAENE
  pruefe('ladeQuarantaene: ohne Variable leer', gleich(ladeQuarantaene(), []))
  const titel = [1, 2, 3, 4, 5].map((id) => ({ id }))
  pruefe('ohneZurueckgestellte: ohne Variable alles', ohneZurueckgestellte(titel).length === 5)
  process.env.BAU_QUARANTAENE = datei
  pruefe('ladeQuarantaene: liest die Datei aus der Variable', gleich(ladeQuarantaene().map((e) => e.titleId), [2, 4]))
  pruefe('ohneZurueckgestellte: ohne die zurückgestellten', gleich(ohneZurueckgestellte(titel).map((t) => t.id), [1, 3, 5]))
  const phase = new Map(titel.map((t) => [t.id, t as Title]))
  stelleZurueck({ titles: phase, releases: [], events: [] })
  pruefe('stelleZurueck: ohne Liste die aus der Variable', gleich([...phase.keys()], [1, 3, 5]), [...phase.keys()])
  if (vorher === undefined) delete process.env.BAU_QUARANTAENE
  else process.env.BAU_QUARANTAENE = vorher
  rmSync(ordner, { recursive: true, force: true })
}

// Marken: je verletztem Titel eine Zeile, die das Gate liest; zurück kommen genau die verletzten.
{
  let rot: { id: number }[] = []
  const protokoll = mitProtokoll(() => {
    rot = meldeVerletzte([1, 2, 3, 4, 5].map((id) => ({ id })), 'probe', 'grund', (t) => t.id === 2 || t.id === 4)
  })
  pruefe('meldeVerletzte: gibt die verletzten zurück', gleich(rot.map((t) => t.id), [2, 4]), rot)
  const marken = liesMarken(protokoll)
  pruefe('meldeVerletzte: je Titel eine Marke', gleich(marken, [2, 4].map((titleId) => ({ titleId, pruefung: 'probe', grund: 'grund' }))), marken)
}

// Kalender: nur neue Schlüssel von Regeln über ihrer Grenze tragen eine Kennung.
{
  const t = (titleId: number, schluessel: string) => ({ titleId, schluessel, text: schluessel })
  const treffer = Object.fromEntries(REGELN.map((r) => [r, []])) as unknown as TrefferJeRegel
  treffer.schaetzungNachEnde = [t(1, 'a'), t(2, 'b'), t(3, 'c')]
  treffer.terminOhneBeleg = [t(4, 'd'), t(5, 'e')]
  treffer.ereignisOhneNews = [t(6, 'f')]
  const grenzen: Grenzen = {
    _hinweis: '',
    vorkommen: { schaetzungNachEnde: 2, terminOhneBeleg: 2 },
    bekannt: { schaetzungNachEnde: ['a', 'c'], terminOhneBeleg: ['x'] },
  }
  const neu = neueTreffer(treffer, grenzen).map((n) => `${n.regel}:${n.treffer.titleId}`)
  pruefe('neueTreffer: neue Schlüssel über der Grenze, Regel ohne Grenze zählt 0', gleich(neu, ['schaetzungNachEnde:2', 'ereignisOhneNews:6']), neu)
  const marken = liesMarken(mitProtokoll(() => meldeNeueTreffer(treffer, grenzen)))
  pruefe('meldeNeueTreffer: je neuem Treffer eine Marke', gleich(marken.map((m) => `${m.titleId}:${m.pruefung}:${m.grund}`), ['2:kalender-plausibilitaet:schaetzungNachEnde: b', '6:kalender-plausibilitaet:ereignisOhneNews: f']), marken)
  const kalender = unbedingteAufrufe(quelle('./check-kalender-plausibilitaet-bestand.ts'), 'pruefen')
  pruefe('Kalender-Prüfung meldet die neuen Treffer', args(kalender, 'meldeNeueTreffer') === 'treffer|grenzen', kalender.map((x) => x.name))
}

// Termin-Verlauf: die Releases zurückgestellter Titel werden gehalten und unverändert zurückgelegt.
{
  const v = (titelId: number, datum: string) => ({ titelId, datum }) as TerminVerlauf
  const historie: TerminGedaechtnis = {
    termine: { a: [v(1, '1')], q1: [v(3, '2'), v(3, '3')], b: [v(2, '4')], q2: [v(3, '5')] },
    vergangen: { c: [v(1, '6')], q1: [v(3, '7')], d: [v(5, '8')] },
  }
  const vorher = structuredClone(historie)
  const gehalten = nimmVerlaufHeraus(historie, new Set(['q1', 'q2']))
  pruefe('nimmVerlaufHeraus: nur die übrigen Releases bleiben', gleich(Object.keys(historie.termine!), ['a', 'b']) && gleich(Object.keys(historie.vergangen!), ['c', 'd']), historie)
  pruefe('nimmVerlaufHeraus: gehalten', gleich(gehalten, { termine: { q1: vorher.termine!.q1, q2: vorher.termine!.q2 }, vergangen: { q1: vorher.vergangen!.q1 } }), gehalten)
  setzeVerlaufEin(historie, gehalten)
  const sortiert = (g: TerminGedaechtnis) => JSON.stringify(g, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x))
  pruefe('setzeVerlaufEin: Rundweg ergibt das Gedächtnis von vorher', sortiert(historie) === sortiert(vorher), historie)
  const leer: TerminGedaechtnis = {}
  setzeVerlaufEin(leer, nimmVerlaufHeraus(leer, new Set(['q1'])))
  pruefe('ohne Verlauf bleibt das Gedächtnis leer', gleich(leer, {}), leer)
}

// Verdrahtung im Bau, geparst: Name, Argumente und Reihenfolge.
{
  const folge = quelle('./bau/phasenfolge.ts')
  const haupt = unbedingteAufrufe(folge, 'bauePhasenfolge')
  pruefe('phasenfolge.ts: stelleZurueck({ titles, releases, events })', args(haupt, 'stelleZurueck') === '{ titles, releases, events }', args(haupt, 'stelleZurueck'))
  pruefe(
    'phasenfolge.ts: stelleZurueck nach schliesseWegeAb',
    stelle(haupt, 'schliesseWegeAb') >= 0 && stelle(haupt, 'stelleZurueck') > stelle(haupt, 'schliesseWegeAb'),
    haupt.map((x) => `${x.stelle}:${x.name}`),
  )
  pruefe('phasenfolge.ts: die Rückgabe trägt die Quarantäne', /return \{\s*quarantaene,/.test(folge), 'return')
  const bauMain = args(unbedingteAufrufe(quelle('./build.ts'), 'main'), 'liefereAus')
  pruefe('build.ts: liefereAus bekommt das Ergebnis der Phasenfolge', bauMain === 'bauePhasenfolge(ladeQuellen())', bauMain)
  const aus = unbedingteAufrufe(quelle('./build.ts'), 'liefereAus')
  pruefe('build.ts: vermerkeQuarantaene(meta, quarantaene)', args(aus, 'vermerkeQuarantaene') === 'meta|quarantaene', args(aus, 'vermerkeQuarantaene'))
  pruefe(
    'build.ts: vermerkeQuarantaene nach baueMeta, vor schreibeDatensatzGemessen',
    stelle(aus, 'baueMeta') >= 0 && stelle(aus, 'vermerkeQuarantaene') > stelle(aus, 'baueMeta') && stelle(aus, 'schreibeDatensatzGemessen') > stelle(aus, 'vermerkeQuarantaene'),
    aus.map((x) => `${x.stelle}:${x.name}`),
  )
  const ohne = unbedingteAufrufe(quelle('./bau/nebendateien.ts'), 'schreibeOhneSynchro')
  pruefe('nebendateien: ohne-synchro ohne zurückgestellte Titel', args(ohne, 'ohneZurueckgestellte') === 'ladeKatalogEintraege()', args(ohne, 'ohneZurueckgestellte'))
  // check-handbelege ist ein Skript ohne Funktion: der Aufruf als Anweisung auf oberster Ebene, nur einmal.
  const hand = unbedingteAufrufe(`function datei() {\n${quelle('./check-handbelege.ts').replace(/^import .*$/gm, '')}\n}`, 'datei').filter((x) => x.name === 'pruefeVerwaiste')
  const sollHand = 'loadDubChecks()|mitZurueckgestellten(new Set([...titel, ...hinterToggle].map((t) => t.id)))'
  pruefe('check-handbelege: verwaiste Handbelege kennen die zurückgestellten Titel', hand.length === 1 && hand[0]!.args.join('|') === sollHand, hand)
}

/** Der Block in `schreibeKernUndNews`, der das News-Gedächtnis liest und schreibt, als eigene Funktion zum Parsen. */
function newsBlock(): Aufruf[] {
  const text = quelle('./bau/13-5-kerndateien.ts')
  const datei = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
  const fn = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'schreibeKernUndNews')
  const bloecke = (fn?.body?.statements ?? []).filter((s) => ts.isBlock(s) && s.getText(datei).includes("'data/news-historie.json'"))
  if (bloecke.length !== 1) return []
  return unbedingteAufrufe(`function block() ${bloecke[0]!.getText(datei)}`, 'block')
}
{
  const block = newsBlock()
  const gedaechtnis = (name: string) => block.filter((x) => x.name === name && x.args[0] === "'data/news-historie.json'")
  const [gelesen, geschrieben] = [gedaechtnis('readJson'), gedaechtnis('writeJson')]
  const reihe = [gelesen[0]?.stelle ?? -1, stelle(block, 'nimmVerlaufHeraus'), stelle(block, 'entdoppeleUndMelde'), stelle(block, 'setzeVerlaufEin'), geschrieben[0]?.stelle ?? -1]
  pruefe('13-5: das Gedächtnis wird genau einmal gelesen und geschrieben', gelesen.length === 1 && geschrieben.length === 1, block.map((x) => x.name))
  pruefe('13-5: Verlauf gehalten nach dem Lesen, vor den News, zurück vor dem Schreiben', reihe.every((s, i) => s >= 0 && (i === 0 || s > reihe[i - 1]!)), reihe)
  pruefe('13-5: nimmVerlaufHeraus(newsHistorie, zurueckgestellt(meta).releases)', args(block, 'nimmVerlaufHeraus') === 'newsHistorie|zurueckgestellt(meta).releases', args(block, 'nimmVerlaufHeraus'))
  pruefe('13-5: setzeVerlaufEin(newsHistorie, gehalten)', args(block, 'setzeVerlaufEin') === 'newsHistorie|gehalten', args(block, 'setzeVerlaufEin'))
}

if (fehler) {
  console.error(`check-quarantaene: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-quarantaene: ok')
