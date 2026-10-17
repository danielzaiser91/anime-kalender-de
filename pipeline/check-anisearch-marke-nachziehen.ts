/**
 * Die Marke „Deutsch“ eines aniSearch-Eintrags folgt der Dub-Liste (17.10.2026, Kennung 18892: Liste „geplant“, Eintrag „nicht genannt“, `check-bild-und-synchro.ts` rot).
 * Der Dub-Abruf (`fetch-anisearch-dubs.ts`) zieht das Feld `dub` der Einträge nach; hier läuft das ganze Skript gegen eine Kulisse
 * (`AK_ROOT`, Attrappe `tools/dubs-abruf-mock.mjs`). Fängt, wenn der Abruf die Einträge nicht mehr anfasst.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/dubs-abruf-mock.mjs')).href
const kulisse = mkdtempSync(join(tmpdir(), 'marke-nachziehen-'))
mkdirSync(join(kulisse, 'data'))

const eintrag = (dub: string, extra: object = {}) => ({ t: 'x', ty: 'TV-Serie', dub, ...extra })
/* Reihenfolge mit Absicht: die abweichenden Einträge stehen in der Mitte und hinten, unveränderte vorn und dazwischen. */
const vorher = { 900001: eintrag('d'), 900002: eintrag('-', { dvon: '2024-04-18' }), 900003: eintrag('d'), 900004: eintrag('c'), 900005: eintrag('-'), 900006: eintrag('p') }
writeFileSync(join(kulisse, 'data/anisearch-eintraege.json'), JSON.stringify(vorher))
/* Antwort: 900002 neu „geplant“, 900003 nicht mehr genannt, 900004 jetzt „vertont“, 900006 unverändert; 900007 hat keinen Eintrag. Der Abruf braucht über 10.000 Zeilen. */
const alle: Record<string, object> = { 900001: { dubbed: ['de'] }, 900002: { planned: ['de'] }, 900004: { dubbed: ['de'] }, 900006: { planned: ['de'] }, 900007: { planned: ['de'] }, 900008: { dubbed: ['en'] } }
for (let i = 1; i <= 10_000; i++) alle[String(i)] = {}
writeFileSync(join(kulisse, 'dubs-antwort.json'), JSON.stringify(alle))
/* Die Brücke Titel → aniSearch liest der Abruf aus der Handdatei; ein Eintrag genügt. */
writeFileSync(join(kulisse, 'data/anisearch-ids-hand.yaml'), '700001: 900001\n')

function lauf() {
  return spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-anisearch-dubs.ts')], { env: { ...process.env, AK_ROOT: kulisse }, encoding: 'utf8' })
}
const erster = lauf()
const lies = <T>(datei: string) => JSON.parse(readFileSync(join(kulisse, 'data', datei), 'utf8')) as T
const nachher = lies<Record<string, { dub: string }>>('anisearch-eintraege.json')
const liste = lies<Record<string, string>>('anisearch-dub-ids.json')

console.log('Marke der Einträge folgt der Liste')
pruefe('der Abruf läuft durch', erster.status === 0, erster.stderr.slice(-300))
pruefe('nicht genannt → geplant (18892)', nachher[900002]?.dub === 'p', nachher[900002])
pruefe('nicht mehr in der Liste → „-“', nachher[900003]?.dub === '-', nachher[900003])
pruefe('abgebrochen → vertont', nachher[900004]?.dub === 'd', nachher[900004])
pruefe('unveränderte Einträge bleiben', nachher[900001]?.dub === 'd' && nachher[900005]?.dub === '-' && nachher[900006]?.dub === 'p')
pruefe('übrige Felder bleiben', JSON.stringify(nachher[900002]) === JSON.stringify(eintrag('p', { dvon: '2024-04-18' })), nachher[900002])
pruefe('kein Eintrag wird angelegt', !('900007' in nachher) && Object.keys(nachher).length === 6)
pruefe('die Liste enthält nur Kennungen mit Deutsch', JSON.stringify(Object.keys(liste).sort()) === JSON.stringify(['900001', '900002', '900004', '900006', '900007']), liste)
pruefe('die Meldung nennt drei nachgezogene Einträge', erster.stdout.includes('3 Einträge nachgezogen'), erster.stdout.slice(-300))
const zweiter = lauf()
pruefe('ein zweiter Lauf ändert nichts', zweiter.stdout.includes('0 Einträge nachgezogen'), zweiter.stdout.slice(-300))

rmSync(kulisse, { recursive: true, force: true })
if (fehler > 0) process.exit(1)
