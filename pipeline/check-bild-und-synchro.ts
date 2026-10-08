/**
 * Zusicherungen für die Arbeit vom 07.10.2026: Plakat-Auswahl, „keine Synchro laut aniSearch", Teile ohne belegte Synchro,
 * Zugang über den Dub-Endpunkt und die Suche in Schritten. Läuft hinter `check:logic` (ein eigenes Skript hält dessen Datei unter der Grenze).
 */
import { readFileSync } from 'node:fs'
import { keineSynchroLautAnisearch } from './bau/ohne-beleg.ts'
import { entferneFremdeNachStaffeln } from './bau/cr-serie-geteilt.ts'
import { mitKitsuTiteln } from './bau/folgentitel-kitsu.ts'
import { ANISEARCH_ID_BASIS, FORMAT, anisearchNurKatalog } from './bau/anisearch-titel.ts'
import { ohneBelegteSynchro } from './bau/synchro-belegt.ts'
import { ausAnisearchDubs } from './lib/anisearch-synchro-ids.ts'
import { malOhneAnilistTitel } from './lib/anisearch-cover.ts'
import { waehlePlakat } from './lib/tmdb-plakat.ts'
import { waehleStaffel } from './lib/tmdb-staffel.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { mitDubKennzeichen } from './lib/anisearch-termine.ts'
import { erstausgabeAlsNeuigkeit } from '../web/src/components/detail/antwort-regeln.ts'
import { stufeVon } from '../web/src/lib/saison.ts'
import { entferneGesperrte, mitSperre } from './bau/sperre.ts'
import { sucheGen, sucheMitFundstellen, treibe } from '../web/src/lib/search.ts'
import { istOhneBelegteSynchro, sortiereNachTitel } from '../web/src/lib/titel-sortierung.ts'
import { anzeigeName } from '../shared/titles.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Plakat-Auswahl')
const bild = (iso: string | null, width: number, height: number) => ({ file_path: `/${iso}${width}.jpg`, width, height, iso_639_1: iso })
pruefe('das japanische Plakat geht vor dem größeren englischen', waehlePlakat([bild('en', 2000, 3000), bild('ja', 1000, 1500)])?.iso_639_1 === 'ja')
pruefe('innerhalb einer Sprache gewinnt das breiteste', waehlePlakat([bild('ja', 1000, 1500), bild('ja', 2000, 3000)])?.width === 2000)
pruefe('Querformate zählen nicht', waehlePlakat([bild('ja', 3000, 1500)]) === undefined)
pruefe('ohne Bilder kein Plakat', waehlePlakat([]) === undefined)
const staffeln = [{ season_number: 0, air_date: '2005-10-01', episode_count: 3 }, { season_number: 1, air_date: '2005-04-07', episode_count: 12 }, { season_number: 2, air_date: '2005-10-20', episode_count: 12 }]
pruefe('Staffel: Beginn und Folgenzahl treffen die zweite', waehleStaffel(staffeln, '2005-10-20', 12) === 2)
pruefe('Staffel: ein Special (Staffel 0) zählt nie', waehleStaffel(staffeln, '2005-10-01', 3) === undefined)
pruefe('Staffel: gleiches Datum, aber andere Folgenzahl ist keine Staffel', waehleStaffel(staffeln, '2005-10-20', 49) === undefined)
const alt = { id: 1, slug: 'x', titleRomaji: 'X', format: 'TV', episodes: 143, jpYear: 1989, jpStatus: 'FINISHED', streams: [], genres: [], keywords: [], studios: [], dubConfidence: 'low' } as unknown as Title
const kopf = (erst: Title['deErstausgabe']) => berechneAntwort({ title: { ...alt, deErstausgabe: erst }, releases: [], today: '2026-10-07' })
const teil = kopf({ synchro: true, teil: true })
console.log('Saison-Stufen')
const T0 = '2026-10-07'
pruefe('Termin im Kalender, erschienen, ohne Tonspur-Beleg: auf Deutsch (Tank Chair)', stufeVon(alt, { datum: '2026-10-04', geschaetzt: false }, T0) === 'auf-deutsch')
pruefe('Termin in der Zukunft ohne Beleg: angekündigt', stufeVon(alt, { datum: '2026-10-20', geschaetzt: false }, T0) === 'angekuendigt')
pruefe('abgeleiteter Termin, verstrichen: Sprache ungeklärt', stufeVon(alt, { datum: '2026-10-03', geschaetzt: true }, T0) === 'ungeklaert')
pruefe('abgeleiteter Termin, in der Zukunft: nur Termin', stufeVon(alt, { datum: '2026-10-20', geschaetzt: true }, T0) === 'termin')
pruefe('belegte Tonspur, noch nicht erschienen: bestätigt', stufeVon({ ...alt, hasVoices: true }, { datum: '2026-10-20', geschaetzt: false }, T0) === 'bestaetigt')
pruefe('kein Termin und kein Beleg: offen', stufeVon(alt, undefined, T0) === 'offen')
const mitAnk = { ...alt, ankuendigung: { platform: 'crunchyroll', omuAb: '2026-10-03', synchro: 'angekuendigt' } } as typeof alt
pruefe('Synchro vom Anbieter angekündigt, abgeleiteter Termin verstrichen: angekündigt (Black Clover, Apothekerin)', stufeVon(mitAnk, { datum: '2026-10-03', geschaetzt: true }, T0) === 'angekuendigt')
pruefe('Synchro vom Anbieter angekündigt, kein Termin: angekündigt', stufeVon(mitAnk, undefined, T0) === 'angekuendigt')
pruefe('abgebrochener Dub ohne Zahl: „teilweise“, nicht „alle 143 Folgen“', teil?.art === 'teilweise' && teil.raus === undefined, teil)
pruefe('Erstausgabe wandert in die Neuigkeiten: Tagesdatum und Synchro', erstausgabeAlsNeuigkeit({ deErstausgabe: { von: '2016-11-10', synchro: true } }))
pruefe('Erstausgabe bleibt im Kasten: ein Datum in der Zukunft', !erstausgabeAlsNeuigkeit({ deErstausgabe: { von: '2999-01-01', synchro: true } }))
pruefe('Erstausgabe bleibt im Kasten: ein deutscher Stream war früher da', !erstausgabeAlsNeuigkeit({ deErstausgabe: { von: '2016-11-10', synchro: true }, angebotSeit: { date: '2015-01-01', platform: 'netflix' } as never, streams: [{ platform: 'netflix', dub: true } as never] }))
pruefe('Erstausgabe bleibt im Kasten: ohne Synchro-Marke', !erstausgabeAlsNeuigkeit({ deErstausgabe: { von: '2016-11-10' } }))
pruefe('Erstausgabe bleibt im Kasten: Datum nur auf das Jahr genau', !erstausgabeAlsNeuigkeit({ deErstausgabe: { von: '1984-00-00', synchro: true } }))
pruefe('vertonte Ausgabe ohne Teilmarke bleibt „fertig“', kopf({ synchro: true })?.art === 'fertig')
pruefe('Staffel: ohne Startdatum keine Zuordnung', waehleStaffel(staffeln, undefined, 12) === undefined)
pruefe('Staffel: zwei mögliche Staffeln sind keine Auskunft', waehleStaffel([...staffeln, { season_number: 3, air_date: '2005-11-10', episode_count: 12 }], '2005-10-25', 12) === undefined)

