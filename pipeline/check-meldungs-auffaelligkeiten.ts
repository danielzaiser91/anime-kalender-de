/**
 * Zusicherung (19.10.2026): Auffälligkeiten der Browser-Meldungen. Weniger Folgen als der Titel ist kein Befund, mehr schon;
 * ein Eintrag der Datei lebt, solange sein Befund am Bestand zutrifft (auch nach dem Abhaken der Meldung, ein Lauf mit nur harmlosen
 * Meldungen löscht ihn nicht); der Text nennt den Titelnamen; die Warnung zählt die offenen Befunde.
 * Drei Läufe von `fetch-pruefungen.ts` gegen eine Attrappe (`tools/auffaelligkeiten-mock.mjs`), geschrieben und abgerufen wird in ein Log.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { folgenzahlIstBefund, momentaufnahme, neueBefunde, titelMitName, trifftNochZu, warnungsText } from './lib/meldungs-auffaelligkeiten.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/auffaelligkeiten-mock.mjs')).href
const fehler: string[] = []
const pruefe = (ok: boolean, text: string): void => void (ok || fehler.push(text))

pruefe(!folgenzahlIstBefund(6, 24), 'weniger gemeldet als der Titel ist ein Befund')
pruefe(!folgenzahlIstBefund(1, 24), 'eine gemeldete Folge ist ein Befund')
pruefe(!folgenzahlIstBefund(30, 0) && !folgenzahlIstBefund(30, undefined), 'ohne Folgenzahl des Titels ist ein Befund')
pruefe(!folgenzahlIstBefund(3, 2), 'kleine Titel: 3 von 2 (unter der Mindestabweichung 2) ist ein Befund')
pruefe(!folgenzahlIstBefund(4, 2) && folgenzahlIstBefund(5, 2), 'kleine Titel: Grenze liegt nicht zwischen 4 und 5 von 2')
pruefe(!folgenzahlIstBefund(50, 40) && folgenzahlIstBefund(51, 40), 'große Titel: Grenze liegt nicht zwischen 50 und 51 von 40')
pruefe(folgenzahlIstBefund(40, 12), 'mehr gemeldet als der Titel ist kein Befund')
pruefe(folgenzahlIstBefund(16, 12), '16 von 12 (über der Toleranz) ist kein Befund')
pruefe(!folgenzahlIstBefund(15, 12), '15 von 12 (innerhalb der Toleranz) ist ein Befund')
pruefe(titelMitName(7, [{ id: 7, titleDe: 'Siebter' }]) === 'Titel 7 (Siebter)', 'Titelname fehlt im Text')
pruefe(titelMitName(7, [{ id: 7, titleEn: 'Seventh' }]) === 'Titel 7 (Seventh)', 'Titel ohne deutschen Namen: englischer fehlt')
pruefe(titelMitName(8, [{ id: 7, titleDe: 'Siebter' }]) === 'Titel 8', 'unbekannte Kennung ohne Namen')
const liste = [{ id: 3, episodes: 12 }, { id: -4, episodes: 12 }]
const staffel = (id: number): number | undefined => (id === 3 ? 1 : undefined)
const folgenText = 'Meldung 1: 40 Folgen gemeldet, Titel 3 (Name (2020)) hat 12 (X)'
pruefe(trifftNochZu(folgenText, liste, staffel), 'Folgen-Befund mit Klammer im Namen trifft noch zu')
pruefe(!trifftNochZu(folgenText, [{ id: 3, episodes: 40 }], staffel), 'Folgen-Befund trifft nach geänderter Folgenzahl noch zu')
pruefe(!trifftNochZu(folgenText, [], staffel), 'Folgen-Befund trifft für einen verschwundenen Titel noch zu')
pruefe(trifftNochZu('Meldung 1: 40 Folgen gemeldet, Titel -4 hat 12 (X)', liste, staffel), 'Befund an negativer Kennung ohne Namen')
const staffelText = 'Meldung 1: Titel 3 (Name) ist Staffel 1, die Seite https://x/y Staffel 2'
pruefe(trifftNochZu(staffelText, liste, staffel), 'Staffel-Widerspruch trifft noch zu')
pruefe(!trifftNochZu(staffelText, liste, () => 2), 'Staffel-Widerspruch trifft nach geänderter Staffelnummer noch zu')
pruefe(!trifftNochZu(staffelText, liste, () => 3), 'Staffel-Widerspruch trifft bei Nummer 3 statt 1 noch zu')
pruefe(!trifftNochZu('Meldung 1: Titel 3 ist Staffel 1, die Seite X Staffel 1', liste, staffel), 'Staffel 1 gegen Staffel 1 ist ein Widerspruch')
pruefe(!trifftNochZu(staffelText, liste, () => undefined), 'Staffel-Widerspruch trifft ohne Reihe noch zu')
pruefe(!trifftNochZu('Meldung 1: etwas anderes', liste, staffel), 'unlesbarer Text gilt als offen')
const alt = [{ am: '2026-01-01', text: 'bleibt' }, { am: '2026-01-01', text: 'fällt weg' }]
const eintraege = momentaufnahme(['bleibt', 'bleibt', 'neu'], alt, '2026-10-19', (t) => t === 'bleibt')
pruefe(JSON.stringify(eintraege) === JSON.stringify([{ am: '2026-01-01', text: 'bleibt' }, { am: '2026-10-19', text: 'neu' }]), `Momentaufnahme: ${JSON.stringify(eintraege)}`)
pruefe(momentaufnahme(['x', 'x'], [], '2026-10-19', () => false).length === 1, 'derselbe neue Text steht doppelt in der Datei')
pruefe(momentaufnahme([], alt, '2026-10-19', () => false).length === 0, 'ohne offenen Befund bleibt die Datei nicht leer')
pruefe(momentaufnahme([], alt, '2026-10-19', () => true).length === 2, 'ein offener Befund fällt ohne neue Meldung weg')
pruefe(warnungsText(1, 3).startsWith('1 neue Meldung(en) auffällig (3 offen)'), 'Warnungstext nennt neue und offene nicht')
const nb = neueBefunde(alt, momentaufnahme(['bleibt', 'neu'], alt, '2026-10-19', (t) => t === 'bleibt'))
pruefe(nb.length === 1 && nb[0]!.text === 'neu', `neue Befunde: ${JSON.stringify(nb)}`)
pruefe(neueBefunde(alt, momentaufnahme([], alt, '2026-10-19', () => true)).length === 0, 'offene Altbefunde zählen als neu')
pruefe(neueBefunde([], momentaufnahme(['a', 'b'], [], '2026-10-19', () => false)).length === 2, 'neue Befunde ohne Vorbestand fehlen')

type Zeile = { pfad: string; inhalt: string }
type Befund = { am: string; text: string }
type Ergebnis = { befunde: Befund[] | null; warnung: string | undefined; abrufe: Zeile[]; status: number | null; fehler: string }

function laufe(nr: number): Ergebnis {
  const ordner = mkdtempSync(join(tmpdir(), 'auffaelligkeiten-'))
  const log = join(ordner, 'schreiben.jsonl')
  // Im Bau-Lauf ist DATEN_WARNUNG schon gesetzt; fetch-pruefungen hängt an und der Text träfe nicht mehr.
  const { DATEN_WARNUNG: _geerbt, ...umgebung } = process.env
  const env = { ...umgebung, LAUF_TOKEN: 'test', AUFFAELLIGKEITEN_LOG: log, AUFFAELLIGKEITEN_LAUF: String(nr), GITHUB_ENV: join(ordner, 'github-env.txt') }
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], { cwd: wurzel, encoding: 'utf8', env })
  const zeilen = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z) as Zeile)
  rmSync(ordner, { recursive: true, force: true })
  const datei = zeilen.find((s) => /meldungs-auffaelligkeiten\.json$/.test(s.pfad))
  return {
    befunde: datei ? (JSON.parse(datei.inhalt) as Befund[]) : null,
    warnung: zeilen.find((s) => /github-env\.txt$/.test(s.pfad))?.inhalt,
    abrufe: zeilen.filter((s) => /^(GET|POST) /.test(s.pfad)),
    status: lauf.status,
    fehler: lauf.stderr.slice(-300),
  }
}

/** Genau ein Abrufe-Eintrag, das Abhaken der Meldungen dieses Laufs: sonst läuft etwas am Briefkasten vorbei oder das Log ist leer. */
function pruefeAbhaken(nr: number, r: Ergebnis, kennungen: number[]): void {
  const erwartet = `{"uebernommen":${JSON.stringify(kennungen)}}`
  const ok = r.abrufe.length === 1 && /^POST .*\/pruefung$/.test(r.abrufe[0]!.pfad) && r.abrufe[0]!.inhalt === erwartet
  pruefe(ok, `Lauf ${nr}: erwartet genau ein Abhaken ${erwartet}, Abrufe: ${JSON.stringify(r.abrufe)}`)
}

