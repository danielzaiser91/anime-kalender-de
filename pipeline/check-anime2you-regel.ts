/**
 * Anime2You-Regeln ohne Claude (`lib/anime2you-regel.ts`): echte Artikelauszüge aus Hauptmenge und Holdout der Messung vom 07.11.2026
 * (`tools/anime2you-regel-faelle.json`, Erwartung von Hand am Artikeltext gelesen) und die Entscheidungsfunktionen im Einzelnen.
 * Fehlbeleg = Behauptung, die der Artikel nicht trägt (nicht in der Erwartung); die Zahl muss 0 sein.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { blockBehauptungen, datumAusPraefix, leseBehauptungen, liesBloecke, nenntSynchro, plattformDesBlocks, plattformen, satzBehauptungen, type Behauptung } from './lib/anime2you-regel.ts'

interface Fall {
  id: string
  menge: 'haupt' | 'holdout'
  name: string
  text: string
  erwartet: Omit<Behauptung, 'zitat'>[]
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const schluessel = (b: Omit<Behauptung, 'zitat'>): string => [b.familie, b.titel, b.zusatz ?? '', b.plattform, b.sprache, b.datum ?? ''].join('|')

const faelle = JSON.parse(readFileSync(fileURLToPath(new URL('../tools/anime2you-regel-faelle.json', import.meta.url)), 'utf8')) as Fall[]
let behauptungen = 0
let erwartet = 0
let gleich = 0
let fehlbelege = 0
let fehlend = 0
for (const f of faelle) {
  const hat = leseBehauptungen(f.text)
  const zeilen = f.text.split('\n').map((z) => z.trim()).filter(Boolean).join('\n')
  const soll = f.erwartet.map(schluessel)
  const ist = hat.map(schluessel)
  const zuviel = ist.filter((k) => !soll.includes(k))
  const zuwenig = soll.filter((k) => !ist.includes(k))
  behauptungen += hat.length
  erwartet += soll.length
  fehlbelege += zuviel.length
  fehlend += zuwenig.length
  if (!zuviel.length && !zuwenig.length && ist.length === soll.length) gleich++
  pruefe(`${f.id} (${f.name}): zu viel`, !zuviel.length, zuviel)
  pruefe(`${f.id} (${f.name}): fehlt`, !zuwenig.length, zuwenig)
  pruefe(`${f.id}: Zitat steht wörtlich im Artikel`, hat.every((b) => zeilen.includes(b.zitat)), hat.map((b) => b.zitat))
  pruefe(`${f.id}: höchstens eine Behauptung je Familie, Titel und Plattform`, new Set(hat.map((b) => `${b.familie}|${b.titel}|${b.zusatz}|${b.plattform}`)).size === hat.length)
  const bloecke = hat.filter((b) => b.familie === 'block')
  pruefe(`${f.id}: ein Block-Zitat trägt genau einen Titel`, bloecke.every((b) => (b.zitat.match(/»/g) ?? []).length === 1), bloecke.map((b) => b.zitat))
  pruefe(`${f.id}: ein Block-Zitat reicht bis zur Sprachzeile`, bloecke.every((b) => /^Sprache:/m.test(b.zitat)), bloecke.map((b) => b.zitat))
}
pruefe('die Auszüge decken Hauptmenge und Holdout ab', faelle.some((f) => f.menge === 'haupt') && faelle.some((f) => f.menge === 'holdout'))
pruefe('es gibt Behauptungen (kein leerer Lauf)', behauptungen > 0 && erwartet > 0, { behauptungen, erwartet })

/* Schärfung 1: Plattform des Blocks. */
const plat = plattformDesBlocks
pruefe('Stream ohne Zeile: einzige Plattform des Artikeltitels', plat(undefined, ['crunchyroll']) === 'crunchyroll')
pruefe('Stream ohne Zeile, Artikeltitel ohne Plattform: Rest', plat(undefined, []) === undefined)
pruefe('Stream ohne Zeile, Artikeltitel mit zwei Plattformen: Rest', plat(undefined, ['netflix', 'crunchyroll']) === undefined)
pruefe('eine Plattform im Stream gilt auch gegen den Artikeltitel', plat('Netflix', ['crunchyroll']) === 'netflix')
pruefe('zwei Plattformen: die des Artikeltitels', plat('Prime Video , Crunchyroll', ['crunchyroll']) === 'crunchyroll')
pruefe('zwei Plattformen, Artikeltitel nennt keine: Rest', plat('Prime Video , Crunchyroll', []) === undefined)
pruefe('zwei Plattformen, Artikeltitel nennt beide: Rest', plat('Prime Video , Crunchyroll', ['primevideo', 'crunchyroll']) === undefined)
pruefe('„nach TV-Ausstrahlung“ ist kein Weg', plat('Joyn (nach TV-Ausstrahlung)', ['joyn']) === undefined)
pruefe('„nach der TV-Ausstrahlung“ ist kein Weg', plat('Joyn (nach der TV-Ausstrahlung)', ['joyn']) === undefined)
pruefe('„Noch nicht verfügbar“ nennt keine Plattform', plat('Noch nicht verfügbar', ['disneyplus']) === undefined)

