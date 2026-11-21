/**
 * Zusicherungen zum Messer (`shared/ausbleiben-messen.ts`): Zeitlogik mit fester Uhr (ms-Zahlen, keine echte Zeit).
 * Slot ist 15:00 Berlin = 14:00 UTC am 15.11.2026 (Winterzeit), der Fall Space Mercenary F7 (kam 15:19).
 *
 * Aufruf: `npx tsx pipeline/check-ausbleiben-messen.ts`
 */
import { MESSER_AUSBLEIBEN_FRUEHESTENS_MS } from '../shared/ausbleiben-plan.ts'
import { deutscheStaffel, lesungAusFolgenliste, lesungFaellig, nachLesung, serieAusSlug, staffelAbgeloest, standFuer, urteil, type Lesung, type ZielStand } from '../shared/ausbleiben-messen.ts'
import { berlinToUtc } from '../shared/time.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const MIN = 6e4
const SLOT = Date.UTC(2026, 10, 15, 14, 0)
const leer: ZielStand = { slotMs: SLOT }
const ohneDe: Lesung = { art: 'auskunft', vorhanden: true, deutsch: false }
const mitDe: Lesung = { art: 'auskunft', vorhanden: true, deutsch: true }
const nichts: Lesung = { art: 'keine' }

pruefe('Konstante 26 min', MESSER_AUSBLEIBEN_FRUEHESTENS_MS === 26 * MIN)

// Ausgeblieben: genau an Slot + 26 (die Lesung zählt), eins drüber, deutlich drüber; eins davor nicht
const ohneDeutschUm = (min: number) => urteil(nachLesung(leer, ohneDe, SLOT + min * MIN))
pruefe('25 min 59 s: offen', urteil(nachLesung(leer, ohneDe, SLOT + 26 * MIN - 1000)) === 'offen')
pruefe('genau Slot + 26: ausgeblieben', ohneDeutschUm(26) === 'ausgeblieben')
pruefe('Slot + 27: ausgeblieben', ohneDeutschUm(27) === 'ausgeblieben')
pruefe('Slot + 3 h: ausgeblieben', ohneDeutschUm(180) === 'ausgeblieben')
pruefe('Slot + 5 min: offen', ohneDeutschUm(5) === 'offen')

// Monoton: einmal gesehen bleibt erschienen, die erste Sichtung wird nie überschrieben, auch nicht von einer älteren Lesung
const gesehen = nachLesung(leer, mitDe, SLOT + 19 * MIN)
const spaeterAlt = nachLesung(gesehen, ohneDe, SLOT + 40 * MIN)
pruefe('Sichtung: erschienen', urteil(gesehen) === 'erschienen' && gesehen.gesehenAm === SLOT + 19 * MIN)
pruefe('ältere Lesung danach: weiter erschienen', urteil(spaeterAlt) === 'erschienen')
pruefe('erste Sichtung bleibt', nachLesung(spaeterAlt, mitDe, SLOT + 50 * MIN).gesehenAm === SLOT + 19 * MIN)
pruefe('ältere Lesung nach Sichtung schreibt ohneDeutschAm nicht', spaeterAlt.ohneDeutschAm === undefined)
pruefe('Lesung nach Sichtung zählt für den Takt', spaeterAlt.letzteLesung === SLOT + 40 * MIN)
const ausgeblieben = nachLesung(leer, ohneDe, SLOT + 30 * MIN)
pruefe('ausgeblieben, dann gesehen: erschienen', urteil(nachLesung(ausgeblieben, mitDe, SLOT + 35 * MIN)) === 'erschienen')

