/**
 * Zusicherung: **Eine Neuverfilmung zählt für sich** (Daniel, 26.10.2026: Yaiba 2025 stand als „Staffel 2" der Reihe, ist aber das Remake von
 * Staffel 1). `FranchiseMember.remakeVon` teilt eine Reihe in Zählgruppen (`zaehlgruppen` in shared/titles.ts); Zählung, Kopf und Reihenliste
 * rechnen je Gruppe. Fälle aus den echten Daten (`public/data/franchises.json`, 26.10.2026): Yaiba, Fruits Basket, Fullmetal Alchemist, Kanon,
 * Spice and Wolf. Der Bestandsteil steht in `check-remake-zaehlung-bestand.ts`. Läuft in `check:logic`.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { hauptstaffeln, staffelBeschriftungen, staffelStaende, zaehlgruppeVon, zaehlgruppen } from '../shared/titles.ts'
import { reihenNameVon } from '../web/src/components/detail/reihen-namen.ts'
import { reihenGruppen } from '../web/src/components/detail/reihen-gruppen.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { ladeRemakeVonHand, markiereRemakes, remakePaareAusKanten, zaehltAlsNeuverfilmung } from './bau/remake-von.ts'
import { doppelteNummern, remakeMitOriginalInGruppe } from './lib/remake-zaehlung-pruefung.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tv = (id: number, name: string, jpStart: string, mehr: Partial<FranchiseMember> = {}): FranchiseMember =>
  ({ id, name, format: 'TV', jpYear: Number(jpStart.slice(0, 4)), jpStart, episodes: 13, ...mehr }) as FranchiseMember
const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const nr = (m: Map<number, { staffel: number; von: number }>, id: number): string => (m.has(id) ? `${m.get(id)!.staffel}/${m.get(id)!.von}` : '-')

/** Die Reihe von Yaiba, wörtlich aus `franchises.json` (Kennung 177476), 26.10.2026. */
const YAIBA = (): FranchiseMember[] => [
  { id: 180000, name: 'Kenyuu Densetsu YAIBA (Mikoukai Pilot)', format: 'OVA', jpYear: 1991, episodes: 1, jpStart: '1991' },
  { id: 2335, name: 'Legendary Brave Swordsman Yaiba', format: 'TV', jpYear: 1993, episodes: 52, jpStart: '1993-04-09' },
  { id: 177476, name: 'Yaiba: Samurai Legend', format: 'TV', jpYear: 2025, episodes: 24, jpStart: '2025-04-05' },
  { id: 199337, name: 'Shin Samurai-den YAIBA 2', format: 'TV', jpYear: 2027, jpStart: '2027-01-09', staffelQuelle: 2 },
]
const YAIBA_MARKIERT = (): FranchiseMember[] => YAIBA().map((m) => (m.id === 177476 ? { ...m, remakeVon: 2335 } : m))

