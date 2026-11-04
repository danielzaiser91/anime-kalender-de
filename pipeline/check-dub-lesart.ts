/**
 * Ratsche: `x.dub === true` (auch `== true`, `x['dub']`, geklammert) als „deutsch bestätigt“ lesen, ohne
 * `dubAbgeleitet` zu beachten. Neue Stellen in shared/ und pipeline/bau/ fallen auf; Bestand und Markenzahl dürfen nur sinken
 * (Grenzen: tools/dub-lesart-grenzen.json). Ausnahme mit Grund: Kommentar `dub-lesart: <Grund>` (Regeln: pipeline/lib/dub-lesart.ts).
 * Nicht erfasst: web/src und pipeline/lib (Stand 03.11.2026: 53 Lesungen nach dieser Regel, rund 176 mit breiterem Muster, siehe docs/wissen/quellen.md).
 * Beim Abbau die Grenzen von Hand senken; steht eine Grenze über dem Zählstand, ist der Lauf rot („auf N senken“).
 * Eine Erhöhung gegen die Basis (erster Elternteil eines Merge-Commits, sonst origin/main, nötigenfalls per Abruf) ist rot; ohne lesbare Basis entfällt der Vergleich, in CI (`CI` gesetzt) ist das rot.
 * Aufruf: npx tsx pipeline/check-dub-lesart.ts [--liste] [--wurzel <ordner>] [--basis <ref>]
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dubLesart, offeneLesungen } from './lib/dub-lesart.ts'

const ORDNER = ['shared', 'pipeline/bau']
const GRENZDATEI = 'tools/dub-lesart-grenzen.json'

export interface Grenzen {
  offen: number
  marken: number
}

export interface Stand {
  offen: string[]
  marken: number
  tote: string[]
}

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [pfad] : []
  })
}

/** Offene Lesestellen, Markenzahl und tote Marken unter der Wurzel. */
export function zaehle(wurzel: string): Stand {
  const stand: Stand = { offen: [], marken: 0, tote: [] }
  for (const datei of ORDNER.flatMap((o) => dateien(join(wurzel, o)))) {
    const rel = datei.slice(wurzel.length + 1).replaceAll('\\', '/')
    const text = readFileSync(datei, 'utf8')
    stand.offen.push(...offeneLesungen(text).map((l) => `${rel}:${l.zeile}`))
    const { marken, tote } = dubLesart(text)
    stand.marken += marken
    if (tote) stand.tote.push(`${rel} (${tote})`)
  }
  return stand
}

/** Meldungen zu Zählstand gegen Grenzen und Basis-Grenzen; leer = in Ordnung. */
export function urteil(stand: Stand, grenzen: Grenzen, basis?: Grenzen): string[] {
  const fehler: string[] = []
  if (stand.offen.length > grenzen.offen) fehler.push(`Neue Stelle liest dub === true, ohne dubAbgeleitet zu beachten: ${stand.offen.length} statt höchstens ${grenzen.offen}\n  ${stand.offen.join('\n  ')}`)
  if (stand.marken > grenzen.marken) fehler.push(`Mehr Marken „dub-lesart:“ als erlaubt: ${stand.marken} statt höchstens ${grenzen.marken}`)
  if (stand.tote.length) fehler.push(`Marke ohne Lesung oder ohne Grund: ${stand.tote.join(', ')}`)
  if (stand.offen.length < grenzen.offen) fehler.push(`Grenze offen zu hoch: ${stand.offen.length} Stellen, bitte in ${GRENZDATEI} auf ${stand.offen.length} senken`)
  if (stand.marken < grenzen.marken) fehler.push(`Grenze marken zu hoch: ${stand.marken} Marken, bitte in ${GRENZDATEI} auf ${stand.marken} senken`)
  if (basis && grenzen.offen > basis.offen) fehler.push(`Grenze offen gegen die Basis erhöht: ${grenzen.offen} statt ${basis.offen}`)
  if (basis && grenzen.marken > basis.marken) fehler.push(`Grenze marken gegen die Basis erhöht: ${grenzen.marken} statt ${basis.marken}`)
  return fehler
}

function gelesen(text: string): Grenzen {
  const j = JSON.parse(text) as Partial<Grenzen>
  if (typeof j.offen !== 'number' || typeof j.marken !== 'number') throw new Error(`${GRENZDATEI}: offen und marken fehlen`)
  return { offen: j.offen, marken: j.marken }
}

function git(wurzel: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()
  } catch {
    return undefined
  }
}

/** Ref der Basis: erster Elternteil eines Merge-Commits (im flachen Klon per `cat-file` gelesen und nachgeladen), sonst main. */
function basisRef(wurzel: string): string {
  const eltern = (git(wurzel, ['cat-file', '-p', 'HEAD']) ?? '').split('\n').filter((z) => z.startsWith('parent '))
  if (eltern.length >= 2) {
    const sha = eltern[0]!.slice('parent '.length).trim()
    if (git(wurzel, ['cat-file', '-e', `${sha}^{commit}`]) === undefined) git(wurzel, ['fetch', '--no-tags', '--depth=1', 'origin', sha])
    return sha
  }
  if (git(wurzel, ['rev-parse', '--verify', '-q', 'origin/main']) !== undefined) return 'origin/main'
  return git(wurzel, ['fetch', '--no-tags', '--depth=1', 'origin', 'main']) === undefined ? 'origin/main' : 'FETCH_HEAD'
}

/** Grenzen der Basis: `--basis <ref>`, sonst `basisRef`. `undefined`, wenn nicht lesbar. */
export function basisGrenzen(wurzel: string, ref?: string): Grenzen | undefined {
  const text = git(wurzel, ['show', `${ref ?? basisRef(wurzel)}:${GRENZDATEI}`])
  return text ? gelesen(text) : undefined
}

/** Meldung, wenn in CI keine Basis lesbar war (sonst fiele eine angehobene Grenze nicht auf). */
export function basisFehlt(basis: Grenzen | undefined, ci: boolean): string | undefined {
  return !basis && ci ? 'Basisvergleich entfällt in CI: Grenzen der Basis (main) nicht lesbar' : undefined
}

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): number {
  const wurzel = resolve(argument('--wurzel') ?? resolve(import.meta.dirname, '..'))
  const stand = zaehle(wurzel)
  if (process.argv.includes('--liste')) {
    console.log(stand.offen.join('\n'))
    return 0
  }
  const grenzen = gelesen(readFileSync(join(wurzel, GRENZDATEI), 'utf8'))
  const basis = basisGrenzen(wurzel, argument('--basis'))
  console.log(`dub-lesart: ${stand.offen.length} offene Lese-Stellen (höchstens ${grenzen.offen}), ${stand.marken} Marken (höchstens ${grenzen.marken}), ${stand.tote.length} tote; Basisvergleich ${basis ? 'ja' : 'entfällt'}`)
  const fehler = urteil(stand, grenzen, basis)
  const ohneBasis = basisFehlt(basis, Boolean(process.env.CI))
  if (ohneBasis) fehler.push(ohneBasis)
  if (fehler.length) {
    console.error(`✖ ${fehler.join('\n✖ ')}\nBeachte dubAbgeleitet bzw. istLautAnbieter (shared/saison.ts) oder markiere mit „dub-lesart: <Grund>“. Die Grenzen werden nicht angehoben.`)
    return 1
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) process.exit(main())
