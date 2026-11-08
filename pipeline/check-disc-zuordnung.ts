/**
 * Disc-Ausgaben je Titel (`lib/disc-zuordnung.ts`, `extract-disc-ausgaben.ts`): eine aniSearch-Kennung kann mehrere Titel tragen,
 * und Titel ohne Eintrag in `anisearch.json` verloren bisher ihre Disc. Namen und Ausgaben stehen wörtlich so im Bestand
 * (titles.json und aniSearch-Archiv vom 06.11.2026).
 *
 * Der Ablauf läuft als eigener Prozess gegen eine Kulisse (`AK_ROOT`), damit die Verdrahtung `main()` → Zuordnung → Datei belegt ist.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { ausgabeGehoertZu, kandidatenOrdnung, ordneZu, ordnungszahlen, titelOrdnung, verteileAusgaben, type DiscKandidat } from './lib/disc-zuordnung.ts'
import { ausgabenAusHtml, formatAus, kandidatenJeKennung } from './extract-disc-ausgaben.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const kand = (id: number, namen: string[], format = 'MOVIE', jpYear?: number): DiscKandidat => ({ id, namen, format, ...(jpYear ? { jpYear } : {}) })
const ed = (edition: string) => ({ edition })
const ids = (v: ReturnType<typeof verteileAusgaben<{ edition: string }>>, e: string) =>
  [...v.je].filter(([, l]) => l.some((a) => a.edition === e)).map(([id]) => id)

/* --- Ordnungszahlen der Ausgabe --- */
pruefe('Film 1-3 ist 1,2,3', gleich(ordnungszahlen('Ajin - Film 1-3 - Limited Steelcase Edition: Komplettset'), [1, 2, 3]))
pruefe('Chapter 1&2 ist 1,2', gleich(ordnungszahlen('Princess Principal: Crown Handler - Chapter 1&2'), [1, 2]))
pruefe('Movie 1+2 ist 1,2', gleich(ordnungszahlen('Kabaneri of the Iron Fortress - Movie 1+2: Komplettset'), [1, 2]))
pruefe('Teil 4 ist 4', gleich(ordnungszahlen('Girls und Panzer: Das Finale - Teil 4'), [4]))
pruefe('„OVA 1+2" ist keine Filmzahl', gleich(ordnungszahlen('Princess Principal - Komplettset + OVA 1+2'), []))
pruefe('Komplettset ohne Zahl', gleich(ordnungszahlen('Mademoiselle Hanamura - Komplettset'), []))
pruefe('Zahl im Reihennamen zählt nicht (Persona 3: nur Movie 3)', gleich(ordnungszahlen('Persona 3: The Movie 3 - Falling Down'), [3]))

/* --- Zahl im Titel --- */
pruefe('Crown Handler 2', gleich(titelOrdnung(['Princess Principal: ~Crown Handler~ 2']), [2]))
pruefe('Movie 3 im Titel', gleich(titelOrdnung(['Haikyu!! Movie 3 - Talent Und Gespür']), [3]))
pruefe('Schlüsselwort + Zahl geht vor freier Zahl („Persona 3: The Movie 2" ist 2)', gleich(titelOrdnung(['Persona 3: The Movie 2']), [2]))
pruefe('Titel ohne Zahl', gleich(titelOrdnung(['Kabaneri of the Iron Fortress: Gebündeltes Licht']), []))

/* --- Zuordnung auf geteilter Seite: die echten Fälle --- */
const crown = [
  kand(101595, ['Princess Principal: ~Crown Handler~ 1'], 'MOVIE', 2021),
  kand(129759, ['Princess Principal: ~Crown Handler~ 2'], 'MOVIE', 2021),
  kand(137612, ['Princess Principal: Crown Handler 3'], 'MOVIE', 2023),
  kand(186716, ['Princess Principal: Crown Handler 4'], 'MOVIE', 2025),
]
const crownEd = ['Princess Principal: Crown Handler - Chapter 1&2 [Blu-ray]', 'Princess Principal - Komplettset + OVA 1+2 [Blu-ray]']
const vCrown = verteileAusgaben(crownEd.map(ed), crown)
pruefe('Crown Handler: Chapter 1&2 gehört zu 1 und 2, nicht zu 3 und 4', gleich(ids(vCrown, crownEd[0]!).sort(), [101595, 129759]), ids(vCrown, crownEd[0]!))
pruefe('Crown Handler: Komplettset + OVA ist nicht eindeutig und bleibt ohne Titel', gleich(ids(vCrown, crownEd[1]!), []) && vCrown.unklar.length === 1)
pruefe('Crown Handler 3 und 4 bleiben ohne Disc (gezählt)', gleich(vCrown.leer, [137612, 186716]), vCrown.leer)