function yaibaZaehlung(): void {
  console.log('\nYaiba (Anlassfall):')
  const alt = YAIBA()
  const neu = YAIBA_MARKIERT()
  const name = 'Legendary Brave Swordsman Yaiba'
  const vorher = staffelStaende(hauptstaffeln(alt), name)
  pruefe('ohne Markierung zählt die Neuverfilmung als Staffel 2 (der alte Fehler)', nr(vorher, 177476) === '2/2' && nr(vorher, 199337) === '2/2', [...vorher])
  pruefe('ohne Markierung: Wächter meldet die doppelte Nummer', doppelteNummern({ 1: alt }).length === 1, doppelteNummern({ 1: alt }))
  const nachher = staffelStaende(hauptstaffeln(neu), name)
  pruefe('Neuverfilmung 2025 ist Staffel 1 von 2', nr(nachher, 177476) === '1/2', [...nachher])
  pruefe('Fortsetzung 2027 ist Staffel 2 von 2', nr(nachher, 199337) === '2/2')
  pruefe('das Original steht allein in seiner Gruppe und bekommt keine Nummer', !nachher.has(2335))
  pruefe('mit Markierung kommt keine Nummer doppelt vor', doppelteNummern({ 1: neu }).length === 0, doppelteNummern({ 1: neu }))
  pruefe('eine Reihe ohne Neuverfilmung gilt nicht als „mit Neuverfilmung"', doppelteNummern({ 1: alt })[0]?.mitRemake === false)
  const zuViel = doppelteNummern({ 1: [...neu, tv(300, 'Yaiba Zusatz', '2028-01-01', { staffelQuelle: 2 })] })
  pruefe('doppelte Nummer in der Gruppe der Neuverfilmung wird als „mit Neuverfilmung" gemeldet', zuViel.length === 1 && zuViel[0]!.mitRemake && zuViel[0]!.nummer === '2/-' && zuViel[0]!.teile.length === 2, zuViel)
  const beschriftung = staffelBeschriftungen(hauptstaffeln(neu), name)
  pruefe('Beschriftung: 2025 „Staffel 1", 2027 „Staffel 2"', beschriftung.get(177476) === 'Staffel 1' && beschriftung.get(199337) === 'Staffel 2', [...beschriftung])
  const reihenfolge = [199337, 2335, 177476].map((id) => neu.find((m) => m.id === id)!)
  pruefe('die Eingabereihenfolge ändert nichts', nr(staffelStaende(reihenfolge, name), 177476) === '1/2' && nr(staffelStaende(reihenfolge, name), 199337) === '2/2')
}

function gruppenZuschnitt(): void {
  console.log('\nZählgruppen:')
  const neu = YAIBA_MARKIERT()
  const ids = (g: FranchiseMember[]) => g.map((m) => m.id)
  pruefe('Original-Linie zuerst, dann die Neuverfilmung samt Fortsetzung', JSON.stringify(zaehlgruppen(neu).map(ids)) === '[[180000,2335],[177476,199337]]', zaehlgruppen(neu).map(ids))
  pruefe('ohne Neuverfilmung bleibt es eine Gruppe in der Eingabereihenfolge', JSON.stringify(zaehlgruppen(YAIBA()).map(ids)) === '[[180000,2335,177476,199337]]')
  pruefe('die Neuverfilmung selbst gehört zu ihrer Gruppe (Start gleich der Markierung)', ids(zaehlgruppeVon(neu, 177476)).includes(177476))
  pruefe('zaehlgruppeVon: Fortsetzung → Gruppe der Neuverfilmung', JSON.stringify(ids(zaehlgruppeVon(neu, 199337))) === '[177476,199337]')
  pruefe('zaehlgruppeVon: Original → Original-Gruppe', JSON.stringify(ids(zaehlgruppeVon(neu, 2335))) === '[180000,2335]')
  pruefe('zaehlgruppeVon: unbekannte Kennung → leer', zaehlgruppeVon(neu, 5).length === 0)
  const gleichTag = [tv(1, 'A', '2000-01-01'), tv(3, 'A neu', '2010-01-01', { remakeVon: 1 }), tv(2, 'A Zwilling', '2010-01-01')]
  pruefe('gleicher Start: die kleinere Kennung vor der Markierung zählt zum Original', JSON.stringify(zaehlgruppen(gleichTag).map(ids)) === '[[1,2],[3]]', zaehlgruppen(gleichTag).map(ids))
  const zwei = [tv(1, 'B', '1990-01-01'), tv(2, 'B neu', '2000-01-01', { remakeVon: 1 }), tv(3, 'B neu 2', '2005-01-01'), tv(4, 'B nochmal', '2010-01-01', { remakeVon: 2 }), tv(5, 'B nochmal 2', '2012-01-01')]
  pruefe('zwei Neuverfilmungen ergeben drei Gruppen nach Start', JSON.stringify(zaehlgruppen(zwei).map(ids)) === '[[1],[2,3],[4,5]]', zaehlgruppen(zwei).map(ids))
  const ohneOriginal = [tv(2, 'C neu', '2000-01-01', { remakeVon: 1 }), tv(3, 'C neu 2', '2005-01-01')]
  pruefe('Neuverfilmung als frühester Teil: keine leere Gruppe davor', JSON.stringify(zaehlgruppen(ohneOriginal).map(ids)) === '[[2,3]]', zaehlgruppen(ohneOriginal).map(ids))
}

