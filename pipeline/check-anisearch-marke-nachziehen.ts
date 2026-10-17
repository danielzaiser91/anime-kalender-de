/**
 * Die Marke „Deutsch“ eines aniSearch-Eintrags folgt der Dub-Liste (17.10.2026, Kennung 18892: Liste „geplant“, Eintrag „nicht genannt“, `check-bild-und-synchro.ts` rot).
 * Der Dub-Abruf (`fetch-anisearch-dubs.ts`) zieht das Feld `dub` der Einträge nach; hier läuft das ganze Skript gegen eine Kulisse
 * (`AK_ROOT`, Attrappe `tools/dubs-abruf-mock.mjs`). Fängt, wenn der Abruf die Einträge nicht mehr anfasst.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
/* Der erste und der letzte Eintrag ändern sich, dazwischen wechseln sich geänderte und unveränderte ab (Schleife über alle, nicht nur über einen Rand). */
const vorher = {
  900001: eintrag('c'),
  900002: eintrag('-', { dvon: '2024-04-18' }),
  900003: eintrag('d'),
  900004: eintrag('c'),
  900005: eintrag('c'),
  900006: eintrag('p'),
  900007: eintrag('d'),
  900008: eintrag('d'),
}
writeFileSync(join(kulisse, 'data/anisearch-eintraege.json'), JSON.stringify(vorher))
/* Die Liste vom letzten Abruf: 900005 steht darin und kommt in der neuen Antwort nicht mehr vor; 900003 stand nie darin und fehlt ebenfalls. */
writeFileSync(join(kulisse, 'data/anisearch-dub-ids.json'), JSON.stringify({ 900005: 'c', 900007: 'd' }))
/*
 * Antwort: 900001 jetzt „vertont“, 900002 neu „geplant“, 900003 und 900005 fehlen (nicht widerlegt, bleiben „vertont“ und „abgebrochen“), 900004 jetzt „vertont“,
 * 900006 unverändert, 900007 in der Antwort ohne Deutsch (→ „-“), 900008 jetzt „abgebrochen“; 900009 hat keinen Eintrag. Der Abruf braucht über 10.000 Zeilen.
 */
const alle: Record<string, object> = {
  900001: { dubbed: ['de'] },
  900002: { planned: ['de'] },
  900004: { dubbed: ['de'] },
  900006: { planned: ['de'] },
  900007: { dubbed: ['en'] },
  900008: { canceled: ['de'] },
  900009: { planned: ['de'] },
}
for (let i = 1; i <= 10_000; i++) alle[String(i)] = {}
writeFileSync(join(kulisse, 'dubs-antwort.json'), JSON.stringify(alle))
/* Die Brücke Titel → aniSearch liest der Abruf aus der Handdatei; ein Eintrag genügt. */
writeFileSync(join(kulisse, 'data/anisearch-ids-hand.yaml'), '700001: 900001\n')

function lauf(wo = kulisse) {
  return spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-anisearch-dubs.ts')], { env: { ...process.env, AK_ROOT: wo }, encoding: 'utf8' })
}
const erster = lauf()
const lies = <T>(datei: string) => JSON.parse(readFileSync(join(kulisse, 'data', datei), 'utf8')) as T
const nachher = lies<Record<string, { dub: string }>>('anisearch-eintraege.json')
const liste = lies<Record<string, string>>('anisearch-dub-ids.json')