const persona = [
  kand(14407, ['Persona 3 the Movie: #1 Spring of Birth'], 'MOVIE', 2013),
  kand(20736, ['Persona 3 the Movie: #2 Midsummer Knight\'s Dream'], 'MOVIE', 2014),
  kand(20737, ['Persona 3 the Movie: #3 Falling Down'], 'MOVIE', 2015),
  kand(21248, ['Persona 3 the Movie: #4 Winter of Rebirth'], 'MOVIE', 2016),
]
const pEd = ['Persona 3: The Movie 3 - Falling Down [Blu-ray]', 'Persona 3: The Movie 2 - Midsummer Knight’s Dream [Blu-ray]']
const vPersona = verteileAusgaben(pEd.map(ed), persona)
pruefe('Persona 3: „3" im Reihennamen ordnet nichts — Movie 3 geht nur an Teil 3', gleich(ids(vPersona, pEd[0]!), [20737]), ids(vPersona, pEd[0]!))
pruefe('Persona 3: Movie 2 geht nur an Teil 2', gleich(ids(vPersona, pEd[1]!), [20736]), ids(vPersona, pEd[1]!))

const kabaneri = [kand(98662, ['Kabaneri of the Iron Fortress: Gebündeltes Licht'], 'MOVIE', 2016), kand(98663, ['Kabaneri of the Iron Fortress: Brennendes Leben'], 'MOVIE', 2017)]
const kEd = ['Kabaneri of the Iron Fortress - Movie 2: Loderndes Leben [Blu-ray]', 'Kabaneri of the Iron Fortress - Movie 1+2: Komplettset [Blu-ray]']
const vKab = verteileAusgaben(kEd.map(ed), kabaneri)
pruefe('Kabaneri: ohne Zahl im Titel gilt die Reihenfolge — Movie 2 ist der zweite Film', gleich(ids(vKab, kEd[0]!), [98663]), ids(vKab, kEd[0]!))
pruefe('Kabaneri: Movie 1+2 gehört zu beiden', gleich(ids(vKab, kEd[1]!).sort(), [98662, 98663]))
const kabDrei = verteileAusgaben([ed('Kabaneri - Movie 3: Fehlt im Bestand')], kabaneri)
pruefe('Kabaneri: Film 3 bei nur zwei Titeln wird nicht auf den zweiten geraten', kabDrei.unklar.length === 1 && kabDrei.je.size === 0)
pruefe('Kabaneri: „Movie 2+3" bei zwei Titeln ist nicht eindeutig', ausgabeGehoertZu('Kabaneri - Movie 2+3: Set', kabaneri, 2).ids.length === 0)
const kabLuecke = verteileAusgaben([ed('Kabaneri - Movie 1: A'), ed('Kabaneri - Movie 3: B')], kabaneri)
pruefe('Kabaneri: nennt die Seite mehr Filme als Titel da sind, entscheidet die Position nicht', kabLuecke.je.size === 0 && kabLuecke.unklar.length === 2)