const r1 = laufe(1)
pruefe(r1.status === 0, `Lauf 1 endete mit ${r1.status}: ${r1.fehler}`)
const b1 = r1.befunde ?? []
pruefe(b1.length === 3, `Lauf 1: ${b1.length} Befunde statt 3 (Altbefund + 2 neue) (${JSON.stringify(b1)})`)
pruefe(b1.some((b) => b.text.includes('Titel 3 (Gti-Titel 3) hat 12')), 'Titelname fehlt im Folgen-Befund')
pruefe(b1.some((b) => b.text.includes('Titel 4 (Gti-Titel 4) ist Staffel 1')), 'Titelname fehlt im Staffel-Befund')
pruefe(!b1.some((b) => b.text.includes('alter Befund')), 'alter, unlesbarer Eintrag blieb stehen')
pruefe(b1.length > 0 && b1.filter((b) => b.am !== '2026-10-01').every((b) => b.am >= '2026-10-19'), `Lauf 1: neue Einträge tragen nicht den heutigen Tag: ${JSON.stringify(b1)}`)
pruefe(r1.warnung?.includes('DATEN_WARNUNG=2 neue Meldung(en) auffällig (3 offen)') === true, `Lauf 1, Warnung: ${r1.warnung}`)
pruefeAbhaken(1, r1, [900001, 900002, 900003])