console.log('Marke der Einträge folgt der Liste')
pruefe('der Abruf läuft durch', erster.status === 0, erster.stderr.slice(-300))
pruefe('nicht genannt → geplant (18892)', nachher[900002]?.dub === 'p', nachher[900002])
pruefe('der erste Eintrag wird nachgezogen: abgebrochen → vertont', nachher[900001]?.dub === 'd', nachher[900001])
pruefe('ein mittlerer Eintrag wird nachgezogen: abgebrochen → vertont', nachher[900004]?.dub === 'd', nachher[900004])
pruefe('der letzte Eintrag wird nachgezogen: vertont → abgebrochen', nachher[900008]?.dub === 'c', nachher[900008])
pruefe('in der Antwort, ohne Deutsch → „-“', nachher[900007]?.dub === '-', nachher[900007])
pruefe('fehlt in der Antwort und nie in der Liste: der Eintrag bleibt „vertont“', nachher[900003]?.dub === 'd', nachher[900003])
pruefe('fehlt in der Antwort: die Liste führt die alte Marke weiter', liste[900005] === 'c' && nachher[900005]?.dub === 'c', liste)
pruefe('unveränderte Einträge bleiben', nachher[900006]?.dub === 'p')
pruefe('übrige Felder bleiben', JSON.stringify(nachher[900002]) === JSON.stringify(eintrag('p', { dvon: '2024-04-18' })), nachher[900002])
pruefe('kein Eintrag wird angelegt', !('900009' in nachher) && Object.keys(nachher).length === 8)
pruefe('die Liste: neue Marken, alte nur für Fehlendes, nichts ohne Deutsch', JSON.stringify(Object.keys(liste).sort()) === JSON.stringify(['900001', '900002', '900004', '900005', '900006', '900008', '900009']), liste)
pruefe('die Meldung nennt fünf nachgezogene Einträge', erster.stdout.includes('5 Einträge nachgezogen'), erster.stdout.slice(-300))
pruefe('die Meldung nennt die eine übernommene Kennung (900005)', erster.stdout.includes('1 Kennungen fehlen in der Antwort'), erster.stdout.slice(-300))
/* `schreibeMarken` schreibt alle drei Dateien im kompakten Format (wie `writeJson` ohne `pretty`); der Auszug trägt die Brücke: Titel 700001 → aniSearch 900001. */
const rohAuszug = readFileSync(join(kulisse, 'data/anisearch-dubs.json'), 'utf8')
pruefe('der Auszug je Titel wird geschrieben', rohAuszug === '{"700001":"d"}', rohAuszug)
pruefe('alle drei Dateien stehen kompakt in einer Zeile', ['anisearch-dubs.json', 'anisearch-dub-ids.json', 'anisearch-eintraege.json'].every((d) => !readFileSync(join(kulisse, 'data', d), 'utf8').includes('\n')))
const zweiter = lauf()
pruefe('ein zweiter Lauf ändert nichts', zweiter.stdout.includes('0 Einträge nachgezogen'), zweiter.stdout.slice(-300))

rmSync(kulisse, { recursive: true, force: true })

/* Grenze: Eine Antwort darf höchstens 30 Kennungen der bisherigen Liste verschweigen (Begründung bei `MAX_UEBERNOMMEN`); darüber wird nichts geschrieben. Fester Wert, damit eine Änderung der Konstante auffällt. */
const GRENZE = 30
function grenzfall(fehlend: number) {
  const wo = mkdtempSync(join(tmpdir(), 'marke-grenze-'))
  mkdirSync(join(wo, 'data'))
  const bisher = Object.fromEntries(Array.from({ length: fehlend }, (_, i) => [800001 + i, 'd']))
  writeFileSync(join(wo, 'data/anisearch-eintraege.json'), JSON.stringify({ 900001: eintrag('c') }))
  writeFileSync(join(wo, 'data/anisearch-dub-ids.json'), JSON.stringify(bisher))
  writeFileSync(join(wo, 'data/anisearch-ids-hand.yaml'), '700001: 900001\n')
  const antwort: Record<string, object> = { 900001: { dubbed: ['de'] } }
  for (let i = 1; i <= 10_000; i++) antwort[String(i)] = {}
  writeFileSync(join(wo, 'dubs-antwort.json'), JSON.stringify(antwort))
  const l = lauf(wo)
  const lies = (d: string) => (existsSync(join(wo, 'data', d)) ? readFileSync(join(wo, 'data', d), 'utf8') : undefined)
  const ergebnis = { l, eintraege: lies('anisearch-eintraege.json'), ids: lies('anisearch-dub-ids.json'), auszug: lies('anisearch-dubs.json'), health: lies('source-health.json') }
  rmSync(wo, { recursive: true, force: true })
  return { ...ergebnis, bisher: JSON.stringify(bisher) }
}
console.log('Grenze für verschwiegene Kennungen')
const gerade = grenzfall(GRENZE)
pruefe('genau an der Grenze: alles wird geschrieben und der Eintrag nachgezogen', gerade.l.status === 0 && gerade.eintraege?.includes('"dub":"d"') === true && gerade.auszug === '{"700001":"d"}', gerade.eintraege)
pruefe('genau an der Grenze: die Zahl steht in der Meldung und die alten Marken in der Liste', gerade.l.stdout.includes(`${GRENZE} Kennungen fehlen in der Antwort`) && gerade.ids?.includes('"800030":"d"') === true, gerade.l.stdout.slice(-300))
const drueber = grenzfall(GRENZE + 1)
pruefe('eine Kennung über der Grenze: Eintrag, Liste und Auszug bleiben, wie sie waren', drueber.eintraege?.includes('"dub":"c"') === true && drueber.ids === drueber.bisher && drueber.auszug === undefined, drueber)
pruefe('eine Kennung über der Grenze: der Lauf meldet es mit Zahl in der Quellenübersicht', drueber.health?.includes(`${GRENZE + 1} Kennungen fehlen in der Antwort`) === true && drueber.l.stderr.includes('Dateien bleiben unverändert'), drueber.health)

if (fehler > 0) process.exit(1)
