/**
 * Verworfene Namenstreffer (19.11.2026): `ohneAndereWerke` nimmt einem `ohneTreffer`-Befund den gleichnamigen Kandidaten, wenn die Handliste genau diesen Kandidaten
 * als anderes Werk führt; danach greifen `kein-angebot` und `nur-disc`. Je Zusicherung ein Fall, der ohne sie rot wird. Aufruf: `npm run check:logic`.
 */
import { baueOhneWeg, type OhneWegEingabe } from './lib/ohne-weg.ts'
import { ohneAndereWerke, type AndereWerke } from './lib/ohne-weg-andere-werke.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Befund = OhneWegEingabe['justwatch'][string]
const treffer = (jwId: string) => ({ jwId, jwPfad: '/de/Film/x', titel: 'X', tmdbId: 5, gleicherName: true })
const ohneTreffer = (extra: Record<string, unknown> = {}) => ({ geprueftAm: '2026-11-17', angebote: [], ohneTreffer: true, namenTreffer: treffer('tm1'), ...extra }) as unknown as Befund
const eintrag = (anilistId: number, jwId: string): AndereWerke => ({ anilistId, jwId, jwPfad: '/de/Film/x', grund: 'Film statt Serie', geprueftAm: '2026-11-19' })
const grundVon = (justwatch: Record<string, Befund>, id: number, extra: Partial<OhneWegEingabe> = {}) =>
  baueOhneWeg({ titel: [{ id, format: 'TV', streams: [] } as never], termine: [], handbelege: [], justwatch, discAusgaben: {}, heute: '2026-11-18', ...extra })[id]

console.log('\nverworfene Namenstreffer')
pruefe('Ohne Liste: gleichnamiger Kandidat, der Titel bleibt offen', grundVon({ 7: ohneTreffer() }, 7)?.reason === 'offen')
const mit = ohneAndereWerke({ 7: ohneTreffer() }, [eintrag(7, 'tm1')])
pruefe('Mit Eintrag für genau diesen Kandidaten: kein-angebot, Tag und Quelle JustWatch', grundVon(mit, 7)?.reason === 'kein-angebot' && grundVon(mit, 7)?.checkedAt === '2026-11-17', grundVon(mit, 7))
pruefe('Mit Eintrag und erschienener Disc: nur-disc', grundVon(mit, 7, { discAusgaben: { 7: [{ datum: '2020-01-01' }] } })?.reason === 'nur-disc')
pruefe('Gegenfall: der Abruf nennt einen anderen Kandidaten (jwId) — der Eintrag gilt nicht mehr, offen', grundVon(ohneAndereWerke({ 7: ohneTreffer({ namenTreffer: treffer('tm2') }) }, [eintrag(7, 'tm1')]), 7)?.reason === 'offen')
pruefe('Gegenfall: Eintrag für eine andere Kennung ändert diesen Titel nicht', grundVon(ohneAndereWerke({ 7: ohneTreffer() }, [eintrag(8, 'tm1')]), 7)?.reason === 'offen')
pruefe('Gegenfall: 28 Tage alter Befund bleibt offen (kein Beleg aus dem Eintrag)', grundVon(ohneAndereWerke({ 7: ohneTreffer({ geprueftAm: '2026-10-21' }) }, [eintrag(7, 'tm1')]), 7)?.reason === 'offen')
pruefe('Gegenfall: verfehlter Befund bleibt offen', grundVon(ohneAndereWerke({ 7: ohneTreffer({ verfehltAm: '2026-11-17' }) }, [eintrag(7, 'tm1')]), 7)?.reason === 'offen')
pruefe('Gegenfall: Handbeleg „deutsch“ geht vor', grundVon(mit, 7, { handbelege: [{ anilistId: 7, platform: 'prime', dub: true, checkedAt: '2026-10-01' } as never] })?.reason === 'offen')
const gefunden = { geprueftAm: '2026-11-17', jwId: 'ts9', tmdbId: 1, angebote: [{ anbieter: 'X', art: 'FLATRATE', audio: ['en'] }], namenTreffer: treffer('tm1') } as unknown as Befund
pruefe('Gegenfall: ein gefundener Titel (kein ohneTreffer) behält seine Felder', ohneAndereWerke({ 7: gefunden }, [eintrag(7, 'tm1')])[7]?.namenTreffer?.jwId === 'tm1')
const fremdBefund = { geprueftAm: '2026-11-17', jwId: 'ts9', tmdbId: 1, jwPfad: '/de/Serie/x', verfehltAm: '2026-11-17', angebote: [] } as unknown as Befund
const ersetzt = ohneAndereWerke({ 7: fremdBefund }, [eintrag(7, 'ts9')])
pruefe('Alter Befund, der das andere Werk selbst trägt: wie ohneTreffer, Tag bleibt (kein offen)', grundVon(ersetzt, 7)?.reason === 'kein-angebot' && grundVon(ersetzt, 7)?.checkedAt === '2026-11-17', grundVon(ersetzt, 7))
pruefe('Gegenfall: Eintrag für eine andere jwId lässt den alten Befund stehen (offen)', grundVon(ohneAndereWerke({ 7: fremdBefund }, [eintrag(7, 'ts8')]), 7)?.reason === 'offen')
const bestand = { 7: ohneTreffer() }
ohneAndereWerke(bestand, [eintrag(7, 'tm1')])
pruefe('Der Bestand selbst bleibt unverändert (Kopie)', bestand[7]?.namenTreffer?.jwId === 'tm1')
pruefe('Leere Liste: gleicher Inhalt', JSON.stringify(ohneAndereWerke(bestand, [])) === JSON.stringify(bestand))

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-andere-werke: Eintrag gilt nur für den genannten Kandidaten und nur bei frischem, nicht verfehltem ohneTreffer')
