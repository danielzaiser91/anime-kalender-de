/**
 * Zusicherungen zu Wegen, deren `dub: true` nicht gemessen ist: Joyn gilt pauschal als deutsch (Daniel, 02.09.2026), ein
 * Prime-Kanal erbt das Ja seines Anbieters (13.10.2026). Beide tragen `dubAbgeleitet`; gemessene Wege nie. Läuft in `check:logic`.
 * Fälle nach den echten Titeln (Eyeshield 21, Naruto, Inuyasha), kein Netz.
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { joynZeile, setzeJoynDeutsch } from './bau/joyn-pauschal.ts'
import { kanalErbtVomAnbieter } from './bau/kanal-erbt-anbieter.ts'
import { nimmKanalJaGegenSprachTermin } from './bau/deutsch-nicht-gegen-sprach-termin.ts'
import { dubAbgeleitetFehler } from './lib/dub-abgeleitet.ts'

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const bereiche = [{ from: 1, to: 12, dub: true }]
const joyn = (extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'joyn', url: 'https://www.joyn.de/serien/eyeshield-21', ...extra }) as StreamLink
const netflix = (): StreamLink => ({ platform: 'netflix', url: 'https://www.netflix.com/title/1' }) as StreamLink
const cr = (extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/G6DKW52DR/inuyasha', ...extra }) as StreamLink
const kanal = (extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0D6NNGL96', kanal: 'Crunchyroll', ...extra }) as StreamLink
const titelMit = (id: number, streams: StreamLink[]): Title => ({ id, streams }) as unknown as Title

console.log('\nJoyn pauschal:')
const offen = [joyn(), netflix()]
pruefe('Eyeshield 21: Joyn ohne Urteil bekommt Ja und Kennzeichen', setzeJoynDeutsch([titelMit(15, offen)]) === 1 && offen[0]!.dub === true && offen[0]!.dubAbgeleitet === 'joyn-pauschal', offen)
pruefe('Andere Anbieter bleiben ohne Urteil und ohne Kennzeichen', offen[1]!.dub === undefined && offen[1]!.dubAbgeleitet === undefined, offen)
const nein = [joyn({ dub: false })]
pruefe('Joyn mit Handbeleg Nein bleibt Nein, ohne Kennzeichen', setzeJoynDeutsch([titelMit(20, nein)]) === 0 && nein[0]!.dub === false && nein[0]!.dubAbgeleitet === undefined, nein)
const gemessen = [joyn({ dub: true, dubRanges: bereiche })]
pruefe('Joyn mit eigenem Ja bleibt gemessen, ohne Kennzeichen', setzeJoynDeutsch([titelMit(223, gemessen)]) === 0 && gemessen[0]!.dubAbgeleitet === undefined, gemessen)
const zeileTitel = [titelMit(1, [joyn(), joyn({ dub: false }), joyn({ dub: true, dubRanges: bereiche }), netflix()]), titelMit(2, [joyn({ dub: false })])]
const zeileGesetzt = setzeJoynDeutsch(zeileTitel)
pruefe('Bau-Zeile: 1 gesetzt, 3 behalten (2 davon Nein), Netflix zählt nicht', joynZeile(zeileTitel, zeileGesetzt) === '1 Joyn-Verweis(e) als deutsch gesetzt — deutscher Anbieter; 3 mit eigenem Urteil unverändert (2 ohne Deutsch)', joynZeile(zeileTitel, zeileGesetzt))
pruefe('Bau-Zeile: ohne Joyn-Weg leer', joynZeile([titelMit(3, [netflix()])], 0) === '')
pruefe('Bau-Zeile: nur behaltene Wege, 0 gesetzt, wird trotzdem gemeldet', joynZeile([titelMit(4, [joyn({ dub: false })])], 0) === '0 Joyn-Verweis(e) als deutsch gesetzt — deutscher Anbieter; 1 mit eigenem Urteil unverändert (1 ohne Deutsch)')

console.log('\nPrime-Kanal erbt:')
const erbt = [cr({ dub: true, dubRanges: bereiche }), kanal()]
pruefe('Inuyasha: Kanal Crunchyroll erbt Ja samt Kennzeichen', kanalErbtVomAnbieter([titelMit(249, erbt)]) === 1 && erbt[1]!.dub === true && erbt[1]!.dubAbgeleitet === 'kanal-erbt', erbt[1])
pruefe('Der Anbieter-Weg selbst bleibt gemessen', erbt[0]!.dubAbgeleitet === undefined, erbt[0])
const eigenesJa = [cr({ dub: true }), kanal({ dub: true, dubRanges: bereiche })]
pruefe('Kanal mit eigenem Ja erbt nicht und trägt kein Kennzeichen', kanalErbtVomAnbieter([titelMit(249, eigenesJa)]) === 0 && eigenesJa[1]!.dubAbgeleitet === undefined, eigenesJa[1])
const anbieterNein = [cr({ dub: false }), kanal()]
pruefe('Anbieter Nein: Kanal bleibt offen, kein Kennzeichen', kanalErbtVomAnbieter([titelMit(249, anbieterNein)]) === 0 && anbieterNein[1]!.dub === undefined && anbieterNein[1]!.dubAbgeleitet === undefined, anbieterNein[1])
const jwNein = [cr({ dub: true }), kanal()]
pruefe('JustWatch Nein an der Seite: kein Erbe, kein Kennzeichen', kanalErbtVomAnbieter([titelMit(249, jwNein)], () => true) === 0 && jwNein[1]!.dubAbgeleitet === undefined, jwNein[1])
const ohneKanal = [cr({ dub: true }), kanal({ kanal: undefined })]
pruefe('Prime-Weg ohne Kanal erbt nicht', kanalErbtVomAnbieter([titelMit(249, ohneKanal)]) === 0 && ohneKanal[1]!.dubAbgeleitet === undefined, ohneKanal[1])

console.log('\nKreislauf: Erbe, dann Sprachtermin nimmt es zurück:')
const termin = [{ titleId: 166240, platform: 'primevideo', sprache: 'offen' }] as unknown as Release[]
const hashira = titelMit(166240, [cr({ dub: true }), kanal()])
kanalErbtVomAnbieter([hashira])
pruefe('Vorher: Kanal trägt Ja und Kennzeichen', hashira.streams[1]!.dub === true && hashira.streams[1]!.dubAbgeleitet === 'kanal-erbt', hashira.streams[1])
pruefe('Termin „Sprache offen“ nimmt das Ja', nimmKanalJaGegenSprachTermin([hashira], termin, []) === 1, hashira.streams[1])
pruefe('Nachher: weder Ja noch Kennzeichen', hashira.streams[1]!.dub === undefined && hashira.streams[1]!.dubAbgeleitet === undefined, hashira.streams[1])

console.log('\nZusicherung der Auslieferung:')
pruefe('Joyn und Kanal mit Kennzeichen und Ja: kein Fehler', dubAbgeleitetFehler([titelMit(1, [joyn({ dub: true, dubAbgeleitet: 'joyn-pauschal' }), kanal({ dub: true, dubAbgeleitet: 'kanal-erbt' })])]).length === 0)
pruefe('Kennzeichen ohne dub: Fehler', dubAbgeleitetFehler([titelMit(1, [kanal({ dubAbgeleitet: 'kanal-erbt' })])]).length === 1)
pruefe('Kennzeichen neben dub false: Fehler', dubAbgeleitetFehler([titelMit(1, [joyn({ dub: false, dubAbgeleitet: 'joyn-pauschal' })])]).length === 1)
pruefe('joyn-pauschal an Netflix: Fehler', dubAbgeleitetFehler([titelMit(1, [{ ...netflix(), dub: true, dubAbgeleitet: 'joyn-pauschal' }])]).length === 1)
pruefe('kanal-erbt an Prime ohne Kanal: Fehler', dubAbgeleitetFehler([titelMit(1, [kanal({ kanal: undefined, dub: true, dubAbgeleitet: 'kanal-erbt' })])]).length === 1)
pruefe('Weg ohne Kennzeichen: kein Fehler', dubAbgeleitetFehler([titelMit(1, [joyn({ dub: true }), netflix()])]).length === 0)

if (verletzt) {
  console.error(`\n${verletzt} von ${gesamt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log(`\ncheck-dub-abgeleitet: ${gesamt} Prüfungen ok`)
