/**
 * Schritt „Meldungen einarbeiten“ (19.11.2026, Migration 066; Anlass: Meldung 27504 meldete „weg“ für Landei II, weil das Panel
 * noch den Titel der vorigen Seite trug): der echte Abholer `fetch-pruefungen.ts` als Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`)
 * und die Abruf-Attrappe. Eine Meldung, deren Seitenadresse (`seiten_adresse`) eine Titelseite mit fremder Kennung ist, schreibt
 * keinen Beleg, wird nicht abgehakt, steht in Log und Arbeitsliste und wird gezählt; die Meldung bleibt im Briefkasten. Ohne Angabe,
 * mit eigener Seite, mit Startseite oder mit einer Seite eines Anbieters, den der Titel gar nicht führt, wird wie bisher geschrieben.
 * Die Regel selbst (Kennungen je Anbieter, Prime ausgenommen) steht in `check-meldung-seite.ts`.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-unbekannt-mock.mjs')).href
const fehler: string[] = []
/** Der Ordner der Arbeitslisten; der Test liest alle Dateien darin, ohne den Dateinamen der Meldungsliste zu nennen. */
const LISTEN = 'daniel-zum-abarbeiten/listen'
const ADN = 'https://animationdigitalnetwork.com/de/video/'

const titel = (id: number, titleDe: string, kennung: string) => ({ id, titleDe, format: 'TV', episodes: 12, streams: [{ platform: 'adn', url: `${ADN}${kennung}` }] })
/** Zwei Titel mit je einer ADN-Seite; die Meldungen nennen den Titel selbst (`titel_id`), die Seite dazu ist das, was geprüft wird. */
const BESTAND = [titel(900201, 'Seitenprobe Alpha', '1140-seitenprobe-alpha'), titel(900202, 'Seitenprobe Beta', '2250-seitenprobe-beta')]

function zeile(nr: number, seiten_adresse: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: 960000 + nr,
    plattform: 'adn',
    url: `${ADN}1140-seitenprobe-alpha`,
    sprachen: '["de"]',
    befund: 'dub',
    titel: 'Seitenprobe Alpha',
    folgen: 12,
    folge_nr: nr,
    staffel: 1,
    staffeln: null,
    serientitel: 'Seitenprobe Alpha',
    notiz: 'ADN: alle Folgen geprüft',
    teil_von: null,
    teil_bis: null,
    gemeldet_am: '2026-11-19T10:00:00.000Z',
    seiten_kennung: null,
    titel_id: 900201,
    folge: null,
    seiten_adresse,
    ...extra,
  }
}

function lauf(zeilen: unknown[]) {
  const tmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-seite-'))
  try {
    for (const ordner of ['data/curated', 'public/data', 'extension', LISTEN]) mkdirSync(join(tmp, ordner), { recursive: true })
    writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify(BESTAND))
    writeFileSync(join(tmp, 'public/data/franchises.json'), '{}')
    for (const datei of ['cartoons', 'ohne-synchro', 'ohne-synchro-namen']) writeFileSync(join(tmp, `public/data/${datei}.json`), '[]')
    writeFileSync(join(tmp, 'data/prime-zugeordnet.json'), '{}')
    writeFileSync(join(tmp, 'data/dub-confirmed.yaml'), '')
    writeFileSync(join(tmp, 'meldungen.json'), JSON.stringify(zeilen))
    const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
      cwd: wurzel,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, LAUF_TOKEN: 'test', AK_ROOT: tmp, AK_MELDUNGEN: join(tmp, 'meldungen.json') },
    })
    const ausgabe = `${r.stdout}\n${r.stderr}`
    if (r.status !== 0 || !ausgabe.includes('Prüfungen abgeholt')) fehler.push(`Lauf endete mit ${r.status}, ohne Schlusszeile: ${ausgabe.slice(-400)}`)
    const lesen = (datei: string) => (existsSync(join(tmp, datei)) ? readFileSync(join(tmp, datei), 'utf8') : '')
    const listen = readdirSync(join(tmp, LISTEN)).map((d) => lesen(join(LISTEN, d))).join('\n')
    return { ausgabe, zeilen: ausgabe.split('\n'), liste: listen, belege: lesen('data/dub-confirmed.yaml') }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
