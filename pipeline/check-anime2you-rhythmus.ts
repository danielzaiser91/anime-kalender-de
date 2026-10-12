/**
 * Zusicherungen zur Anime2You-Art „rhythmus“ und zur Auswahl (12.10.2026), am Fall Artikel 1059483 (Avatar: Die sieben Häfen):
 * Der Satz „Bis zum 30. Oktober 2026 folgen wöchentlich jeweils drei bis vier weitere Episoden“ wird zum Vorschlag mit Spanne und Enddatum,
 * und ein Artikel, den ein Handeintrag schon in `sources` führt, wird trotzdem gelesen, solange keine Extraktion zu ihm vorliegt.
 */
import { readFileSync } from 'node:fs'
import { ARTEN, pruefeVorschlag, type Vorschlag } from './lib/anime2you-vorschlag.ts'
import { neueKandidaten } from './lib/anime2you-artikel.ts'
import { adressenIn } from './lib/eingearbeitet.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ARTIKEL = 'https://www.anime2you.de/news/1059483/avatar-kuruk-wave-of-chaos-angekuendigt/'
/** Wörtlich aus dem Artikel, gekürzt (14 Wörter); der Rest des Satzes steht nur im Artikeltext. */
const TAKT = 'Bis zum 30. Oktober 2026 folgen wöchentlich jeweils drei bis vier weitere Episoden'
const REST = 'der 13-teiligen ersten Staffel.'
const KOPF = 'Paramount+\n\n »Avatar« legt nach: Neue Prequel-Serie und verdoppelte Staffelzahl\n\n 10. Oktober 2026 um 00:42 Uhr\n\n'
const titel = '»Avatar« legt nach: Neue Prequel-Serie und verdoppelte Staffelzahl'
const bezug = { text: `${KOPF} ${TAKT} ${REST}\n`, titel, veroeffentlicht: '2026-10-10' }
/** Derselbe Artikel mit einem zusätzlichen Satz im Text (die Fälle unten sind erfunden, damit das Zitat darin vorkommt). */
const mitSatz = (satz: string) => ({ ...bezug, text: `${bezug.text} ${satz}` })

const avatar: Vorschlag = {
  titel: 'Avatar: Die sieben Häfen',
  art: 'rhythmus',
  plattform: 'paramountplus',
  anbieter: 'Paramount+',
  sender: null,
  datum: null,
  uhrzeit: null,
  wochentage: null,
  sprache: 'unklar',
  folgen: null,
  proWoche: [3, 4],
  bis: '2026-10-30',
  zitat: TAKT,
  unsicher: null,
}
const grund = (v: unknown, b = bezug): string | undefined => {
  const r = pruefeVorschlag(v, b)
  return 'grund' in r ? r.grund : undefined
}

console.log('\nAnime2You-Extraktion: Rhythmus (Artikel 1059483)')
const gut = pruefeVorschlag(avatar, bezug)
pruefe('Avatar: drei bis vier je Woche bis 30.10. besteht und behält Spanne, Enddatum und Beleg', 'ok' in gut && gut.ok.proWoche?.join() === '3,4' && gut.ok.bis === '2026-10-30' && gut.ok.zitat.includes('wöchentlich'), gut)
pruefe('Anbieter Paramount+ steht nur im Artikeltext: nur Warnungen', 'ok' in gut && gut.ok.warnungen.every((w) => w.includes('nur im Artikeltext')), gut)
pruefe('Art steht in der Liste der Arten, die Anleitung nennt jede', ARTEN.includes('rhythmus'))
const anleitung = readFileSync(new URL('./anime2you-extraktion-anleitung.md', import.meta.url), 'utf8')
pruefe('Anleitung nennt jede Art, `proWoche` und `bis`', ARTEN.every((a) => anleitung.includes(`\`${a}\``)) && anleitung.includes('`proWoche`') && anleitung.includes('`bis`'))
const ziffern = 'Bis zum 30. Oktober 2026 folgen wöchentlich 3–4 weitere Episoden.'
pruefe('Zahlen als Ziffern („3–4“) gelten wie Zahlwörter', 'ok' in pruefeVorschlag({ ...avatar, zitat: ziffern }, mitSatz(ziffern)))
const nebensatz = 'Die ersten drei Episoden sind da, danach folgen bis zum 30. Oktober 2026 wöchentlich zwei weitere.'
pruefe('Zahl im Nebensatz mit dem Takt-Wort zählt (2), die davor (3) nicht', 'ok' in pruefeVorschlag({ ...avatar, proWoche: [2, 2], zitat: nebensatz }, mitSatz(nebensatz)) && grund({ ...avatar, proWoche: [3, 3], zitat: nebensatz }, mitSatz(nebensatz))?.includes('Takt-Wort') === true)

