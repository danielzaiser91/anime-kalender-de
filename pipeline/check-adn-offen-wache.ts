/** Test der Wache `check-adn-offen-bestand.ts` mit Kulisse (kein Echtdatenzugriff). */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { bewerteOffenDatei } from './lib/adn-offen-wache.ts'
import { aktualisiereOffenSeit, laufendOhneZuordnung, type OffenLage } from './lib/adn-offen-seit.ts'
import { laufendZeile } from './check-adn-offen-bestand.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const datei = (gruende: string[], anzahl = gruende.length) =>
  JSON.stringify({ anzahl, serien: gruende.map((grund, i) => ({ showId: 100 + i, grund, kandidaten: [] })) })
const fehlt = (n: number) => Array(n).fill('titelliste-fehlt') as string[]
const stufe = (s: string | null) => bewerteOffenDatei(s).stufe

pruefe('Datei fehlt: rot', stufe(null) === 'rot')
pruefe('kein JSON: rot', stufe('{kaputt') === 'rot')
pruefe('leere Datei: rot', stufe('') === 'rot')
pruefe('Feld serien fehlt: rot', stufe('{"anzahl":0}') === 'rot')
pruefe('serien keine Liste: rot', stufe('{"anzahl":0,"serien":{}}') === 'rot')
pruefe('anzahl passt nicht: rot', stufe(datei(fehlt(1), 7)) === 'rot')
pruefe('null als Inhalt: rot', stufe('null') === 'rot')
pruefe('leere Liste: ok, 0', stufe(datei([])) === 'ok' && bewerteOffenDatei(datei([])).fehlt === 0)
pruefe('andere Gründe zählen nicht: ok', stufe(datei(['kein-kandidat', 'mehrdeutig', 'vergeben'])) === 'ok')
pruefe('genau 1: Warnung, fehlt 1', stufe(datei(fehlt(1))) === 'warnung' && bewerteOffenDatei(datei(fehlt(1))).fehlt === 1)
const gemischt = bewerteOffenDatei(datei([...fehlt(4), 'mehrdeutig']))
pruefe('4 mit Fremdgrund gemischt: Warnung, fehlt 4', gemischt.stufe === 'warnung' && gemischt.fehlt === 4, gemischt)
const fuenf = bewerteOffenDatei(datei(fehlt(5)))
pruefe('genau 5: nur Warnung (rot stoppt den Bestandsbau), deutlicherer Text', fuenf.stufe === 'warnung' && fuenf.fehlt === 5 && fuenf.text.includes('länger nicht'), fuenf)
pruefe('4: der Text ist noch der einfache', !gemischt.text.includes('länger nicht'), gemischt)
const mitNull = bewerteOffenDatei(JSON.stringify({ anzahl: 3, serien: [null, { grund: 'titelliste-fehlt' }, 7] }))
pruefe('null und Zahl als Eintrag: kein Absturz, zählt nur den echten', mitNull.stufe === 'warnung' && mitNull.fehlt === 1, mitNull)
pruefe('nur null-Einträge: ok, 0', stufe('{"anzahl":1,"serien":[null]}') === 'ok')
pruefe('4 plus 10 andere (Gesamt über 5): Warnung, einfacher Text', stufe(datei([...fehlt(4), ...Array(10).fill('kein-kandidat')])) === 'warnung')

