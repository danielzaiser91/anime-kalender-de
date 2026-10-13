/**
 * Zusicherungen zu `lib/tmdb-ablauf.ts`: TMDB-Inhalt wird nach 150 Tagen gestrichen, die Zuordnung bleibt (API-Bedingungen: höchstens 6 Monate).
 * Aufruf: `npm run check:logic`.
 */
import type { TmdbInfo } from './lib/tmdb.ts'
import { bilderAbzufragen, bilderFaellig, FRIST_TAGE, istAbgelaufen, tageSeit, tmdbJsonEintrag, tmdbJsonFaellig, inhaltsStand, streicheAbgelaufenes, type MitInhaltsstand } from './lib/tmdb-ablauf.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const jetzt = new Date('2026-10-12T12:00:00Z')
const vorTagen = (tage: number): string => new Date(jetzt.getTime() - tage * 86_400_000).toISOString()
type Eintrag = MitInhaltsstand & { tmdbId: number; kind: string; jahr: number; overviewDe?: string; offers?: unknown[] }
const eintrag = (stand: Partial<MitInhaltsstand>): Eintrag => ({ tmdbId: 7, kind: 'tv', jahr: 2020, overviewDe: 'Handlung', offers: [], ...stand })

console.log('\nTMDB-Ablauf: Alter')
pruefe('Alter in vollen Tagen', tageSeit(vorTagen(150), jetzt) === 150)
pruefe('ohne Datum ist das Alter unbekannt', tageSeit(undefined, jetzt) === undefined)
pruefe('inhaltAm gilt vor fetchedAt', inhaltsStand({ inhaltAm: 'a', fetchedAt: 'b' }) === 'a')
pruefe('ohne inhaltAm gilt fetchedAt', inhaltsStand({ fetchedAt: 'b' }) === 'b')

console.log('\nTMDB-Ablauf: Streichung')
const cache: Record<string, Eintrag> = {
  frisch: eintrag({ fetchedAt: vorTagen(10), inhaltAm: vorTagen(10) }),
  grenze: eintrag({ fetchedAt: vorTagen(150), inhaltAm: vorTagen(150) }),
  alt: eintrag({ fetchedAt: vorTagen(151), inhaltAm: vorTagen(151) }),
  /* Fehltreffer setzt fetchedAt neu, der Inhalt ist aber alt: inhaltAm entscheidet. */
  fehltreffer: eintrag({ fetchedAt: vorTagen(1), inhaltAm: vorTagen(200) }),
  ohneDatum: eintrag({}),
  ohneInhalt: { tmdbId: 8, kind: 'tv', jahr: 2021, fetchedAt: vorTagen(400) },
}
const gestrichen = streicheAbgelaufenes(cache, jetzt)
pruefe('gestrichen: nur Einträge mit altem oder unbekanntem Inhaltsstand', gestrichen.join() === 'alt,fehltreffer,ohneDatum', gestrichen)
pruefe('frisch und genau 150 Tage bleiben', Boolean(cache.frisch?.overviewDe) && Boolean(cache.grenze?.overviewDe))
pruefe('Handlung und Anbieter sind weg', cache.alt?.overviewDe === undefined && cache.alt?.offers === undefined)
pruefe('Zuordnung bleibt', cache.alt?.tmdbId === 7 && cache.alt?.kind === 'tv' && cache.alt?.jahr === 2020)
pruefe('ein Eintrag ohne Inhalt wird nicht angefasst', JSON.stringify(cache.ohneInhalt) === JSON.stringify({ tmdbId: 8, kind: 'tv', jahr: 2021, fetchedAt: vorTagen(400) }))

console.log('\nTMDB-Ablauf: Plakate und Hintergrundbilder (Abrufdatum je Eintrag)')
const tag = (tage: number): string => vorTagen(tage).slice(0, 10)
pruefe('150 Tage alt: noch nicht fällig', !istAbgelaufen(tag(150), jetzt))
pruefe('151 Tage alt: fällig', istAbgelaufen(tag(151), jetzt))
pruefe('ohne Datum: fällig', istAbgelaufen(undefined, jetzt))
const bilder = { frisch: { inhaltAm: tag(10) }, grenze: { inhaltAm: tag(150) }, alt: { inhaltAm: tag(151) }, aelter: { inhaltAm: tag(170) }, ohneDatum: {}, ohneZuordnung: { inhaltAm: tag(200) }, keins: null }
const faellig = bilderFaellig(bilder, (id) => id !== 'ohneZuordnung', jetzt)
pruefe('erneuert wird, was über 150 Tage alt oder undatiert ist, die Ältesten zuerst', faellig.erneuern.join() === 'ohneDatum,aelter,alt', faellig.erneuern)
pruefe('ohne Zuordnung wird der abgelaufene Eintrag entfernt', faellig.entfernen.join() === 'ohneZuordnung', faellig.entfernen)
pruefe('null („TMDB hat keins") wird nie angefasst', !faellig.erneuern.includes('keins') && !faellig.entfernen.includes('keins'))
const zuordnung = { alt: { tmdbId: 1, kind: 'tv' }, neu: { tmdbId: 2, kind: 'movie' }, ohneArt: { tmdbId: 3 } }
const abfrage = bilderAbzufragen(zuordnung, { alt: { inhaltAm: tag(151) } }, false, 10, jetzt)
pruefe('abgefragt wird: neuer Titel und abgelaufener Eintrag', abfrage.offen.map(([id]) => id).join() === 'neu,alt', abfrage.offen)