console.log('\nAnime2You-Extraktion: Rhythmus, was verworfen wird')
pruefe('Spanne weicht vom Zitat ab (2–3): verworfen', grund({ ...avatar, proWoche: [2, 3] })?.includes('Folgen je Woche') === true, grund({ ...avatar, proWoche: [2, 3] }))
pruefe('feste Zahl statt Spanne (3): verworfen', grund({ ...avatar, proWoche: [3, 3] }) !== undefined)
pruefe('Enddatum nicht im Zitat: verworfen', grund({ ...avatar, bis: '2026-10-23' })?.includes('Enddatum') === true)
pruefe('ohne Enddatum: verworfen', grund({ ...avatar, bis: undefined }) !== undefined)
pruefe('Spanne verkehrt oder keine ganze Zahl: verworfen', grund({ ...avatar, proWoche: [4, 3] }) !== undefined && grund({ ...avatar, proWoche: [3.5, 4] }) !== undefined)
const ohneTakt = 'Bis zum 30. Oktober 2026 erscheinen drei bis vier weitere Episoden der 13-teiligen ersten Staffel.'
pruefe('Zitat ohne wöchentlichen Takt: verworfen', grund({ ...avatar, zitat: ohneTakt }, mitSatz(ohneTakt))?.includes('Takt') === true)
pruefe('Taktsatz allein genügt, weil der Artikeltitel »Avatar« nennt (Untertitel egal)', 'ok' in pruefeVorschlag({ ...avatar, zitat: TAKT }, bezug))
pruefe('anderer Titel im selben Artikel: verworfen', grund({ ...avatar, titel: 'Naruto' }) !== undefined)

console.log('\nAnime2You-Extraktion: Rhythmus, nur Zahlen aus dem Satz mit dem Takt-Wort')
const teilig = 'wöchentlich jeweils drei bis vier weitere Episoden der 13-teiligen ersten Staffel'
pruefe('„13-teiligen“ ist keine Folgenzahl (13)', grund({ ...avatar, proWoche: [13, 13], zitat: teilig }, bezug)?.includes('Takt-Wort') === true, grund({ ...avatar, proWoche: [13, 13], zitat: teilig }, bezug))
const nachbar = 'Seit gestern sind die ersten drei Episoden abrufbar. Bis zum 30. Oktober 2026 folgen wöchentlich weitere Episoden.'
pruefe('Zahl im Satz davor („ersten drei Episoden.“) zählt nicht', grund({ ...avatar, proWoche: [3, 3], zitat: nachbar }, mitSatz(nachbar))?.includes('Takt-Wort') === true)
const datum = 'Ab dem 10. Oktober 2026 erscheinen wöchentlich weitere Episoden.'
pruefe('Tag („10. Oktober“) ist keine Folgenzahl (10)', grund({ ...avatar, proWoche: [10, 10], bis: '2026-10-10', zitat: datum }, mitSatz(datum))?.includes('Takt-Wort') === true)
const figuren = 'Es gibt drei bis vier Hauptfiguren. Bis zum 30. Oktober 2026 folgen wöchentlich weitere Episoden.'
pruefe('Spanne im Nachbarsatz („drei bis vier Hauptfiguren“) zählt nicht', grund({ ...avatar, zitat: figuren }, mitSatz(figuren))?.includes('Takt-Wort') === true)

console.log('\nAnime2You-Extraktion: Auswahl liest von Hand eingearbeitete Artikel')
const feed = [{ link: ARTIKEL, title: titel, publishedAt: '2026-10-10' }]
const handeintrag = `  sources:\n    - https://www.anime2you.de/news/1059426/avatar-die-sieben-haefen-auf-paramount-plus/\n    - ${ARTIKEL}\n`
pruefe('Attrappe: die Adresse steht in den sources eines Handeintrags', adressenIn(handeintrag).includes(ARTIKEL.replace(/\/$/, '')))
pruefe('Artikel in sources, ohne Extraktion: Kandidat', neueKandidaten(feed, new Set(), 10).map((k) => k.id).join() === '1059483')
pruefe('Artikel in sources, schon extrahiert: kein Kandidat', neueKandidaten(feed, new Set(['1059483']), 10).length === 0)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Rhythmus: alle Zusicherungen erfüllt')
