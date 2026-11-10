/**
 * Zusicherungen: `public/data/eingabe-stand.json` (nicht `meta.json`) trägt den Abrufzeitpunkt je Eingabe, ein Bau auf älteren Eingaben als der
 * vorige warnt (Warnung, kein Abbruch, als `::warning::` über `check-eingabe-stand-bestand.ts`), und jede Eingabe der Liste trägt ihr Feld in der
 * echten Datei. Fixtures sind die echten Köpfe vom 07.11.2026; der Bau-Schritt läuft gegen einen Wegwerf-Ordner (`AK_ROOT`).
 * Läuft in `check:logic`. Kein Netz, keine Uhr.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DataMeta, ReleaseEvent, Release, Title } from '../shared/types.ts'
import type { EingabeStandDatei } from './lib/eingabe-stand.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'eingabe-stand-'))
mkdirSync(join(wurzel, 'data', 'cache'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
const handDaten = join(import.meta.dirname, '..', 'data')
for (const datei of readdirSync(handDaten).filter((d) => d.endsWith('.yaml'))) copyFileSync(join(handDaten, datei), join(wurzel, 'data', datei))
cpSync(join(handDaten, 'curated'), join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { EINGABEN, leseEingabeStand, findeRueckschritte, baueEingabeStandDatei, rueckschrittZeile } = await import('./lib/eingabe-stand.ts')
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

/* 3. Datei-Inhalt und Warnzeile (reine Funktion, Eingabe von außen). */
function fange(f: () => void): string[] {
  const zeilen: string[] = []
  const orig = console.log
  console.log = (...a: unknown[]) => { zeilen.push(a.join(' ')) }
  try { f() } finally { console.log = orig }
  return zeilen
}
const lies = (d: string): unknown => dateien[dateiname(d)]
const d1 = baueEingabeStandDatei({ stand: { 'cr-katalog-de': '2026-09-10T00:00:00.000Z', motn: MOTN } }, lies)
pruefe('Datei: stand gesetzt', JSON.stringify(d1.stand) === JSON.stringify(stand), d1.stand)
pruefe('Datei: genau ein Rückschritt mit Datei, alt und neu', JSON.stringify(d1.zurueck) === JSON.stringify([{ eingabe: 'cr-katalog-de', alt: '2026-09-10T00:00:00.000Z', neu: CR }]), d1.zurueck)
pruefe('Datei: Zeile nennt Datei, alt und neu', rueckschrittZeile(d1.zurueck[0]!).includes('⚠ WARNUNG Eingabestand zurück: cr-katalog-de 2026-09-10T00:00:00.000Z → ' + CR))
pruefe('Datei: Gleichstand und Fortschritt ohne Rückschritt', baueEingabeStandDatei({ stand: { motn: MOTN, 'cr-katalog-de': '2026-09-01T00:00:00Z' } }, lies).zurueck.length === 0)
pruefe('Datei: ohne vorige Datei (null) ohne Rückschritt', baueEingabeStandDatei(null, lies).zurueck.length === 0)
pruefe('Datei: vorige Datei ohne stand ({}) ohne Rückschritt', baueEingabeStandDatei({}, lies).zurueck.length === 0)

/* 4. Verdrahtung im echten Bau-Schritt: alter Stand aus public/data/eingabe-stand.json, meta.json bleibt unberührt. */
for (const [datei, inhalt] of Object.entries(dateien)) writeFileSync(join(wurzel, 'data', datei === 'anilist-katalog.json' ? 'cache' : '', datei), JSON.stringify(inhalt))
writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), '[]')
const standPfad = join(wurzel, 'public', 'data', 'eingabe-stand.json')
function bauSchritt(vorige: object | undefined): { zeilen: string[]; datei: EingabeStandDatei; meta: Record<string, unknown> } {
  if (vorige) writeFileSync(standPfad, JSON.stringify(vorige))
  else rmSync(standPfad, { force: true })
  writeFileSync(join(wurzel, 'data', 'news-historie.json'), JSON.stringify({ zuerst: {} }))
  const meta = { generatedAt: '2026-11-07T18:30:06.887Z', titleCount: 0, releaseCount: 0, eventCount: 0 } as unknown as DataMeta
  const zeilen = fange(() => schreibeKernUndNews({ releases: [] as Release[], events: [] as ReleaseEvent[], titles: new Map<number, Title>(), meta, bekannteSeiten: new Map() }))
  return { zeilen, datei: JSON.parse(readFileSync(standPfad, 'utf8')) as EingabeStandDatei, meta: JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'meta.json'), 'utf8')) as Record<string, unknown> }
}
const ohne = bauSchritt(undefined)
pruefe('Bau: eingabe-stand.json trägt den Stand', JSON.stringify(ohne.datei.stand) === JSON.stringify(stand), ohne.datei.stand)
pruefe('Bau: meta.json bleibt ohne Eingabestand (Besucher laden sie)', !('eingabeStand' in ohne.meta) && Object.keys(ohne.meta).sort().join() === 'belegtCount,eventCount,generatedAt,releaseCount,titleCount', Object.keys(ohne.meta))
pruefe('Bau: ohne vorige Datei keine Warnung', !ohne.zeilen.some((z) => z.includes('Eingabestand zurück')) && ohne.datei.zurueck.length === 0, ohne.zeilen)
const gleich = bauSchritt(ohne.datei)
pruefe('Bau: zweiter Lauf mit gleichem Stand schweigt', !gleich.zeilen.some((z) => z.includes('Eingabestand zurück')) && gleich.datei.zurueck.length === 0, gleich.zeilen)
const rueck = bauSchritt({ stand: { ...stand, motn: '2026-11-07T10:00:00.000Z' }, zurueck: [] })
const warn = rueck.zeilen.filter((z) => z.includes('Eingabestand zurück'))
pruefe('Bau: Rückschritt warnt einmal, nennt Datei und beide Stände, bricht nicht ab', warn.length === 1 && warn[0]!.includes(`motn 2026-11-07T10:00:00.000Z → ${MOTN}`), rueck.zeilen)
pruefe('Bau: Rückschritt steht in der Datei und der neue Stand wird geschrieben', rueck.datei.zurueck.length === 1 && rueck.datei.stand.motn === MOTN, rueck.datei)
const nachRueck = bauSchritt(rueck.datei)
pruefe('Bau: nach dem Rückschritt-Lauf ist die Warnung weg (Datei trägt nur diesen Bau)', nachRueck.datei.zurueck.length === 0, nachRueck.datei)