const ordner = mkdtempSync(join(tmpdir(), 'adn-offen-wache-'))
const skript = fileURLToPath(new URL('./check-adn-offen-bestand.ts', import.meta.url))
function prozess(name: string, inhalt: string | null, wurzel = ordner, heute?: string): { status: number; out: string; err: string } {
  const d = join(ordner, name)
  if (inhalt !== null) writeFileSync(d, inhalt)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, d, wurzel, ...(heute ? [heute] : [])], { encoding: 'utf8', windowsHide: true })
  return { status: r.status ?? -1, out: r.stdout, err: r.stderr }
}
const warnung = prozess('a.json', datei(fehlt(2)))
pruefe('Prozess: Warnung endet mit Exit 0, Zeile "⚠ WARNUNG ADN-Titelliste" auf stdout', warnung.status === 0 && warnung.out.includes('⚠ WARNUNG ADN-Titelliste:'), warnung)
const viele = prozess('b.json', datei(fehlt(6)))
pruefe('Prozess: viele (6) enden ebenfalls mit Exit 0 und Warnzeile', viele.status === 0 && viele.out.includes('⚠ WARNUNG'), viele)
const weg = prozess('c.json', null)
pruefe('Prozess: fehlende Datei endet mit Exit 1, Meldung auf stderr (nicht stdout)', weg.status === 1 && weg.err.includes('✖ ADN-Titelliste:') && weg.out === '', weg)
const kaputt = prozess('e.json', '{kaputt')
pruefe('Prozess: kaputte Datei endet mit Exit 1, Meldung auf stderr', kaputt.status === 1 && kaputt.err.includes('kein gültiges JSON') && kaputt.out === '', kaputt)
const falscheAnzahl = prozess('f.json', datei(fehlt(1), 7))
pruefe('Prozess: falsche Anzahl endet mit Exit 1, Meldung auf stderr', falscheAnzahl.status === 1 && falscheAnzahl.err.includes('passt nicht'), falscheAnzahl)
const gut = prozess('d.json', datei([]))
pruefe('Prozess: ok endet mit Exit 0, Zeile mit ✓ auf stdout', gut.status === 0 && gut.out.includes('✓ ADN-Titelliste:') && gut.err === '', gut)


// Laufende Serie ohne Zuordnung: Warnung nach 3 Tagen (lib/adn-offen-seit.ts)
const HEUTE = '2026-11-05'
const lage = (aenderung: Partial<OffenLage> = {}): OffenLage => ({ heute: HEUTE, seit: { '887': '2026-10-31' }, letzteFolge: new Map([[887, '2026-10-24']]), zugeordnet: new Set(), ...aenderung })
const dream = [{ showId: 887, title: 'Dreamland' }]
const tage = (a: Partial<OffenLage>, serien = dream) => laufendOhneZuordnung(serien, lage(a)).map((s) => s.tage)
pruefe('laufend, 5 Tage offen: Warnung mit Tagen', tage({}).join() === '5', tage({}))
pruefe('genau 3 Tage offen: noch keine Warnung', tage({ seit: { '887': '2026-11-02' } }).length === 0)
pruefe('4 Tage offen: Warnung', tage({ seit: { '887': '2026-11-01' } }).join() === '4')
pruefe('letzte Folge genau 14 Tage her: laufend', tage({ letzteFolge: new Map([[887, '2026-10-22']]) }).length === 1)
pruefe('letzte Folge 15 Tage her: nicht laufend, keine Warnung', tage({ letzteFolge: new Map([[887, '2026-10-21']]) }).length === 0)
pruefe('Folge liegt noch in der Zukunft: laufend', tage({ letzteFolge: new Map([[887, '2026-12-01']]) }).length === 1)
pruefe('schon zugeordnet: keine Warnung', tage({ zugeordnet: new Set([887]) }).length === 0)
pruefe('Zuordnung einer anderen Serie ändert nichts', tage({ zugeordnet: new Set([1]) }).length === 1)
pruefe('ohne erste Sichtung: keine Warnung (Alter unbekannt)', tage({ seit: {} }).length === 0)
pruefe('ohne Folgendatum: keine Warnung', tage({ letzteFolge: new Map() }).length === 0)
const zweiSerien = laufendOhneZuordnung([...dream, { showId: 888, title: 'Neu' }], lage({ seit: { '887': '2026-10-31', '888': '2026-11-04' }, letzteFolge: new Map([[887, '2026-10-24'], [888, '2026-11-01']]) }))
pruefe('mehrere offene Serien: nur die lange offene warnt', zweiSerien.map((s) => s.showId).join() === '887', zweiSerien)
const zeile = laufendZeile(dream, lage())
pruefe('Zeile nennt Name, Kennung und Tage', Boolean(zeile?.includes('⚠ WARNUNG') && zeile.includes('Dreamland') && zeile.includes('887') && zeile.includes('5 Tagen')), zeile)
pruefe('keine Warnung: keine Zeile', laufendZeile(dream, lage({ zugeordnet: new Set([887]) })) === undefined)
const seitAlt = { '887': '2026-10-31', '5': '2026-10-01' }
const seitNeu = aktualisiereOffenSeit(seitAlt, [887, 900, 12], HEUTE)
pruefe('Seit-Datei: altes Datum bleibt, neue Serien tragen heute, gelöste fallen heraus', JSON.stringify(seitNeu) === '{"12":"2026-11-05","887":"2026-10-31","900":"2026-11-05"}', seitNeu)
pruefe('Seit-Datei: zweiter Lauf ändert nichts', JSON.stringify(aktualisiereOffenSeit(seitNeu, [12, 887, 900], '2027-01-01')) === JSON.stringify(seitNeu))
pruefe('Seit-Datei: leere Liste ergibt leere Datei', JSON.stringify(aktualisiereOffenSeit(seitAlt, [], HEUTE)) === '{}')