const hanamura = [kand(21833, ['Mademoiselle Hanamura 1 - Aufbruch zu modernen Zeiten']), kand(100652, ['Mademoiselle Hanamura 2 - Eine Romanze in Tokyo'])]
const hEd = ['Mademoiselle Hanamura: Eine Romanze in Tokyo [Blu-ray]', 'Mademoiselle Hanamura - Komplettset [Blu-ray]']
const vH = verteileAusgaben(hEd.map(ed), hanamura)
pruefe('Hanamura: der eigene Namensteil entscheidet', gleich(ids(vH, hEd[0]!), [100652]), ids(vH, hEd[0]!))
pruefe('Hanamura: „Komplettset" ohne Filmwort und ohne Zahl bleibt unklar', vH.unklar.length === 1 && vH.unklar[0]!.edition === hEd[1])

const appleseed = [kand(10689, ['Appleseed XIII: Tartaros']), kand(10693, ['Appleseed XIII: Ouranos'])]
const vA = verteileAusgaben([ed('Appleseed XIII: Tartaros & Ouranos [Blu-ray]')], appleseed)
pruefe('Appleseed: beide Namen in einer Ausgabe → beide Titel', gleich([...vA.je.keys()].sort(), [10689, 10693]))

const arise = [
  kand(17187, ['Ghost in the Shell: Arise - Border:1 Ghost Pain'], 'MOVIE', 2013),
  kand(19191, ['Ghost in the Shell: Arise - Border:2 Ghost Whispers'], 'MOVIE', 2013),
  kand(19193, ['Ghost in the Shell: Arise - Border:3 Ghost Tears'], 'MOVIE', 2014),
  kand(19195, ['Ghost in the Shell: Arise - Border:4 Ghost Stands Alone'], 'MOVIE', 2014),
]
const aEd = ['Ghost in the Shell: Arise - Border 3+4 [Blu-ray]', 'Ghost in the Shell: Arise - Gesamtausgabe [Blu-ray]']
const vAr = verteileAusgaben(aEd.map(ed), arise)
pruefe('Arise: „Border:3" im Titel, „Border 3+4" in der Ausgabe → Teil 3 und 4', gleich(ids(vAr, aEd[0]!).sort(), [19193, 19195]), ids(vAr, aEd[0]!))
pruefe('Arise: „Gesamtausgabe" ohne Zahl bleibt unklar', vAr.unklar.length === 1)
const titan = [kand(20691, ['Attack on Titan Part I: Crimson Bow and Arrow'], 'MOVIE', 2014), kand(20692, ['Attack on Titan - Movie Teil 2: Flügel der Freiheit', 'Attack on Titan Part II: Wings of Freedom'], 'MOVIE', 2015)]
pruefe('„Part I" im Titel ist 1 (römisch), „Part II" ist 2', gleich(titelOrdnung([titan[0]!.namen[0]!]), [1]) && gleich(titelOrdnung([titan[1]!.namen[1]!]), [2]))
pruefe('Titan: „Teil 1" in der Ausgabe geht nur an Part I', gleich(ausgabeGehoertZu('Attack on Titan: Teil 1 - Feuerroter Pfeil und Bogen [Blu-ray]', titan, 0).ids, [20691]))
pruefe('Titan: „Movie 1-3" geht an beide', gleich(ausgabeGehoertZu('Attack on Titan - Movie 1-3: Komplettset [Blu-ray]', titan, 0).ids, [20691, 20692]))

const mardock = [kand(8100, ['Mardock Scramble: The First Compression']), kand(10624, ['Mardock Scramble: The Second Combustion']), kand(12053, ['Mardock Scramble: The Third Exhaust'])]
pruefe('Mardock: „Trilogie" gilt für alle drei Filme', gleich(ausgabeGehoertZu('Mardock Scramble - Trilogie [Blu-ray]', mardock, 0).ids, [8100, 10624, 12053]))
const serie = [kand(384, ['Gantz'], 'TV'), kand(395, ['Gantz', 'Gantz: Second Stage'], 'TV')]
pruefe('Gantz: zwei Staffeln mit gleichem Namen — „Komplettset" bleibt unklar', ausgabeGehoertZu('Gantz - Komplettset', serie, 0).ids.length === 0)
pruefe('„Trilogie" gilt nicht für Serien', ausgabeGehoertZu('Gantz - Trilogie', serie, 0).ids.length === 0)
pruefe('Ein Titel allein bekommt alles', gleich(ausgabeGehoertZu('Irgendwas - Komplettset', [kand(5, ['X'])], 0).ids, [5]))
pruefe('Zwei Kandidaten mit gleicher Zahl: beide (kein Raten auf einen)', gleich(kandidatenOrdnung([kand(1, ['A 2']), kand(2, ['B 2'])]).get(1), []))