// Nichtauskunft ist nie Ausbleiben
const spaetNichts = nachLesung(leer, nichts, SLOT + 3 * 60 * MIN)
pruefe('keine Auskunft: unbekannt', urteil(spaetNichts) === 'unbekannt' && spaetNichts.letzteLesung === SLOT + 180 * MIN)
const nichtVorhanden = nachLesung(leer, { art: 'auskunft', deutsch: false, vorhanden: false }, SLOT + 3 * 60 * MIN)
pruefe('Folge nicht in der Liste: unbekannt', urteil(nichtVorhanden) === 'unbekannt')
pruefe('keine Auskunft löscht ein früheres Ohne-Deutsch nicht', nachLesung(ausgeblieben, nichts, SLOT + 40 * MIN).ohneDeutschAm === SLOT + 30 * MIN)
pruefe('Eingang unverändert', JSON.stringify(leer) === JSON.stringify({ slotMs: SLOT }))

// Wann gelesen wird: vor dem Slot nie, danach im 5-min-Takt, ab 15 min alle 15 min, nach 24 h nicht mehr
pruefe('vor dem Slot: nein', !lesungFaellig(leer, SLOT - MIN))
pruefe('am Slot: ja', lesungFaellig(leer, SLOT))
pruefe('4 min nach letzter Lesung (Slot + 5): nein', !lesungFaellig({ ...leer, letzteLesung: SLOT + 5 * MIN }, SLOT + 9 * MIN))
pruefe('5 min nach letzter Lesung: ja', lesungFaellig({ ...leer, letzteLesung: SLOT + 5 * MIN }, SLOT + 10 * MIN))
pruefe('Slot + 20, letzte vor 10 min: nein (Takt 15)', !lesungFaellig({ ...leer, letzteLesung: SLOT + 10 * MIN }, SLOT + 20 * MIN))
pruefe('Slot + 25, letzte vor 15 min: ja', lesungFaellig({ ...leer, letzteLesung: SLOT + 10 * MIN }, SLOT + 25 * MIN))
pruefe('Slot + 24 h: noch ja', lesungFaellig(leer, SLOT + 24 * 60 * MIN))
pruefe('Slot + 24 h + 1 ms: nein', !lesungFaellig(leer, SLOT + 24 * 60 * MIN + 1))
pruefe('gesehen: nie wieder', !lesungFaellig(gesehen, SLOT + 25 * MIN))

// 00:30 Berlin: Slot nach Mitternacht (Winterzeit = 23:30Z des Vortags), Takt und Fenster rechnen in ms, nicht in Tagen
const NACHT = berlinToUtc('2026-11-16', '00:30').getTime()
pruefe('00:30 Berlin: Slot 23:30Z', NACHT === Date.UTC(2026, 10, 15, 23, 30))
pruefe('00:30: 00:56 Berlin gilt als ausgeblieben', urteil(nachLesung({ slotMs: NACHT }, ohneDe, NACHT + 26 * MIN)) === 'ausgeblieben')
pruefe('00:30: Lesung um 00:29 Berlin nein, um 00:30 ja', !lesungFaellig({ slotMs: NACHT }, NACHT - MIN) && lesungFaellig({ slotMs: NACHT }, NACHT))
// Sommerzeit: 15:00 Berlin = 13:00Z
pruefe('Sommerzeit: Slot 13:00Z', berlinToUtc('2026-07-12', '15:00').getTime() === Date.UTC(2026, 6, 12, 13, 0))

