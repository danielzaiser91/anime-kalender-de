/**
 * Zusicherungen: Eine bestehende Meldung behält `weiterer` vom Bau, der sie erzeugte (20.10.2026, `lib/news-einfrieren.ts`).
 * Läuft in `check:logic`. Erfundene Titel mit festen Daten, kein Netz, keine Uhr.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NewsEintrag, NewsMeldung, Release, StreamLink, Title } from '../shared/types.ts'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { einfrierFehler, haltWeitererFest, saeeWeiterer, setzeWeitererEin, vergissAlte } from './lib/news-einfrieren.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const historie = (zuerst: Record<string, string> = {}, weiterer?: Record<string, boolean>): NewsHistorie => ({ zuerst, ...(weiterer ? { weiterer } : {}) })
const termin = (extra: Partial<NewsMeldung> = {}): NewsMeldung => ({ art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', ...extra }) as NewsMeldung
const eintrag = (...meldungen: NewsMeldung[]): NewsEintrag => ({ am: '2026-10-01', titelId: 1, titel: 'T', slug: 't', meldungen })
const K = 'angekuendigt:r-1:2099-01-01'

/* 1. Die Weiche selbst: erster Wert gilt, später gekippte Werte werden zurückgesetzt, beides in beide Richtungen. */
const h1 = historie()
const erst = haltWeitererFest(h1, K, termin({ weiterer: true }))
pruefe('Erster Bau: Wert wird festgehalten', h1.weiterer?.[K] === true && erst.weiterer === true, h1.weiterer)
const kippt = haltWeitererFest(h1, K, termin())
pruefe('true wird später false abgeleitet: die Meldung bleibt weiterer', kippt.weiterer === true, kippt)
const h2 = historie({}, { [K]: false })
const kippt2 = haltWeitererFest(h2, K, termin({ weiterer: true }))
pruefe('false wird später true abgeleitet: die Meldung bleibt ohne weiterer', !('weiterer' in kippt2), kippt2)
const gleich = termin({ weiterer: true })
pruefe('Gleicher Wert: dasselbe Objekt, Feldreihenfolge unberührt', haltWeitererFest(historie({}, { [K]: true }), K, gleich) === gleich)
const neu = { art: 'neu', platform: 'joyn', weiterer: true } as NewsMeldung
const h3 = historie()
pruefe('Andere Arten bleiben unberührt und werden nicht gemerkt', haltWeitererFest(h3, 'neu:1', neu) === neu && h3.weiterer === undefined)
pruefe('Zwei Schlüssel ohne Verwechslung', haltWeitererFest(historie({}, { [K]: true, 'angekuendigt:r-2:2099-01-01': false }), 'angekuendigt:r-2:2099-01-01', termin({ weiterer: true })).weiterer === undefined)

/* 2. Altern: Schlüssel ohne `zuerst` verlieren auch ihr Flag; ein Schlüssel von heute bleibt. */
const alt = historie({ 'angekuendigt:a:1': '2025-01-01', 'angekuendigt:b:1': '2026-10-01' }, { 'angekuendigt:a:1': true, 'angekuendigt:b:1': false, 'angekuendigt:c:1': true })
vergissAlte(alt, '2026-01-01')
pruefe('Alt: zuerst und Flag fallen heraus, Verwaiste ebenso', JSON.stringify(alt) === JSON.stringify({ zuerst: { 'angekuendigt:b:1': '2026-10-01' }, weiterer: { 'angekuendigt:b:1': false } }), alt)
const ohneFeld = historie({ x: '2026-10-01' })
vergissAlte(ohneFeld, '2026-01-01')
pruefe('Alt: Gedächtnis ohne Feld bleibt ohne Feld', ohneFeld.weiterer === undefined)

