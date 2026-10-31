/**
 * Zusicherung: Ein aniSearch-Eintrag, den sich mehrere Titel teilen (n:1), belegt keine Synchro für das einzelne Teil
 * (`lib/anisearch-sammeleintrag.ts`; Anlass Crown Handler 4–6, 31.10.2026). Läuft in `check:logic`.
 * Der Bauschritt läuft wirklich (`werteWeitereQuellenAus`) gegen eine Kulisse (`AK_ROOT`) mit erfundenen Kennungen ab 900001.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import { ohneBelegteSynchro } from './bau/synchro-belegt.ts'
import { type EigeneBelege, ohneSammelSynchro, sammeleintragTitel, synchroNurAusSammeleintrag } from './lib/anisearch-sammeleintrag.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'sammeleintrag-synchro-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* Crown Handler wörtlich: sechs Kapitel, ein aniSearch-Eintrag (13597); Kapitel 1 und 2 haben Ton, 3 bis 6 nicht (Daniel, 31.10.2026). */
const KAPITEL = [101595, 129759, 137612, 186716, 204584, 204585]
const BRUECKE = new Map<string, string>([...KAPITEL.map((id) => [String(id), '13597'] as [string, string]), ['135255', '17318']])

console.log('\nSammeleintrag: wer teilt sich einen aniSearch-Eintrag')
{
  const sammel = sammeleintragTitel(BRUECKE, [...KAPITEL, 135255])
  pruefe('alle sechs Crown-Handler-Kapitel stehen im Sammeleintrag', KAPITEL.every((id) => sammel.has(id)), [...sammel])
  pruefe('ein Titel allein an seinem Eintrag (135255) zählt nicht', !sammel.has(135255))
  pruefe('ein Eintrag mit genau zwei Titeln zählt (Grenze 2)', sammeleintragTitel(new Map([['1', 'A'], ['2', 'A']]), [1, 2]).size === 2)
  pruefe('ein Titel, der nicht im Bestand steht, zählt nicht mit (ein Rest von eins ist kein Sammeleintrag)', sammeleintragTitel(new Map([['1', 'A'], ['2', 'A']]), [1]).size === 0)
  pruefe('ein Titel ohne Brücke fällt nicht in einen Sammeleintrag', sammeleintragTitel(new Map([['1', 'A']]), [1, 2]).size === 0)
  pruefe('zwei getrennte Gruppen bleiben getrennt', sammeleintragTitel(new Map([['1', 'A'], ['2', 'B'], ['3', 'A'], ['4', 'B']]), [1, 2, 3, 4]).size === 4)
}

console.log('\nSammeleintrag: die Marke fällt, die Auskunft bleibt')
{
  const nurMarke = { zitat: 'aniSearch-Dub-Liste', synchro: true }
  const mitDatum = { zitat: '10.01.2021', synchro: true, teil: true, start: '2021-01-10', publisher: 'Verlag' }
  pruefe('im Sammeleintrag: nur die Marke → nichts bleibt übrig', ohneSammelSynchro(nurMarke, true) === undefined)
  pruefe('außerhalb des Sammeleintrags bleibt die Marke', ohneSammelSynchro(nurMarke, false)?.synchro === true)
  const rest = ohneSammelSynchro(mitDatum, true)
  pruefe('im Sammeleintrag: Datum und Verlag bleiben, Synchro und Teilmarke nicht', rest?.start === '2021-01-10' && rest.publisher === 'Verlag' && rest.synchro === undefined && rest.teil === undefined, rest)
  pruefe('im Sammeleintrag: nur ein Datum bleibt als Auskunft', ohneSammelSynchro({ zitat: 'x', synchro: true, start: '2021-01-10' }, true)?.start === '2021-01-10')
  pruefe('im Sammeleintrag: nur ein Zeitraum bleibt als Auskunft', ohneSammelSynchro({ zitat: 'x', synchro: true, zeitraum: '1997' }, true)?.zeitraum === '1997')
  pruefe('im Sammeleintrag: nur ein Verlag bleibt als Auskunft', ohneSammelSynchro({ zitat: 'x', synchro: true, publisher: 'KSM' }, true)?.publisher === 'KSM')
  pruefe('ohne Marke ändert sich nichts', ohneSammelSynchro({ zitat: 'x', start: '2021-01-10' }, true)?.start === '2021-01-10')
  pruefe('kein Termin bleibt kein Termin', ohneSammelSynchro(undefined, true) === undefined)
  pruefe('die Eingabe bleibt unverändert', mitDatum.synchro === true && mitDatum.teil === true)
}

const titel = (id: number): Title => ({ id, streams: [], titleRomaji: `Kulisse ${id}`, format: 'MOVIE', jpYear: 2021 }) as unknown as Title