// Folgenliste lesen: Form aus dem Probelauf 2c (Eintrag mit ja-JP, en-US, ohne de-DE vor dem Slot)
const liste = (versionen: string[][]) => ({
  data: versionen.map((v, i) => ({ episode_number: i + 1, versions: v.map((audio_locale) => ({ audio_locale })) })),
})
const vorSlot = liste([['ja-JP', 'de-DE'], ['ja-JP', 'de-DE'], ['ja-JP', 'de-DE'], ['ja-JP', 'en-US']])
const nachSlot = liste([['ja-JP', 'de-DE'], ['ja-JP', 'de-DE'], ['ja-JP', 'de-DE'], ['ja-JP', 'de-DE']])
pruefe('Folge 4 vor dem Slot: vorhanden, nicht deutsch', JSON.stringify(lesungAusFolgenliste(vorSlot, 4)) === JSON.stringify(ohneDe))
pruefe('Folge 4 danach: deutsch', JSON.stringify(lesungAusFolgenliste(nachSlot, 4)) === JSON.stringify(mitDe))
pruefe('Folge 3 deutsch, Folge 4 nicht (Nachbarfolge zählt nicht)', lesungAusFolgenliste(vorSlot, 4).art === 'auskunft' && (lesungAusFolgenliste(vorSlot, 4) as { deutsch: boolean }).deutsch === false)
pruefe('Folge 9 nicht in der Liste: vorhanden false', JSON.stringify(lesungAusFolgenliste(vorSlot, 9)) === JSON.stringify({ art: 'auskunft', vorhanden: false, deutsch: false }))
pruefe('leere Liste: keine Auskunft', lesungAusFolgenliste({ data: [] }, 4).art === 'keine')
pruefe('ohne data: keine Auskunft', lesungAusFolgenliste({}, 4).art === 'keine' && lesungAusFolgenliste(null, 4).art === 'keine' && lesungAusFolgenliste('x', 4).art === 'keine')
pruefe('Eintrag ohne versions: nicht deutsch', (lesungAusFolgenliste({ data: [{ episode_number: 4 }] }, 4) as { deutsch: boolean }).deutsch === false)

// Staffelwahl: jüngste deutsche Staffel (Apothekerin: drei Staffeln, alle de-DE)
const staffeln = {
  data: [
    { season_sequence_number: 1, versions: [{ audio_locale: 'de-DE', guid: 'G1' }] },
    { season_sequence_number: 3, versions: [{ audio_locale: 'ja-JP', guid: 'J3' }, { audio_locale: 'de-DE', guid: 'GS3DEDE' }] },
    { season_sequence_number: 2, versions: [{ audio_locale: 'de-DE', guid: 'G2' }] },
    { season_sequence_number: 4, versions: [{ audio_locale: 'ja-JP', guid: 'J4' }] },
  ],
}
pruefe('Staffel: höchste mit de-DE, nicht die höchste überhaupt', deutscheStaffel(staffeln) === 'GS3DEDE')
pruefe('Staffel: keine deutsche -> null', deutscheStaffel({ data: [{ season_sequence_number: 1, versions: [{ audio_locale: 'ja-JP', guid: 'J' }] }] }) === null)
pruefe('Staffel: Müll -> null', deutscheStaffel(null) === null && deutscheStaffel({}) === null)
const de = (guid: string) => [{ audio_locale: 'de-DE', guid }]
pruefe('Staffel: gleiche Nummer, die erste gilt', deutscheStaffel({ data: [{ season_sequence_number: 2, versions: de('ERSTE') }, { season_sequence_number: 2, versions: de('ZWEITE') }] }) === 'ERSTE')
pruefe('Staffel: ohne Nummer zählt 0, mit Nummer 1 gewinnt', deutscheStaffel({ data: [{ versions: de('OHNE') }, { season_sequence_number: 1, versions: de('EINS') }] }) === 'EINS')
pruefe('Staffel: Einträge, die keine Objekte sind, werden übergangen', deutscheStaffel({ data: [null, 'x', { season_sequence_number: 1, versions: de('G') }] }) === 'G')
pruefe('Staffel: Fassung ohne guid wird übergangen', deutscheStaffel({ data: [{ season_sequence_number: 5, versions: [{ audio_locale: 'de-DE' }] }, { season_sequence_number: 1, versions: de('G') }] }) === 'G')

