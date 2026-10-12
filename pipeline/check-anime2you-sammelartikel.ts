/**
 * Zusicherungen zur Anime2You-Extraktion bei Sammelartikeln (11.10.2026): Titelblöcke (»Titel«, darunter Sprache/Simulcast/Stream)
 * und Aufzählungen mit Sprachangabe. Der Aufbau stammt aus den Artikeln 1059679 (Crunchyroll), 1059642 (Prime Video), 1059441 (Netflix).
 * Lauf 38132571893 verwarf 20 von 41 Vorschlägen, weil der Titel nur in der Titelzeile über dem Zitat stand.
 */
import { pruefeVorschlag, type Vorschlag } from './lib/anime2you-vorschlag.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TEXT = `Sechs weitere Anime-Neustarts ab sofort auf Crunchyroll verfügbar
Veröffentlicht: 2026-10-10

 Der Streaming-Dienst Crunchyroll hat sein Programm mit sechs weiteren Simulcast-Neustarts aufgestockt.
 Ab sofort verfügbar:
 »Firefly Wedding«
 »Horror Collector«
 »The Iceblade Sorcerer Shall Rule the World« – Staffel 2

 »Firefly Wedding«
 Episoden: 1 verfügbar
 Sprache: Japanisch (UT)
 Simulcast: Jeden Freitag um 18:00 Uhr
 Hinweis: Deutsche Synchronisation angekündigt
 Stream: Prime Video , Crunchyroll

 Handlung:
 Die schwerkranke Adelige Satoko Kirigaya möchte vor ihrem Tod heiraten.
 »Horror Collector«
 Episoden: 1 verfügbar
 Sprache: Japanisch (UT)
 Simulcast: Jeden Samstag um 19:15 Uhr
 Stream: Prime Video , Crunchyroll

 »The Iceblade Sorcerer Shall Rule the World« – Staffel 2
 Episoden: 1 verfügbar
 Sprache: Japanisch (UT)
 Simulcast: Jeden Donnerstag um 19:00 Uhr
 Hinweis: Deutsche Synchronisation angekündigt
 Stream: Prime Video , Crunchyroll

 Zu den Neuzugängen gehört der Anime-Film »The Sky Crawlers« aus dem Jahr 2008, der ab sofort sowohl mit deutscher Synchronisation als auch im japanischen Originalton mit deutschen Untertiteln angesehen werden kann.
 Zudem stehen seit heute alle zwölf Episoden der Actionserie »Rooster Fighter« mit deutscher und japanischer Sprachausgabe sowie sämtliche 13 Folgen des Anime »Snowball Earth« im japanischen Originalton zur Verfügung.
 »Demon Slayer: Mugen Train Arc«
 Episoden: 7 (komplett)
 Sprache: Deutsch, Japanisch (UT)
 Stream: Prime Video
 »Demon Slayer: Hashira Training Arc«
 Episoden: 8 (komplett)
 Sprache: Deutsch, Japanisch (UT)
 Stream: Prime Video