// Prozess: Kulisse mit Offen-Datei, Seit-Datei, Katalog und Cartoons
const kulisse = join(ordner, 'kulisse')
mkdirSync(join(kulisse, 'data'), { recursive: true })
writeFileSync(join(kulisse, 'data', 'adn-offen-seit.json'), JSON.stringify({ '887': '2026-10-31' }))
writeFileSync(join(kulisse, 'data', 'adn-catalog.json'), JSON.stringify({ shows: [{ showId: 887, episodes: [{ date: '2026-10-17' }, { date: '2026-10-24' }] }] }))
const offenDreamland = JSON.stringify({ anzahl: 1, serien: [{ showId: 887, title: 'Dreamland', grund: 'titelliste-fehlt', kandidaten: [] }] })
const ZEILE = '⚠ WARNUNG ADN laufend ohne Zuordnung'
const langOffen = prozess('g.json', offenDreamland, kulisse, HEUTE)
pruefe('Prozess: laufende Serie seit 5 Tagen offen: Warnzeile, Exit 0', langOffen.status === 0 && langOffen.out.includes(ZEILE) && langOffen.out.includes('Dreamland'), langOffen)
const frisch = prozess('h.json', offenDreamland, kulisse, '2026-11-03')
pruefe('Prozess: 3 Tage offen: keine Warnzeile', frisch.status === 0 && !frisch.out.includes(ZEILE), frisch)
const vorbei = prozess('i.json', offenDreamland, kulisse, '2026-11-20')
pruefe('Prozess: letzte Folge über 14 Tage her: keine Warnzeile', vorbei.status === 0 && !vorbei.out.includes(ZEILE), vorbei)
writeFileSync(join(kulisse, 'data', 'cartoons.json'), JSON.stringify({ '-900887': { adnId: 887 }, '-5': {} }))
const zugeordnet = prozess('j.json', offenDreamland, kulisse, HEUTE)
pruefe('Prozess: Cartoon mit adnId 887 vorhanden: keine Warnzeile', zugeordnet.status === 0 && !zugeordnet.out.includes(ZEILE), zugeordnet)
const kalenderOrdner = join(ordner, 'kalender')
mkdirSync(join(kalenderOrdner, 'data'), { recursive: true })
writeFileSync(join(kalenderOrdner, 'data', 'adn-offen-seit.json'), JSON.stringify({ '887': '2026-10-31' }))
writeFileSync(join(kalenderOrdner, 'data', 'adn.json'), JSON.stringify({ shows: [{ showId: 887, episodes: [{ date: '2026-10-24' }] }] }))
const ausKalender = prozess('l.json', offenDreamland, kalenderOrdner, HEUTE)
pruefe('Prozess: Folgen nur im Kalender (adn.json) zählen ebenso', ausKalender.status === 0 && ausKalender.out.includes(ZEILE), ausKalender)
const kaputtMitLage = prozess('k.json', '{kaputt', kulisse, HEUTE)
pruefe('Prozess: kaputte Offen-Datei bleibt rot, ohne Warnzeile', kaputtMitLage.status === 1 && !kaputtMitLage.out.includes(ZEILE), kaputtMitLage)
rmSync(ordner, { recursive: true, force: true })
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
