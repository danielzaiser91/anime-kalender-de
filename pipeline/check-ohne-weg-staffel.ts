/**
 * Der Grund `abo-andere-staffel` in `ohne-weg.json` (19.11.2026): JustWatch führt das deutsche Abo an einer anderen Staffel derselben Serie, die ein Titel der Reihe
 * als eigenen Weg trägt. Fälle nach den zwei echten Anlässen (Chunibyo 14741 mit Geschwister 18671, Legend of the Galactic Heroes Second 100780 mit 20628),
 * je Zusicherung ein Gegenfall. Aufruf: `npm run check:logic`.
 */
import { baueOhneWeg, type OhneWegEingabe } from './lib/ohne-weg.ts'
import { aboAndereStaffel } from './lib/ohne-weg-staffel.ts'
import type { OhneWegEintrag } from '../shared/ohne-weg.ts'
import { ohneWegText } from '../web/src/components/detail/ohne-weg.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Befund = OhneWegEingabe['justwatch'][string]
const HEUTE = '2026-11-19'
const ANGEBOT = (art: string, audio: string[]) => ({ anbieter: 'Crunchyroll', art, audio })
/** Chunibyo (Stand 19.11.2026): Staffel 1 ohne Angebot, Staffel 2 Crunchyroll mit `de`. */
const chunibyo = (staffeln: unknown[] = [{ nr: 1, folgen: 13, angebote: [] }, { nr: 2, folgen: 13, angebote: [ANGEBOT('FLATRATE', ['de', 'ja'])] }]) =>
  ({ geprueftAm: '2026-11-19', jwId: 'ts27994', tmdbId: 45501, angebote: [ANGEBOT('FLATRATE', ['de', 'ja'])], staffeln }) as unknown as Befund
const ohneWeg = (id: number, franchiseId: number | undefined = 14741) => ({ id, format: 'TV', streams: [], franchiseId }) as unknown as OhneWegEingabe['titel'][number]
const mitWeg = (id: number, franchiseId: number | undefined = 14741) => ({ id, format: 'TV', streams: [{ platform: 'crunchyroll' }], franchiseId }) as unknown as OhneWegEingabe['titel'][number]
const lauf = (eingabe: Partial<OhneWegEingabe>) => baueOhneWeg({ titel: [], termine: [], handbelege: [], justwatch: {}, discAusgaben: {}, heute: HEUTE, ...eingabe })[14741]
/** Titel 14741 in Staffel 1 mit Geschwister 18671 (Weg); `extra` ändert die Eingabe. */
const fall = (extra: Partial<OhneWegEingabe> = {}) => lauf({ titel: [ohneWeg(14741), mitWeg(18671)], justwatch: { 14741: chunibyo() }, staffelNr: { 14741: 1 }, ...extra })