/* 3. Zwei echte Bauten mit demselben Gedächtnis: Titel 1 verliert den anderen Anbieter, Titel 2 bekommt ihn, Titel 3 bleibt. */
const cr = { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/T', dub: true } as StreamLink
const titel = (id: number, streams: StreamLink[]): Title => ({ id, franchiseId: id, slug: `t-${id}`, titleEn: `T${id}`, keywords: [], genres: [], streams }) as unknown as Title
const release = (id: number): Release =>
  ({ titleId: id, slug: `r-${id}`, platform: 'netflix', releaseType: 'series', schedule: { firstEpisodeDate: '2099-01-01' }, sources: ['https://www.netflix.com/title/1'] }) as unknown as Release
const bau = (h: NewsHistorie, wege: StreamLink[][]): Record<string, boolean | undefined> => {
  const e = baueNews(wege.map((s, i) => titel(i + 1, s)), [1, 2, 3].map(release), [], [], h)
  return Object.fromEntries(e.flatMap((x) => x.meldungen.filter((m) => m.art === 'angekuendigt').map((m) => [m.release!, m.weiterer])))
}
const hb = historie()
const erster = bau(hb, [[cr], [], [cr]])
pruefe('Bau 1: weiterer nach heutigem Stand', erster['r-1'] === true && erster['r-2'] === undefined && erster['r-3'] === true, erster)
const zweiter = bau(hb, [[], [cr], [cr]])
pruefe('Bau 2 (Wege getauscht): kein Umsprung an Titel 1, 2 und 3', JSON.stringify(zweiter) === JSON.stringify(erster), zweiter)
const dritter = bau(hb, [[cr], [], [cr]])
pruefe('Bau 3 (wieder zurück): weiter kein Umsprung', JSON.stringify(dritter) === JSON.stringify(erster), dritter)

const alterBau = historie({ 'angekuendigt:alt:1': '2000-01-01', 'angekuendigt:neu:1': '2099-01-01' }, { 'angekuendigt:alt:1': true, 'angekuendigt:neu:1': true })
bau(alterBau, [[cr], [], [cr]])
pruefe('Bau altert das Gedächtnis: 400 Tage alter Schlüssel samt Flag weg, junger bleibt', alterBau.weiterer?.['angekuendigt:alt:1'] === undefined && alterBau.weiterer?.['angekuendigt:neu:1'] === true, alterBau)

/* 3b. Meldungen aus dem Terminverlauf (abgelöst, zurückgezogen) tragen dasselbe festgehaltene weiterer (Bestandsbau 20.10.2026: 8 Fehler). */
const verlaufBau = (h: NewsHistorie, wege: StreamLink[][], datum: string | undefined): NewsMeldung[] => {
  const rel = datum ? [{ ...release(1), schedule: { firstEpisodeDate: datum } } as Release] : []
  return baueNews(wege.map((s, i) => titel(i + 1, s)), rel, [], [], h).flatMap((x) => x.meldungen.filter((m) => m.art === 'angekuendigt'))
}
const hv = historie()
verlaufBau(hv, [[cr]], '2099-01-01')
const abgeloest = verlaufBau(hv, [[cr]], '2099-02-01')
pruefe('Terminverlauf: abgelöste Meldung behält weiterer vom Tag der Meldung', abgeloest.find((m) => m.datum === '2099-01-01')?.ersetzt !== undefined && abgeloest.find((m) => m.datum === '2099-01-01')?.weiterer === true, abgeloest)
pruefe('Terminverlauf: die aktuelle Meldung bleibt weiterer', abgeloest.find((m) => m.datum === '2099-02-01')?.weiterer === true, abgeloest)
const zurueck = verlaufBau(hv, [[cr]], undefined)
pruefe('Terminverlauf: zurückgezogene Meldung behält weiterer', zurueck.length === 2 && zurueck.some((m) => m.zurueckgezogen !== undefined) && zurueck.every((m) => m.weiterer === true), zurueck)
const hf = historie()
verlaufBau(hf, [[]], '2099-01-01')
const abgeloestOhne = verlaufBau(hf, [[cr]], '2099-02-01')
pruefe('Terminverlauf: festgehaltenes false bekommt auch am abgelösten Stand kein weiterer', abgeloestOhne.find((m) => m.datum === '2099-01-01')?.ersetzt !== undefined && abgeloestOhne.find((m) => m.datum === '2099-01-01')?.weiterer === undefined, abgeloestOhne)

/* 4. Säen: erster Stand zählt, Festgehaltenes bleibt, Fremdes (nicht im Gedächtnis) wird nicht angelegt; zweiter Lauf tut nichts. */
const stand1 = [eintrag(termin({ weiterer: true }), termin({ release: 'r-9', weiterer: true }), termin({ release: 'r-7' }))]
const stand2 = [eintrag(termin(), termin({ release: 'r-9' }), termin({ release: 'r-7', weiterer: true }))]
const jetzt = [eintrag(termin(), termin({ release: 'r-9' }), termin({ release: 'r-7', weiterer: true }), termin({ release: 'r-8', weiterer: true }), termin({ release: 'r-5' }))]
const hs = historie(
  { [K]: 'x', 'angekuendigt:r-9:2099-01-01': 'x', 'angekuendigt:r-7:2099-01-01': 'x', 'angekuendigt:r-8:2099-01-01': 'x' },
  { 'angekuendigt:r-9:2099-01-01': false },
)
const n1 = saeeWeiterer(hs, [stand1, stand2], jetzt)
pruefe(
  'Säen: erster Stand, Vorhandenes bleibt, Meldung ohne Stand nimmt den heutigen Wert, Schlüssel ohne zuerst fehlt',
  n1 === 3 && JSON.stringify(hs.weiterer) === JSON.stringify({ 'angekuendigt:r-9:2099-01-01': false, [K]: true, 'angekuendigt:r-7:2099-01-01': false, 'angekuendigt:r-8:2099-01-01': true }),
  { n1, w: hs.weiterer },
)
pruefe('Säen: zweiter Lauf legt nichts mehr an', saeeWeiterer(hs, [stand1, stand2], jetzt) === 0)
const hl = historie({ [K]: 'x' })
pruefe('Säen: leere Historie nimmt den heutigen Wert', saeeWeiterer(hl, [], [eintrag(termin({ weiterer: true }))]) === 1 && hl.weiterer?.[K] === true)

/* 5. news.json angleichen: Reihenfolge wie im Bau (nach geschaetzt/belege), Entfernen, zweiter Lauf, Fremdes unberührt. */
const roh = [eintrag(termin({ quelle: 'q', belege: [], geschaetzt: true, hinweis: 'h' } as Partial<NewsMeldung>), termin({ release: 'r-9', weiterer: true }), { art: 'neu', platform: 'joyn' } as NewsMeldung)]
const fest = { [K]: true, 'angekuendigt:r-9:2099-01-01': false }
const g1 = setzeWeitererEin(roh, fest)
pruefe('Angleichen: true eingefügt hinter geschaetzt, vor hinweis', Object.keys(roh[0]!.meldungen[0]!).join() === 'art,platform,release,datum,quelle,belege,geschaetzt,weiterer,hinweis', Object.keys(roh[0]!.meldungen[0]!))
pruefe('Angleichen: false entfernt das Feld, andere Art bleibt', g1 === 2 && !('weiterer' in roh[0]!.meldungen[1]!) && roh[0]!.meldungen[2]!.art === 'neu', g1)
pruefe('Angleichen: zweiter Lauf ändert nichts', setzeWeitererEin(roh, fest) === 0)

/* 5b. Bestandswächter: Umsprung, Lücke, passender Fall; Gegenprobe mit zweiter Meldung gleicher Serienadresse. */
const bestand = [eintrag(termin({ weiterer: true }), termin({ release: 'r-9', weiterer: true }), termin({ release: 'r-4' }), termin({ release: 'r-6', platform: 'adn' }))]
const w = einfrierFehler(bestand, historie({}, { [K]: false, 'angekuendigt:r-9:2099-01-01': true, 'angekuendigt:r-4:2099-01-01': true }))
pruefe('Wächter: nur der gekippte Fall ist Fehler (false festgehalten, true ausgeliefert), der gekippte andere Weg ebenso', w.fehler.length === 2 && w.fehler[0]!.includes(K) && w.fehler[1]!.includes('r-4'), w)
pruefe('Wächter: fehlender Eintrag ist Lücke, kein Fehler', w.luecken.length === 1 && w.luecken[0]!.includes('r-6'), w)
const ok = einfrierFehler(bestand, historie({}, { [K]: true, 'angekuendigt:r-9:2099-01-01': true, 'angekuendigt:r-4:2099-01-01': false, 'angekuendigt:r-6:2099-01-01': false }))
const ohneDatum = einfrierFehler([eintrag(termin({ datum: undefined, weiterer: true }))], historie({}, { 'angekuendigt:r-1:undefined': false }))
pruefe('Wächter: Meldung ohne Datum hat keinen Schlüssel und wird übergangen', ohneDatum.fehler.length === 0 && ohneDatum.luecken.length === 0, ohneDatum)
pruefe('Wächter: alles gleich ist grün', ok.fehler.length === 0 && ok.luecken.length === 0, ok)

/* 6. Der Läufer end-to-end in einem Wegwerf-Repo: Quelle, Gedächtnis und news.json als Parameter (AK_ROOT, GIT_EXE). */
const wurzel = mkdtempSync(join(tmpdir(), 'news-einfrieren-'))
try {
  const git = (...a: string[]): void => void execFileSync(process.env.GIT_EXE ?? 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: wurzel, windowsHide: true, stdio: 'pipe' })
  git('init', '-q')
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const schreibe = (pfad: string, daten: unknown): void => writeFileSync(join(wurzel, pfad), JSON.stringify(daten))
  schreibe('public/data/news.json', stand1)
  git('add', '.')
  git('commit', '-q', '-m', 'eins')
  schreibe('public/data/news.json', stand2)
  git('add', '.')
  git('commit', '-q', '-m', 'zwei')
  schreibe('data/news-historie.json', { zuerst: { [K]: 'x', 'angekuendigt:r-9:2099-01-01': 'x' } })
  const lauf = (): string =>
    execFileSync(process.execPath, ['--import', 'tsx', 'pipeline/news-einfrieren-saeen.ts', '--ref', 'HEAD'], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true })
  const aus = lauf()
  const h = JSON.parse(readFileSync(join(wurzel, 'data', 'news-historie.json'), 'utf8')) as NewsHistorie
  const nj = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'news.json'), 'utf8')) as NewsEintrag[]
  pruefe('Läufer: Gedächtnis hat den ersten Stand, news.json ist angeglichen', h.weiterer?.[K] === true && h.weiterer['angekuendigt:r-9:2099-01-01'] === true && nj[0]!.meldungen[0]!.weiterer === true, { h: h.weiterer, aus })
  pruefe('Läufer: zweiter Lauf meldet nichts Neues', /0 Schlüssel festgehalten, 0 Meldungen/.test(lauf()))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(`check-news-einfrieren: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