/* Tag vor dem Titel. */
pruefe('„1. November“', datumAusPraefix('1. November', '2026-10-28') === '2026-11-01')
pruefe('„Ab 02.11.“', datumAusPraefix('Ab 02.11.', '2026-10-27') === '2026-11-02')
pruefe('Wochentag nennt keinen Tag', datumAusPraefix('Donnerstag', '2026-10-21') === undefined)
pruefe('Januar im Dezember-Artikel: nächstes Jahr', datumAusPraefix('3. Januar', '2026-12-20') === '2027-01-03')
pruefe('Dezember im Januar-Artikel: Vorjahr', datumAusPraefix('28. Dezember', '2027-01-02') === '2026-12-28')
pruefe('Monat ohne Namen: kein Tag', datumAusPraefix('5. Foo', '2026-10-01') === undefined)

/* Synchro-Aussage und Satzschärfungen an kleinen Sätzen (die echten Auslöser stehen oben in den Auszügen). */
pruefe('„auf Deutsch untertitelt“ bejaht keine Synchro', !nenntSynchro('Die Serie läuft auf Deutsch untertitelt.'))
pruefe('Verneinung bejaht keine Synchro', !nenntSynchro('Es gibt keine deutsche Synchronisation.'))
const satzMit = (kopf: string, s: string): Behauptung[] => satzBehauptungen([kopf, 'Veröffentlicht: 2026-10-01', s], '2026-10-01')
const satz = (s: string): Behauptung[] => satzMit('»Foo« startet bei Disney+', s)
pruefe('Satz mit einer Plattform und einem Titel', satz('Die deutsche Synchronisation von »Foo« läuft bei Netflix.').map((b) => b.plattform).join() === 'netflix')
pruefe('Satz ohne Plattform: die des Artikeltitels', satz('Die deutsche Synchronisation von »Foo« läuft an.').map((b) => b.plattform).join() === 'disneyplus')
pruefe('Satz mit zwei Plattformen: Rest', satz('Die deutsche Synchronisation von »Foo« läuft bei Netflix und Crunchyroll.').length === 0)
pruefe('Satz mit zwei Titeln: Rest', satz('Die deutsche Synchronisation von »Foo« und »Bar« läuft bei Netflix.').length === 0)
for (const wort of ['Synchronstimme', 'Synchronregie', 'Synchronsprecher']) pruefe(`${wort} zählt nicht`, satz(`Die ${wort} von »Foo« wurde bei Netflix gelobt.`).length === 0)
pruefe('„synchronisiert von“ zählt nicht', satz('»Foo« wurde synchronisiert von Studio X und läuft bei Netflix.').length === 0)
pruefe('Jahr vor dem Veröffentlichungsjahr macht den Satz zum Rest', satz('Die deutsche Synchronisation von »Foo« lief 2025 bei Netflix.').length === 0)
pruefe('Jahr des Veröffentlichungsjahrs bleibt', satz('Die deutsche Synchronisation von »Foo« läuft 2026 bei Netflix.').length === 1)
pruefe('Satz mit Untertiteln und Synchro: deutsch+omu', satz('»Foo« gibt es bei Netflix mit deutscher Synchronisation und im Originalton mit Untertiteln.').map((b) => b.sprache).join() === 'deutsch+omu')
pruefe('Satz nur mit Synchro: deutsch', satz('»Foo« gibt es bei Netflix mit deutscher Synchronisation.').map((b) => b.sprache).join() === 'deutsch')
pruefe('Satzgrenze nach „153.“ vor „Bei“', satz('Reborn! läuft bis Episode 153. Bei »Foo« kommt die deutsche Synchronisation hinzu.').length === 1)
pruefe('keine Satzgrenze nach Tag vor Monatsnamen', satz('Ab dem 3. November läuft »Foo« bei Netflix mit deutscher Synchronisation.').length === 1)
pruefe('ohne Veröffentlicht-Zeile: nichts', leseBehauptungen('Titel\nkeine Zeile\n\n»Foo« bei Netflix mit deutscher Synchronisation.').length === 0)
pruefe('Artikeltitel mit zwei Plattformen, Satz ohne: Rest', satzMit('Netflix und Crunchyroll', 'Die deutsche Synchronisation von »Foo« läuft an.').length === 0)
pruefe('Artikeltitel ohne Plattform, Satz ohne: Rest', satzMit('Neuigkeiten', 'Die deutsche Synchronisation von »Foo« läuft an.').length === 0)
pruefe('das Satz-Zitat ist der ganze Satz', satz('Die deutsche Synchronisation von »Foo« läuft bei Netflix an.')[0]?.zitat === 'Die deutsche Synchronisation von »Foo« läuft bei Netflix an.')
pruefe('Leerzeile im Block gehört nicht ins Zitat', leseBehauptungen('Foo bei Netflix\nVeröffentlicht: 2026-10-01\n\n»Bar«\n\nSprache: Deutsch\nStream: Netflix\n')[0]?.zitat === '»Bar«\nSprache: Deutsch\nStream: Netflix')
for (const [wort, satzText] of [['Untertiteln', 'mit deutscher Synchronisation und mit Untertiteln'], ['Originalton', 'mit deutscher Synchronisation und im Originalton'], ['japanisch', 'mit deutscher Synchronisation und japanischem Ton']] as const)
  pruefe(`${wort} macht den Satz deutsch+omu`, satz(`Bei Netflix läuft »Foo« ${satzText}.`).map((b) => b.sprache).join() === 'deutsch+omu')

