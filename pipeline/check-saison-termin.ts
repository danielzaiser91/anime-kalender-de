/**
 * Terminzeile der Saison-Karte (Daniel, 11.10.2026): eine Zeile ohne Verb, `Japan 25.09. · Deutsch 02.10.` — bei höchstens einem Tag Abstand
 * `Japan und Deutsch ab 25.09.`, ohne deutschen Termin `Japan 26.09. · Deutsch: Termin offen`.
 */
import { translate } from '../web/src/lib/i18n.tsx'
import { terminText } from '../web/src/lib/saison-termin.ts'
import { anbieterChips, anbieterVon, type SaisonZeile } from '../web/src/lib/saison.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ist: string | undefined, soll: string | undefined): void {
  if (ist === soll) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(ist)}, erwartet: ${JSON.stringify(soll)}`)
}

const zeile = (extra: Partial<SaisonZeile>): SaisonZeile => ({ id: 1, deutsch: true, stufe: 'auf-deutsch', erschienen: true, ...extra })
const text = (z: SaisonZeile, ausblick = false) => terminText(z, ausblick, '2026', translate)

console.log('Terminzeile der Saison-Karte')
pruefe('zwei Tage: Japan und Deutsch', text(zeile({ jp: '2026-09-25', de: '2026-10-02' })), 'Japan 25.09. · Deutsch 02.10.')
pruefe('derselbe Tag: ein Datum für beide', text(zeile({ jp: '2026-09-25', de: '2026-09-25' })), 'Japan und Deutsch ab 25.09.')
pruefe('ein Tag Abstand (Zeitzone): ein Datum für beide, der frühere', text(zeile({ jp: '2026-09-25', de: '2026-09-26' })), 'Japan und Deutsch ab 25.09.')
pruefe('deutsch einen Tag vor Japan: ebenfalls ein Datum', text(zeile({ jp: '2026-07-09', de: '2026-07-08' })), 'Japan und Deutsch ab 08.07.')
pruefe('zwei Tage Abstand: getrennt', text(zeile({ jp: '2026-09-25', de: '2026-09-27' })), 'Japan 25.09. · Deutsch 27.09.')
pruefe('ohne deutschen Termin: offen', text(zeile({ jp: '2026-09-26', erschienen: false, stufe: 'offen', deutsch: false })), 'Japan 26.09. · Deutsch: Termin offen')
pruefe('abgeleiteter deutscher Termin: „ca.“, nie zusammengelegt', text(zeile({ jp: '2026-09-25', de: '2026-09-25', geschaetzt: true, erschienen: false })), 'Japan 25.09. · Deutsch ca. 25.09.')
pruefe('Termin in der Zukunft: gleiche Schreibweise wie erschienen', text(zeile({ jp: '2026-10-02', de: '2026-10-20', erschienen: false })), 'Japan 02.10. · Deutsch 20.10.')
pruefe('erschienen ohne bekannten Tag: nur Japan', text(zeile({ jp: '2026-07-05' })), 'Japan 05.07.')
pruefe('ohne Japan-Datum: nur Deutsch', text(zeile({ de: '2026-10-02' })), 'Deutsch 02.10.')
pruefe('Ausblick ohne deutschen Termin: nur Japan (das Abzeichen sagt „noch offen“)', text(zeile({ jp: '2027-01-08', genau: 'tag', erschienen: false, stufe: 'offen', deutsch: false }), true), 'Japan 08.01.')
pruefe('Ausblick, Monat genau: Monatsname', text(zeile({ jp: '2026-10', genau: 'monat', erschienen: false, deutsch: false, stufe: 'offen' }), true), 'Japan Oktober')
pruefe('Ausblick, deutscher Termin im nächsten Jahr: mit Jahr', text(zeile({ jp: '2027-01-05', genau: 'tag', de: '2027-01-12', erschienen: false, stufe: 'angekuendigt' }), true), 'Japan 05.01. · Deutsch 12.01.2027')
pruefe('Ausblick ohne jede Angabe: keine Zeile', text(zeile({ genau: 'jahr', erschienen: false, deutsch: false, stufe: 'offen' }), true), undefined)

console.log('Anbieter-Chip')
const termin = (platform: string, estimated?: boolean) => ({ platform, schedule: { firstEpisodeDate: '2026-10-02', estimated } }) as unknown as Release
const anbieter = (t: object, releases: Release[]) => anbieterVon(t as Title, releases).join('+')
pruefe('Weg ohne Stream, sicherer Termin: der Anbieter des Termins (Tokyo Revengers)', anbieter({ streams: [] }, [termin('disneyplus')]), 'disneyplus')
pruefe('abgeleiteter Termin nennt keinen Anbieter', anbieter({ streams: [] }, [termin('disneyplus', true)]), '')
pruefe('Tonspur-Weg steht vor dem Termin-Anbieter, keine Dopplung', anbieter({ streams: [{ platform: 'netflix', dub: true }] }, [termin('primevideo'), termin('netflix')]), 'netflix+primevideo')
pruefe('Stream ohne Tonspur-Beleg zählt nicht', anbieter({ streams: [{ platform: 'netflix' }] }, []), '')

console.log('Anbieter-Chip „laut Anbieter“')
const chips = (t: object, releases: Release[] = []) => anbieterChips(t as Title, releases).map((c) => `${c.platform}${c.laut ? '*' : ''}`).join('+')
pruefe('nur abgeleiteter Weg (Joyn): Chip mit Kennzeichnung', chips({ streams: [{ platform: 'joyn', dub: true, dubAbgeleitet: 'joyn-pauschal' }] }), 'joyn*')
pruefe('belegter Weg: Chip ohne Kennzeichnung', chips({ streams: [{ platform: 'netflix', dub: true }] }), 'netflix')
pruefe('belegt und abgeleitet beim selben Anbieter: belegt gewinnt', chips({ streams: [{ platform: 'primevideo', dub: true, dubAbgeleitet: 'joyn-pauschal' }, { platform: 'primevideo', dub: true }] }), 'primevideo')
pruefe('zwei Anbieter gemischt: nur der abgeleitete gekennzeichnet', chips({ streams: [{ platform: 'netflix', dub: true }, { platform: 'joyn', dub: true, dubAbgeleitet: 'joyn-pauschal' }] }), 'netflix+joyn*')
pruefe('abgeleiteter Weg mit sicherem Termin beim selben Anbieter: ohne Kennzeichnung', chips({ streams: [{ platform: 'joyn', dub: true, dubAbgeleitet: 'joyn-pauschal' }] }, [termin('joyn')]), 'joyn')
pruefe('abgeleiteter Weg mit nur geschätztem Termin: bleibt gekennzeichnet', chips({ streams: [{ platform: 'joyn', dub: true, dubAbgeleitet: 'joyn-pauschal' }] }, [termin('joyn', true)]), 'joyn*')
pruefe('Anbieter nur aus Termin: ohne Kennzeichnung', chips({ streams: [] }, [termin('disneyplus')]), 'disneyplus')
pruefe('Ankündigung: ohne Kennzeichnung', chips({ streams: [], ankuendigung: { synchro: 'angekuendigt', platform: 'netflix' } }), 'netflix')

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