/** Der übergebene Reihenname gilt für die Gruppe, die ihn trägt; die anderen heißen nach ihrem ersten Teil. */
function gruppenNamen(): void {
  console.log('\nName je Zählgruppe:')
  const keinTreffer = staffelBeschriftungen([tv(1, 'Alpha', '2000-01-01'), tv(2, 'Alpha Staffel 2', '2002-01-01')], 'Beta')
  pruefe('ohne Neuverfilmung rechnet die Reihe mit dem übergebenen Namen, auch wenn er nicht passt', keinTreffer.size === 0, [...keinTreffer])
  const spice = [tv(1, 'Spice and Wolf', '2008-01-08'), tv(2, 'Spice and Wolf: Merchant Meets the Wise Wolf', '2024-04-02', { remakeVon: 1 }), tv(3, 'Spice and Wolf: Merchant Meets the Wise Wolf - Staffel 2', '2027')]
  const mitName = staffelStaende(spice, 'Spice and Wolf')
  pruefe('die Gruppe, die den Namen trägt, behält ihn: die Neuverfilmung heißt „eigener Name"', mitName.get(2)?.eigenerName === true, [...mitName])
  const fremd = [tv(1, 'Orig', '1990-01-01'), tv(2, 'Foo Bar: Alpha', '2010-01-01', { remakeVon: 1 }), tv(3, 'Foo Bar: Beta', '2012-01-01'), tv(4, 'Foo Bar: Gamma', '2014-01-01')]
  const nachErstem = staffelStaende(fremd, 'Orig')
  pruefe('trägt keine Gruppe den Namen, heißt sie nach dem gemeinsamen Anfang ihrer Teile („Foo Bar")', nachErstem.get(2)?.eigenerName === true && nachErstem.get(3)?.eigenerName === true, [...nachErstem])
}

