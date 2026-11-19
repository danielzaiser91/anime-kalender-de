/**
 * Zusicherung: Ein per Handbeleg `available: false` gestrichener Weg steht im Entfernungsprotokoll der Delta-Wache (`belegWege` in
 * `data/verweise-entfernt.json`), und die Wache meldet ihn nicht als „ohne protokollierten Grund weg“. Anlass: 173 Netflix-Wege
 * (Umleitungs-Belege nach PR 4215, Bau 18.11.2026), `entferntProtokolliert` blieb bei 842. Ein Weg ohne Beleg bleibt rot,
 * der Massenabgang ab 40 je Anbieter (Lehre 140) auch.
 * Geprüft: Beleg-Erkennung, Datei (Gedächtnis unberührt, zwei Läufe), `baueAuslieferung` als echter Lauf auf einer Kulisse (`AK_ROOT`)
 * und `messen` gegen die geschriebene Datei, dann `findeAuffaelliges`.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'ak-beleg-wege-'))
mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
mkdirSync(join(kulisse, 'public', 'data'), { recursive: true })
process.env.AK_ROOT = kulisse
for (const d of ['kino-ankuendigungen', 'ohne-synchro-von-hand']) writeFileSync(join(kulisse, 'data', `${d}.yaml`), '[]\n')
const { belegGestrichen } = await import('./bau/beleg-wege-protokoll.ts')
const { gedaechtnisAusgabe } = await import('./bau/verweise-gedaechtnis.ts')
const { baueAuslieferung } = await import('./bau/13-2-auslieferung.ts')
const { merkeBestandVorher } = await import('./lib/bestand-vorher.ts')
const { messen, findeAuffaelliges } = await import('./lib/bestand-delta.ts')

const weg = (platform: string, url: string) => ({ platform, url }) as unknown as NonNullable<Title['streams']>[number]
const titel = (id: number, streams: ReturnType<typeof weg>[]) => ({ id, titleDe: `Titel ${id}`, streams }) as unknown as Title
const NF = 'https://www.netflix.com/title/'
const beleg = (anilistId: number, rest: Record<string, unknown> = {}) => ({
  anilistId,
  platform: 'netflix',
  url: `${NF}${anilistId}`,
  available: false,
  checkedAt: '2026-11-18',
  note: 'Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite',
  ...rest,
})
const HEUTE = '2026-11-19'

console.log('Beleg-Erkennung')
const vorher = [titel(1, [weg('netflix', `${NF}1`)]), titel(2, [weg('netflix', `${NF}2`)]), titel(3, [weg('netflix', `${NF}3`), weg('netflix', `${NF}30`)]), titel(4, [weg('netflix', `${NF}4`)])]
const geh = (b: Record<string, unknown>[], jetzt = [titel(1, []), titel(2, []), titel(3, []), titel(4, [])]) =>
  belegGestrichen(vorher, jetzt, b as never, HEUTE)
const e1 = geh([beleg(1)])
pruefe('Weg weg, Beleg available:false: ein Eintrag mit Titel, Anbieter, Adresse und Grund', e1.length === 1 && e1[0]!.titleId === 1 && e1[0]!.plattform === 'netflix' && e1[0]!.url === `${NF}1` && /available: false.*Durchgang/.test(e1[0]!.grund), e1)
pruefe('entferntAm ist der Bautag, letzterWeg stimmt', e1[0]!.entferntAm === HEUTE && e1[0]!.letzterWeg === true && e1[0]!.geprueftAm === '2026-11-18', e1)
pruefe('Grund wörtlich: Beleg-Datum und Notiz', e1[0]!.grund === 'Handbeleg available: false (2026-11-18): Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite', e1[0]!.grund)
const lang = geh([beleg(1, { note: 'x'.repeat(200) })])[0]!.grund
pruefe('lange Notiz: genau 120 Zeichen im Grund', lang.endsWith('x'.repeat(120)) && !lang.endsWith('x'.repeat(121)), lang.length)
const einer = geh([beleg(3)], [titel(1, []), titel(2, []), titel(3, [weg('netflix', `${NF}30`)]), titel(4, [])])
pruefe('ein anderer Weg derselben Plattform bleibt: Eintrag für den gestrichenen, letzterWeg false', einer.length === 1 && einer[0]!.url === `${NF}3` && einer[0]!.letzterWeg === false, einer)
pruefe('Weg ohne Beleg: kein Eintrag', geh([]).length === 0)
pruefe('Beleg eines anderen Titels mit derselben Adresse: kein Eintrag', geh([beleg(9, { url: `${NF}1` })]).length === 0)
pruefe('Beleg einer anderen Plattform: kein Eintrag', geh([beleg(1, { platform: 'primevideo' })]).length === 0)
pruefe('Beleg mit anderer Adresse: kein Eintrag', geh([beleg(1, { url: `${NF}77` })]).length === 0)
pruefe('Beleg ohne Adresse, einziger Weg der Plattform: Eintrag', geh([beleg(2, { url: undefined })]).length === 1)
pruefe('Beleg ohne Adresse, zwei Wege der Plattform: kein Eintrag', geh([beleg(3, { url: undefined })]).length === 0)
pruefe('jüngeres Ja (dub:true) derselben Adresse hebt das Nein auf', geh([beleg(1), beleg(1, { available: undefined, dub: true, checkedAt: '2026-11-19' })]).length === 0)
pruefe('älteres Ja unter jüngerem Nein: Eintrag', geh([beleg(1, { available: undefined, dub: true, checkedAt: '2026-10-01' }), beleg(1)]).length === 1)
pruefe('Weg noch im Bestand: kein Eintrag', geh([beleg(1)], [titel(1, [weg('netflix', `${NF}1`)]), titel(2, []), titel(3, []), titel(4, [])]).length === 0)
pruefe('Titel nicht mehr im Hauptbestand (verschoben): kein Eintrag', geh([beleg(1)], [titel(2, []), titel(3, []), titel(4, [])]).length === 0)
pruefe('Beleg dub:false statt available:false: kein Eintrag (das protokolliert „belegtes Nein“ selbst)', geh([beleg(1, { available: undefined, dub: false })]).length === 0)
pruefe('verschmolzener Beleg mit jüngstem Urteil Ja trotz available:false: kein Eintrag', geh([beleg(1, { juengstesUrteil: 'ja' })]).length === 0)

console.log('Datei: Gedächtnis unberührt, zwei Läufe')
const gedaechtnis = [{ titleId: 7, titel: 'x', plattform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X', seriesId: null, grund: 'belegtes Nein: dort gibt es keine deutsche Tonspur', geprueftAm: null, entferntAm: '2999-12-31', letzterWeg: false }]
const GRENZE = '2026-10-22'
const bau1 = gedaechtnisAusgabe({ stand: 'A', verweise: gedaechtnis }, [], e1, [], GRENZE)
pruefe('verweise bleiben, wie sie waren; belegWege kommt dazu', JSON.stringify(bau1.verweise) === JSON.stringify(gedaechtnis) && bau1.belegWege?.length === 1, bau1)
pruefe('geänderte belegWege erneuern den Stand', bau1.stand !== 'A')
const bau2 = gedaechtnisAusgabe({ stand: 'Fest', verweise: bau1.verweise, belegWege: bau1.belegWege }, [], [], [], GRENZE)
pruefe('zweiter Lauf ohne neue Wege trägt sie weiter, Stand gleich', bau2.stand === 'Fest' && JSON.stringify({ ...bau2, stand: 0 }) === JSON.stringify({ ...bau1, stand: 0 }), bau2)
pruefe('abgelaufene belegWege fallen weg, ohne Eintrag fehlt der Schlüssel', gedaechtnisAusgabe({ stand: 'A', verweise: [], belegWege: [{ ...e1[0]!, entferntAm: '2026-09-01' }] }, [], [], [], GRENZE).belegWege === undefined)
pruefe('ohne belegWege bleibt die Datei im alten Format', !('belegWege' in gedaechtnisAusgabe({ stand: 'A', verweise: gedaechtnis }, [], [], [], GRENZE)))

console.log('Gesamtlauf: baueAuslieferung auf der Kulisse, dann Wache')
/** 173 Wege wie am 18.11.: vorher im Bestand, per Beleg weg; dazu 60 ohne Beleg weg. */
const viele = (von: number, bis: number) =>
  Array.from({ length: bis - von }, (_, i) => titel(von + i, [weg('netflix', `${NF}${von + i}`)]))
