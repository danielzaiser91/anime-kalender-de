/**
 * Zusicherungen zu den Staffelangaben aus JustWatch und zur vorzeitigen Wiedervorlage des Abrufs
 * (`lib/jw-staffeln.ts`, `lib/jw-wiedervorlage.ts`). Läuft in `check:logic`.
 */
import { staffelnVon, type StaffelRoh } from './lib/jw-staffeln.ts'
import { staffelnFehlen, vertrauensBefundAlt } from './lib/jw-wiedervorlage.ts'
import type { Title } from '../shared/types.ts'

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

const serie = { geprueftAm: '2026-09-01', jwId: 'ts1', jwPfad: '/de/Serie/x' }
pruefe('Serie ohne Staffelangaben wird nachgeholt', staffelnFehlen(serie))
pruefe('Serie mit Staffelangaben nicht', !staffelnFehlen({ ...serie, staffeln: [] }))
pruefe('Film nie', !staffelnFehlen({ ...serie, jwPfad: '/de/Film/x' }))
pruefe('ohne Treffer nie', !staffelnFehlen({ ...serie, ohneTreffer: true }))
pruefe('ohne Befund nie', !staffelnFehlen(undefined))

const mitKennzeichnung = { streams: [{ platform: 'primevideo', url: 'x', dubQuelle: 'justwatch' }] } as unknown as Title
const ohne = { streams: [{ platform: 'primevideo', url: 'x' }] } as unknown as Title
const befund = (tag: string) => ({ geprueftAm: tag })
pruefe('Kennzeichnung mit Befund von vor 21 Tagen: erneuern', vertrauensBefundAlt(mitKennzeichnung, befund('2026-09-20'), '2026-10-11'))
pruefe('Kennzeichnung mit Befund von vor 20 Tagen: noch nicht', !vertrauensBefundAlt(mitKennzeichnung, befund('2026-09-21'), '2026-10-11'))
pruefe('ohne Kennzeichnung nie vorgezogen', !vertrauensBefundAlt(ohne, befund('2026-01-01'), '2026-10-11'))
pruefe('ohne Befund nie', !vertrauensBefundAlt(mitKennzeichnung, undefined, '2026-10-11'))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-staffeln: ok')
