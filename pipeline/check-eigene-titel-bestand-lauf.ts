/**
 * Prozesstest zu `check-eigene-titel-bestand.ts`: der Wächter läuft als eigener Prozess gegen eine Wegwerf-Wurzel. Rot (Exit 1, Verstoßzeile): ein
 * eigener Titel fehlt im Hauptbestand oder steht hinter dem Schalter bzw. nach `zuId`/Widerruf noch da. Warnung (Exit 0): der Katalog führt den
 * Titel jetzt, oder die Meldung hat keinen Termin ergeben. Dazu die Bewertung selbst mit Fremdtitel. Aufruf: npx tsx pipeline/check-eigene-titel-bestand-lauf.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pruefeEigeneImBestand } from './bau/eigene-titel-bestand.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const repo = fileURLToPath(new URL('..', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'eigene-bestand-'))
mkdirSync(join(wurzel, 'data'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
const ID = 5_000_000 + 910001
const zeile = (extra: string[] = []) => ['- nr: 910001', '  name: Fixture Eins', '  format: MOVIE', '  anbieter: [joyn]', '  tag: 2999-01-02', '  sources: [https://example.org/a]', '  zitat: "Z"', ...extra].join('\n')
const schreibe = (pfad: string, inhalt: string): void => writeFileSync(join(wurzel, pfad), inhalt)
const json = (pfad: string, inhalt: unknown): void => schreibe(pfad, JSON.stringify(inhalt))

function lauf(yaml: string, haupt: unknown[], hinter: unknown[], releases: unknown[]): { status: number | null; ausgabe: string } {
  schreibe('data/eigene-titel.yaml', yaml)
  json('public/data/titles.json', haupt)
  json('public/data/ohne-synchro.json', hinter)
  json('public/data/releases.json', releases)
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-eigene-titel-bestand.ts'), wurzel], { encoding: 'utf8', timeout: 120_000, windowsHide: true })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}
const eigener = { id: ID, titleDe: 'Fixture Eins', format: 'MOVIE', coverImage: 'https://example.org/cover.jpg' }
const termin = { titleId: ID, platform: 'joyn' }

try {
  const gut = lauf(zeile(), [eigener, { id: 42, titleDe: 'Fremd', format: 'TV' }], [], [termin])
  pruefe('alles da: Exit 0, Ergebniszeile mit Zählern, keine Warnung', gut.status === 0 && gut.ausgabe.includes('✓ Eigene Titel: 1 Zeilen, 0 Warnungen') && gut.ausgabe.includes('VERSTÖSSE: 0') && !gut.ausgabe.includes('⚠ WARNUNG'), gut.ausgabe)
  const fehlt = lauf(zeile(), [{ id: 42, titleDe: 'Fremd', format: 'TV' }], [], [])
  pruefe('Titel fehlt: Exit 1, Zeile und Verstoßzähler', fehlt.status === 1 && fehlt.ausgabe.includes('nicht in der Ausgabe') && fehlt.ausgabe.includes('VERSTÖSSE: 1') && !fehlt.ausgabe.includes('QUARANTAENE '), fehlt.ausgabe)
  const hinter = lauf(zeile(), [], [eigener], [termin])
  pruefe('Titel hinter dem Schalter: Exit 1', hinter.status === 1 && hinter.ausgabe.includes('hinter dem Schalter') && hinter.ausgabe.includes(`QUARANTAENE {"titleId":${ID},"pruefung":"eigene-titel"`), hinter.ausgabe)
  const katalog = lauf(zeile(), [eigener, { id: 77, titleDe: 'Fixture Eins', format: 'MOVIE' }], [], [termin])
  pruefe('Katalog führt jetzt X: Exit 0 mit Warnzeile samt zuId-Hinweis', katalog.status === 0 && katalog.ausgabe.includes('⚠ WARNUNG Eigene Titel: Katalog führt jetzt „Fixture Eins“ (Titel 77)') && katalog.ausgabe.includes('zuId: 77'), katalog.ausgabe)
  const ohneTermin = lauf(zeile(), [eigener], [], [{ titleId: ID, platform: 'netflix' }, { titleId: 42, platform: 'joyn' }])
  pruefe('Termin nur beim falschen Anbieter oder an fremdem Titel: Exit 0 mit Warnung', ohneTermin.status === 0 && ohneTermin.ausgabe.includes('keinen Termin bei joyn'), ohneTermin.ausgabe)
  const umgezogen = lauf(zeile(['  zuId: 77']), [{ id: 77, titleDe: 'Katalog', format: 'MOVIE' }], [], [])
  pruefe('zuId gesetzt und eigener Titel weg: Exit 0, keine Katalog-Warnung', umgezogen.status === 0 && !umgezogen.ausgabe.includes('⚠ WARNUNG'), umgezogen.ausgabe)
  const nochDa = lauf(zeile(['  zuId: 77']), [eigener, { id: 77, titleDe: 'Katalog', format: 'MOVIE' }], [], [termin])
  pruefe('zuId gesetzt, eigener Titel noch da: Exit 1', nochDa.status === 1 && nochDa.ausgabe.includes('zuId 77 gesetzt'), nochDa.ausgabe)
  const widerrufen = lauf(zeile(['  widerrufen: Fixture, 2999-01-03']), [eigener], [], [termin])
  pruefe('widerrufen, Titel noch da: Exit 1', widerrufen.status === 1 && widerrufen.ausgabe.includes('widerrufen ist'), widerrufen.ausgabe)
  const ohneBild = lauf(zeile(), [{ ...eigener, coverImage: undefined }], [], [termin])
  pruefe('Titel ohne Cover: Exit 0 mit Warnung (kein Fehler, es gibt keine Cover-Quelle)', ohneBild.status === 0 && ohneBild.ausgabe.includes('⚠ WARNUNG Eigene Titel: „Fixture Eins“ (Zeile 910001) hat kein Cover') && ohneBild.ausgabe.includes('VERSTÖSSE: 0'), ohneBild.ausgabe)
  const leer = lauf('[]\n', [], [], [])
  pruefe('keine Zeilen: Exit 0', leer.status === 0 && leer.ausgabe.includes('0 Zeilen'), leer.ausgabe)
  /* Die Bewertung selbst: zwei Zeilen, nur die erste fehlt; die Fremdzeile mit demselben Namen im anderen Format meldet nichts. */
  const direkt = pruefeEigeneImBestand(
    [{ nr: 1, name: 'A', format: 'MOVIE', anbieter: ['joyn'], tag: '2999-01-01', sources: ['https://x'], zitat: 'z' }, { nr: 2, name: 'B', format: 'TV', anbieter: ['joyn'], tag: '2999-01-01', sources: ['https://x'], zitat: 'z' }],
    [{ id: 5_000_002, titleDe: 'B', format: 'TV', coverImage: 'https://x/c.jpg' }, { id: 9, titleDe: 'A', format: 'TV' }], [], [{ titleId: 5_000_002, platform: 'joyn' }],
  )
  pruefe('Bewertung: eine Rot-Zeile für Nr. 1, keine Warnung (A als TV ist kein Film)', direkt.rot.length === 1 && direkt.rot[0]!.text.includes('Zeile 1') && direkt.rot[0]!.titleId === undefined && direkt.warnungen.length === 0, direkt)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) {
  console.error(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log(`Eigene Titel (Bestand): ${faelle} Fälle in Ordnung`)