console.log('Teile ohne belegte Synchro')
const titel = (t: Partial<Title>): Title => ({ id: 900001, jpYear: 2026, dubConfidence: 'low', streams: [], ...t }) as Title
const nichts: Release[] = []
pruefe('ein Titel von 2026 ohne jeden Beleg gilt als unbelegt', ohneBelegteSynchro(titel({}), nichts))
pruefe('ein Stream mit belegter Synchro hebt das auf', !ohneBelegteSynchro(titel({ streams: [{ platform: 'netflix', dub: true } as never] }), nichts))
pruefe('ein sicherer Termin hebt es auf', !ohneBelegteSynchro(titel({}), [{ titleId: 900001, schedule: { estimated: false } } as Release]))
pruefe('ein geschätzter Termin (Start mit Untertiteln) hebt es nicht auf', ohneBelegteSynchro(titel({}), [{ titleId: 900001, schedule: { estimated: true } } as Release]))
pruefe('ein älterer Titel bleibt unberührt', !ohneBelegteSynchro(titel({ jpYear: 2005 }), nichts))
pruefe('hohe Sicherheit bleibt unberührt', !ohneBelegteSynchro(titel({ dubConfidence: 'high' }), nichts))

console.log('aniSearch-Typnamen')
const typen = new Set(Object.values(JSON.parse(readFileSync('data/anisearch-eintraege.json', 'utf8')) as Record<string, { ty: string }>).map((e) => e.ty))
const unbekannt = [...typen].filter((ty) => !(ty in FORMAT))
pruefe('jeder Typname der Eintragsdatei steht in der Formattabelle (deutsch und englisch)', unbekannt.length === 0, unbekannt)
pruefe('„TV-Serie“ ist eine Serie, „Film“ ein Film', FORMAT['TV-Serie'] === 'TV' && FORMAT['Film'] === 'MOVIE')
console.log('Keine Synchro laut aniSearch')
const dubs = JSON.parse(readFileSync('data/anisearch-dubs.json', 'utf8')) as Record<string, string>
const idMit = (kz: string) => Number(Object.keys(dubs).find((k) => dubs[k] === kz))
pruefe('Dub-Liste d: ohne Sprachblock entsteht trotzdem eine Synchro-Marke', mitDubKennzeichen(idMit('d'), undefined)?.synchro === true)
pruefe('Dub-Liste c: Synchro und Teilmarke', mitDubKennzeichen(idMit('c'), undefined)?.teil === true)
pruefe('Dub-Liste -: der Termin bleibt, wie er ist', mitDubKennzeichen(idMit('-'), undefined) === undefined)
const mitErst = (id: number, extra: Partial<Title> = {}) => titel({ id, deErstausgabe: { von: '2024-10-21', publisher: 'Crunchyroll' } as never, ...extra })
pruefe('deutsche Ausgabe, aniSearch nennt kein Deutsch: keine Synchro', keineSynchroLautAnisearch(mitErst(idMit('-'))))
pruefe('ein Stream mit belegter Synchro schlägt das', !keineSynchroLautAnisearch(mitErst(idMit('-'), { streams: [{ platform: 'netflix', dub: true } as never] })))
pruefe('auch ohne deutsche Ausgabe: aniSearch nennt kein Deutsch, kein Beleg', keineSynchroLautAnisearch(titel({ id: idMit('-') })))
pruefe('Deutsch vertont: bleibt', !keineSynchroLautAnisearch(mitErst(idMit('d'))))
pruefe('Deutsch abgebrochen (Teilsynchro): bleibt', !keineSynchroLautAnisearch(mitErst(idMit('c'))))
pruefe('Deutsch geplant: bleibt', !keineSynchroLautAnisearch(mitErst(idMit('p'))))
const neu = ausAnisearchDubs([])
pruefe('Titel mit vertontem, geplantem oder abgebrochenem Deutsch kommen in den Bestand', neu.length > 0 && neu.every((id) => 'dpc'.includes(dubs[String(id)] ?? '-')))
pruefe('was schon im Bestand steht, wird nicht noch einmal geholt', !ausAnisearchDubs(neu.map((id) => ({ id }))).length)