console.log('\nSammeleintrag: der Bestandswächter findet Synchro nur aus der Marke')
{
  const keine = new Set<number>()
  const leer: EigeneBelege = { handbelegt: keine, kartei: keine, handErstausgabe: keine, tv: keine }
  const mitMarke = (id: number, extra: Partial<Title> = {}): Title => ({ ...titel(id), deErstausgabe: { synchro: true }, ...extra }) as Title
  const sammel = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const ids = (liste: Title[]) => liste.map((t) => t.id)
  pruefe('nur die Marke im Sammeleintrag: gefunden', ids(synchroNurAusSammeleintrag([mitMarke(1)], sammel, leer)).join() === '1')
  pruefe('außerhalb des Sammeleintrags: nicht gefunden', synchroNurAusSammeleintrag([mitMarke(99)], sammel, leer).length === 0)
  pruefe('ohne Synchro-Marke: nicht gefunden', synchroNurAusSammeleintrag([{ ...titel(1), deErstausgabe: { von: '2021-01-10' } } as Title], sammel, leer).length === 0)
  pruefe('Stream mit deutschem Ton: nicht gefunden', synchroNurAusSammeleintrag([mitMarke(1, { streams: [{ platform: 'netflix', url: 'x', dub: true }] as Title['streams'] })], sammel, leer).length === 0)
  pruefe('Stream ohne Ton (dub false): gefunden', synchroNurAusSammeleintrag([mitMarke(1, { streams: [{ platform: 'netflix', url: 'x', dub: false }] as Title['streams'] })], sammel, leer).length === 1)
  pruefe('deutsche Sprecher: nicht gefunden', synchroNurAusSammeleintrag([mitMarke(1, { hasVoices: true })], sammel, leer).length === 0)
  pruefe('Handlink mit Tonbereich: nicht gefunden', synchroNurAusSammeleintrag([mitMarke(1, { watchLinks: [{ name: 'x', url: 'y', kind: 'buy', dubRanges: [{ from: 1, to: 1, dub: true }] }] as Title['watchLinks'] })], sammel, leer).length === 0)
  pruefe('Handlink mit Bereich ohne Ton (dub false): gefunden', synchroNurAusSammeleintrag([mitMarke(1, { watchLinks: [{ name: 'x', url: 'y', kind: 'buy', dubRanges: [{ from: 1, to: 1, dub: false }] }] as Title['watchLinks'] })], sammel, leer).length === 1)
  pruefe('Disc-Erstausgabe: nicht gefunden', synchroNurAusSammeleintrag([mitMarke(1, { deErstausgabe: { synchro: true, quelle: 'disc' } })], sammel, leer).length === 0)
  const nur = (feld: keyof EigeneBelege): EigeneBelege => ({ ...leer, [feld]: new Set([1]) })
  for (const feld of ['handbelegt', 'kartei', 'handErstausgabe', 'tv'] as const) {
    pruefe(`Beleg „${feld}“: nicht gefunden`, synchroNurAusSammeleintrag([mitMarke(1)], sammel, nur(feld)).length === 0)
    pruefe(`Beleg „${feld}“ gilt nur dem eigenen Titel: der Nachbar (2) wird gefunden`, ids(synchroNurAusSammeleintrag([mitMarke(1), mitMarke(2)], sammel, nur(feld))).join() === '2')
  }
}

console.log('\nOhne belegte Synchro: Kapitel ohne Beleg gehören hinter den Schalter, auch ohne bekanntes Jahr')
{
  const ohneBeleg = (extra: Partial<Title>): Title => ({ id: 204584, streams: [], dubConfidence: 'low', format: 'MOVIE', ...extra }) as unknown as Title
  pruefe('Kapitel 5 (kein Jahr, Stufe low, kein Beleg): hinter dem Schalter', ohneBelegteSynchro(ohneBeleg({}), []) === true)
  pruefe('Kapitel 4 (2025): hinter dem Schalter', ohneBelegteSynchro(ohneBeleg({ jpYear: 2025 }), []) === true)
  pruefe('ab 2023 (Grenze): hinter dem Schalter', ohneBelegteSynchro(ohneBeleg({ jpYear: 2023 }), []) === true)
  pruefe('2022: davor, bleibt sichtbar', ohneBelegteSynchro(ohneBeleg({ jpYear: 2022 }), []) === false)
  pruefe('mit Stufe normal bleibt es sichtbar', ohneBelegteSynchro(ohneBeleg({ dubConfidence: 'normal' }), []) === false)
  pruefe('mit Synchro-Marke bleibt es sichtbar', ohneBelegteSynchro(ohneBeleg({ deErstausgabe: { synchro: true } }), []) === false)
}

console.log('\nSammeleintrag: der Bauschritt (werteWeitereQuellenAus) gegen die Kulisse')
try {
  /* 900001 und 900002 teilen den aniSearch-Eintrag 900100 (beide „vertont“), 900003 hat 900101 für sich. */
  schreibe('data/anisearch-ids-hand.yaml', '900001: 900100\n900002: 900100\n900003: 900101\n')
  schreibe('data/anisearch-dubs.json', JSON.stringify({ 900001: 'd', 900002: 'd', 900003: 'd' }))
  schreibe('data/anisearch.json', '{}')
  for (const leer of ['kino-ankuendigungen.yaml', 'ankuendigungen.yaml', 'offizielle-meldungen.yaml', 'folgen-hinweise.yaml']) schreibe(`data/${leer}`, '[]\n')
  const { werteWeitereQuellenAus } = await import('./bau/09-5-weitere-quellen.ts')
  const titles = new Map([900001, 900002, 900003].map((id) => [id, titel(id)]))
  const releases: Release[] = []
  const adnKatalog = { shows: [] } as never
  werteWeitereQuellenAus({ releases, titles, adnKatalog, adnVerweiseErgaenzt: 0, verweiseEntfernt: [], schreibWurzel: kulisse })
  pruefe('Teil eines Sammeleintrags (900001) bekommt keine Synchro aus der Marke', titles.get(900001)!.deErstausgabe?.synchro !== true, titles.get(900001)!.deErstausgabe)
  pruefe('Teil eines Sammeleintrags (900002) bekommt keine Synchro aus der Marke', titles.get(900002)!.deErstausgabe?.synchro !== true, titles.get(900002)!.deErstausgabe)
  pruefe('Kontrolle: ein Titel allein an seinem Eintrag (900003) behält die Synchro aus der Marke', titles.get(900003)!.deErstausgabe?.synchro === true, titles.get(900003)!.deErstausgabe)
} catch (e) {
  fehler++
  console.error(`  ✖ Bauschritt lief nicht: ${(e as Error).stack}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nOK — ${faelle} Fälle`)