const kurzName = [kand(1, ['Show: Alpha']), kand(2, ['Show: Betas'])]
pruefe('Namensteile unter 6 Zeichen ordnen nichts zu („Alpha" steckt in „Alphabet")', ausgabeGehoertZu('Show - Alphabet Box', kurzName, 0).ids.length === 0)
const eigeneZahl = [kand(1, ['Show 11'], 'MOVIE', 2001), kand(2, ['Show 12'], 'MOVIE', 2002)]
pruefe('Tragen die Titel eigene Zahlen, entscheidet nie die Position', ausgabeGehoertZu('Show - Film 1', eigeneZahl, 1).ids.length === 0)

/* --- ordneZu: Besitzer behält alles, Geschwister nur das Eindeutige --- */
const zahlSeite = [ed('Show - Film 1'), ed('Show - Komplettset')]
const zahlKand = [kand(901, ['Show 1'], 'MOVIE'), kand(902, ['Show 2'], 'MOVIE')]
const z0 = ordneZu([[7000, zahlSeite]], new Map([[7000, zahlKand]]), new Map([[7000, 901]]))
pruefe('Besitzer behält auch dann alles, wenn ihm selbst eine Ausgabe eindeutig gehört', z0.raus['901']?.length === 2 && z0.raus['902'] === undefined, z0.raus)
const seiteWolf = [ed('Wolf’s Rain - Komplettset'), ed('Wolf’s Rain - Special: Rain Lunch Box')]
const wolf = [kand(900001, ['Wolf’s Rain'], 'TV'), kand(900002, ['Wolf’s Rain: Rain Lunch Box'], 'OVA')]
const z1 = ordneZu([[7001, seiteWolf]], new Map([[7001, wolf]]), new Map([[7001, 900001]]))
pruefe('Besitzer behält alle Ausgaben seiner Seite', z1.raus['900001']?.length === 2)
pruefe('Mit Besitzer wird nichts als „unklar" gezählt', z1.bilanz.unklar === 0 && z1.bilanz.leereKandidaten.length === 0, z1.bilanz)
pruefe('Geschwister ohne eindeutigen Beleg bekommt nichts', z1.raus['900002']?.length === 1 && z1.raus['900002']![0]!.edition.includes('Lunch Box'), z1.raus['900002'])
pruefe('Ohne Besitzer: dieselben Fälle werden nicht geraten', Object.keys(ordneZu([[7001, [ed('Wolf’s Rain - Komplettset')]]], new Map([[7001, wolf]]), new Map()).raus).length === 0)
const z2 = ordneZu([[7002, [ed('Y - Komplettset'), ed('Y - Box 2/2')]]], new Map([[7002, [kand(900003, ['Y'])]]]), new Map())
pruefe('Einziger Titel der Kennung ohne Eintrag in anisearch.json bekommt die Ausgaben', z2.raus['900003']?.length === 2 && z2.bilanz.neuUeberKennung === 1)
pruefe('Bilanz zählt geteilte Seiten und nicht Zugeordnetes', z1.bilanz.geteilteSeiten === 1 && ordneZu([[7001, seiteWolf]], new Map([[7001, wolf]]), new Map()).bilanz.unklar === 1)

/* --- kandidatenJeKennung: Besitzer aus anisearch.json bleibt Kandidat, auch wenn titles.json eine andere Kennung führt --- */
const titel = (id: number, as: number | undefined, extra: Partial<Title> = {}) => ({ id, anisearchId: as, titleEn: `T${id}`, ...extra }) as unknown as Title
const k = kandidatenJeKennung([titel(900011, 8001), titel(900012, 8001), titel(900013, 8002)], new Map([[8001, 900013]]))
pruefe('Kandidaten: titles.json-Kennung plus Besitzer', gleich(k.get(8001)!.map((x) => x.id).sort(), [900011, 900012, 900013]))
pruefe('Kandidaten: eigene Kennung des Besitzers bleibt', gleich(k.get(8002)!.map((x) => x.id), [900013]))

