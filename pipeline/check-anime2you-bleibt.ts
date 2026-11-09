/**
 * Zusicherungen: ein Beleg mit der Artikel-Adresse (Handbeleg oder Anime2You-Automatik) verdrängt die Termine eines
 * Sammelartikels nicht (08.11.2026, Artikel 1066831 „25 Anime-Neuzugänge ab sofort auf Joyn verfügbar“, Termin 03.11.).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bleibtImVorrat, waehleVorrat, type VorratEintrag, type VorratKandidat } from './lib/anime2you-bleibt.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — ${String(gefunden)}`}`)
}

const HEUTE = '2026-11-09'
// Form des echten Eintrags aus data/proposals/anime2you.json (Stand 08.11.2026 18:01 UTC): keine Daten im Text, 25 Sammeleinträge vom 03.11.
const JOYN: VorratKandidat = {
  alreadyCurated: true,
  dates: [],
  sammel: [
    { titel: 'Akame ga KILL!', datum: '2026-11-03' },
    { titel: 'Clannad', datum: '2026-11-03' },
  ],
}
const alt = (p: VorratKandidat, heute: string): boolean =>
  p.dates.some((d) => (d.iso ?? `${d.month}-31`) >= heute) || !p.alreadyCurated || !!p.verschiebungen?.length || (p.sammel as { datum?: string }[] | undefined)?.some((e) => (e.datum ?? '') >= heute) === true

pruefe('Rot-Probe: die alte Bedingung warf den Joyn-Artikel raus', alt(JOYN, HEUTE) === false)
pruefe('Eingearbeiteter Sammelartikel mit vergangenem Termin bleibt', bleibtImVorrat(JOYN, HEUTE))
pruefe('… mit genau einem Sammeleintrag', bleibtImVorrat({ ...JOYN, sammel: [{ datum: '2026-11-03' }] }, HEUTE))
pruefe('Eingearbeitet ohne Sammeleintrag, ohne Zukunftsdatum: raus', !bleibtImVorrat({ ...JOYN, sammel: [] }, HEUTE))
pruefe('Eingearbeitet, Feld sammel fehlt: raus', !bleibtImVorrat({ alreadyCurated: true, dates: [] }, HEUTE))
pruefe('Nicht eingearbeitet: bleibt', bleibtImVorrat({ alreadyCurated: false, dates: [] }, HEUTE))
pruefe('Eingearbeitet, Datum heute: bleibt', bleibtImVorrat({ alreadyCurated: true, dates: [{ iso: HEUTE }] }, HEUTE))
pruefe('Eingearbeitet, Datum gestern: raus', !bleibtImVorrat({ alreadyCurated: true, dates: [{ iso: '2026-11-08' }] }, HEUTE))
pruefe('Eingearbeitet, nur Monat (ohne Tag) im laufenden Monat: bleibt', bleibtImVorrat({ alreadyCurated: true, dates: [{ month: '2026-11' }] }, HEUTE))
pruefe('Eingearbeitet mit Verschiebungen: bleibt', bleibtImVorrat({ alreadyCurated: true, dates: [], verschiebungen: [{}] }, HEUTE))

// waehleVorrat: dieselbe Funktion, die main() aufruft — Kuratiertes neu bewerten, Sprachhinweis verfallen lassen, Vorrat filtern.
const eintrag = (url: string, p: Partial<VorratEintrag>): VorratEintrag => ({ articleUrl: url, publishedAt: '2026-11-08', alreadyCurated: false, dates: [], ...p })
const verworfen: string[] = []
const gewaehlt = waehleVorrat(
  [
    eintrag('https://x/joyn/', { sammel: [{ datum: '2026-11-03' }] }),
    eintrag('https://x/leer/', {}),
    eintrag('https://x/hinweis-alt/', { hinweis: 'sprache', publishedAt: '2026-09-24', dates: [{ iso: '2026-12-01' }] }),
    eintrag('https://x/hinweis-grenze/', { hinweis: 'sprache', publishedAt: '2026-09-25', dates: [{ iso: '2026-12-01' }] }),
    eintrag('https://x/offen/', { dates: [{ iso: '2026-12-02' }] }),
  ],
  new Set(['https://x/joyn', 'https://x/leer']),
  HEUTE,
  45,
  (g) => void verworfen.push(g),
).map((p) => p.articleUrl)
pruefe('waehleVorrat: Kuratierter Sammelartikel bleibt (Adresse mit Schrägstrich, Menge ohne)', gewaehlt.includes('https://x/joyn/'))
pruefe('waehleVorrat: Kuratierter ohne Termine fliegt', !gewaehlt.includes('https://x/leer/'))
pruefe('waehleVorrat: Sprachhinweis 46 Tage alt fliegt, 45 Tage bleibt', !gewaehlt.includes('https://x/hinweis-alt/') && gewaehlt.includes('https://x/hinweis-grenze/'))
pruefe('waehleVorrat: Unkuratiertes bleibt', gewaehlt.includes('https://x/offen/'))
pruefe('waehleVorrat: Verfall wird mit Grund einmal gezählt', verworfen.length === 1 && verworfen[0] === 'Sprachhinweis älter als 45 Tage')

// Ganzer Lauf von scrape-anime2you.ts (Kulisse AK_ROOT, Attrappe): derselbe alte Sprachhinweis muss im Vorrat verworfen werden.
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/anime2you-abruf-mock.mjs')).href
const ak = mkdtempSync(join(tmpdir(), 'a2y-bleibt-'))
try {
  mkdirSync(join(ak, 'data/curated'), { recursive: true })
  writeFileSync(join(ak, 'data/curated/kulisse.yaml'), 'quellen:\n  - https://www.anime2you.de/anderer-artikel/\n')
  const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/scrape-anime2you.ts')], {
    cwd: ak,
    env: { ...process.env, AK_ROOT: ak, AK_A2Y_MODUS: 'sprachhinweis-alt', NODE_OPTIONS: `--import ${mock}` },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  pruefe('Lauf: Prozess endete mit Exit 0', r.status === 0, r.stderr)
  const datei = JSON.parse(readFileSync(join(ak, 'data/proposals/anime2you.json'), 'utf8')) as { proposals: unknown[]; verworfen: Record<string, number> }
  pruefe('Lauf: alter Sprachhinweis steht nicht im Vorrat', datei.proposals.length === 0)
  pruefe('Lauf: Verfall gezählt', datei.verworfen['Sprachhinweis älter als 45 Tage'] === 1)
} finally {
  rmSync(ak, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Vorrat (Sammelartikel bleibt trotz Beleg): alle Zusicherungen erfüllt')
