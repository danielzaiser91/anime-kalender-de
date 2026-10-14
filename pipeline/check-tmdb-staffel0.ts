/**
 * Zusicherungen zu `lib/tmdb-staffel0.ts`: ein Special, OVA oder Film wird nur einer Folge der Staffel 0 zugeordnet, wenn Datum, Name und Länge passen
 * (Beispiel Durarara!! World at Peace = tv/42410 Staffel 0 Folge 2, 14.10.2026), und der Bestand `data/tmdb-staffel0.json` trägt sein Urteil noch aus den
 * eigenen Merkmalen. Aufruf: `npm run check:logic`.
 */
import { eintragHaelt, mehrfachBelegt, urteilStaffel0, type Staffel0Eintrag, type Staffel0Folge, type Staffel0Titel, type Staffel0Urteil } from './lib/tmdb-staffel0.ts'
import { staffel0Kandidaten, type Staffel0Kandidat } from './lib/tmdb-staffel0-kandidaten.ts'
import { setzeBilder, staffel0Faellig, streiche, wende, type Bestaende, type Staffel0Bestand } from './lib/tmdb-staffel0-abruf.ts'
import type { TmdbBild } from './lib/tmdb-plakat.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (t: Partial<Staffel0Titel> & { namen: string[] }): Staffel0Titel => ({ start: '2011-02-23', ...t })
const folge = (e: number, name: string, datum: string | null, minuten: number | null = 24, nameJa?: string): Staffel0Folge => ({ e, name, datum, minuten, nameJa })
const stufe = (t: Staffel0Titel, folgen: Staffel0Folge[]) => urteilStaffel0(t, [{ tmdbId: 42410, folgen }])

console.log('\nTMDB-Staffel 0: was sicher ist')
const durarara = titel({ namen: ['Durarara!! World at Peace', 'Durarara!! Tenka Taihei', 'デュラララ！！ 天下泰平'] })
const wahl = stufe(durarara, [folge(1, 'Heaven’s Vengeance', '2010-08-25'), folge(2, 'World at Peace', '2011-02-23')])
pruefe('Durarara!! World at Peace → Folge 2 (Datum und Name gleich, unsere Länge fehlt)', wahl.stufe === 'sicher' && wahl.treffer?.e === 2, wahl)
pruefe('mit Länge: Abstand eine Minute genügt', stufe(titel({ namen: ['World at Peace'], minuten: 25 }), [folge(2, 'World at Peace', '2011-02-23')]).stufe === 'sicher')
pruefe('Datum einen Tag daneben mit gleicher Länge und Name', stufe(titel({ namen: ['World at Peace'], minuten: 24 }), [folge(2, 'World at Peace', '2011-02-24')]).stufe === 'sicher')
const ja = stufe(titel({ namen: ['Ookami OVA', '狼と琥珀色の憂鬱'], minuten: 24 }), [folge(2, 'Wolf and the Amber Melancholy', '2011-02-23', 24, '狼と琥珀色の憂鬱')])
pruefe('Name nur japanisch gleich (englisch übersetzt) trägt', ja.stufe === 'sicher', ja)
const drei = stufe(titel({ namen: ['Shana S'], folgen: 3, minuten: 24 }), [folge(31, 'Shana S', '2011-02-23'), folge(32, 'x', '2011-03-30'), folge(33, 'y', '2011-04-30')])
pruefe('drei Folgen: die folgenden stehen in der Staffel 0', drei.stufe === 'sicher' && drei.treffer?.e === 31, drei)

