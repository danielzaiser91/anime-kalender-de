/**
 * Zusicherungen: `meta.json` trägt den Abrufzeitpunkt je Eingabe (`eingabeStand`), und ein Bau auf älteren Eingaben als der vorige warnt
 * (Warnung, kein Abbruch). Fixtures sind die echten Köpfe der Dateien vom 07.11.2026; der Bau-Schritt läuft gegen einen Wegwerf-Ordner (`AK_ROOT`).
 * Läuft in `check:logic`. Kein Netz, keine Uhr.
 */
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DataMeta, ReleaseEvent, Release, Title } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'eingabe-stand-'))
mkdirSync(join(wurzel, 'data', 'cache'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
const handDaten = join(import.meta.dirname, '..', 'data')
for (const datei of readdirSync(handDaten).filter((d) => d.endsWith('.yaml'))) copyFileSync(join(handDaten, datei), join(wurzel, 'data', datei))
cpSync(join(handDaten, 'curated'), join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { EINGABEN, leseEingabeStand, findeRueckschritte, vermerkeEingabeStand } = await import('./lib/eingabe-stand.ts')
const { schreibeKernUndNews } = await import('./bau/13-5-kerndateien.ts')

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

/* Köpfe wörtlich aus den Dateien (07.11.2026). */
const CR = '2026-09-09T17:26:33.450Z'
const CRUNCHY = '2026-10-21T20:02:22.931Z'
const MOTN = '2026-11-07T04:03:57.029Z'
const IDS = '2026-11-06T04:01:49.607Z'
const ANILIST = '2026-09-03T21:20:13.528Z'
const TV = '2026-11-07T15:03:33.472Z'
const dateien: Record<string, unknown> = {
  'cr-katalog-de.json': { geholtAm: CR, katalog: [] },
  'crunchyroll.json': { scrapedAt: CRUNCHY },
  'motn.json': { fetchedAt: MOTN },
  'anime-ids.json': { updatedAt: IDS },
  'anilist-katalog.json': { geholtAm: ANILIST },
  'tv-programm.json': { geholtAm: TV },
}
const dateiname = (pfad: string): string => pfad.split('/').pop() ?? ''
const stand = leseEingabeStand((d) => dateien[dateiname(d)])
const erwartet = {
  'cache/anilist-katalog': ANILIST,
  'anime-ids': IDS,
  'cr-katalog-de': CR,
  crunchyroll: CRUNCHY,
  motn: MOTN,
  'tv-programm': TV,
}

/* 1. Lesen: nur vorhandene Zeitstempel, Schlüssel = Dateiname ohne Ordner `data/` und ohne `.json`. */
pruefe('Stand: genau die sechs vorhandenen Zeitstempel', JSON.stringify(stand) === JSON.stringify(erwartet), stand)
pruefe('Stand: Datei fehlt → Eintrag fehlt', stand['toggo'] === undefined && Object.keys(leseEingabeStand(() => undefined)).length === 0)
pruefe('Stand: null (Datei fehlt im Bau) → leer', Object.keys(leseEingabeStand(() => null)).length === 0)
pruefe('Stand: Feld fehlt → kein Eintrag', Object.keys(leseEingabeStand((d) => (dateiname(d) === 'motn.json' ? { geholtAm: MOTN } : undefined))).length === 0)
pruefe('Stand: Zahl statt Text → kein Eintrag', Object.keys(leseEingabeStand((d) => (dateiname(d) === 'motn.json' ? { fetchedAt: 2026 } : undefined))).length === 0)
pruefe('Stand: kein Datum → kein Eintrag', Object.keys(leseEingabeStand((d) => (dateiname(d) === 'motn.json' ? { fetchedAt: 'gestern' } : undefined))).length === 0)
pruefe('Stand: Liste statt Objekt (Eingabe ohne Kopf) → kein Eintrag', Object.keys(leseEingabeStand(() => [])).length === 0)
pruefe('Liste: 19 Eingaben, keine doppelt', EINGABEN.length === 19 && new Set(EINGABEN.map((e) => e.datei)).size === 19, EINGABEN.length)
const feldVon = (name: string): string | undefined => EINGABEN.find((e) => dateiname(e.datei) === name)?.feld
pruefe('Liste: Felder wie in den Dateien', feldVon('adn.json') === 'scrapedAt' && feldVon('anime-ids.json') === 'updatedAt' && feldVon('motn-changes.json') === 'fetchedAt')

/* 2. Rückschritt: nur ein älterer Stand, je Eintrag einzeln. */
const spaeter = { ...stand, motn: '2026-11-07T10:00:00.000Z' }
pruefe('Rückschritt: motn älter → genau ein Befund mit alt und neu', JSON.stringify(findeRueckschritte(spaeter, stand)) === JSON.stringify([{ eingabe: 'motn', alt: '2026-11-07T10:00:00.000Z', neu: MOTN }]), findeRueckschritte(spaeter, stand))
pruefe('Gleichstand: kein Befund', findeRueckschritte(stand, { ...stand }).length === 0)
pruefe('Fortschritt: kein Befund', findeRueckschritte(stand, { ...stand, motn: '2026-11-07T10:00:00.000Z' }).length === 0)
pruefe('Vorige Datei fehlt (undefined): kein Befund', findeRueckschritte(undefined, stand).length === 0)
pruefe('Vorige meta.json ohne eingabeStand ({}): kein Befund', findeRueckschritte({}, stand).length === 0)
pruefe('Neuer Eintrag ohne Vorgänger: kein Befund', findeRueckschritte({ motn: MOTN }, stand).length === 0)
pruefe('Eintrag im neuen Stand weg: kein Befund', findeRueckschritte(stand, { motn: MOTN }).length === 0)
pruefe('Eine Millisekunde zurück zählt', findeRueckschritte({ motn: '2026-11-07T04:03:57.029Z' }, { motn: '2026-11-07T04:03:57.028Z' }).length === 1)
pruefe('Andere Schreibweise desselben Augenblicks: kein Befund', findeRueckschritte({ motn: '2026-11-07T04:03:57.000Z' }, { motn: '2026-11-07T04:03:57Z' }).length === 0)
pruefe('Derselbe Augenblick, Millisekunden neu angehängt: kein Befund', findeRueckschritte({ motn: '2026-11-07T04:03:57Z' }, { motn: '2026-11-07T04:03:57.000Z' }).length === 0)
const zwei = findeRueckschritte({ motn: MOTN, 'cr-katalog-de': CR, crunchyroll: CRUNCHY }, { motn: '2026-11-01T00:00:00Z', 'cr-katalog-de': '2026-09-01T00:00:00Z', crunchyroll: CRUNCHY })
pruefe('Zwei Rückschritte: beide, der dritte Eintrag nicht', zwei.map((r) => r.eingabe).join() === 'motn,cr-katalog-de', zwei)

/* 3. Warnzeile und Setzen (reine Funktion, Eingabe von außen). */
function fange(f: () => void): string[] {
  const zeilen: string[] = []
  const orig = console.log
  console.log = (...a: unknown[]) => { zeilen.push(a.join(' ')) }
  try { f() } finally { console.log = orig }
  return zeilen
}
const leereMeta = (): DataMeta => ({ generatedAt: '2026-11-07T18:30:06.887Z', titleCount: 0, releaseCount: 0, eventCount: 0 } as unknown as DataMeta)
const m1 = leereMeta()
const zeilen1 = fange(() => vermerkeEingabeStand(m1, { eingabeStand: { 'cr-katalog-de': '2026-09-10T00:00:00.000Z', motn: MOTN } }, (d) => dateien[dateiname(d)]))
pruefe('Vermerk: meta.eingabeStand gesetzt', JSON.stringify(m1.eingabeStand) === JSON.stringify(stand), m1.eingabeStand)
pruefe('Vermerk: genau eine Warnzeile mit Datei, alt und neu', zeilen1.filter((z) => z.includes('⚠ WARNUNG')).length === 1 && zeilen1.some((z) => z.includes('cr-katalog-de 2026-09-10T00:00:00.000Z → ' + CR)), zeilen1)
pruefe('Vermerk: Gleichstand und Fortschritt schweigen', fange(() => vermerkeEingabeStand(leereMeta(), { eingabeStand: { motn: MOTN, 'cr-katalog-de': '2026-09-01T00:00:00Z' } }, (d) => dateien[dateiname(d)])).length === 0)
pruefe('Vermerk: ohne vorigen Stand schweigt', fange(() => vermerkeEingabeStand(leereMeta(), {}, (d) => dateien[dateiname(d)])).length === 0)

/* 4. Verdrahtung im echten Bau-Schritt: alter Stand aus public/data/meta.json, neuer Stand in der geschriebenen Datei. */
for (const [datei, inhalt] of Object.entries(dateien)) writeFileSync(join(wurzel, 'data', datei === 'anilist-katalog.json' ? 'cache' : '', datei), JSON.stringify(inhalt))
writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), '[]')
function bauSchritt(vorige: DataMeta | undefined): { zeilen: string[]; meta: DataMeta } {
  const pfad = join(wurzel, 'public', 'data', 'meta.json')
  if (vorige) writeFileSync(pfad, JSON.stringify(vorige))
  else rmSync(pfad, { force: true })
  writeFileSync(join(wurzel, 'data', 'news-historie.json'), JSON.stringify({ zuerst: {} }))
  const zeilen = fange(() => schreibeKernUndNews({ releases: [] as Release[], events: [] as ReleaseEvent[], titles: new Map<number, Title>(), meta: leereMeta(), bekannteSeiten: new Map() }))
  return { zeilen, meta: JSON.parse(readFileSync(pfad, 'utf8')) as DataMeta }
}
const ohne = bauSchritt(undefined)
pruefe('Bau: meta.json trägt den Eingabestand', JSON.stringify(ohne.meta.eingabeStand) === JSON.stringify(stand), ohne.meta.eingabeStand)
pruefe('Bau: ohne vorige meta.json keine Warnung', !ohne.zeilen.some((z) => z.includes('Eingabestand zurück')), ohne.zeilen)
const gleich = bauSchritt(ohne.meta)
pruefe('Bau: zweiter Lauf mit gleichem Stand schweigt', !gleich.zeilen.some((z) => z.includes('Eingabestand zurück')), gleich.zeilen)
const rueck = bauSchritt({ ...leereMeta(), eingabeStand: { ...stand, motn: '2026-11-07T10:00:00.000Z' } })
const warn = rueck.zeilen.filter((z) => z.includes('Eingabestand zurück'))
pruefe('Bau: Rückschritt warnt einmal, nennt Datei und beide Stände, bricht nicht ab', warn.length === 1 && warn[0]!.includes(`motn 2026-11-07T10:00:00.000Z → ${MOTN}`), rueck.zeilen)
pruefe('Bau: Rückschritt schreibt trotzdem den neuen Stand', rueck.meta.eingabeStand?.motn === MOTN, rueck.meta.eingabeStand)

rmSync(wurzel, { recursive: true, force: true })
console.log(`check-eingabe-stand: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
