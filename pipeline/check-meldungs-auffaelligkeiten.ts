/**
 * Zusicherung (19.10.2026): Auffälligkeiten der Browser-Meldungen. Weniger Folgen als der Titel ist kein Befund, mehr schon;
 * die Datei ist eine Momentaufnahme (alte Einträge entfallen); der Text nennt den Titelnamen; die Warnung zählt den Rest.
 * Der Lauf liest dazu zwei erfundene Meldungen gegen eine Attrappe (`tools/auffaelligkeiten-mock.mjs`), geschrieben wird in ein Log.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { folgenzahlIstBefund, momentaufnahme, titelMitName, warnungsText } from './lib/meldungs-auffaelligkeiten.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/auffaelligkeiten-mock.mjs')).href
const fehler: string[] = []
const pruefe = (ok: boolean, text: string): void => void (ok || fehler.push(text))

pruefe(!folgenzahlIstBefund(6, 24), 'weniger gemeldet als der Titel ist ein Befund')
pruefe(!folgenzahlIstBefund(1, 24), 'eine gemeldete Folge ist ein Befund')
pruefe(!folgenzahlIstBefund(30, 0) && !folgenzahlIstBefund(30, undefined), 'ohne Folgenzahl des Titels ist ein Befund')
pruefe(!folgenzahlIstBefund(3, 2), 'kleine Titel: 3 von 2 (unter der Mindestabweichung 2) ist ein Befund')
pruefe(folgenzahlIstBefund(40, 12), 'mehr gemeldet als der Titel ist kein Befund')
pruefe(folgenzahlIstBefund(16, 12), '16 von 12 (über der Toleranz) ist kein Befund')
pruefe(!folgenzahlIstBefund(15, 12), '15 von 12 (innerhalb der Toleranz) ist ein Befund')
pruefe(titelMitName(7, [{ id: 7, titleDe: 'Siebter' }]) === 'Titel 7 (Siebter)', 'Titelname fehlt im Text')
pruefe(titelMitName(8, [{ id: 7, titleDe: 'Siebter' }]) === 'Titel 8', 'unbekannte Kennung ohne Namen')
const alt = [{ am: '2026-01-01', text: 'bleibt' }, { am: '2026-01-01', text: 'fällt weg' }]
const eintraege = momentaufnahme(['bleibt', 'bleibt', 'neu'], alt, '2026-10-19')
pruefe(JSON.stringify(eintraege) === JSON.stringify([{ am: '2026-01-01', text: 'bleibt' }, { am: '2026-10-19', text: 'neu' }]), `Momentaufnahme: ${JSON.stringify(eintraege)}`)
pruefe(momentaufnahme([], alt, '2026-10-19').length === 0, 'ohne Befund bleibt die Datei nicht leer')
pruefe(warnungsText(3).startsWith('3 Meldung(en) auffällig'), 'Warnungstext zählt nicht')

const ordner = mkdtempSync(join(tmpdir(), 'auffaelligkeiten-'))
const log = join(ordner, 'schreiben.jsonl')
const envDatei = join(ordner, 'github-env.txt')
const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
  cwd: wurzel,
  encoding: 'utf8',
  env: { ...process.env, LAUF_TOKEN: 'test', AUFFAELLIGKEITEN_LOG: log, GITHUB_ENV: envDatei },
})
const schreiben = existsSync(log)
  ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z) as { pfad: string; inhalt: string })
  : []
rmSync(ordner, { recursive: true, force: true })
pruefe(lauf.status === 0, `Lauf endete mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
const datei = schreiben.find((s) => /meldungs-auffaelligkeiten\.json$/.test(s.pfad))
const befunde = datei ? (JSON.parse(datei.inhalt) as { am: string; text: string }[]) : []
pruefe(befunde.length === 2, `Befunde im Lauf: ${befunde.length} statt 2 (${JSON.stringify(befunde)})`)
pruefe(befunde.some((b) => b.text.includes('Titel 3 (Gti-Titel 3) hat 12')), 'Titelname fehlt im Folgen-Befund')
pruefe(befunde.some((b) => b.text.includes('Titel 4 (Gti-Titel 4) ist Staffel 1')), 'Titelname fehlt im Staffel-Befund')
pruefe(!befunde.some((b) => b.text.includes('alter Befund')), 'alter Eintrag blieb stehen')
const warn = schreiben.find((s) => /github-env\.txt$/.test(s.pfad))
pruefe(warn?.inhalt.includes('DATEN_WARNUNG=2 Meldung(en) auffällig') === true, `Warnung: ${warn?.inhalt}`)

if (fehler.length) {
  console.error(`check-meldungs-auffaelligkeiten: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-meldungs-auffaelligkeiten: weniger Folgen kein Befund, Momentaufnahme mit Titelname, Warnung zählt 2 von 3 Meldungen.')