function gegenproben(): void {
  console.log('\nGegenproben aus dem Bestand (wörtlich, 26.10.2026):')
  const fruits = [
    tv(120, 'Fruits Basket (2001)', '2001-07-05', { episodes: 26 }),
    tv(105334, 'Fruits Basket', '2019-04-06', { episodes: 25, remakeVon: 120 }),
    tv(111762, 'Fruits Basket Staffel 2', '2020-04-07', { episodes: 25, staffelQuelle: 2 }),
    tv(124194, 'Fruits Basket Staffel 3', '2021-04-06', { staffelQuelle: 3 }),
  ]
  const f = staffelStaende(fruits, 'Fruits Basket (2001)')
  pruefe('Fruits Basket 2019 ist Staffel 1 von 3, 2020 Staffel 2, 2021 Staffel 3', nr(f, 105334) === '1/3' && nr(f, 111762) === '2/3' && nr(f, 124194) === '3/3', [...f])
  pruefe('Fruits Basket 2001 steht allein', !f.has(120))
  const fma = [tv(121, 'Fullmetal Alchemist', '2003-10-04', { episodes: 51 }), tv(5114, 'Fullmetal Alchemist: Brotherhood', '2009-04-05', { episodes: 64, remakeVon: 121 })]
  pruefe('Fullmetal Alchemist: Brotherhood ist keine „Staffel 2" mehr', staffelStaende(fma, 'Fullmetal Alchemist').size === 0 && staffelStaende(kopie(fma).map(({ remakeVon: _r, ...m }) => m), 'Fullmetal Alchemist').size === 2)
  const kanon = [tv(144, 'Kanon (2002)', '2002-01-31'), tv(1530, 'Kanon', '2006-10-05', { episodes: 24, remakeVon: 144 })]
  pruefe('Kanon 2006 ist keine „Staffel 2" mehr', staffelStaende(kanon, 'Kanon').size === 0)
  const sw = [
    tv(2966, 'Spice and Wolf', '2008-01-08'),
    tv(5341, 'Spice and Wolf II', '2009-07-09', { episodes: 12 }),
    tv(145728, 'Spice and Wolf: Merchant Meets the Wise Wolf', '2024-04-02', { episodes: 25, remakeVon: 2966 }),
    tv(181951, 'Spice and Wolf: Merchant Meets the Wise Wolf - Season 2', '2027', { episodes: undefined }),
  ]
  const s = staffelStaende(sw, 'Spice and Wolf')
  pruefe('Spice and Wolf: Original 1/2 und 2/2, Neuverfilmung 1/2 und 2/2 — statt 1 bis 4', nr(s, 2966) === '1/2' && nr(s, 5341) === '2/2' && nr(s, 145728) === '1/2' && nr(s, 181951) === '2/2', [...s])
  pruefe('Spice and Wolf: keine doppelte Nummer, weil jede Gruppe für sich zählt', doppelteNummern({ 1: sw }).length === 0, doppelteNummern({ 1: sw }))
  const hxh = [tv(136, 'Hunter x Hunter', '1999-10-16', { episodes: 62 }), tv(11061, 'Hunter × Hunter', '2011-10-02', { episodes: 148 })]
  pruefe('ohne belegte Neuverfilmung (Hunter x Hunter 2011, offen) bleibt die Zählung wie sie war', nr(staffelStaende(hxh, 'Hunter x Hunter'), 11061) === '2/2')
}

function kopfUndGruppen(): void {
  console.log('\nKopf des Panels und Reihenliste:')
  const reihe = YAIBA_MARKIERT()
  const titel = (id: number, en: string, jahr: number) => ({ id, titleEn: en, format: 'TV', jpYear: jahr, franchiseId: 177476 }) as unknown as Title
  const alle = [titel(2335, 'Legendary Brave Swordsman Yaiba', 1993), titel(177476, 'Yaiba: Samurai Legend', 2025), titel(199337, 'Shin Samurai-den YAIBA 2', 2027)]
  const data = { titleById: new Map(alle.map((t) => [t.id, t])) } as unknown as Dataset
  const kopf = (id: number) => reihenNameVon(alle.find((t) => t.id === id), reihe, data)
  pruefe('Kopf der Neuverfilmung nennt die Neuverfilmung, nicht das Original', kopf(177476) === 'Yaiba: Samurai Legend', kopf(177476))
  pruefe('Kopf der Fortsetzung 2027 nennt dieselbe Linie', kopf(199337) === 'Yaiba: Samurai Legend', kopf(199337))
  pruefe('Kopf des Originals nennt das Original', kopf(2335) === 'Legendary Brave Swordsman Yaiba', kopf(2335))
  const ohne = reihenNameVon(alle[1], YAIBA(), data)
  pruefe('ohne Markierung nennt der Kopf der Neuverfilmung das Original (der alte Fehler)', ohne === 'Legendary Brave Swordsman Yaiba', ohne)
  const haupt = (m: FranchiseMember) => m.format === 'TV'
  const gruppen = reihenGruppen(reihe, haupt, (a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0), (k) => k)
  pruefe('Reihenliste: Hauptserie, Neuverfilmung, Specials', gruppen.map((g) => g.titel).join('|') === 'detail.gruppeStaffeln|detail.gruppeNeuverfilmung|detail.gruppeSpecials', gruppen.map((g) => g.titel))
  pruefe('Reihenliste: Neuverfilmung führt 2025 und 2027', gruppen[1]!.teile.map((m) => m.id).join() === '177476,199337')
  const ohneGruppe = reihenGruppen(YAIBA(), haupt, (a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0), (k) => k)
  pruefe('Reihenliste ohne Markierung: keine Neuverfilmungs-Gruppe', !ohneGruppe.some((g) => g.titel === 'detail.gruppeNeuverfilmung'))
  const nachJahr = (a: FranchiseMember, b: FranchiseMember) => (a.jpYear ?? 0) - (b.jpYear ?? 0)
  const zwei = [tv(1, 'O', '1990-01-01'), tv(2, 'O 2', '1995-01-01'), tv(3, 'N', '2010-01-01', { remakeVon: 1 }), tv(4, 'N 2', '2012-01-01')]
  const sortiert = reihenGruppen(zwei.slice().reverse(), haupt, nachJahr, (k) => k).map((g) => g.teile.map((m) => m.id).join())
  pruefe('Reihenliste sortiert jede Gruppe selbst', sortiert.join('|') === '1,2|3,4', sortiert)
  kopfSonderfaelle(data, titel)
}

