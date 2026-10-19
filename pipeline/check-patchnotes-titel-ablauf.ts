/**
 * Ablauftest zu `check-patchnotes-titel.ts`: der Check läuft als eigener Prozess in einem Wegwerf-Repo (Basis-Commit, Kopf-Commit, Ereignisdatei).
 * Belegt, dass nur im PR neue oder geänderte Einträge gegen die `titles.json` der Basis zählen und dass ein Rot den Exit-Code trägt.
 * Aufruf: `npx tsx pipeline/check-patchnotes-titel-ablauf.ts [Wurzelordner für die Wegwerf-Repos]`
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PATCHNOTES_ORDNER } from './lib/patchnotes.ts'

const SKRIPT = resolve(import.meta.dirname, 'check-patchnotes-titel.ts')
const wurzel = process.argv[2] ?? tmpdir()
const TITEL = [{ id: 1, titleDe: 'Overgeared', titleEn: 'Overgeared', titleRomaji: 'Tempal: Item no Chikara' }]
const eintrag = (untertitel: string): string => `text: Folgenliste\nuntertitel: ${untertitel}\n`

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

type Dateien = Record<string, string>

function git(ordner: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: ordner, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function schreibe(ordner: string, dateien: Dateien): void {
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    const voll = join(ordner, pfad)
    mkdirSync(join(voll, '..'), { recursive: true })
    writeFileSync(voll, inhalt)
  }
}

interface Fall {
  basis: Dateien
  kopf: Dateien
  loesche?: string[]
  event?: string
  /** Der Check läuft in einem flachen Klon (nur der Kopf), die Basis muss er nachladen wie in der CI. */
  flach?: boolean
  /** Änderungen, die main nach der Basis bekommt (das `base.sha` des Ereignisses bleibt veraltet auf der Basis). */
  main?: Dateien
  /** Kopf ist ein einfacher Commit statt des Merge-Commits der CI. */
  linear?: boolean
}

function mainWeiter(ordner: string, dateien: Dateien): void {
  schreibe(ordner, dateien)
  git(ordner, 'add', '-A')
  git(ordner, 'commit', '-q', '-m', 'main weiter')
}

/** Klon mit nur dem Kopf-Commit; der Ursprung gibt jede Kennung heraus (lokal per Datei-Adresse). */
function flacherKlon(ursprung: string): string {
  git(ursprung, 'config', 'uploadpack.allowAnySHA1InWant', 'true')
  const ziel = mkdtempSync(join(wurzel, 'patchnotes-titel-klon-'))
  git(wurzel, 'clone', '-q', '--depth=1', pathToFileURL(ursprung).href, ziel)
  return ziel
}

/** Baut Basis- und Kopf-Commit, startet den Check als Prozess; liefert Exit-Code und Ausgabe. */
function lauf(fall: Fall): { status: number | null; ausgabe: string } {
  const ordner = mkdtempSync(join(wurzel, 'patchnotes-titel-'))
  try {
    git(ordner, 'init', '-q', '-b', 'main')
    schreibe(ordner, fall.basis)
    git(ordner, 'add', '-A')
    git(ordner, 'commit', '-q', '-m', 'basis')
    const basis = git(ordner, 'rev-parse', 'HEAD')
    git(ordner, 'checkout', '-q', '-b', 'pr')
    schreibe(ordner, fall.kopf)
    for (const weg of fall.loesche ?? []) rmSync(join(ordner, weg))
    git(ordner, 'add', '-A')
    git(ordner, 'commit', '-q', '--allow-empty', '-m', 'kopf')
    git(ordner, 'checkout', '-q', 'main')
    if (fall.main) mainWeiter(ordner, fall.main)
    if (!fall.linear) git(ordner, 'merge', '-q', '--no-ff', '-m', 'Merge pr into main', 'pr')
    else git(ordner, 'checkout', '-q', 'pr')
    const arbeit = fall.flach ? flacherKlon(ordner) : ordner
    const ereignis = join(ordner, '..', `${basis}.json`)
    writeFileSync(ereignis, JSON.stringify({ pull_request: { base: { sha: basis } } }))
    const env = { ...process.env, GITHUB_EVENT_NAME: fall.event ?? 'pull_request', GITHUB_EVENT_PATH: ereignis, NODE_OPTIONS: '' }
    const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), SKRIPT], { cwd: arbeit, env, encoding: 'utf8', windowsHide: true })
    rmSync(ereignis)
    if (arbeit !== ordner) rmSync(arbeit, { recursive: true, force: true })
    return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

const bestand = (titel: unknown[] = TITEL): Dateien => ({ 'public/data/titles.json': JSON.stringify(titel), 'public/data/cartoons.json': '[]' })
const pfad = (name: string): string => `${PATCHNOTES_ORDNER}/${name}.yaml`
const note = (name: string, untertitel: string): Dateien => ({ [pfad(name)]: eintrag(untertitel) })