const mitBeleg = viele(1000, 1173)
const ohneBeleg = viele(2000, 2060)
const bleibt = titel(5000, [weg('netflix', `${NF}5000`)])
const vorherAlle = [...mitBeleg, ...ohneBeleg, bleibt]
const jetztAlle = [...mitBeleg, ...ohneBeleg].map((t) => titel(t.id, [])).concat([bleibt])
writeFileSync(join(kulisse, 'public', 'data', 'titles.json'), JSON.stringify(vorherAlle))
writeFileSync(join(kulisse, 'data', 'verweise-entfernt.json'), JSON.stringify({ stand: 'A', verweise: gedaechtnis }))
const belegeYaml = mitBeleg
  .map((t) => `- anilistId: ${t.id}\n  platform: netflix\n  url: ${NF}${t.id}\n  available: false\n  checkedAt: '2026-11-18'\n  note: "Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite"\n`)
  .join('')
writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), belegeYaml)

const lies = () => JSON.parse(readFileSync(join(kulisse, 'data', 'verweise-entfernt.json'), 'utf8')) as { verweise: unknown[]; belegWege?: { titleId: number }[] }
const messe = (titelListe: Title[], entfernt: object = lies()) => messen({ titel: titelListe, releases: [], termine: [], entfernt, kanal: new Set() })
const kzVor = messe(vorherAlle, { verweise: gedaechtnis })
merkeBestandVorher()
const lauf = () =>
  baueAuslieferung({
    allTitles: jetztAlle,
    anisearch: {},
    tmdbTitles: {},
    trenneQuelle: (text: string) => ({ text }),
    synopses: {},
    mitStimmen: new Set(),
    annKennungen: {},
    trailer: {},
    releases: [],
    verschoben: [],
    verweiseEntfernt: [],
  })
