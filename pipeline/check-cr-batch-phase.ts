/**
 * Läuft die Bau-Phase `legeCrVerweiseUndTermineAn` (`bau/09-4-4-termine.ts`) wirklich, in einem leeren Wegwerf-Ordner (`AK_ROOT`), und prüft,
 * was sie an Crunchyroll-Terminen anlegt: Aoashi Staffel 2 (26.10.2026; Block, Titel und Zeitstempel wörtlich aus `data/crunchyroll-dub.json`).
 * Damit steht die Herkunftszeile, die `check-cr-batch-bestand.ts` liest, nicht nur im Round-Trip der Hilfsfunktion, sondern am Ergebnis des Baus.
 * Aufruf: npx tsx pipeline/check-cr-batch-phase.ts
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cr-batch-phase-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { legeCrVerweiseUndTermineAn } = await import('./bau/09-4-4-termine.ts')
const { batchUeberBelegt, belegteFolgen } = await import('./lib/cr-batch-wache.ts')
const { expandEvents } = await import('../shared/logic.ts')

const AO = 'https://www.crunchyroll.com/de/aoashi'
const titel = { id: 191788, titleEn: 'Aoashi Season 2', jpYear: 2026, episodes: 24, format: 'TV', streams: [{ platform: 'crunchyroll', url: AO, dub: true }] }
const folge = (nummer: number, verfuegbarAb: string) => ({ nummer, guid: `g${nummer}`, verfuegbarAb })

/** Die Phase mit einem Block „Staffel 2“ und diesen deutschen Folgen; zurück kommen die angelegten Releases. */
function lauf(folgen: ReturnType<typeof folge>[]) {
  const serie = { url: AO, katalog: 'de', staffeln: [{ name: 'Staffel 2', deutsch: folgen.length, folgen: 4, deutscheFolgen: folgen }] }
  const releases: never[] = []
  const log = console.log
  console.log = () => undefined
  try {
    legeCrVerweiseUndTermineAn({
      titles: new Map([[191788, titel as never]]),
      anisearch: {},
      belegt: 0,
      crDub: { serien: [serie] } as never,
      verschwunden: 0,
      usNeinOffen: 0,
      nachUrl: new Map([[AO, [titel as never]]]),
      releases,
    })
  } finally {
    console.log = log
  }
  return releases as unknown as import('../shared/types.ts').Release[]
}

try {
  const eine = lauf([folge(1, '2026-10-25T09:00:00Z')])
  pruefe('Aoashi S2 mit einer Folge: ein Termin, Wochenstart statt Abwurf', eine.length === 1 && eine[0]?.releaseType === 'weekly' && eine[0]?.dateMeaning === undefined, eine)
  pruefe('Aoashi S2 mit einer Folge: die Herkunft nennt 1 belegte Folge, die Werkszahl bleibt Erwartung', belegteFolgen(eine[0]?.herkunft) === 1 && eine[0]?.schedule?.episodeCount === 24, eine[0])

  const zwei = lauf([folge(1, '2026-10-25T09:00:00Z'), folge(2, '2026-10-25T09:00:00Z')])
  const z = zwei[0]
  pruefe('Aoashi S2 mit zwei Folgen am Starttag: Abwurf, aber nur die zwei belegten Folgen und kein Ende', z?.releaseType === 'batch' && z?.schedule?.episodeCount === 2 && z?.schedule?.lastEpisodeDate === undefined, z)
  pruefe('Aoashi S2 mit zwei Folgen: die Herkunft nennt 2 Folgen, die Wache meldet nichts', belegteFolgen(z?.herkunft) === 2 && batchUeberBelegt(zwei).length === 0, z?.herkunft)
  pruefe('Aoashi S2 mit zwei Folgen: der Termin ist ein einziger Tag, ohne Fortschreibung', expandEvents(z!).length === 1, expandEvents(z!).map((e) => e.date))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