console.log('Suche in Schritten')
const viele = Array.from({ length: 1000 }, (_, i) => `Titel ${i} Naruto`)
/* Jeder Eintrag kostet hier absichtlich Zeit: Die Suche gibt nach Zeit ab, nicht nach Anzahl. */
const langsam = (t: string): string[] => {
  const bis = performance.now() + 0.05
  while (performance.now() < bis);
  return [t]
}
const gen = sucheGen(viele, 'naruto', (t) => [{ art: 'titel', text: t }], langsam)
let abgaben = 0
let r = gen.next()
while (!r.done) { abgaben++; r = gen.next() }
pruefe('ein langsamer Suchlauf gibt mehrfach ab (mindestens alle 6 ms)', abgaben >= 5, abgaben)
const sync = sucheMitFundstellen(viele, 'naruto', (t) => [{ art: 'titel', text: t }], (t) => [t])
pruefe('synchron und in Schritten liefern dasselbe', JSON.stringify(sync) === JSON.stringify(treibe(sucheGen(viele, 'naruto', (t) => [{ art: 'titel', text: t }], (t) => [t]))))
pruefe('ohne Suchbegriff bleibt alles drin', sucheMitFundstellen(viele, '', (t) => [{ art: 'titel', text: t }], (t) => [t]).length === viele.length)