lauf()
const datei = lies()
pruefe('173 Wege mit Beleg stehen in belegWege, die 60 ohne Beleg nicht', datei.belegWege?.length === 173 && datei.belegWege.every((e) => e.titleId >= 1000 && e.titleId < 1173), datei.belegWege?.length)
pruefe('das Gedächtnis `verweise` ist unverändert', JSON.stringify(datei.verweise) === JSON.stringify(gedaechtnis))
const kzJetzt = messe(jetztAlle)
pruefe('Kennzahl: protokolliert 1 → 174, netflix 0 → 173 (fest eingetragen)', kzVor.entferntProtokolliert === 1 && kzJetzt.entferntProtokolliert === 174 && kzJetzt.entferntJeAnbieter?.netflix === 173, [kzVor.entferntProtokolliert, kzJetzt.entferntProtokolliert, kzJetzt.entferntJeAnbieter])
const befund = findeAuffaelliges(kzJetzt, kzVor)
pruefe('Wache: die 60 Wege ohne Beleg bleiben „ohne protokollierten Grund weg“', befund.auffaellig.some((z) => /^60 Verweise ohne protokollierten Grund weg/.test(z)), befund)
pruefe('Wache: die 173 Wege mit Beleg tauchen dort nicht auf', !befund.auffaellig.some((z) => /^233 Verweise ohne/.test(z)), befund)
pruefe('Wache: Massenabgang ab 40 je Anbieter bleibt (netflix 173)', befund.auffaellig.some((z) => /^netflix: 173 Wege in einem Lauf entfernt/.test(z)), befund)
const nurBeleg = messe(jetztAlle.filter((t) => t.id < 2000 || t.id >= 5000).map((t) => t))
const nurBelegVor = messe(vorherAlle.filter((t) => t.id < 2000 || t.id >= 5000), { verweise: gedaechtnis })
pruefe('Wache: nur per Beleg gestrichen (ohne die 60): kein „ohne protokollierten Grund weg“', !findeAuffaelliges(nurBeleg, nurBelegVor).auffaellig.some((z) => /ohne protokollierten Grund/.test(z)), findeAuffaelliges(nurBeleg, nurBelegVor))

const vorLauf2 = readFileSync(join(kulisse, 'data', 'verweise-entfernt.json'), 'utf8')
merkeBestandVorher()
writeFileSync(join(kulisse, 'public', 'data', 'titles.json'), JSON.stringify(jetztAlle))
merkeBestandVorher()
lauf()
pruefe('zweiter Bau auf dem neuen Bestand: Datei byte-gleich, Wege bleiben protokolliert', readFileSync(join(kulisse, 'data', 'verweise-entfernt.json'), 'utf8') === vorLauf2 && lies().belegWege?.length === 173)

if (fehler > 0) {
  console.error(`check-beleg-wege-protokoll: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-beleg-wege-protokoll: ok (Beleg-Erkennung 17, Datei 5, Gesamtlauf 8)')