console.log('\nTMDB-Staffel 0: was nicht gilt (Gegenproben)')
const nurDatum = stufe(titel({ namen: ['Ganz anderer Titel'], minuten: 24 }), [folge(1, 'Episode Prologue Reunion', '2011-02-23')])
pruefe('Datum und Länge gleich, Name anders: unsicher, nie sicher', nurDatum.stufe === 'unsicher', nurDatum)
pruefe('Name gleich, Datum drei Tage daneben: unsicher', stufe(titel({ namen: ['World at Peace'], minuten: 24 }), [folge(2, 'World at Peace', '2011-02-26')]).stufe === 'unsicher')
pruefe('Name gleich, Datum einen Tag daneben, Länge fehlt: unsicher', stufe(titel({ namen: ['World at Peace'] }), [folge(2, 'World at Peace', '2011-02-24')]).stufe === 'unsicher')
pruefe('Name und Datum gleich, Länge 24 gegen 60: nicht sicher', stufe(titel({ namen: ['World at Peace'], minuten: 24 }), [folge(2, 'World at Peace', '2011-02-23', 60)]).stufe !== 'sicher')
pruefe('allgemeiner TMDB-Name „Special“ zählt nicht als Name', stufe(titel({ namen: ['Violet Evergarden: Special'], minuten: 34 }), [folge(1, 'Special', '2011-02-23', 34)]).stufe === 'unsicher')
pruefe('„Episode 1“ zählt nicht als Name', stufe(titel({ namen: ['Violet Evergarden Episode 1'], minuten: 34 }), [folge(1, 'Episode 1', '2011-02-23', 34)]).stufe === 'unsicher')
const zwei = stufe(titel({ namen: ['World at Peace'], minuten: 24 }), [folge(2, 'World at Peace', '2011-02-23'), folge(3, 'World at Peace Part 2', '2011-02-23')])
pruefe('zwei Folgen passen: keine wird gewählt', zwei.stufe === 'unsicher' && zwei.grund === 'mehrere Folgen passen', zwei)
const luecke = stufe(titel({ namen: ['Shana S'], folgen: 3, minuten: 24 }), [folge(31, 'Shana S', '2011-02-23'), folge(35, 'x', '2011-03-30')])
pruefe('drei Folgen, aber die folgenden fehlen: unsicher', luecke.stufe === 'unsicher', luecke)
pruefe('ohne Staffel 0: kein', stufe(durarara, []).stufe === 'kein')
pruefe('ohne japanischen Start: kein Vergleich, kein Treffer', stufe({ namen: ['World at Peace'] }, [folge(2, 'World at Peace', '2011-02-23')]).stufe === 'kein')
pruefe('eine Folge, zwei Titel: beide ausgeschlossen', [...mehrfachBelegt({ 1: { tmdbId: 5, e: 2 }, 2: { tmdbId: 5, e: 2 }, 3: { tmdbId: 5, e: 3 }, 4: { tmdbId: 6, e: 2 } })].join() === '1,2')

console.log('\nTMDB-Staffel 0: Kandidaten')
const reihen = { 7: [{ id: 1, jpStart: '2010-01-01' }, { id: 2, jpStart: '2011-02-23', episodes: 1 }, { id: 3, jpStart: '2012-01-01' }, { id: 4 }] }
const zuordnung = { 1: { tmdbId: 42410, kind: 'tv' } }
const kandidaten = staffel0Kandidaten(
  [{ id: 1, format: 'TV' }, { id: 2, format: 'SPECIAL', titleEn: 'X' }, { id: 3, format: 'TV' }, { id: 4, format: 'OVA' }, { id: 9, format: 'OVA' }],
  reihen,
  zuordnung,
)
pruefe('nur das Special der Reihe mit Serie: TV, eigene Kennung, ohne Start und ohne Reihe fallen heraus', kandidaten.map((k) => k.id).join() === '2' && kandidaten[0]?.serien.join() === '42410', kandidaten)

console.log('\nTMDB-Staffel 0: Frist (Änderung wird spätestens nach 150 Tagen sichtbar)')
const jetzt = new Date('2026-10-14T12:00:00Z')
const vorTagen = (tage: number): string => new Date(jetzt.getTime() - tage * 86_400_000).toISOString().slice(0, 10)
pruefe('ohne Eintrag: fällig', staffel0Faellig(undefined, jetzt))
pruefe('Eintrag von heute: nicht fällig', !staffel0Faellig({ inhaltAm: vorTagen(0) }, jetzt))
pruefe('Eintrag vor 150 Tagen: nicht fällig', !staffel0Faellig({ inhaltAm: vorTagen(150) }, jetzt))
pruefe('Eintrag vor 151 Tagen: fällig (Urteil und Bilder werden neu geholt)', staffel0Faellig({ inhaltAm: vorTagen(151) }, jetzt))
pruefe('Eintrag ohne Datum: fällig', staffel0Faellig({ inhaltAm: '' }, jetzt))