console.log('Sortierung nach Titel')
const echte = (JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[]).slice(0, 400)
const kollator = new Intl.Collator('de')
const rangfolge = echte.slice().sort((x, y) => kollator.compare(anzeigeName(x), anzeigeName(y)) || x.id - y.id)
const mitRang = echte.map((t) => ({ ...t, tr: rangfolge.findIndex((r) => r.id === t.id) }))
const ohneRang = echte.map((t) => ({ ...t }))
const gruppeMit = mitRang.map((main) => ({ main }))
const gruppeOhne = ohneRang.map((main) => ({ main }))
sortiereNachTitel(gruppeMit)
sortiereNachTitel(gruppeOhne)
pruefe('mit Rang und ohne Rang ergibt dieselbe Reihenfolge', gruppeMit.every((g, i) => g.main.id === gruppeOhne[i]!.main.id))
pruefe('die Reihenfolge ist die der deutschen Sortierung', gruppeOhne.every((g, i) => i === 0 || kollator.compare(anzeigeName(gruppeOhne[i - 1]!.main), anzeigeName(g.main)) <= 0))

console.log('Datenbank blendet angekündigte Titel ohne belegte Synchro aus')
pruefe('ein Titel mit dem Merkmal os gilt als ohne belegte Synchro', istOhneBelegteSynchro({ id: 1, os: true } as unknown as Title))
pruefe('ein gewöhnlicher Titel nicht', !istOhneBelegteSynchro({ id: 2 } as unknown as Title))