console.log('\nabo-andere-staffel')
const e = fall()
pruefe('Chunibyo-Form: Grund, Tag aus geprueftAm, Quelle JustWatch', e?.reason === 'abo-andere-staffel' && e.checkedAt === '2026-11-19' && e.source === 'justwatch', e)
const loGH = baueOhneWeg({
  titel: [ohneWeg(100780, 20628), mitWeg(20628, 20628)],
  termine: [],
  handbelege: [],
  justwatch: { 100780: chunibyo([{ nr: 1, folgen: 12, angebote: [ANGEBOT('FLATRATE', ['de'])] }, { nr: 2, folgen: 12, angebote: [] }, { nr: 3, folgen: 13, angebote: [] }]) },
  discAusgaben: {},
  heute: HEUTE,
  staffelNr: { 100780: 2 },
})[100780]
pruefe('Legend-of-the-Galactic-Heroes-Form (Second = Staffel 2, Abo an Staffel 1)', loGH?.reason === 'abo-andere-staffel', loGH)
pruefe('Gegenfall: ohne Staffelnummer', fall({ staffelNr: {} })?.reason === 'offen')
pruefe('Gegenfall: Nummer der Staffel, die das Abo trägt (Staffel 2)', fall({ staffelNr: { 14741: 2 } })?.reason === 'offen')
pruefe('Gegenfall: Nummer ohne Staffel bei JustWatch', fall({ staffelNr: { 14741: 3 } })?.reason === 'offen')
pruefe('Gegenfall: kein Titel der Reihe mit Weg', fall({ titel: [ohneWeg(14741), ohneWeg(18671)] })?.reason === 'offen')
pruefe('Gegenfall: Weg trägt nur eine fremde Reihe', fall({ titel: [ohneWeg(14741), mitWeg(18671, 555)] })?.reason === 'offen')
pruefe('Gegenfall: Titel ohne Reihe', fall({ titel: [{ ...ohneWeg(14741), franchiseId: undefined }, { ...mitWeg(18671), franchiseId: undefined }] })?.reason === 'offen')
const anders = (staffeln: unknown[]) => fall({ justwatch: { 14741: chunibyo(staffeln) } })?.reason
pruefe('Gegenfall: die eigene Staffel trägt selbst ein Angebot', anders([{ nr: 1, folgen: 13, angebote: [ANGEBOT('FLATRATE', ['ja'])] }, { nr: 2, folgen: 13, angebote: [ANGEBOT('FLATRATE', ['de'])] }]) === 'offen')
pruefe('Gegenfall: die andere Staffel führt Deutsch nur als Kauf', anders([{ nr: 1, folgen: 13, angebote: [] }, { nr: 2, folgen: 13, angebote: [ANGEBOT('BUY', ['de']), ANGEBOT('RENT', ['de']), ANGEBOT('CINEMA', ['de'])] }]) === 'offen')
pruefe('Gegenfall: die andere Staffel führt Abo ohne Deutsch', anders([{ nr: 1, folgen: 13, angebote: [] }, { nr: 2, folgen: 13, angebote: [ANGEBOT('FLATRATE', ['ja'])] }]) === 'offen')
pruefe('Abo mit Werbung zählt als Abo', anders([{ nr: 1, folgen: 13, angebote: [] }, { nr: 2, folgen: 13, angebote: [ANGEBOT('ADS', ['de'])] }]) === 'abo-andere-staffel')
pruefe('Gegenfall: Befund ohne Staffelliste', fall({ justwatch: { 14741: { ...chunibyo(), staffeln: undefined } as Befund } })?.reason === 'offen')
pruefe('Gegenfall: Befund 28 Tage alt', fall({ justwatch: { 14741: { ...chunibyo(), geprueftAm: '2026-10-22' } as Befund } })?.reason === 'offen')
pruefe('Gegenfall: verfehlter Befund', fall({ justwatch: { 14741: { ...chunibyo(), verfehltAm: '2026-11-18' } as Befund } })?.reason === 'offen')
const hb = { anilistId: 14741, platform: 'crunchyroll', dub: true, checkedAt: '2026-10-01' } as unknown as OhneWegEingabe['handbelege'][number]
pruefe('Gegenfall: Handbeleg „deutsch“ am Titel geht vor', fall({ handbelege: [hb] })?.reason === 'offen')
pruefe('Gegenfall: Kennung bei JustWatch an zwei Titeln', fall({ titel: [ohneWeg(14741), mitWeg(18671), ohneWeg(14742)], justwatch: { 14741: chunibyo(), 14742: { ...chunibyo(), tmdbId: 7 } as Befund }, staffelNr: { 14741: 1, 14742: 1 } })?.reason === 'offen', fall({ titel: [ohneWeg(14741), mitWeg(18671), ohneWeg(14742)], justwatch: { 14741: chunibyo(), 14742: { ...chunibyo(), tmdbId: 7 } as Befund }, staffelNr: { 14741: 1, 14742: 1 } }))

console.log('\nBeleg-Funktion')
pruefe('aboAndereStaffel ohne Geschwister-Weg: nein', !aboAndereStaffel(chunibyo(), 1, false))
pruefe('aboAndereStaffel mit Staffel 0 und ohne Nummer: nein', !aboAndereStaffel(chunibyo(), undefined, true) && !aboAndereStaffel(chunibyo(), 0, true))

console.log('\nAnzeigesatz')
const satz = ohneWegText({ reason: 'abo-andere-staffel', checkedAt: '2026-11-19' })
pruefe('Text nennt JustWatch, die andere Staffel und den Tag', satz === 'Laut JustWatch gehört das deutsche Abo zu einer anderen Staffel, geprüft am 19.11.2026.', satz)
pruefe('Gegenfall: ohne Tag erfindet der Text keinen', ohneWegText({ reason: 'abo-andere-staffel' } as OhneWegEintrag) === 'Ein Streaming-Angebot ist noch nicht belegt.')

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-staffel: abo-andere-staffel mit Beleg, Sperren, Vorrang und Anzeigesatz in Ordnung')
