/**
 * Verdrahtung (15.11.2026): `check-qualitaet.ts` läuft als Prozess gegen eine Kulisse (`AK_ROOT`) und warnt, wenn die Titel mit
 * Streaming-Weg gegenüber dem letzten Verlaufswert um mehr als 1 % sinken; ohne Rückgang bleibt die Warnung aus.
 * Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RUECKGANG_ZEILE, VERLAUF_DATEI } from './lib/streaming-rueckgang.ts'
import { ERSTAUSGABE_OHNE_WEG_ZEILE } from './lib/erstausgabe-ohne-weg.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const stream = { name: 'Amazon', url: 'https://www.amazon.de/gp/video/detail/B0KULISSE1', kind: 'stream' }
/* Zwei Titel mit Streaming-Weg: einmal über streams, einmal über watchLinks. */
const titel = [
  { id: 900001, titleRomaji: 'A', format: 'TV', episodes: 12, streams: [{ platform: 'netflix', url: 'https://x.invalid/1', dub: true }] },
  { id: 900002, titleRomaji: 'B', format: 'TV', episodes: 12, streams: [], watchLinks: [stream] },
]

/* Gaiden-Form: Erstausgabe als Synchro, kein Stream, kein Verweis — dazu ein Titel mit Verweis und einer ohne Erstausgabe. */
const erst = { von: '2019-07-12', publisher: 'Universum Anime', synchro: true }
const titelMitErstausgabe = [
  ...titel,
  { id: 900003, titleRomaji: 'C', format: 'MOVIE', episodes: 1, streams: [], deErstausgabe: erst },
  { id: 900004, titleRomaji: 'D', format: 'MOVIE', episodes: 1, streams: [], deErstausgabe: erst, watchLinks: [stream] },
  { id: 900005, titleRomaji: 'E', format: 'MOVIE', episodes: 1, streams: [] },
]

function lauf(vorherWert: number, vorherErstausgabe?: number, titelListe: unknown[] = titel, termine: unknown[] = []): string {
  const ak = mkdtempSync(join(tmpdir(), 'qualitaet-rueckgang-'))
  try {
    mkdirSync(join(ak, 'public', 'data'), { recursive: true })
    mkdirSync(join(ak, 'data'), { recursive: true })
    writeFileSync(join(ak, 'public', 'data', 'titles.json'), JSON.stringify(titelListe))
    writeFileSync(join(ak, 'public', 'data', 'events.json'), '[]')
    writeFileSync(join(ak, 'public', 'data', 'releases.json'), JSON.stringify(termine))
    writeFileSync(join(ak, VERLAUF_DATEI), JSON.stringify([{ gemessenAm: '2000-01-01', mitStreamingWeg: vorherWert, ...(vorherErstausgabe === undefined ? {} : { erstausgabeOhneWeg: vorherErstausgabe }) }]))
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-qualitaet.ts')], {
      env: { ...process.env, AK_ROOT: ak },
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
    })
    if (r.status !== 0) throw new Error(`Exit ${r.status}: ${r.stderr}`)
    return `${r.stdout}${r.stderr}`
  } finally {
    rmSync(ak, { recursive: true, force: true })
  }
}

const mit = lauf(3)
pruefe('Rückgang 3 → 2 meldet im Lauf die Zeile', mit.includes(`${RUECKGANG_ZEILE}mitStreamingWeg: 3 → 2`), mit)
const ohne = lauf(2)
pruefe('gleicher Wert meldet im Lauf die Zeile nicht', !ohne.includes(RUECKGANG_ZEILE), ohne)

/* Erstausgabe bekannt, kein Weg: gezählt wird genau Titel C (D hat einen Verweis, E keine Erstausgabe). */
const anstieg = lauf(3, 0, titelMitErstausgabe)
pruefe('Anstieg 0 → 1 meldet im Lauf die Zeile', anstieg.includes(`${ERSTAUSGABE_OHNE_WEG_ZEILE}erstausgabeOhneWeg: 0 → 1 (+1)`), anstieg)
pruefe('der Verlauf trägt die Kennzahl für den nächsten Lauf (Protokollzeile nennt 1)', anstieg.includes('1 Erstausgabe bekannt, kein Weg (+1)'), anstieg)
const gleichGeblieben = lauf(3, 1, titelMitErstausgabe)
pruefe('gleicher Wert meldet die Zeile nicht', !gleichGeblieben.includes(ERSTAUSGABE_OHNE_WEG_ZEILE), gleichGeblieben)
const ohneVorwert = lauf(3, undefined, titelMitErstausgabe)
pruefe('ältere Verlaufszeile ohne Feld meldet die Zeile nicht', !ohneVorwert.includes(ERSTAUSGABE_OHNE_WEG_ZEILE), ohneVorwert)

/* Disc-Termin als Weg (16.11.2026): Titel C mit Disc-Termin zählt nicht mehr, mit Kino-Termin weiter. */
const mitDisc = lauf(3, 1, titelMitErstausgabe, [{ titleId: 900003, releaseType: 'disc' }])
pruefe('Titel mit Disc-Termin zählt nicht als „kein Weg“ (Verlauf 1 → 0)', mitDisc.includes('0 Erstausgabe bekannt, kein Weg'), mitDisc)
const mitKino = lauf(3, 0, titelMitErstausgabe, [{ titleId: 900003, releaseType: 'kino' }])
pruefe('Titel mit Kino-Termin zählt weiter (Anstieg 0 → 1)', mitKino.includes(`${ERSTAUSGABE_OHNE_WEG_ZEILE}erstausgabeOhneWeg: 0 → 1 (+1)`), mitKino)

if (verletzt) process.exit(1)
console.log('check-qualitaet-rueckgang-lauf: 8 Fälle grün')
