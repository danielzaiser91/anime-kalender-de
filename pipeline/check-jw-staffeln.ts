/**
 * Zusicherungen zu den Staffelangaben aus JustWatch und zur vorzeitigen Wiedervorlage des Abrufs
 * (`lib/jw-staffeln.ts`, `lib/jw-wiedervorlage.ts`). Läuft in `check:logic`.
 */
import { staffelnVon, type StaffelRoh } from './lib/jw-staffeln.ts'
import { staffelnFehlen } from './lib/jw-wiedervorlage.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const angebot = (monetizationType: string, name: string, audioLanguages: string[]) => ({
  monetizationType,
  audioLanguages,
  standardWebURL: `https://example.test/${name}`,
  package: { clearName: name },
})
const staffel = (nr: number | null, offers: StaffelRoh['offers']): StaffelRoh => ({ content: { seasonNumber: nr }, offers })

pruefe('Film (keine Staffeln in der Antwort) gibt undefined', staffelnVon(undefined) === undefined && staffelnVon(null) === undefined)
const s = staffelnVon([
  staffel(1, [angebot('FLATRATE', 'Prime', ['de']), angebot('FLATRATE', 'Prime', ['de']), angebot('BUY', 'Store', ['de']), angebot('RENT', 'Store', [])]),
  staffel(2, []),
  staffel(null, [angebot('FLATRATE', 'Prime', ['de'])]),
])
pruefe('Staffel ohne Nummer fällt weg, leere Staffel bleibt', s?.map((x) => x.nr).join() === '1,2', JSON.stringify(s))
pruefe('Kauf und Leihe stehen nicht in den Staffelangaben', s?.[0]?.angebote.length === 1 && s[0].angebote[0]?.anbieter === 'Prime')
pruefe('doppeltes Angebot (je Auflösung) steht einmal', s?.[0]?.angebote.length === 1)
pruefe('Ton und Adresse bleiben erhalten', s?.[0]?.angebote[0]?.audio.join() === 'de' && s[0].angebote[0].url === 'https://example.test/Prime')
const art = staffelnVon([staffel(1, [angebot('FLATRATE', 'Prime', ['de']), angebot('FREE', 'Prime', ['de'])])])
pruefe('dasselbe Angebot in zwei Arten (Abo, gratis) bleibt zweimal', art?.[0]?.angebote.length === 2)
const mitZahl = staffelnVon([{ ...staffel(1, []), totalEpisodeCount: 13 }, { ...staffel(2, []), totalEpisodeCount: 0 }, staffel(3, [])])
pruefe('Folgenzahl der Staffel bleibt erhalten, fehlende oder 0 gibt kein Feld', mitZahl?.[0]?.folgen === 13 && mitZahl[1].folgen === undefined && mitZahl[2].folgen === undefined)

const serie = { geprueftAm: '2026-09-01', jwId: 'ts1', jwPfad: '/de/Serie/x' }
pruefe('Serie ohne Staffelangaben wird nachgeholt', staffelnFehlen(serie))
pruefe('Serie mit Staffelangaben nicht', !staffelnFehlen({ ...serie, staffeln: [] }))
pruefe('Film nie', !staffelnFehlen({ ...serie, jwPfad: '/de/Film/x' }))
pruefe('ohne Treffer nie', !staffelnFehlen({ ...serie, ohneTreffer: true }))
pruefe('ohne Befund nie', !staffelnFehlen(undefined))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-staffeln: ok')