// Serienkennung aus dem Schlüssel
pruefe('Schlüssel cr-GT…', serieAusSlug('cr-GT00384015') === 'GT00384015' && serieAusSlug('cr-G3KHEVDJ7') === 'G3KHEVDJ7')
pruefe('alter Schlüssel: null', serieAusSlug('aoashi-staffel-2-crunchyroll-de-2026-10-25') === null && serieAusSlug('cr-GT1-x') === null && serieAusSlug('xcr-GT1') === null)

// Verschobener Termin (A1): neuer Slot, alte Lesungen verworfen, Sichtung und Staffel bleiben
const NEU = SLOT + 2 * 60 * MIN
const alt: ZielStand = { slotMs: SLOT, staffel: 'GS1', letzteLesung: SLOT + 5 * MIN, ohneDeutschAm: SLOT + 5 * MIN }
pruefe('standFuer: ohne Stand ein leerer', JSON.stringify(standFuer(undefined, NEU)) === JSON.stringify({ slotMs: NEU }))
pruefe('standFuer: gleicher Slot, derselbe Stand', standFuer(alt, SLOT) === alt)
pruefe('standFuer: neuer Slot verwirft Lesungen, behält die Staffel', JSON.stringify(standFuer(alt, NEU)) === JSON.stringify({ slotMs: NEU, staffel: 'GS1' }))
pruefe('standFuer: neuer Slot behält die Sichtung', standFuer({ ...alt, gesehenAm: SLOT + 9 * MIN }, NEU).gesehenAm === SLOT + 9 * MIN)
pruefe('verschoben: 65 min nach dem alten Slot nie ausgeblieben', urteil(nachLesung(standFuer(alt, NEU), ohneDe, SLOT + 65 * MIN)) !== 'ausgeblieben')
pruefe('verschoben: vor dem neuen Slot nicht fällig', !lesungFaellig(standFuer(alt, NEU), SLOT + 65 * MIN))

// Neue Staffel ohne Deutsch (A5): Folgen der Vorstaffel zählen nur nach Sendedatum
const mitNeuer = { data: [{ season_sequence_number: 3, versions: de('GS3DEDE') }, { season_sequence_number: 5, versions: [{ audio_locale: 'ja-JP', guid: 'J5' }] }] }
pruefe('abgelöst: jüngere Staffel ohne Deutsch', staffelAbgeloest(mitNeuer, 'GS3DEDE') && staffelAbgeloest(staffeln, 'GS3DEDE'))
pruefe('abgelöst: die gewählte ist die jüngste -> nein', !staffelAbgeloest({ data: [{ season_sequence_number: 3, versions: de('GS3DEDE') }] }, 'GS3DEDE') && !staffelAbgeloest(null, 'x'))
const mitDatum = (d?: string) => ({ data: [{ episode_number: 4, ...(d ? { episode_air_date: d } : {}), versions: de('X').concat([{ audio_locale: 'ja-JP', guid: 'J' }]) }] })
const GRENZE = Date.UTC(2026, 10, 1)
pruefe('Datum genau an der Grenze: zählt', (lesungAusFolgenliste(mitDatum('2026-11-01T00:00:00Z'), 4, GRENZE) as { deutsch: boolean }).deutsch)
pruefe('Datum eine Sekunde davor: Folge nicht vorhanden', JSON.stringify(lesungAusFolgenliste(mitDatum('2026-10-31T23:59:59Z'), 4, GRENZE)) === JSON.stringify({ art: 'auskunft', vorhanden: false, deutsch: false }))
pruefe('ohne Datum mit Grenze: Folge nicht vorhanden', (lesungAusFolgenliste(mitDatum(), 4, GRENZE) as { vorhanden: boolean }).vorhanden === false)
pruefe('ohne Grenze: Datum egal', (lesungAusFolgenliste(mitDatum('2020-01-01T00:00:00Z'), 4) as { deutsch: boolean }).deutsch)

if (fehler > 0) {
  console.error(`${fehler} von ${faelle} Prüfungen rot`)
  process.exit(1)
}
console.log(`Messer: ${faelle} Prüfungen grün`)