/* Altbestand wie am 13.10.2026: Plakate stammen von drei Tagen (2.007, 262, 72 Einträge am 07., 11., 12.10.); wöchentlicher Lauf mit Obergrenze. */
const TAG0 = Date.parse('2026-10-07T00:00:00Z')
const tagNach = (tage: number): string => new Date(TAG0 + tage * 86_400_000).toISOString().slice(0, 10)

/** [Tage nach dem 07.10.2026, Zahl der Plakate], Stand der Datei am 13.10.2026. */
const ALTBESTAND: [number, number][] = [
  [0, 2007],
  [4, 262],
  [5, 72],
]

/** Das höchste Alter, das ein Eintrag zu Beginn eines Laufs hat; `laufTage`: Tage seit dem 07.10.2026, `ausfall`: Nummern ausgefallener Läufe. */
function hoechstesAlter(laufTage: number[], ausfall: number[]): number {
  const stand: Record<string, { inhaltAm?: string }> = {}
  ALTBESTAND.forEach(([versatz, n], i) => {
    for (let k = 0; k < n; k++) stand[`${i}-${k}`] = { inhaltAm: tagNach(versatz) }
  })
  let hoechstes = 0
  laufTage.forEach((tage, lauf) => {
    const am = new Date(TAG0 + tage * 86_400_000)
    for (const e of Object.values(stand)) hoechstes = Math.max(hoechstes, tageSeit(e.inhaltAm, am) ?? Infinity)
    if (ausfall.includes(lauf)) return
    for (const id of bilderFaellig(stand, () => true, am).erneuern) stand[id] = { inhaltAm: tagNach(tage) }
  })
  return hoechstes
}
console.log('\nTMDB-Ablauf: Änderung wird spätestens nach 180 Tagen erneuert')
/* Erster Lauf am Tag 151 nach dem ersten Abruf (07.10.2026) oder bis zu sechs Tage später, dann im Wochentakt; mit und ohne ausgefallenen zweiten Lauf. */
for (const [versatz, ausfall] of [[0, []], [6, []], [0, [1]], [6, [1]]] as [number, number[]][]) {
  const laeufe = Array.from({ length: 5 }, (_, i) => 151 + versatz + i * 7)
  const alter = hoechstesAlter(laeufe, ausfall)
  pruefe(`Versatz ${versatz} Tage, ausgefallen: ${ausfall.join() || 'keiner'}: kein Eintrag beim Lauf über ${FRIST_TAGE} Tage`, alter <= FRIST_TAGE, alter)
}

console.log('\nTMDB-Ablauf: data/tmdb.json (FSK, Anbieter)')
const mitInhalt: TmdbInfo = { tmdbId: 5, fsk: 12, inhaltAm: tag(151) }
pruefe('fehlender Eintrag wird geholt', tmdbJsonFaellig(undefined, false, jetzt))
pruefe('Inhalt mit 150 Tagen: nicht fällig, mit 151: fällig', !tmdbJsonFaellig({ ...mitInhalt, inhaltAm: tag(150) }, false, jetzt) && tmdbJsonFaellig(mitInhalt, false, jetzt))
pruefe('Inhalt ohne Datum: fällig', tmdbJsonFaellig<TmdbInfo>({ tmdbId: 5, fsk: 12 }, false, jetzt))
pruefe('Eintrag ohne Inhalt bleibt liegen (auch uralt)', !tmdbJsonFaellig<TmdbInfo>({ tmdbId: 5, inhaltAm: tag(400) }, false, jetzt) && !tmdbJsonFaellig({}, false, jetzt))
pruefe('mit force immer', tmdbJsonFaellig({ ...mitInhalt, inhaltAm: tag(1) }, true, jetzt))
pruefe('neuer Inhalt bekommt den Tag des Abrufs', tmdbJsonEintrag<TmdbInfo>(mitInhalt, { tmdbId: 5, fsk: 16 }, jetzt)?.inhaltAm === jetzt.toISOString().slice(0, 10))
pruefe('Suche gescheitert: alter Eintrag bleibt (undefined)', tmdbJsonEintrag<TmdbInfo>(mitInhalt, {}, jetzt) === undefined)
pruefe('Treffer ohne Inhalt: kein Datum', tmdbJsonEintrag<TmdbInfo>(undefined, { tmdbId: 5 }, jetzt)?.inhaltAm === undefined)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Ablauf: alle Zusicherungen halten.')