/* Wortmarken der Plattformen. */
const MARKEN_FAELLE: [string, string][] = [
  ['Crunchyroll', 'crunchyroll'], ['Netflix', 'netflix'], ['Prime Video', 'primevideo'], ['Amazon Prime', 'primevideo'], ['Disney+', 'disneyplus'],
  ['Disney +', 'disneyplus'], ['Paramount+', 'paramountplus'], ['ADN', 'adn'], ['Anime Digital Network', 'adn'], ['aniverse', 'aniverse'],
  ['WOW', 'wow'], ['Joyn', 'joyn'], ['RTL+', 'rtlplus'], ['YouTube', 'youtube'],
]
for (const [text, id] of MARKEN_FAELLE) pruefe(`Wortmarke ${text}`, plattformen(`Läuft bei ${text} im Januar`).join() === id, plattformen(text))
pruefe('Wortmarke ADN nur als Wort', plattformen('ADNA Madness').length === 0)
pruefe('Wortmarke WOW nur großgeschrieben', plattformen('wow, das ist neu').length === 0)

/* Tag und Monat an den Rändern der Jahreswahl. */
pruefe('März im Oktober: nächstes Jahr', datumAusPraefix('1. März', '2026-10-01') === '2027-03-01')
pruefe('April im Oktober: dasselbe Jahr', datumAusPraefix('1. April', '2026-10-01') === '2026-04-01')
pruefe('August im Februar: dasselbe Jahr', datumAusPraefix('1. August', '2027-02-01') === '2027-08-01')
pruefe('September im Februar: Vorjahr', datumAusPraefix('1. September', '2027-02-01') === '2026-09-01')
pruefe('einstelliger Monat und Tag werden aufgefüllt', datumAusPraefix('5. März', '2026-03-01') === '2026-03-05')