/** Kopf in den Randfällen: Gruppe mit einem Teil, Titel außerhalb der Reihe, Gruppe mit eigenem Namensanfang. */
function kopfSonderfaelle(data: Dataset, titel: (id: number, en: string, jahr: number) => Title): void {
  const einzeln = [tv(1, 'Orig', '1990-01-01'), tv(2, 'Neu', '2010-01-01', { remakeVon: 1 }), tv(0, 'Vorläufer', '1980-01-01')]
  const deutsch = { ...titel(2, 'Neu', 2010), titleDe: 'Neu Deutsch' } as Title
  const einzelnKopf = reihenNameVon(deutsch, einzeln, data)
  pruefe('Gruppe mit einem Teil: der Kopf ist der Name des Titels', einzelnKopf === 'Neu Deutsch', einzelnKopf)
  const fremdKopf = reihenNameVon(titel(5, 'Fremd', 2000), YAIBA_MARKIERT(), data)
  pruefe('Titel, der nicht in der Reihe steht: der Kopf nennt die ganze Reihe', fremdKopf === 'Legendary Brave Swordsman Yaiba', fremdKopf)
  const viele = [tv(1, 'Orig', '1990-01-01'), tv(2, 'Orig Zwei', '1991-01-01'), tv(3, 'Orig Drei', '1992-01-01'), tv(4, 'Foo Bar: Alpha', '2010-01-01', { remakeVon: 1 }), tv(5, 'Foo Bar: Beta', '2011-01-01')]
  const anfang = reihenNameVon(titel(4, 'Foo Bar: Alpha', 2010), viele, data)
  pruefe('der Kopf kürzt auf den gemeinsamen Anfang der Gruppe, nicht der ganzen Reihe', anfang === 'Foo Bar', anfang)
}