const GRUND = 'Seite der Meldung gehört nicht zum Titel'

/* Anlassfall: Meldung 960001 für Alpha, gelesen auf der Titelseite von Beta (Panel einer anderen Seite). */
const fremd = lauf([zeile(1, `${ADN}2250-seitenprobe-beta`)])
const warnung = fremd.zeilen.find((z) => z.includes(GRUND)) ?? ''
console.log(`Beispiel Anlassfall: ${warnung}`)
if (fremd.belege.includes('900201')) fehler.push('Fremde Seite: Beleg wurde geschrieben')
if (!warnung.includes('Meldung bleibt liegen') || !warnung.includes('2250')) fehler.push(`Fremde Seite: keine Warnzeile mit Seite und „Meldung bleibt liegen“: ${warnung || '(keine)'}`)
if (!fremd.liste.includes(GRUND)) fehler.push('Fremde Seite: nicht in der Arbeitsliste')
if (!fremd.ausgabe.includes('1 Meldung(en) von einer Seite, die nicht zum Titel gehört, nicht angehängt')) fehler.push(`Fremde Seite: Schlusszeile zählt nicht: ${fremd.zeilen.filter((z) => z.includes('Prüfungen abgeholt')).join(' | ')}`)
if (fremd.ausgabe.includes('Meldungen werden nach dem Commit abgehakt')) fehler.push('Fremde Seite: Meldung wurde zum Abhaken vorgemerkt')

/* Alles andere wird wie bisher geschrieben und abgehakt: eigene Seite, ohne Angabe, Startseite, Anbieter ohne Adresse beim Titel. */
const gut = lauf([
  zeile(1, `${ADN}1140-seitenprobe-alpha`),
  zeile(2, null),
  zeile(3, 'https://animationdigitalnetwork.com/de'),
  zeile(4, 'https://www.netflix.com/title/81000001'),
])
if (gut.ausgabe.includes(GRUND) || gut.liste.includes(GRUND)) fehler.push(`Eigene Seite, ohne Angabe, Startseite, anderer Anbieter: fälschlich gehalten: ${gut.ausgabe.slice(-300)}`)
if (!gut.ausgabe.includes('4 Meldungen werden nach dem Commit abgehakt')) fehler.push(`Gut: nicht alle vier abgehakt: ${gut.zeilen.filter((z) => z.includes('abgehakt')).join(' | ')}`)

/* Eine fremde Seite hält nur ihre Adresse: dieselbe Adresse, eine zweite Folge von der eigenen Seite → die Gruppe bleibt liegen (eine Warnung). */
const gemischt = lauf([zeile(1, `${ADN}1140-seitenprobe-alpha`), zeile(2, `${ADN}2250-seitenprobe-beta`)])
if (gemischt.zeilen.filter((z) => z.includes(GRUND)).length !== 1 || gemischt.ausgabe.includes('Meldungen werden nach dem Commit abgehakt')) fehler.push(`Gruppe mit einer fremden Seite: nicht als Ganzes gehalten: ${gemischt.ausgabe.slice(-300)}`)

/* Die fremde Seite steht in der älteren Meldung, die jüngste kommt von der eigenen Seite: die Gruppe bleibt trotzdem liegen. */
const aelter = lauf([zeile(1, `${ADN}2250-seitenprobe-beta`, { gemeldet_am: '2026-11-19T09:00:00.000Z' }), zeile(2, `${ADN}1140-seitenprobe-alpha`)])
if (aelter.zeilen.filter((z) => z.includes(GRUND)).length !== 1 || aelter.ausgabe.includes('Meldungen werden nach dem Commit abgehakt')) fehler.push(`Fremde Seite in der älteren Meldung: Gruppe nicht gehalten: ${aelter.ausgabe.slice(-300)}`)

if (fehler.length) {
  console.error(`check-fetch-pruefungen-seite: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-fetch-pruefungen-seite: Meldung von fremder Titelseite bleibt liegen und wird gezählt, übrige Meldungen werden wie bisher geschrieben.')