/* 5. Bestandswache: dieselbe Zeile, die `bestand_warnungen` in tools/commit-data.sh (grep -F '⚠ WARNUNG', Text hinter '⚠ ') aufgreift. */
function wacheLauf(inhalt: object | string | undefined): { status: number | null; aus: string } {
  const dir = mkdtempSync(join(tmpdir(), 'eingabe-wache-'))
  mkdirSync(join(dir, 'public', 'data'), { recursive: true })
  if (inhalt !== undefined) writeFileSync(join(dir, 'public', 'data', 'eingabe-stand.json'), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(import.meta.dirname, 'check-eingabe-stand-bestand.ts'), dir], { encoding: 'utf8', windowsHide: true, timeout: 60000 })
  rmSync(dir, { recursive: true, force: true })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}
const annotation = (aus: string): string[] => aus.split('\n').filter((z) => z.includes('⚠ WARNUNG')).map((z) => `::warning::${z.slice(z.indexOf('⚠ ') + 2)}`)
const wRueck = wacheLauf(rueck.datei)
pruefe('Wache: Rückschritt → Exit 0 und genau eine ::warning::-Annotation mit Datei und Ständen', wRueck.status === 0 && annotation(wRueck.aus).length === 1 && annotation(wRueck.aus)[0]!.startsWith('::warning::WARNUNG Eingabestand zurück: motn ') && annotation(wRueck.aus)[0]!.includes(MOTN), wRueck)
const wGleich = wacheLauf(gleich.datei)
pruefe('Wache: kein Rückschritt → Exit 0, keine Annotation', wGleich.status === 0 && annotation(wGleich.aus).length === 0 && wGleich.aus.includes('VERSTÖSSE: 0'), wGleich)
const wFehlt = wacheLauf(undefined)
pruefe('Wache: Datei fehlt → Exit 0, Hinweis, keine Annotation', wFehlt.status === 0 && annotation(wFehlt.aus).length === 0 && wFehlt.aus.includes('fehlt'), wFehlt)
const wKaputt = wacheLauf('{kaputt')
pruefe('Wache: kaputte Datei → Warnung statt Rot (Exit 0, Annotation „nicht lesbar“)', wKaputt.status === 0 && annotation(wKaputt.aus).length === 1 && wKaputt.aus.includes('nicht lesbar'), wKaputt)
const wLeer = wacheLauf({ stand: {}, zurueck: [] })
pruefe('Wache: leerer Stand → Warnung, Exit 0', wLeer.status === 0 && annotation(wLeer.aus).length === 1, wLeer)
const wOhneListe = wacheLauf({ stand })
pruefe('Wache: ohne „zurueck“ → Warnung, Exit 0', wOhneListe.status === 0 && annotation(wOhneListe.aus).length === 1, wOhneListe)

/* 6. Echte Köpfe: jede Eingabe der Liste trägt ihr Feld als lesbaren Zeitstempel (die Fixtures oben sind Abbilder; hier zählt die Datei).
   Die Cache-Datei liegt nicht im Checkout der Kette: fehlt sie, steht eine Zeile „übersprungen“. */
const echtesRepo = join(import.meta.dirname, '..')
for (const { datei, feld } of EINGABEN) {
  const pfad = join(echtesRepo, datei)
  if (!existsSync(pfad) && datei.includes('/cache/')) {
    console.log(`Köpfe: ${datei} übersprungen (Cache liegt nicht im Checkout)`)
    continue
  }
  pruefe(`Kopf: ${datei} liegt im Checkout`, existsSync(pfad))
  if (!existsSync(pfad)) continue
  const wert = (JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>)[feld]
  pruefe(`Kopf: ${datei} trägt ${feld} als ISO-Zeitstempel`, typeof wert === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(wert) && !Number.isNaN(Date.parse(wert)), wert)
}

rmSync(wurzel, { recursive: true, force: true })
console.log(`check-eingabe-stand: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