console.log('Crunchyroll-Serie: jede Staffel hat genau einen Titel mit Folgenzahl UND Namen')
const crTitel = (id: number, episodes: number, name: string): Title => ({ id, episodes, titleEn: name, streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/SERIE1/x', dub: true }] }) as unknown as Title
const kv = () => 'SERIE1'
const bb = new Map([[1, crTitel(1, 24, 'Black Butler')], [2, crTitel(2, 11, 'Black Butler: Public School Arc')], [3, crTitel(3, 13, 'Black Butler: Emerald Witch Arc')], [4, crTitel(4, 12, 'Black Butler II')]])
const arcs = new Map([['SERIE1', [{ name: 'Black Butler -Public School Arc-', folgen: 11 }, { name: 'Black Butler -Emerald Witch Arc-', folgen: 13 }]]])
const weg = entferneFremdeNachStaffeln(bb, kv, arcs)
pruefe('Black Butler: Staffel 1 (24) und II (12) verlieren den Weg, die beiden Arcs behalten ihn', weg === 2 && bb.get(1)!.streams.length === 0 && bb.get(4)!.streams.length === 0 && bb.get(2)!.streams.length === 1 && bb.get(3)!.streams.length === 1)
const gleicheZahl = new Map([[1, crTitel(1, 11, 'Ganz anderer Titel')], [2, crTitel(2, 13, 'Black Butler: Emerald Witch Arc')], [3, crTitel(3, 24, 'Black Butler')]])
pruefe('dieselbe Folgenzahl ohne passenden Namen bestätigt nichts', entferneFremdeNachStaffeln(gleicheZahl, kv, arcs) === 0 && gleicheZahl.get(3)!.streams.length === 1)
const zusammen = new Map([[1, crTitel(1, 13, 'Haikyu')], [2, crTitel(2, 2, 'Haikyu Land vs Air')], [3, crTitel(3, 12, 'Haikyu Part 2')]])
pruefe('fasst die Serie zusammen, was wir trennen (13 + 2 + 12 = 27), bleibt alles', entferneFremdeNachStaffeln(zusammen, kv, new Map([['SERIE1', [{ name: 'Haikyu 4th Season', folgen: 27 }]]])) === 0)
const einzeln = new Map([[1, crTitel(1, 12, 'Black Butler II')]])
pruefe('ein einzelner Titel an der Serie wird nie entfernt', entferneFremdeNachStaffeln(einzeln, kv, arcs) === 0)
const doppelt = new Map([[1, crTitel(1, 12, 'Serie X')], [2, crTitel(2, 12, 'Serie X')], [3, crTitel(3, 5, 'Serie X Special')]])
pruefe('zwei Titel mit gleicher Zahl und gleichem Namen: keine Entscheidung', entferneFremdeNachStaffeln(doppelt, kv, new Map([['SERIE1', [{ name: 'Serie X', folgen: 12 }]]])) === 0)

console.log('Folgentitel und Laufzeit aus Kitsu')
const ova = { id: 7, episodes: 2 } as unknown as Title
const kitsu = { k: 8338, f: [[1, 'Book of Murder Part 1', 58], [2, 'Book of Murder Part 2', 58]] as [number, string, number][] }
const gefuellt = mitKitsuTiteln(ova, [{ nr: 1 }, { nr: 2 }], kitsu)
pruefe('Kitsu füllt fehlende Titel und Minuten', gefuellt?.[0]?.en === 'Book of Murder Part 1' && gefuellt?.[1]?.minuten === 58, gefuellt)
const vorhanden = mitKitsuTiteln(ova, [{ nr: 1, de: 'Eigener Titel', minuten: 30 }, { nr: 2 }], kitsu)
pruefe('ein vorhandener Titel und eine vorhandene Minutenzahl bleiben', vorhanden?.[0]?.de === 'Eigener Titel' && vorhanden?.[0]?.en === undefined && vorhanden?.[0]?.minuten === 30)
pruefe('andere Folgenzahl: nichts wird übernommen', mitKitsuTiteln({ id: 8, episodes: 3 } as unknown as Title, [{ nr: 1 }, { nr: 2 }, { nr: 3 }], kitsu)?.every((x) => !x.en) === true)
pruefe('Platzhalter wie „Episode 3" sind kein Titel', mitKitsuTiteln(ova, [{ nr: 1 }, { nr: 2 }], { k: 1, f: [[1, 'Episode 1', 24], [2, 'Episode 2', 24]] })?.every((x) => !x.en) === true)
pruefe('Nummern mit Lücke (1, 3): nichts', mitKitsuTiteln(ova, [{ nr: 1 }, { nr: 2 }], { k: 1, f: [[1, 'A', 24], [3, 'B', 24]] })?.every((x) => !x.en) === true)

console.log('Titel nur bei aniSearch')
const eintraege = JSON.parse(readFileSync('data/anisearch-eintraege.json', 'utf8')) as Record<string, { dub: string; ty: string }>
const ids = Object.keys(eintraege).map(Number)
pruefe('es gibt Einträge', ids.length > 100, ids.length)
pruefe('jede Kennung ist positiv und die Titelkennung liegt über allen AniList-Kennungen', ids.every((i) => i > 0 && ANISEARCH_ID_BASIS + i > 1_000_000))
pruefe('jeder Eintrag trägt ein bekanntes Deutsch-Kennzeichen', Object.values(eintraege).every((e) => 'dpc-'.includes(e.dub) && e.dub.length === 1))
pruefe('nur Einträge ohne Deutsch bleiben im Katalog', [...anisearchNurKatalog()].every((id) => eintraege[String(id - ANISEARCH_ID_BASIS)]?.dub === '-') && anisearchNurKatalog().size === Object.values(eintraege).filter((e) => e.dub === '-').length)

console.log('Cover für aniSearch-Titel (AniList über die MAL-Kennung)')
const probeEintraege = { 1: { y: 2026, mal: 10, dub: '-' }, 2: { y: 2026, mal: 11, dub: '-' }, 3: { y: 2020, mal: 12, dub: '-' }, 4: { y: 2026, dub: '-' }, 5: { y: 2026, mal: 14, dub: '-' }, 6: { y: 2026, mal: 10, dub: '-' }, 7: { y: 1998, mal: 15, dub: 'd' } }
const offeneMal = malOhneAnilistTitel(probeEintraege, new Set([11]), { 14: { id: 1, cover: 'x' } }, 2025)
pruefe('abgefragt wird: Eintrag mit MAL-Kennung, ohne AniList-Titel, ohne Cover im Cache, jede Kennung einmal; ohne Deutsch nur jung, mit Deutsch jedes Alter', JSON.stringify(offeneMal) === '[10,15]', offeneMal)
/* Ausnahme mit Ablauf: Beide Titel hatten am 08.10.2026 kein Cover, bis der Abruf es holt; danach gilt die Regel ohne Ausnahme. */
const koernOhneCover = new Map([[10021566, 'Dragon Ball Super: Beerus'], [10021751, 'Fool Night'], [10021575, 'Cover erst nach dem nächsten Bau']])
const ausnahmeGilt = new Date().toISOString().slice(0, 10) <= '2026-10-15'
const kern = JSON.parse(readFileSync('public/data/titles-core.json', 'utf8')) as { id: number; coverImage?: string }[]
const ohneCover = kern.filter((t) => !t.coverImage && !(ausnahmeGilt && koernOhneCover.has(t.id))).map((t) => t.id)
pruefe('jeder Kern-Titel trägt ein Cover', ohneCover.length === 0, ohneCover)
/* Alle ausgelieferten aniSearch-Titel: Steht die MAL-Kennung im Cover-Bestand, muss der Titel das Cover tragen (08.10.2026: der Bestand lag im Actions-Cache, der Bau sah ihn nicht). */
const coverBestand = JSON.parse(readFileSync('data/anisearch-cover.json', 'utf8')) as Record<string, unknown>
const alleTitel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { anisearchId?: number; coverImage?: string; titleRomaji: string }[]
const mitQuelleOhneCover = alleTitel
  .filter((t) => t.anisearchId && !t.coverImage && coverBestand[String((eintraege as Record<string, { mal?: number }>)[String(t.anisearchId)]?.mal)])
  .filter((t) => !(ausnahmeGilt && koernOhneCover.has(ANISEARCH_ID_BASIS + t.anisearchId!)))
  .map((t) => t.titleRomaji)
pruefe('kein ausgelieferter Titel mit Cover-Quelle (MAL-Kennung im Cover-Bestand) ohne Cover', mitQuelleOhneCover.length === 0, mitQuelleOhneCover)

console.log('F-Sperre (Fanservice-Urteil von Hand, data/fanservice-urteil.yaml)')
const gesperrt = new Set([...readFileSync('data/fanservice-urteil.yaml', 'utf8').matchAll(/^\s*-\s*id:\s*(\d+)/gm)].map((m) => Number(m[1])))
pruefe('die Sperrliste ist nicht leer und trägt gültige Kennungen', gesperrt.size > 0 && [...gesperrt].every((i) => i > 0))
const probe = [{ titleId: 10013220 }, { titleId: 1 }]
entferneGesperrte(probe)
pruefe('die F-Sperre nimmt Termine und Meldungen eines gesperrten Titels aus den Listen, andere bleiben', probe.length === 1 && probe[0]!.titleId === 1, probe)
pruefe('der gesperrte Titel trägt die Marke, andere nicht', mitSperre<Title>({ id: 10013220 } as Title, gesperrt).sperre === 'fanservice' && !('sperre' in mitSperre({ id: 1 }, gesperrt)))
const jsonDatei = <T>(name: string): T => JSON.parse(readFileSync(`public/data/${name}`, 'utf8')) as T
const prominent: [string, number[]][] = [
  ['releases.json', jsonDatei<{ titleId: number }[]>('releases.json').map((r) => r.titleId)],
  ['events.json', jsonDatei<{ titleId: number }[]>('events.json').map((r) => r.titleId)],
  ['news.json', jsonDatei<{ titelId: number }[]>('news.json').map((r) => r.titelId)],
  ['neu-mit-synchro.json', jsonDatei<{ id: number }[]>('neu-mit-synchro.json').map((r) => r.id)],
  ['titles-core.json', jsonDatei<{ id: number }[]>('titles-core.json').map((r) => r.id)],
]
for (const [datei, kennungen] of prominent) pruefe(`kein gesperrter Titel in ${datei} (die F-Sperre greift im Bau nicht, wenn einer auftaucht)`, !kennungen.some((i) => gesperrt.has(i)), kennungen.filter((i) => gesperrt.has(i)))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
