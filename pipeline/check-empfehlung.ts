/**
 * Zusicherungen zu `empfehlung.json` (Pool für „Was gucke ich als Nächstes?“): Pool-Regeln, Einstieg je Reihe, `duell`/`ab`, Prüfung,
 * Größenwächter und die Verdrahtung des Baus. Aufruf: `npm run check:logic`; der Bestandsteil steht in `check-empfehlung-bestand.ts`.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { baueEmpfehlung, imEmpfehlungsPool, MAX_GZIP_BYTES, pruefeEmpfehlung } from '../shared/empfehlung-pool.ts'
import type { Franchises } from '../shared/franchise-typ.ts'
import { uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Rohtitel = Partial<Title> & { id: number }
const titel = (t: Rohtitel): Title =>
  ({ titleDe: `T${t.id}`, format: 'TV', genres: [], keywords: [], coverImage: 'c.jpg', streams: [{ platform: 'netflix', url: 'u', dub: true, zugang: 'abo' }], ...t }) as unknown as Title
const glied = (id: number, jpStart: string, extra: Record<string, unknown> = {}) => ({ id, name: `T${id}`, format: 'TV', jpStart, jpYear: Number(jpStart.slice(0, 4)), ...extra })
const ids = (titles: Title[], fr: Franchises = {}) => baueEmpfehlung(titles, fr).einstiege.map((k) => k.id)

console.log('\nEmpfehlungs-Pool:')
{
  const ok = { score: 80 }
  pruefe('Synchro-Stream, ohne Bewertung: im Pool', imEmpfehlungsPool(titel({ id: 1 })))
  pruefe('Bewertung genau 60: im Pool', imEmpfehlungsPool(titel({ id: 1, score: 60 })))
  pruefe('Bewertung 59: nicht im Pool', !imEmpfehlungsPool(titel({ id: 1, score: 59 })))
  pruefe('Bewertung 0: nicht im Pool (0 ist keine fehlende Bewertung)', !imEmpfehlungsPool(titel({ id: 1, score: 0 })))
  pruefe('gesperrter Titel: nicht im Pool', !imEmpfehlungsPool(titel({ id: 1, ...ok, sperre: 'fanservice' })))
  pruefe('Stream mit dub=false: nicht im Pool', !imEmpfehlungsPool(titel({ id: 1, streams: [{ platform: 'netflix', url: 'u', dub: false }] as Title['streams'] })))
  pruefe('Stream ohne Tonurteil: nicht im Pool', !imEmpfehlungsPool(titel({ id: 1, streams: [{ platform: 'netflix', url: 'u' }] as Title['streams'] })))
  pruefe('kein Stream: nicht im Pool', !imEmpfehlungsPool(titel({ id: 1, streams: [] })))
  pruefe('ein Synchro-Stream unter mehreren genügt', imEmpfehlungsPool(titel({ id: 1, streams: [{ platform: 'netflix', url: 'u', dub: false }, { platform: 'crunchyroll', url: 'u', dub: true }] as Title['streams'] })))
}

console.log('\nEinstieg je Reihe:')
{
  const reihe = [titel({ id: 12, franchiseId: 10, jpYear: 2012 }), titel({ id: 10, franchiseId: 10, jpYear: 2010 }), titel({ id: 14, franchiseId: 10, jpYear: 2014 })]
  const fr: Franchises = { 10: [glied(10, '2010-01'), glied(12, '2012-01'), glied(14, '2014-01')] } as unknown as Franchises
  const d = baueEmpfehlung(reihe, fr)
  pruefe('von drei Teilen bleibt der früheste', d.einstiege.map((k) => k.id).join() === '10', d.einstiege.map((k) => k.id))
  pruefe('die späteren Teile verweisen auf den Einstieg', d.reihe['12'] === 10 && d.reihe['14'] === 10 && d.reihe['10'] === undefined, d.reihe)
  pruefe('Teil 1 im Pool: duell, kein ab', d.einstiege[0]!.duell === true && d.einstiege[0]!.ab === undefined)
  pruefe('Pool zählt alle Teile', d.pool === 3)
  pruefe('gleiches Jahr: die kleinere Kennung gewinnt', ids([titel({ id: 21, jpYear: 2020, franchiseId: 20 }), titel({ id: 20, jpYear: 2020, franchiseId: 20 })]).join() === '20')
  pruefe('ohne franchiseId ist der Titel seine eigene Reihe', ids([titel({ id: 31 }), titel({ id: 32 })]).join() === '31,32')

  const teil1Fehlt = [titel({ id: 41, franchiseId: 40, jpYear: 2010, streams: [{ platform: 'netflix', url: 'u', dub: false }] as Title['streams'] }), titel({ id: 42, franchiseId: 40, jpYear: 2012 })]
  const fr2 = { 40: [glied(40, '2009-01'), glied(41, '2010-06'), glied(42, '2012-01')] } as unknown as Franchises
  const k = baueEmpfehlung([titel({ id: 40, franchiseId: 40, jpYear: 2009, score: 59 }), ...teil1Fehlt], fr2).einstiege[0]!
  pruefe('Teil 1 mit Bewertung 59 fehlt im Pool: Einstieg ist Teil 3, kein Duellpaar, Staffel 3', k.id === 42 && !k.duell && k.ab === 3, k)
  const grenze = baueEmpfehlung([titel({ id: 40, franchiseId: 40, jpYear: 2009, score: 60 }), ...teil1Fehlt], fr2).einstiege[0]!
  pruefe('Teil 1 mit Bewertung genau 60 im Pool: er ist der Einstieg und ein Duellpaar', grenze.id === 40 && grenze.duell === true && grenze.ab === undefined, grenze)

  const nurSpaeter = baueEmpfehlung([titel({ id: 52, franchiseId: 50, jpYear: 2012 })], { 50: [glied(50, '2010-01', { ohneSynchro: true }), glied(52, '2012-01')] } as unknown as Franchises).einstiege[0]!
  pruefe('Teil 1 nur in franchises.json (ohne Synchro): kein Duellpaar, Staffel 2', !nurSpaeter.duell && nurSpaeter.ab === 2, nurSpaeter)
  const film = baueEmpfehlung([titel({ id: 62, franchiseId: 60, format: 'MOVIE', jpYear: 2005 })], { 60: [glied(60, '2001-01'), glied(62, '2005-01', { format: 'MOVIE' })] } as unknown as Franchises).einstiege[0]!
  pruefe('Film einer Reihe, Teil 1 fehlt: kein Duellpaar, aber keine erfundene Staffelnummer', !film.duell && film.ab === undefined, film)
  const vorlaeufer = baueEmpfehlung([titel({ id: 72, franchiseId: 70, format: 'MOVIE', jpYear: 1988 })], { 70: [glied(72, '1988-01', { format: 'MOVIE' }), glied(70, '1990-01')] } as unknown as Franchises).einstiege[0]!
  pruefe('Film vor der ersten Staffel: er ist Teil 1 und ein Duellpaar', vorlaeufer.duell === true, vorlaeufer)
}

console.log('\nTeil 1 der Reihe (Grenzfälle):')
{
  const film = (id: number, jpStart: string, extra: Record<string, unknown> = {}) => glied(id, jpStart, { format: 'MOVIE', ...extra })
  const einzeln = (t: Rohtitel, teile: unknown[]) => baueEmpfehlung([titel({ franchiseId: 100, format: 'MOVIE', ...t })], { 100: teile } as unknown as Franchises).einstiege[0]!
  const nurFilme = einzeln({ id: 102, jpStart: '2005-01' }, [film(101, '2003-01'), film(102, '2005-01')])
  pruefe('Reihe nur aus Filmen, früherer Film ohne Synchro: kein Duellpaar', !nurFilme.duell, nurFilme)
  const special = einzeln({ id: 102, jpStart: '2005-01' }, [glied(101, '2001-01', { format: 'SPECIAL' }), film(102, '2005-01')])
  pruefe('ein früheres Special ist nicht Teil 1', special.duell === true, special)
  const beiwerk = einzeln({ id: 102, jpStart: '2005-01' }, [film(101, '2001-01', { beiwerk: true }), film(102, '2005-01')])
  pruefe('früheres Beiwerk ist nicht Teil 1', beiwerk.duell === true, beiwerk)
  const eigenes = einzeln({ id: 102, jpStart: '2005-01' }, [film(101, '2001-01', { eigenesWerk: true }), film(102, '2005-01')])
  pruefe('eine frühere eigene Serie ist nicht Teil 1', eigenes.duell === true, eigenes)
  const spaeterKennung = einzeln({ id: 101, jpStart: '2005-01' }, [film(102, '2005-01'), film(101, '2005-01')])
  pruefe('gleicher Starttag, der Einstieg hat die kleinere Kennung: Duellpaar', spaeterKennung.duell === true, spaeterKennung)
  const gleichZeit = einzeln({ id: 103, jpStart: '2005-01' }, [film(101, '2005-01'), film(103, '2005-01')])
  pruefe('Teil 1 mit gleichem Starttag wie der Einstieg zählt als gleichzeitig: Duellpaar', gleichZeit.duell === true, gleichZeit)
  const imPool = baueEmpfehlung(
    [titel({ id: 121, franchiseId: 120, jpStart: '2010-09', jpYear: 2010 }), titel({ id: 125, franchiseId: 120, jpStart: '2010-01', jpYear: 2010 })],
    { 120: [glied(121, '2010-09'), glied(125, '2010-01')] } as unknown as Franchises,
  ).einstiege[0]!
  pruefe('Teil 1 liegt im Pool, auch wenn die Einstiegsregel (Jahr, Kennung) einen anderen wählt: Duellpaar', imPool.id === 121 && imPool.duell === true, imPool)
  const nummer1 = baueEmpfehlung(
    [titel({ id: 131, franchiseId: 130, jpYear: 2010, jpStart: '2010-01' })],
    { 130: [glied(130, '2009-01'), glied(131, '2010-01', { staffelQuelle: 1 }), glied(132, '2011-01')] } as unknown as Franchises,
  ).einstiege[0]!
  pruefe('Staffelnummer 1 beim Nicht-Teil-1 wird nicht als „ab“ ausgegeben', !nummer1.duell && nummer1.ab === undefined, nummer1)
}

console.log('\nAusgabe-Kennung (Seite, Worker und Erweiterung kennen nur `ak`):')
{
  const titles = [titel({ id: 10, franchiseId: 10, jpYear: 2010 }), titel({ id: 12, franchiseId: 10, jpYear: 2012 }), titel({ id: 20 })]
  const d = baueEmpfehlung(titles, {})
  const aus = uebersetzeDatei('empfehlung.json', d, (id) => id + 1000) as typeof d
  pruefe('Einstiege tragen die übersetzte Kennung', aus.einstiege.map((k) => k.id).join() === '1010,1020', aus.einstiege.map((k) => k.id))
  pruefe('reihe: Schlüssel und Wert übersetzt', JSON.stringify(aus.reihe) === '{"1012":1010}', aus.reihe)
  pruefe('übrige Felder bleiben unverändert', aus.pool === 3 && aus.genres === d.genres && aus.einstiege[0]!.n === d.einstiege[0]!.n && aus.einstiege[0]!.duell === true)
}

console.log('\nFelder:')
{
  const t = titel({
    id: 81,
    genres: ['Action', 'Drama'],
    keywords: ['Magie'],
    fsk: 12,
    trailer: { video: 'abc' } as Title['trailer'],
    streams: [{ platform: 'netflix', url: 'u', dub: true, zugang: 'abo' }, { platform: 'netflix', url: 'v', dub: true, zugang: 'abo' }, { platform: 'primevideo', url: 'u', dub: true }, { platform: 'crunchyroll', url: 'u', dub: false }] as Title['streams'],
  })
  const u = titel({ id: 82, genres: ['Drama', 'Comedy'], keywords: ['Magie', 'Schule'] })
  const d = baueEmpfehlung([t, u], {})
  const [a, b] = d.einstiege as [(typeof d.einstiege)[0], (typeof d.einstiege)[0]]
  pruefe('Genres und Schlagwörter als Indizes in gemeinsamen Wörterbüchern', d.genres.join() === 'Action,Drama,Comedy' && a.g.join() === '0,1' && b.g.join() === '1,2' && d.keywords.join() === 'Magie,Schule' && b.k.join() === '0,1', d)
  pruefe('Anbieter mit Synchro, doppelte Wege einmal, dub=false nicht', JSON.stringify(a.p) === '[["netflix","abo"],["primevideo"]]', a.p)
  pruefe('Trailer-Marke nur mit Video', a.trailer === true && b.trailer === undefined)
  const leer = baueEmpfehlung([titel({ id: 83, trailer: {} as Title['trailer'] })], {}).einstiege[0]!
  pruefe('Trailer-Eintrag ohne Video bekommt keine Marke', leer.trailer === undefined)
  pruefe('Name wie auf der Seite, kein Bild in der Datei', a.n === 'T81' && !JSON.stringify(d).includes('c.jpg'))
}

console.log('\nPrüfung:')
{
  const titles = [titel({ id: 91 }), titel({ id: 92, coverImage: undefined })]
  const gut = baueEmpfehlung([titles[0]!], {})
  pruefe('sauberer Bau: kein Widerspruch', pruefeEmpfehlung(gut, [titles[0]!]).length === 0, pruefeEmpfehlung(gut, [titles[0]!]))
  pruefe('falsche Poolzahl wird gemeldet', pruefeEmpfehlung({ ...gut, pool: 5 }, [titles[0]!]).length > 0)
  pruefe('fehlender Einstieg wird gemeldet', pruefeEmpfehlung({ ...gut, einstiege: [] }, [titles[0]!]).length > 0)
  pruefe('ab bei duell wird gemeldet', pruefeEmpfehlung({ ...gut, einstiege: [{ ...gut.einstiege[0]!, duell: true, ab: 2 }] }, [titles[0]!]).length > 0)
  const { duell: _duell, ...ohneDuell } = gut.einstiege[0]!
  pruefe('ab ohne duell, aber kleiner 2: wird gemeldet', pruefeEmpfehlung({ ...gut, einstiege: [{ ...ohneDuell, ab: 1 }] }, [titles[0]!]).length > 0)
  pruefe('ab 2 ohne duell ist in Ordnung', pruefeEmpfehlung({ ...gut, einstiege: [{ ...ohneDuell, ab: 2 }] }, [titles[0]!]).length === 0)
  pruefe('Schlagwort-Index außerhalb des Wörterbuchs wird gemeldet', pruefeEmpfehlung({ ...gut, einstiege: [{ ...gut.einstiege[0]!, k: [9] }] }, [titles[0]!]).length > 0)
  const poolZwei = [titel({ id: 96 }), titel({ id: 97 })]
  const zweiEinstiege = baueEmpfehlung(poolZwei, {})
  pruefe('doppelte Kennung unter den Einstiegen wird gemeldet', pruefeEmpfehlung({ ...zweiEinstiege, einstiege: [zweiEinstiege.einstiege[0]!, zweiEinstiege.einstiege[0]!] }, poolZwei).some((f) => f.includes('doppelt')))
  pruefe('Einstieg, der nicht (mehr) im Pool liegt, wird gemeldet', pruefeEmpfehlung(gut, [titel({ id: 91, score: 10 })]).some((f) => f.includes('nicht im Pool')))
  pruefe('Index außerhalb des Wörterbuchs wird gemeldet', pruefeEmpfehlung({ ...gut, einstiege: [{ ...gut.einstiege[0]!, g: [3] }] }, [titles[0]!]).length > 0)
  const zwei = [titel({ id: 93, franchiseId: 93, jpYear: 2000 }), titel({ id: 94, franchiseId: 93, jpYear: 2001 }), titel({ id: 95 })]
  const d = baueEmpfehlung(zwei, {})
  pruefe('Verweis auf eine fremde Reihe wird gemeldet', pruefeEmpfehlung({ ...d, reihe: { '94': 95 } }, zwei).some((f) => f.includes('reihe[94]')))
  const drei = [...zwei, titel({ id: 96, franchiseId: 93, jpYear: 2002 })]
  pruefe('Verweis auf einen Teil, der kein Einstieg ist, wird gemeldet', pruefeEmpfehlung({ ...baueEmpfehlung(drei, {}), reihe: { '94': 96, '96': 93 } }, drei).some((f) => f.includes('reihe[94]')))
}

console.log('\nBauphase (Warnungen, Abbruch, Verdrahtung):')
{
  const wurzel = mkdtempSync(join(tmpdir(), 'empfehlung-'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  process.env.AK_ROOT = wurzel
  const { schreibeEmpfehlung, hinweiseEmpfehlung, bestandsFehler, kennungenOhneTitel } = await import('./bau/13-10-empfehlung.ts')
  const bestandTitel = [titel({ id: 301, franchiseId: 300, jpYear: 2012 }), titel({ id: 302 })]
  const bestandReihen = { 300: [glied(300, '2010-01'), glied(301, '2012-01')] } as unknown as Franchises
  const bestand = baueEmpfehlung(bestandTitel, bestandReihen)
  pruefe('Bestandsprüfung: Datei gleich dem Neubau, kein Fehler', bestandsFehler(bestand, bestandTitel, bestandReihen).length === 0, bestandsFehler(bestand, bestandTitel, bestandReihen))
  const veraltet = { ...bestand, einstiege: bestand.einstiege.map((k) => (k.id === 301 ? { ...k, ab: undefined, duell: true as const } : k)) }
  pruefe('Bestandsprüfung: gültige, aber vom Neubau abweichende Datei wird gemeldet', bestandsFehler(veraltet, bestandTitel, bestandReihen).some((f) => f.includes('weicht vom Neubau')), bestandsFehler(veraltet, bestandTitel, bestandReihen))
  pruefe('Bestandsprüfung: Widerspruch wird gemeldet', bestandsFehler({ ...bestand, pool: 9 }, bestandTitel, bestandReihen).some((f) => f.includes('pool 9')))
  pruefe('Bestandsprüfung: fehlendes Cover ist kein Fehler (nur Warnung)', bestandsFehler(bestand, [titel({ id: 301, franchiseId: 300, jpYear: 2012, coverImage: undefined }), bestandTitel[1]!], bestandReihen).length === 0)
  const reiheTitel = [titel({ id: 10, franchiseId: 10, jpYear: 2010 }), titel({ id: 12, franchiseId: 10, jpYear: 2012 }), titel({ id: 20 })]
  const reiheDatei = baueEmpfehlung(reiheTitel, {})
  const plus = (id: number) => id + 1000
  const ohne = (ids: number[]) => kennungenOhneTitel(reiheDatei, reiheTitel.filter((x) => !ids.includes(x.id)), plus)
  pruefe('Kennungen: alle haben einen Titel, keine Meldung', ohne([]).length === 0, ohne([]))
  pruefe('Kennungen: Reihen-Schlüssel ohne Titel wird gemeldet (genau 1)', ohne([12]).length === 1 && ohne([12])[0]!.includes('1012'), ohne([12]))
  pruefe('Kennungen: Einstieg ohne Titel (Einstieg und Reihen-Wert) wird gemeldet', ohne([10]).length === 2 && ohne([10]).every((f) => f.includes('1010')), ohne([10]))
  const ohneCover = [titel({ id: 92, coverImage: undefined })]
  pruefe('Einstieg ohne Cover wird als Hinweis gemeldet', hinweiseEmpfehlung(baueEmpfehlung(ohneCover, {}), ohneCover).some((f) => f.includes('92') && f.includes('Cover')))
  pruefe('Einstieg mit Cover: kein Hinweis', hinweiseEmpfehlung(baueEmpfehlung([titel({ id: 91 })], {}), [titel({ id: 91 })]).length === 0)
  const schreibe = (titles: Title[]) => writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titles))
  const lies = () => JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'empfehlung.json'), 'utf8')) as ReturnType<typeof baueEmpfehlung>
  const echtesExit = process.exit
  let beendet = false
  process.exit = ((): never => {
    beendet = true
    throw new Error('exit')
  }) as typeof process.exit
  const lauf = (): void => {
    beendet = false
    try {
      schreibeEmpfehlung()
    } catch (e) {
      if (!beendet) throw e
    }
  }
  schreibe([titel({ id: 101 }), titel({ id: 102 })])
  lauf()
  pruefe('kleiner Bestand: Datei geschrieben, Bau läuft weiter', !beendet && lies().einstiege.map((k) => k.id).join() === '101,102')
  schreibe([titel({ id: 201, franchiseId: 200, jpYear: 2012 })])
  writeFileSync(join(wurzel, 'public', 'data', 'franchises.json'), JSON.stringify({ 200: [glied(200, '2010-01'), glied(201, '2012-01')] }))
  lauf()
  pruefe('Reihen kommen aus franchises.json (Staffelnummer des Einstiegs)', !beendet && lies().einstiege[0]?.ab === 2, lies().einstiege)
  // Viele verschiedene Namen und Genres: dicht gepackt weit über 40 KB gzip.
  const zufall = (i: number) => Math.imul(i + 1, 2654435761).toString(36) + Math.imul(i + 7, 40503).toString(36)
  const gross = Array.from({ length: 4000 }, (_, i) => titel({ id: 1000 + i, titleDe: `${zufall(i)} ${zufall(i * 3)} ${zufall(i * 7)}`, genres: [zufall(i), zufall(i + 1)], keywords: [zufall(i + 2)] }))
  const echtesWarn = console.warn
  let warnungen: string[] = []
  console.warn = (...a: unknown[]) => void warnungen.push(a.join(' '))
  schreibe(gross)
  lauf()
  pruefe(`mehr als ${MAX_GZIP_BYTES} Byte gzip: Warnung, Bau läuft weiter, Datei geschrieben`, !beendet && warnungen.some((w) => w.includes('über der Grenze')) && lies().einstiege.length === 4000, warnungen)
  pruefe(`Bestandsprüfung: mehr als ${MAX_GZIP_BYTES} Byte gzip ist Fehler`, bestandsFehler(baueEmpfehlung(gross, {}), gross, {}).some((f) => f.includes('über der Grenze')))
  warnungen = []
  schreibe([titel({ id: 103, coverImage: undefined })])
  lauf()
  pruefe('Einstieg ohne Cover: Warnung, Bau läuft weiter, Datei geschrieben', !beendet && warnungen.some((w) => w.includes('103') && w.includes('Cover')) && lies().einstiege[0]?.id === 103, warnungen)
  warnungen = []
  schreibe([titel({ id: 104 })])
  lauf()
  pruefe('sauberer Bestand: keine Warnung', !beendet && warnungen.length === 0, warnungen)
  writeFileSync(join(wurzel, 'public', 'data', 'empfehlung.json'), '{}')
  schreibe([titel({ id: 105, franchiseId: 1 }), titel({ id: 105, franchiseId: 2 })])
  lauf()
  pruefe('Widerspruch in der Datei (Kennung doppelt): Bau bricht ab, Datei bleibt unangetastet', beendet && readFileSync(join(wurzel, 'public', 'data', 'empfehlung.json'), 'utf8') === '{}')
  console.warn = echtesWarn
  process.exit = echtesExit

  /* Der Aufrufer: `liefereAus` in build.ts ruft schreibeEmpfehlung() unbedingt auf der obersten Ebene seines Rumpfs. */
  const quelle = ts.createSourceFile('build.ts', readFileSync(new URL('./build.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const aufrufer = quelle.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'liefereAus')
  const oberste = (aufrufer?.body?.statements ?? []).flatMap((s) => (ts.isExpressionStatement(s) ? [s.expression] : []))
  const ruft = oberste.some((e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'schreibeEmpfehlung' && e.arguments.length === 0)
  pruefe('build.ts: liefereAus ruft schreibeEmpfehlung() auf', ruft)
}

console.log(verletzt === 0 ? '\nEmpfehlung: alle Zusicherungen gehalten' : `\nEmpfehlung: ${verletzt} verletzt`)
process.exit(verletzt === 0 ? 0 : 1)
