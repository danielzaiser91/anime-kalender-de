/**
 * JustWatch-Eintrag für Folgestaffeln (11.11.2026): Ein Titel ohne eigenen Schlüssel in `justwatch-audio.json` bekommt die Angebote der Staffel, die zu
 * Staffelnummer (`staffelDesTitels`) **und** Folgenzahl passt (Goblin Slayer II 129188 unter 101165). Nur die Folgenzahl zu nehmen hätte Shingeki 3 und
 * Dr. Stone NEW WORLD falsch belegt. Die Verdrahtung im Bau prüft `check-kanal-nach-begrenzung.ts` (Wege-Abschluss).
 *
 * Aufruf: `npx tsx pipeline/check-jw-folgestaffel.ts`
 */
import { mitFolgestaffelEintraegen } from './bau/11-2-6-folgestaffel-eintraege.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kanal = { anbieter: 'Aniverse Amazon Channel', art: 'FLATRATE', audio: ['de', 'ja'], url: 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.folgestaffel' }
const titel = (id: number, episodes: number | undefined, franchiseId: number | undefined, jpYear: number): Title =>
  ({ id, episodes, franchiseId, jpYear, format: 'TV', titleEn: `Serie ${franchiseId}` }) as unknown as Title
const tabelle = (...t: Title[]) => new Map(t.map((x) => [x.id, x] as const))
const staffeln = (...s: [number, object[]][]) => s.map(([folgen, angebote], i) => ({ nr: i + 1, folgen, angebote: angebote as never }))
const namen = (e: { angebote?: { anbieter: string }[] } | undefined) => (e?.angebote ?? []).map((a) => a.anbieter).join(',')

console.log('\nmitFolgestaffelEintraegen (feste Staffelformen):')
const reihe = tabelle(titel(900101, 12, 7001, 2018), titel(900102, 12, 7001, 2023))
const eintrag = { jwId: 'tsA', angebote: [], staffeln: staffeln([12, []], [12, [kanal]]) }
const aus = mitFolgestaffelEintraegen({ 900101: eintrag } as never, reihe)
pruefe('Goblin Slayer II: Staffel 2 mit 12 Folgen liefert den Kanal und die Kennung der Serie', namen(aus['900102']) === 'Aniverse Amazon Channel' && aus['900102'].jwId === 'tsA', aus['900102'])
pruefe('der Titel mit eigenem Schlüssel bleibt dasselbe Objekt', aus['900101'] === eintrag)

const shingeki = tabelle(titel(900201, 25, 7002, 2013), titel(900202, 10, 7002, 2018))
const ausShingeki = mitFolgestaffelEintraegen({ 900201: { jwId: 'tsB', staffeln: staffeln([25, []], [12, [kanal]]) } } as never, shingeki)
pruefe('Staffelnummer passt, Folgenzahl nicht (Shingeki 3, Dr. Stone NEW WORLD): kein Eintrag', !('900202' in ausShingeki), ausShingeki['900202'])

const drei = tabelle(titel(900301, 12, 7003, 2018), titel(900302, 12, 7003, 2020), titel(900303, 12, 7003, 2022))
const ausDrei = mitFolgestaffelEintraegen({ 900301: { jwId: 'tsC', staffeln: staffeln([12, []], [12, [kanal]], [24, []]) } } as never, drei)
pruefe('Folgenzahl passt zu einer anderen Staffel als die Nummer (Titel 3 mit 12 Folgen, JW 3 hat 24): kein Eintrag', !('900303' in ausDrei), ausDrei['900303'])
pruefe('Titel 2 derselben Reihe bekommt Staffel 2', namen(ausDrei['900302']) === 'Aniverse Amazon Channel', ausDrei['900302'])

const zwei = tabelle(titel(900401, 12, 7004, 2018), titel(900402, 12, 7004, 2020), titel(900403, 12, 7004, 2022))
const dritteMitKanal = (jwId: string) => ({ jwId, staffeln: staffeln([12, []], [12, []], [12, [kanal]]) })
const ausZwei = mitFolgestaffelEintraegen({ 900401: dritteMitKanal('tsX'), 900402: dritteMitKanal('tsY') } as never, zwei)
pruefe('zwei verschiedene Serien-Einträge der Reihe passen: kein Eintrag (nicht raten)', !('900403' in ausZwei), ausZwei['900403'])
const gleicheSerie = mitFolgestaffelEintraegen({ 900401: dritteMitKanal('tsX'), 900402: dritteMitKanal('tsX') } as never, zwei)
pruefe('zwei Einträge derselben Serie (gleiche Kennung): ein Eintrag', namen(gleicheSerie['900403']) === 'Aniverse Amazon Channel', gleicheSerie['900403'])

const leer = tabelle(titel(900501, 12, 7005, 2018), titel(900502, 12, 7005, 2023))
const ausLeer = mitFolgestaffelEintraegen({ 900501: { jwId: 'tsD', staffeln: staffeln([12, [kanal]], [12, []]) } } as never, leer)
pruefe('Staffel passt, führt aber keine Angebote: kein Eintrag', !('900502' in ausLeer), ausLeer['900502'])

const ohne = tabelle(titel(900601, 12, 7006, 2018), titel(900602, undefined, 7006, 2023), titel(900603, 12, undefined, 2023))
const ausOhne = mitFolgestaffelEintraegen({ 900601: { jwId: 'tsE', staffeln: staffeln([12, []], [12, [kanal]]) } } as never, ohne)
pruefe('Titel ohne Folgenzahl oder ohne Reihe: kein Eintrag', !('900602' in ausOhne) && !('900603' in ausOhne), ausOhne)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