function bauSeite(): void {
  console.log('\nRemake-Paare aus aniSearch und Handliste:')
  const titel = [
    { id: 10, jpYear: 2002, anisearchId: 100 },
    { id: 11, jpYear: 2006, anisearchId: 101 },
    { id: 12, jpYear: 2006, anisearchId: 102 },
    { id: 13, jpYear: 2007, anisearchId: 103 },
  ]
  const kante = (a: number, b: number, art = 'Remake') => ({ a, b, art })
  const p = remakePaareAusKanten([kante(100, 101), kante(101, 100)], titel)
  pruefe('beidseitig eingetragene Kante: die spätere Serie ist die Neuverfilmung', p.size === 1 && p.get(11) === 10, [...p])
  pruefe('andere Art („Alternative Version") ergibt kein Paar', remakePaareAusKanten([kante(100, 101, 'Alternative Version')], titel).size === 0)
  pruefe('gleiches Jahr ergibt kein Paar', remakePaareAusKanten([kante(101, 102)], titel).size === 0)
  pruefe('genau ein Jahr Abstand genügt', remakePaareAusKanten([kante(102, 103)], titel).get(13) === 12)
  pruefe('unbekannte aniSearch-Kennung ergibt kein Paar', remakePaareAusKanten([kante(100, 999)], titel).size === 0)
  const ohneJahr = [{ id: 20, jpYear: undefined, anisearchId: 200 }, { id: 21, jpYear: 2006, anisearchId: 201 }]
  pruefe('ohne Jahr ergibt kein Paar, in beiden Richtungen der Kante', remakePaareAusKanten([kante(200, 201)], ohneJahr).size === 0 && remakePaareAusKanten([kante(201, 200)], ohneJahr).size === 0)
  const zweiOriginale = [...titel, { id: 15, jpYear: 1990, anisearchId: 105 }]
  pruefe('mehrere Originale: das erste gefundene gilt', remakePaareAusKanten([kante(101, 100), kante(101, 105)], zweiOriginale).get(11) === 10)

  const reihen = (): Record<number, FranchiseMember[]> => ({ 1: [tv(10, 'A', '2002-01-01'), tv(11, 'A neu', '2006-01-01'), { ...tv(14, 'A Film', '2008-01-01'), format: 'MOVIE' }], 2: [tv(12, 'C', '2006-01-01')] })
  const m = markiereRemakes(reihen(), titel, { kanten: [kante(100, 101)], hand: [] })
  pruefe('markiereRemakes setzt remakeVon an der Neuverfilmung', m[1]![1]!.remakeVon === 10 && m[1]![0]!.remakeVon === undefined)
  const zwei = markiereRemakes(kopie(m), titel, { kanten: [kante(100, 101)], hand: [] })
  pruefe('ein zweiter Lauf ändert nichts', JSON.stringify(zwei) === JSON.stringify(m))
  const fremd = markiereRemakes(reihen(), titel, { kanten: [kante(100, 102)], hand: [] })
  pruefe('Original in anderer Reihe: keine Markierung', Object.values(fremd).flat().every((x) => x.remakeVon === undefined))
  const film = markiereRemakes({ 1: [{ ...tv(10, 'F', '2002-01-01'), format: 'MOVIE' }, { ...tv(11, 'F neu', '2006-01-01'), format: 'MOVIE' }] }, titel, { kanten: [kante(100, 101)], hand: [] })
  pruefe('Filme werden nicht als Linie gezählt', film[1]!.every((x) => x.remakeVon === undefined))
  const kino = (m: FranchiseMember): FranchiseMember => ({ ...m, format: 'MOVIE' })
  const serieGegenFilm = markiereRemakes({ 1: [tv(10, 'S', '2002-01-01'), kino(tv(11, 'S neu', '2006-01-01'))] }, titel, { kanten: [kante(100, 101)], hand: [] })
  const filmGegenSerie = markiereRemakes({ 1: [kino(tv(10, 'S', '2002-01-01')), tv(11, 'S neu', '2006-01-01')] }, titel, { kanten: [kante(100, 101)], hand: [] })
  pruefe('Serie gegen Film zählt nicht, in beiden Richtungen', [...serieGegenFilm[1]!, ...filmGegenSerie[1]!].every((x) => x.remakeVon === undefined))
  const warnungen: string[] = []
  const warnAlt = console.warn
  console.warn = (...a: unknown[]) => void warnungen.push(a.join(' '))
  const handEintrag = { remake: 11, original: 10, grund: 'g', quelle: 'https://beispiel.invalid/x' }
  markiereRemakes(reihen(), titel, { kanten: [], hand: [handEintrag] })
  const ohneWarnung = warnungen.length
  markiereRemakes(reihen(), titel, { kanten: [], hand: [{ ...handEintrag, original: 99 }] })
  console.warn = warnAlt
  pruefe('ein Handeintrag, der nichts markiert, warnt — ein wirksamer nicht', ohneWarnung === 0 && warnungen.length === 1, warnungen)
  const hand = markiereRemakes(reihen(), titel, { kanten: [], hand: [{ remake: 11, original: 10, grund: 'g', quelle: 'https://beispiel.invalid/x' }] })
  pruefe('Handeintrag ohne aniSearch-Kante markiert', hand[1]![1]!.remakeVon === 10)
  const umgekehrt = markiereRemakes(reihen(), titel, { kanten: [], hand: [{ remake: 10, original: 11, grund: 'g', quelle: 'https://beispiel.invalid/x' }] })
  pruefe('Handeintrag mit dem späteren Original markiert nicht', Object.values(umgekehrt).flat().every((x) => x.remakeVon === undefined))
  pruefe('zaehltAlsNeuverfilmung: gleicher Start nicht', !zaehltAlsNeuverfilmung(tv(2, 'x', '2000-01-01'), tv(1, 'x', '2000-01-01')))
  pruefe('Prüfer: Neuverfilmung mit Original in einer Gruppe wird gemeldet', remakeMitOriginalInGruppe(reihen(), new Map([[11, 10]])).length === 1)
  pruefe('Prüfer: getrennte Gruppen sind ohne Befund', remakeMitOriginalInGruppe(m, new Map([[11, 10]])).length === 0)
  const filme = { 1: [kino(tv(10, 'F', '2002-01-01')), kino(tv(11, 'F neu', '2006-01-01'))] }
  pruefe('Prüfer: ein Film-Paar zählt nicht als Befund', remakeMitOriginalInGruppe(filme, new Map([[11, 10]])).length === 0)
}