`
const bezug = { text: TEXT, titel: 'Sechs weitere Anime-Neustarts ab sofort auf Crunchyroll verfügbar', veroeffentlicht: '2026-10-10' }

const horror: Vorschlag = {
  titel: 'Horror Collector',
  art: 'start',
  plattform: 'crunchyroll',
  anbieter: 'Crunchyroll',
  sender: null,
  datum: null,
  uhrzeit: '19:15',
  wochentage: 'Jeden Samstag',
  sprache: 'omu',
  folgen: null,
  zitat: 'Sprache: Japanisch (UT) Simulcast: Jeden Samstag um 19:15 Uhr',
  unsicher: null,
}
const ergebnis = (v: Vorschlag) => pruefeVorschlag(v, bezug)
const grund = (v: Vorschlag): string | undefined => {
  const r = ergebnis(v)
  return 'grund' in r ? r.grund : undefined
}

console.log('\nAnime2You-Extraktion: Titelblöcke')
const r = ergebnis(horror)
pruefe('Zitat nur mit Simulcast-Zeile, Titel in der Titelzeile darüber: besteht mit Warnung', 'ok' in r && r.ok.warnungen.some((w) => w.includes('Titelzeile')), r)
pruefe('Titel eines anderen Blocks zum selben Zitat: verworfen', grund({ ...horror, titel: 'Firefly Wedding' })?.includes('Titelzeile') === true, grund({ ...horror, titel: 'Firefly Wedding' }))
pruefe('Titel nur in der Aufzählung oben, Zitat im Block eines anderen: verworfen', grund({ ...horror, titel: 'The Iceblade Sorcerer Shall Rule the World – Staffel 2' }) !== undefined)
pruefe('Uhrzeit, die im Zitat nicht steht: weiter verworfen', grund({ ...horror, uhrzeit: '19:00' })?.includes('Uhrzeit') === true)
const zweiBloecke = 'Simulcast: Jeden Samstag um 19:15 Uhr Stream: Prime Video , Crunchyroll »The Iceblade Sorcerer Shall Rule the World« – Staffel 2 Episoden: 1 verfügbar'
pruefe('Zitat reicht in den nächsten Block: verworfen', grund({ ...horror, zitat: zweiBloecke }) !== undefined && grund({ ...horror, zitat: zweiBloecke })?.includes('Titel') === true)
const unterschiedlich: Vorschlag = { ...horror, titel: 'Firefly Wedding', art: 'sprachfassung', uhrzeit: null, wochentage: null, sprache: 'deutsch', zitat: 'Hinweis: Deutsche Synchronisation angekündigt' }
pruefe('Derselbe Wortlaut in zwei Blöcken: gilt für jeden der beiden Titel', 'ok' in ergebnis(unterschiedlich) && 'ok' in ergebnis({ ...unterschiedlich, titel: 'The Iceblade Sorcerer Shall Rule the World – Staffel 2' }))
pruefe('… aber nicht für einen dritten Titel', grund({ ...unterschiedlich, titel: 'Horror Collector' }) !== undefined)
const stream = 'Sprache: Japanisch (UT) Simulcast: Jeden Samstag um 19:15 Uhr Stream: Prime Video , Crunchyroll'
const mitStream = ergebnis({ ...horror, zitat: stream })
pruefe('Zitat mit „Stream: Prime Video , Crunchyroll“: Anbieter im Zitat, keine Anbieter-Warnung', 'ok' in mitStream && !mitStream.ok.warnungen.some((w) => w.includes('anbieter')), mitStream)

console.log('\nAnime2You-Extraktion: Sprachangabe in Aufzählungen')
const sky: Vorschlag = {
  ...horror,
  titel: 'The Sky Crawlers',
  plattform: 'primevideo',
  anbieter: 'Prime Video',
  uhrzeit: null,
  wochentage: null,
  sprache: 'deutsch+omu',
  zitat: 'Zu den Neuzugängen gehört der Anime-Film »The Sky Crawlers« aus dem Jahr 2008, der ab sofort sowohl mit deutscher Synchronisation als auch im japanischen Originalton mit deutschen Untertiteln angesehen werden kann.',
}
pruefe('Titel „The Sky Crawlers“ gilt nicht als Anbieter Sky im Zitat', 'ok' in ergebnis(sky), grund(sky))
const rooster: Vorschlag = { ...sky, titel: 'Rooster Fighter', plattform: 'crunchyroll', anbieter: 'Crunchyroll', zitat: 'Zudem stehen seit heute alle zwölf Episoden der Actionserie »Rooster Fighter« mit deutscher und japanischer Sprachausgabe sowie sämtliche 13 Folgen des Anime »Snowball Earth« im japanischen Originalton zur Verfügung.' }
pruefe('„mit deutscher und japanischer Sprachausgabe“: deutsch+omu besteht', 'ok' in ergebnis(rooster), grund(rooster))
const demon: Vorschlag = { ...sky, titel: 'Demon Slayer: Mugen Train Arc', zitat: 'Sprache: Deutsch, Japanisch (UT)' }
pruefe('„Sprache: Deutsch, Japanisch (UT)“ unter der Titelzeile: deutsch+omu besteht', 'ok' in ergebnis(demon), grund(demon))
pruefe('… aber nicht für einen Arc mit anderem Namen', grund({ ...demon, titel: 'Demon Slayer: Swordsmith Village Arc' }) !== undefined)
pruefe('Nur Originalton ohne deutsches Angebot bleibt „nein“', grund({ ...horror, sprache: 'deutsch', uhrzeit: null, zitat: 'Sprache: Japanisch (UT) Simulcast: Jeden Samstag um 19:15 Uhr' }) !== undefined)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Extraktion Sammelartikel: alle Zusicherungen erfüllt')
