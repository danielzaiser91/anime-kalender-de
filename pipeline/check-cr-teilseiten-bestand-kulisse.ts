/**
 * Zusicherung: die Bestandsprüfung `check-cr-teilseiten-bestand.ts` urteilt über Bereiche ohne Folgenzahl nach dem Katalog
 * (Reincarnated Aristocrat S3, 20.10.2026). Läuft als eigener Prozess gegen eine Kulisse unter `os.tmpdir()` (`AK_ROOT`, Arbeitsordner),
 * nie gegen das Repo; die Titel tragen Kennungen ab 900000.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-cr-teilseiten-bestand-kulisse.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL_S = 'https://www.crunchyroll.com/de/series/GKULISSE/k'
const PRUEFER = fileURLToPath(new URL('./check-cr-teilseiten-bestand.ts', import.meta.url))

/** Staffel 3 hat keine Folgenzahl; der Katalog führt für sie nur Folge 1 deutsch. Staffel 1 und 2 tragen die Folgenzahl 12. */
function titel(bereich: { from: number; to: number }[] | undefined, folgenS3: number | null): unknown[] {
  const stream = (dubRanges?: unknown) => ({ platform: 'crunchyroll', url: URL_S, dub: true, sharedWith: 3, dubRanges })
  const teil = (id: number, titleDe: string, jpYear: number, episodes: number | null, streams: unknown[]) =>
    ({ id, franchiseId: 900001, format: 'TV', titleDe, jpYear, episodes: episodes ?? undefined, streams })
  return [
    teil(900001, 'K', 2023, 12, []),
    teil(900002, 'K: Staffel 2', 2024, 12, []),
    teil(900003, 'K: Staffel 3', 2026, folgenS3, [stream(bereich?.map((b) => ({ ...b, dub: true })))]),
  ]
}

function katalog(): unknown {
  const deutscheFolgen = [{ nummer: 1, guid: 'G1', verfuegbarAb: '2026-10-18T15:00:00Z' }]
  const staffeln = [{ name: 'Staffel 3', folgen: 4, kacheln: 4, deutsch: 1, fremd: 0, deutscheFolgen }]
  return { scrapedAt: '', serien: [{ url: URL_S, katalog: 'de', geprueftAm: '2026-10-19', staffeln }] }
}

function lauf(wurzel: string, titles: unknown[], pruefliste: unknown[]): { status: number | null; aus: string } {
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titles))
  writeFileSync(join(wurzel, 'data', 'crunchyroll-dub.json'), JSON.stringify(katalog()))
  writeFileSync(join(wurzel, 'data', 'cr-teilseiten-pruefliste.json'), JSON.stringify(pruefliste))
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), PRUEFER], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    env: { ...process.env, AK_ROOT: wurzel },
  })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}

console.log('\nBestandsprüfung geteilter Crunchyroll-Seiten gegen eine Kulisse:')
const wurzel = mkdtempSync(join(tmpdir(), 'cr-teilseiten-bestand-'))
try {
  const eintrag = { titleId: 900003, titel: 'K', url: URL_S, grund: 'g' }
  const gut = lauf(wurzel, titel([{ from: 1, to: 1 }], null), [])
  pruefe('Folgenzahl offen, Bereich 1-1 auf der belegten Folge: grün', gut.status === 0, gut.aus)
  const zuweit = lauf(wurzel, titel([{ from: 1, to: 2 }], null), [])
  pruefe('Folgenzahl offen, Bereich 1-2 (Folge 2 unbelegt): rot', zuweit.status === 1 && zuweit.aus.includes('900003'), zuweit.aus)
  const luecke = lauf(wurzel, titel([{ from: 2, to: 2 }], null), [])
  pruefe('Folgenzahl offen, Bereich 2-2 (unbelegt): rot', luecke.status === 1, luecke.aus)
  const mitZahl = lauf(wurzel, titel([{ from: 1, to: 12 }], 12), [])
  pruefe('Folgenzahl 12, Bereich 1-12: grün (Katalog zählt dort nicht)', mitZahl.status === 0, mitZahl.aus)
  const ueberZahl = lauf(wurzel, titel([{ from: 1, to: 13 }], 12), [])
  pruefe('Folgenzahl 12, Bereich 1-13: rot', ueberZahl.status === 1, ueberZahl.aus)
  const andere = lauf(wurzel, titel([{ from: 1, to: 1 }], null), [{ ...eintrag, titleId: 900002 }, { ...eintrag, url: `${URL_S}/andere` }])
  pruefe('Bereich, Prüfliste nennt anderen Titel bzw. andere Adresse: grün', andere.status === 0, andere.aus)
  const beides =lauf(wurzel, titel([{ from: 1, to: 1 }], null), [eintrag])
  pruefe('Bereich und Prüfliste zugleich: rot', beides.status === 1 && beides.aus.includes('Prüfliste'), beides.aus)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nBestandsprüfung geteilter Crunchyroll-Seiten (Kulisse): alle Prüfungen bestanden')