console.log('\nTMDB-Staffel 0: Bilder und Besitz (ein fremdes Bild bleibt, ein eigenes wird erneuert oder gestrichen)')
const bild = (path: string): TmdbBild => ({ file_path: path, width: 2000, height: 3000, iso_639_1: 'ja' })
const leer = (): Bestaende => ({ eintraege: {}, poster: {}, banner: {} })
const eintrag = (extra: Partial<Staffel0Eintrag> = {}): Staffel0Eintrag => ({ tmdbId: 5, e: 1, tage: 0, laenge: 0, name: true, inhaltAm: '2026-10-14', ...extra })
const ohneBesitz = leer()
const neuerEintrag = eintrag()
const gesetzt = setzeBilder('1', neuerEintrag, undefined, { plakat: bild('/p.jpg'), stand: bild('/s.jpg') }, ohneBesitz)
pruefe('Titel ohne TMDB-Bild: Plakat und Hintergrund werden gesetzt und im Eintrag vermerkt', gesetzt && ohneBesitz.poster['1']?.p === '/p.jpg' && ohneBesitz.banner['1']?.p === '/s.jpg' && neuerEintrag.pp === '/p.jpg' && neuerEintrag.sp === '/s.jpg')
const fremd = leer()
fremd.poster['1'] = { p: '/fremd.jpg', w: 800, h: 1200, l: null }
fremd.banner['1'] = { p: '/fremd-b.jpg', w: 1920, h: 1080 }
const fremdEintrag = eintrag()
setzeBilder('1', fremdEintrag, undefined, { plakat: bild('/p.jpg'), stand: bild('/s.jpg') }, fremd)
pruefe('ein Bild aus anderer Quelle bleibt', fremd.poster['1']?.p === '/fremd.jpg' && fremd.banner['1']?.p === '/fremd-b.jpg' && fremdEintrag.pp === undefined && fremdEintrag.sp === undefined)
const eigenes = leer()
eigenes.poster['1'] = { p: '/alt.jpg', w: 800, h: 1200, l: null }
const alterEintrag = eintrag({ pp: '/alt.jpg' })
setzeBilder('1', eintrag(), alterEintrag, { plakat: bild('/neu.jpg') }, eigenes)
pruefe('das eigene Plakat der früheren Prüfung wird erneuert', eigenes.poster['1']?.p === '/neu.jpg')
setzeBilder('1', eintrag(), { ...alterEintrag, pp: '/neu.jpg' }, {}, eigenes)
pruefe('führt TMDB das eigene Plakat nicht mehr, fällt es weg', !('1' in eigenes.poster))
const gestrichen = leer()
gestrichen.eintraege['1'] = eintrag({ pp: '/a.jpg', sp: '/b.jpg' })
gestrichen.poster['1'] = { p: '/a.jpg', w: 800, h: 1200, l: null }
gestrichen.banner['1'] = { p: '/fremd-b.jpg', w: 1920, h: 1080 }
streiche('1', gestrichen)
pruefe('Streichen nimmt Eintrag und eigene Bilder, nicht das fremde Bild', !('1' in gestrichen.eintraege) && !('1' in gestrichen.poster) && gestrichen.banner['1']?.p === '/fremd-b.jpg')
const kand = (id: number): Staffel0Kandidat => ({ id, serien: [5], titel: { start: '2011-02-23', namen: ['World at Peace'], minuten: 24 } })
const urteil = (): Staffel0Urteil => ({ stufe: 'sicher', grund: '', treffer: { serie: 5, e: 2, merkmale: { tage: 0, laenge: 0, name: true } } })
const doppelt = wende([kand(1), kand(2)], { urteile: new Map([[1, urteil()], [2, urteil()]]), ausgefallen: new Set() }, '2026-10-14', leer())
pruefe('zwei Titel, dieselbe Folge: keiner wird zugeordnet', Object.keys(doppelt.neu).length === 0 && doppelt.doppelt.size === 2)
const ausfall = leer()
ausfall.eintraege['1'] = eintrag()
const nichtGeurteilt = wende([kand(1)], { urteile: new Map(), ausgefallen: new Set([1]) }, '2026-10-14', ausfall)
pruefe('Serie nicht erreichbar: der alte Eintrag bleibt', '1' in ausfall.eintraege && Object.keys(nichtGeurteilt.neu).length === 0)
const faellt = leer()
faellt.eintraege['1'] = eintrag()
wende([kand(1)], { urteile: new Map([[1, { stufe: 'unsicher', grund: '' }]]), ausgefallen: new Set() }, '2026-10-14', faellt)
pruefe('Urteil trägt nicht mehr: der Eintrag fällt weg', !('1' in faellt.eintraege))

console.log('\nTMDB-Staffel 0: der Bestand (data/tmdb-staffel0.json)')
const bestand = readJson<Staffel0Bestand>('data/tmdb-staffel0.json', {})
const poster = readJson<Record<string, { p?: string } | null>>('data/tmdb-poster.json', {})
const banner = readJson<Record<string, { p?: string } | null>>('data/tmdb-banner.json', {})
const eigene = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-titles.json', {})
const trageNicht = Object.entries(bestand).filter(([, e]) => !eintragHaelt(e)).map(([id]) => id)
pruefe(`${Object.keys(bestand).length} Einträge, jeder trägt „sicher“ aus seinen Merkmalen`, trageNicht.length === 0, trageNicht)
pruefe('keine Folge gehört zwei Titeln', mehrfachBelegt(bestand).size === 0, [...mehrfachBelegt(bestand)])
const mitKennung = Object.keys(bestand).filter((id) => eigene[id]?.tmdbId)
pruefe('kein Titel mit eigener Serienkennung (tmdb-titles.json) steht zugleich in der Staffel 0', mitKennung.length === 0, mitKennung)
const fremdesPlakat = Object.entries(bestand).filter(([id, e]) => e.pp && poster[id]?.p !== e.pp).map(([id]) => id)
const fremdesBanner = Object.entries(bestand).filter(([id, e]) => e.sp && banner[id]?.p !== e.sp).map(([id]) => id)
pruefe('Plakat und Hintergrund, die ein Eintrag gesetzt hat, stehen in den Beständen', fremdesPlakat.length === 0 && fremdesBanner.length === 0, [fremdesPlakat, fremdesBanner])

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Staffel 0: alle Zusicherungen halten.')