/* Blöcke: Felder, Reichweite, Sprache. */
const kopf = ['Foo bei Netflix', 'Veröffentlicht: 2026-10-01']
const blockMit = (...zeilen: string[]): number => liesBloecke([...kopf, '»Bar«', ...zeilen], '2026-10-01').length
for (const feld of ['Laufzeit: 90 Minuten', 'Episoden: 12 (komplett)', 'Stream: Netflix', 'Sprache: Deutsch']) pruefe(`ein Block mit nur „${feld}“ zählt`, blockMit(feld) === 1)
pruefe('ein Eintrag ohne Feld zählt nicht (Titelliste)', blockMit('Handlung:', 'Ein Text.') === 0)
pruefe('Feldzeile in der neunten Zeile darunter zählt', blockMit(...Array(8).fill('Handlung:'), 'Stream: Netflix') === 1)
pruefe('Feldzeile in der zehnten Zeile darunter zählt nicht', blockMit(...Array(9).fill('Handlung:'), 'Stream: Netflix') === 0)
pruefe('der nächste Titel beendet den Block', liesBloecke([...kopf, '»Bar«', '»Baz«', 'Stream: Netflix'], '2026-10-01').map((b) => b.titel).join() === 'Baz')
pruefe('Stream steht im Block-Zitat', liesBloecke([...kopf, '»Bar«', 'Sprache: Deutsch', 'Stream: Netflix', 'Handlung:'], '2026-10-01')[0]?.zitat === '»Bar«\nSprache: Deutsch\nStream: Netflix')
const spracheBlock = (sprache: string): string => blockBehauptungen([...kopf, '»Bar«', `Sprache: ${sprache}`, 'Stream: Netflix'], '2026-10-01').map((b) => b.sprache).join()
pruefe('Sprache nur Deutsch', spracheBlock('Deutsch') === 'deutsch')
for (const dazu of ['Japanisch', 'Englisch', 'Koreanisch (UT)']) pruefe(`Sprache Deutsch, ${dazu}`, spracheBlock(`Deutsch, ${dazu}`) === 'deutsch+omu')
pruefe('Sprache ohne Deutsch: Rest', spracheBlock('Japanisch (UT)') === '')
pruefe('Sprache unbekannt: Rest', spracheBlock('unbekannt') === '')
pruefe('Block ohne Sprachzeile: Rest', blockBehauptungen([...kopf, '»Bar«', 'Stream: Netflix'], '2026-10-01').length === 0)
pruefe('Block ohne Plattform: Rest', blockBehauptungen([...kopf, '»Bar«', 'Sprache: Deutsch', 'Stream: Noch nicht verfügbar'], '2026-10-01').length === 0)
pruefe('eingerückte Zeilen werden gelesen', leseBehauptungen(`  Foo bei Netflix  \n  Veröffentlicht: 2026-10-01  \n\n  »Bar«  \n  Sprache: Deutsch  \n  Stream: Netflix  \n`).length === 1)

const meldung = `check-anime2you-regel: ${faelle.length} Auszüge (Haupt ${faelle.filter((f) => f.menge === 'haupt').length}, Holdout ${faelle.filter((f) => f.menge === 'holdout').length}); Behauptungen ${behauptungen}, erwartet ${erwartet}, Auszüge gleich ${gleich}/${faelle.length}, Fehlbelege ${fehlbelege}, fehlend ${fehlend}`
if (fehler) {
  console.error(`${meldung}\n${fehler} Prüfungen verletzt.`)
  process.exit(1)
}
console.log(`${meldung}; Entscheidungsfunktionen ok.`)