/* --- formatAus: Vol. N ohne /M und Komplettbox (Zeilen wörtlich aus dem Archiv) --- */
const keine = new Set<string>()
for (const e of ['Hamtaro: Kleine Hamster große Abenteuer - Vol. 03', 'El Hazard - Vol. 01: Collector’s Edition', 'Tenkai Knights - Vol. 06', 'Der kleine Prinz und seine Abenteuer - Vol. 01', 'Dr. Slump - Vol. 01 (Re-Release)']) {
  pruefe(`DVD-Folge „${e}"`, formatAus(e, undefined, keine) === 'DVD', formatAus(e, undefined, keine))
}
for (const e of ['Futakoi - Character Song Series: Vol.04', 'Excel Saga - Original Soundtrack: Vol.02', 'Azur Lane - Character Song: Vol.02 - Laffey', 'New Game!!: Vocal Stage - Vol. 1', 'Smile Precure! - OST: Vol.01', 'Saki - Vol. 3 [eBook]']) {
  pruefe(`Musik/eBook „${e}" bleibt draußen`, formatAus(e, e.includes('eBook') ? 'eBook' : undefined, keine) === null, formatAus(e, undefined, keine))
}
pruefe('Vol. ohne „ - " davor ist keine DVD-Folge', formatAus('Rozen Maiden Ouverture: Vol.01', undefined, keine) === null)
pruefe('Komplettbox ohne Manga der Reihe ist eine Disc', formatAus('Hell’s Paradise - Komplettbox: Limited Edition', undefined, keine, new Set()) === 'DVD')
pruefe('Komplettbox mit Manga-Band der Reihe bleibt draußen', formatAus('Given - Komplettbox', undefined, keine, new Set(['given'])) === null)
pruefe('Komplettbox einer anderen Reihe zählt weiter', formatAus('Hell’s Paradise - Komplettbox: Limited Edition', undefined, keine, new Set(['given'])) === 'DVD')
pruefe('Komplettbox ohne Kenntnis der Seite bleibt draußen', formatAus('Hell’s Paradise - Komplettbox: Limited Edition', undefined, keine) === null)
pruefe('Komplettbox mit Bandangabe ist Manga', formatAus('Mashle: Magic and Muscles - Komplettbox: Bd. 01-18', undefined, keine, new Set()) === null)
pruefe('Filmcomics-Box ist keine Disc', formatAus('Mein Nachbar Totoro: Filmcomics - Komplettbox', undefined, keine, new Set()) === null)
const block = (datum: string, titel: string, nr: number, plakette = 'Blu-ray') =>
  `<li class="merch1" data-date="${datum}">${plakette ? `<div class="rank">${plakette}</div>` : ''}<span class="title">${titel}</span><a data-href="article/${nr},x">x</a></li>`
const seite = (bloecke: string[]) => `<html><section id="items"><ul>${bloecke.join('')}</ul></section></html>`
const seiteGiven = (zeilen: string[]) => ausgabenAusHtml(seite(zeilen.map((z, i) => block('2025-10-07', z, 900040 + i, ''))))!
const mitManga = seiteGiven(['Given - Komplettbox', 'Given - Bd. 09 [eBook]'])
const ohneManga = seiteGiven(['Given - Komplettbox'])
pruefe('Seite mit Manga-Band: die Komplettbox fällt heraus', mitManga.eigene.length === 0 && mitManga.verworfen === 2, mitManga)
pruefe('Seite ohne Manga-Band: die Komplettbox bleibt', ohneManga.eigene.length === 1 && ohneManga.eigene[0]!.art === 'gesamt' && ohneManga.eigene[0]!.format === 'DVD', ohneManga)