const r2 = laufe(2)
pruefe(r2.status === 0, `Lauf 2 endete mit ${r2.status}: ${r2.fehler}`)
pruefe(
  r2.befunde?.length === 2 && r2.befunde.every((b) => b.am === '2026-10-01') && r2.befunde[0]!.text.includes('Titel 3 (Gti-Titel 3) hat 12'),
  `Lauf 2: offene Befunde samt Datum bleiben bei nur harmlosen Meldungen: ${JSON.stringify(r2.befunde)}`,
)
pruefe(r2.warnung === undefined, `Lauf 2: nur alte offene Befunde lösen keine Warnung aus: ${r2.warnung}`)
pruefeAbhaken(2, r2, [900004])

const r3 = laufe(3)
pruefe(r3.status === 0, `Lauf 3 endete mit ${r3.status}: ${r3.fehler}`)
pruefe(r3.befunde !== null && r3.befunde.length === 0, `Lauf 3: erledigter Befund bleibt, oder die Datei wurde nicht geschrieben: ${JSON.stringify(r3.befunde)}`)
pruefe(r3.warnung === undefined, `Lauf 3: ohne offenen Befund keine Warnung: ${r3.warnung}`)
pruefeAbhaken(3, r3, [900004])

const r4 = laufe(4)
pruefe(r4.status === 0, `Lauf 4 endete mit ${r4.status}: ${r4.fehler}`)
pruefe(r4.befunde?.length === 3, `Lauf 4: ${r4.befunde?.length} Befunde statt 3 (2 alte + 1 neuer): ${JSON.stringify(r4.befunde)}`)
pruefe(r4.warnung?.includes('DATEN_WARNUNG=1 neue Meldung(en) auffällig (3 offen)') === true, `Lauf 4, genau ein neuer Befund: ${r4.warnung}`)
pruefeAbhaken(4, r4, [900002])

if (fehler.length) {
  console.error(`check-meldungs-auffaelligkeiten: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-meldungs-auffaelligkeiten: weniger Folgen kein Befund; Befund bleibt, solange er zutrifft (Lauf 2: 2 offen, keine Warnung), erledigter fällt weg (Lauf 3), genau ein neuer Befund warnt mit „1 neue … (3 offen)“ (Lauf 4).')