function handDatei(): void {
  console.log('\nHandliste data/remake-von-hand.yaml:')
  const dir = mkdtempSync(join(tmpdir(), 'remake-hand-'))
  const schreibe = (inhalt: string) => {
    const datei = join(dir, 'h.yaml')
    writeFileSync(datei, inhalt)
    return datei
  }
  const wirft = (inhalt: string) => {
    try {
      ladeRemakeVonHand(schreibe(inhalt))
      return false
    } catch {
      return true
    }
  }
  try {
    pruefe('fehlende Datei: keine Einträge', ladeRemakeVonHand(join(dir, 'gibt-es-nicht.yaml')).length === 0)
    pruefe('leere Datei: keine Einträge', ladeRemakeVonHand(schreibe('')).length === 0)
    pruefe('vollständiger Eintrag wird gelesen', ladeRemakeVonHand(schreibe('- remake: 2\n  original: 1\n  grund: g\n  quelle: https://a.invalid/x\n'))[0]?.original === 1)
    pruefe('ohne Quelle bricht der Bau ab', wirft('- remake: 2\n  original: 1\n  grund: g\n'))
    pruefe('Quelle ohne https bricht ab', wirft('- remake: 2\n  original: 1\n  grund: g\n  quelle: http://a.invalid\n'))
    pruefe('ohne Grund bricht ab', wirft('- remake: 2\n  original: 1\n  quelle: https://a.invalid\n'))
    pruefe('Kennung keine Zahl bricht ab', wirft('- remake: x\n  original: 1\n  grund: g\n  quelle: https://a.invalid\n'))
    pruefe('Kennung des Originals keine Zahl bricht ab', wirft('- remake: 2\n  original: x\n  grund: g\n  quelle: https://a.invalid\n'))
    pruefe('ein einziger kaputter Eintrag unter guten bricht ab', wirft('- remake: 2\n  original: 1\n  grund: g\n  quelle: https://a.invalid\n- remake: 4\n  original: 3\n  grund: g\n  quelle: nicht-https\n'))
    const echt = ladeRemakeVonHand()
    pruefe('echte Handliste: Yaiba mit Quelle', echt.some((e) => e.remake === 177476 && e.original === 2335 && e.quelle.startsWith('https://')), echt)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

yaibaZaehlung()
gruppenZuschnitt()
gruppenNamen()
gegenproben()
kopfUndGruppen()
bauSeite()
handDatei()

console.log(`\ncheck-remake-zaehlung: ${faelle} Zusicherungen, ${verletzt} verletzt`)
if (verletzt) process.exit(1)