function faelle(): void {
  const sauber = lauf({ basis: { ...bestand(), ...note('alt', 'bei Overgeared') }, kopf: note('neu', 'bei Overgeared') })
  pruefe('Neuer sauberer Eintrag: Exit 0, Ergebniszeile', sauber.status === 0 && /✓ Patch-Notes-Titel: 1 neue/.test(sauber.ausgabe), sauber.ausgabe)
  const rot = lauf({ basis: { ...bestand(), ...note('alt', 'bei Overgeared') }, kopf: note('neu', 'bei Tempal') })
  pruefe('Neuer Eintrag mit „Tempal“: Exit 1 und Meldung', rot.status === 1 && rot.ausgabe.includes('nennt „Tempal“'), rot.ausgabe)
  const imText = lauf({ basis: { ...bestand(), ...note('alt', 'bei Overgeared') }, kopf: { [pfad('neu')]: eintrag('sauber').replace('Folgenliste', 'bei Tempal') } })
  pruefe('Name im Feld text: Exit 1, Meldung beginnt mit dem Dateinamen', imText.status === 1 && imText.ausgabe.includes('neu: nennt „Tempal“'), imText.ausgabe)
  const flach = lauf({ basis: { ...bestand(), ...note('alt', 'bei Overgeared') }, kopf: note('neu', 'bei Tempal'), flach: true })
  pruefe('Flacher Klon: die Basis wird nachgeladen, Exit 1', flach.status === 1 && flach.ausgabe.includes('nennt „Tempal“'), flach.ausgabe)
  const geaendert = lauf({ basis: { ...bestand(), ...note('alt', 'bei Overgeared') }, kopf: note('alt', 'bei Tempal') })
  pruefe('Geänderter Eintrag mit „Tempal“: Exit 1', geaendert.status === 1, geaendert.ausgabe)
  const altlast = lauf({ basis: { ...bestand(), ...note('alt', 'bei Tempal') }, kopf: { 'README.md': 'x' } })
  pruefe('Unveränderte Altlast „Tempal“: Exit 0, 0 Einträge', altlast.status === 0 && /: 0 neue oder/.test(altlast.ausgabe), altlast.ausgabe)
  const geloescht = lauf({ basis: { ...bestand(), ...note('alt', 'bei Tempal') }, kopf: {}, loesche: [pfad('alt')] })
  pruefe('Gelöschter Eintrag zählt nicht: Exit 0', geloescht.status === 0, geloescht.ausgabe)
  const nurBasis = lauf({ basis: bestand(), kopf: { ...note('neu', 'bei Tempal'), ...bestand([{ id: 1, titleDe: 'Tempal' }]) } })
  pruefe('titles.json des Kopfes zählt nicht, nur die der Basis: Exit 1', nurBasis.status === 1, nurBasis.ausgabe)
  const tief = lauf({ basis: bestand(), kopf: { [pfad('ordner/tief')]: eintrag('bei Tempal') } })
  pruefe('Datei in einem Unterordner gehört nicht zu den Einträgen: Exit 0', tief.status === 0, tief.ausgabe)
  const fuell = Array.from({ length: 20000 }, (_, i) => ({ id: 1000 + i, titleDe: `Füllung ${i} mit einem langen Namen zum Auffüllen` }))
  const gross = lauf({ basis: bestand([...TITEL, ...fuell]), kopf: note('neu', 'bei Tempal') })
  pruefe('Bestand über 1 MB: gelesen, Exit 1', gross.status === 1 && gross.ausgabe.includes('nennt „Tempal“'), gross.ausgabe.slice(0, 300))
  const leer = lauf({ basis: bestand([]), kopf: note('neu', 'bei Overgeared') })
  pruefe('Leere titles.json der Basis: Exit 1 (kein stilles Grün)', leer.status === 1, leer.ausgabe)
  const cartoon = lauf({ basis: { ...bestand(), 'public/data/cartoons.json': JSON.stringify([{ id: -1, titleEn: 'Marvel Zombies Show', titleRomaji: 'Zombie Hero: Marvel' }]) }, kopf: note('neu', 'bei Zombie Hero') })
  pruefe('Cartoons der Basis werden mitgeprüft: Exit 1', cartoon.status === 1, cartoon.ausgabe)
  const alt = { ...bestand(), ...note('alt', 'bei Overgeared') }
  const fremd = lauf({ basis: alt, main: note('fremd', 'bei Tempal'), kopf: { 'README.md': 'x' } })
  pruefe('Veraltetes base.sha: fremder „Tempal“-Eintrag von main zählt nicht, Exit 0', fremd.status === 0 && /: 0 neue oder/.test(fremd.ausgabe), fremd.ausgabe)
  const fremdUndEigen = lauf({ basis: alt, main: note('fremd', 'bei Tempal'), kopf: note('eigen', 'bei Tempal') })
  pruefe('Veraltetes base.sha, eigener Eintrag: Exit 1, nur „eigen“ gemeldet', fremdUndEigen.status === 1 && fremdUndEigen.ausgabe.includes('eigen: nennt „Tempal“') && !fremdUndEigen.ausgabe.includes('fremd: nennt'), fremdUndEigen.ausgabe)
  const linear = lauf({ basis: alt, kopf: note('neu', 'bei Overgeared'), linear: true })
  pruefe('Kopf ohne Merge-Commit: Exit 1, keine Basis geraten', linear.status === 1 && linear.ausgabe.includes('kein Merge-Commit'), linear.ausgabe)
  const ohnePr = lauf({ basis: bestand(), kopf: note('neu', 'bei Tempal'), event: 'push' })
  pruefe('Außerhalb des PR-Ereignisses: Exit 0, nur Gegenproben', ohnePr.status === 0 && ohnePr.ausgabe.includes('nur im PR-Ereignis'), ohnePr.ausgabe)
}

faelle()
if (fehler > 0) process.exit(1)
console.log('  ✓ Patch-Notes-Titel-Ablauf: Kopf gegen Basis, Altlast und Löschung still, Rot trägt den Exit-Code')