/* --- Prozess: main() über die ganze Kette gegen eine Kulisse --- */
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const kulisse = mkdtempSync(join(tmpdir(), 'disc-zuordnung-'))
const schreibe = (teile: string[], inhalt: string | Buffer) => {
  mkdirSync(dirname(join(kulisse, ...teile)), { recursive: true })
  writeFileSync(join(kulisse, ...teile), inhalt)
}
schreibe(['data', 'anisearch-raw', '13597.html.gz'], gzipSync(seite([
  block('2023-10-20', 'Princess Principal: Crown Handler - Chapter 1&amp;2 [Blu-ray]', 900021),
  block('2026-09-04', 'Princess Principal - Komplettset + OVA 1+2 [Blu-ray]', 900022),
])))
schreibe(['data', 'anisearch-raw', '13598.html.gz'], gzipSync(seite([block('2022-01-01', 'Eigenständig - Komplettset [Blu-ray]', 900023), block('2022-01-02', 'Eigenständig - Vol. 1', 900024, '')])))
schreibe(['data', 'anisearch-raw', '13600.html.gz'], gzipSync(seite([block('2022-02-01', 'Zwei - Komplettset [Blu-ray]', 900025)])))
schreibe(['data', 'anisearch.json'], JSON.stringify({ 900031: { anisearchId: 13598 }, 999999: { anisearchId: 13599 }, 900032: { anisearchId: 13600 } }))
schreibe(['public', 'data', 'titles.json'], JSON.stringify([
  { id: 101595, titleEn: 'Princess Principal: ~Crown Handler~ 1', format: 'MOVIE', anisearchId: 13597 },
  { id: 129759, titleEn: 'Princess Principal: ~Crown Handler~ 2', format: 'MOVIE', anisearchId: 13597 },
  { id: 137612, titleEn: 'Princess Principal: Crown Handler 3', format: 'MOVIE', anisearchId: 13597 },
  { id: 900031, titleEn: 'Eigenständig', format: 'TV' },
  { id: 900032, titleEn: 'Zwei', format: 'TV' },
  { id: 900033, titleEn: 'Zwei Extra', format: 'SPECIAL', anisearchId: 13600 },
]))
const lauf = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/extract-disc-ausgaben.ts')], {
  cwd: wurzel,
  encoding: 'utf8',
  timeout: 120_000,
  env: { ...process.env, AK_ROOT: kulisse },
})
pruefe('Prozess endet mit Exit 0', lauf.status === 0, { status: lauf.status, err: lauf.stderr.slice(0, 300) })
const raus = JSON.parse(readFileSync(join(kulisse, 'data', 'disc-ausgaben.json'), 'utf8')) as Record<string, { edition: string; url?: string }[]>
pruefe('Prozess: Crown Handler 2 (nur über anisearchId) bekommt Chapter 1&2', raus['129759']?.length === 1 && raus['129759']![0]!.edition.includes('Chapter 1&2'), raus['129759'])
pruefe('Prozess: Crown Handler 1 bekommt dieselbe Ausgabe mit Adresse', raus['101595']?.[0]?.url === 'https://www.anisearch.de/article/900021,x', raus['101595'])
pruefe('Prozess: Crown Handler 3 bekommt nichts, auch nicht das unklare Komplettset', raus['137612'] === undefined)
pruefe('Prozess: Besitzer aus anisearch.json bleibt wie bisher', raus['900031']?.length === 2)
pruefe('Prozess: Besitzer einer geteilten Kennung behält die Ausgabe, das Geschwister bekommt sie nicht', raus['900032']?.length === 1 && raus['900033'] === undefined, raus)
pruefe('Prozess: nichts sonst', Object.keys(raus).length === 4, Object.keys(raus))
pruefe('Prozess: zählt Nicht-Zugeordnetes im Log', /nicht zugeordnet \(nicht eindeutig\): 1 Ausgaben, 1 Titel bleiben ohne: 137612/.test(lauf.stdout + lauf.stderr), lauf.stdout.slice(-400))
rmSync(kulisse, { recursive: true, force: true })

console.log(`Disc-Zuordnung: ${faelle} Fälle, ${fehler} Fehler`)
if (fehler) process.exit(1)
