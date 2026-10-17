/**
 * Eingaben des Seitenbaus (17.10.2026): Zwischen dem Bau der PR-Prüfkette und dem Merge schreiben Bestandsbau und Sammler oft nur Dateien
 * unter `data/`, die der Seitenbau gar nicht liest. Der Abdruck (`abdruck`) fasst einen Git-Baum so zusammen, dass genau diese Änderungen ihn
 * nicht verändern: Bei freien Pfaden (`frei`) zählen nur Art und Name, außer der Bau liest sie (`BAU_EINGABEN`); alles andere zählt mit Inhalt.
 * Gleicher Abdruck heißt: gleiche Ausgabe bis auf `v`/`baum` in `version.json` (belegt an zwei Paaren echter Artefakte, Bericht
 * daniel-zum-abarbeiten/berichte/deploy-daten-schnellweg-2026-10-17.md). Der Deploy liefert dann den geprüften Bau aus (`tools/deploy-aus-build.mjs`).
 *
 * Aufruf im Bau (`package.json`): `node tools/bau-eingaben.mjs "<befehl>"` führt den Befehl mit der Spur (`tools/bau-eingaben-spur.cjs`) aus
 * und schreibt danach `abdruck` in `dist/version.json` — nur, wenn jeder gelesene freie Pfad in `BAU_EINGABEN` steht und Git den Baum nennt.
 * Fehlt der Abdruck, baut der Deploy neu.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Pfade, deren Inhalt der Seitenbau nicht liest, solange sie nicht in `BAU_EINGABEN` stehen: Datenquellen, Doku, Listen für Daniel, Umfang-Grenzen (schreibt der Bestandsbau). */
export function frei(pfad) {
  return /^(data|docs|daniel-zum-abarbeiten)\//.test(pfad) || /^[^/]+\.md$/.test(pfad) || pfad === 'tools/umfang-grenzen.json'
}

/** Freie Pfade, die der Seitenbau liest (gemessen per Spur); ein Eintrag mit `/` am Ende gilt für den ganzen Ordner. */
export const BAU_EINGABEN = ['data/cartoon-umzug.json', 'data/kennungen.json', 'data/patchnotes/']

const eingabe = (pfad) => BAU_EINGABEN.some((e) => (e.endsWith('/') ? `${pfad}/`.startsWith(e) : pfad === e))

/** Abdruck eines Baums aus `git ls-tree -r -z`: volle Zeile (Art, Kennung, Pfad), bei freien Pfaden außerhalb der Eingaben nur Art und Pfad. */
export function abdruck(lsTree) {
  const hash = createHash('sha1')
  for (const eintrag of lsTree.split('\0')) {
    const pfad = eintrag.slice(eintrag.indexOf('\t') + 1)
    hash.update(frei(pfad) && !eingabe(pfad) ? `${eintrag.split(' ')[0]}\t${pfad}\0` : `${eintrag}\0`)
  }
  return hash.digest('hex')
}

/** Lesefunktionen, die nur Namen liefern: Namen freier Pfade stehen ohnehin im Abdruck. */
const NUR_NAMEN = new Set(['readdirSync', 'readdir', 'opendirSync', 'opendir', 'promises.readdir', 'promises.opendir'])

/** Freie Pfade aus den Spur-Zeilen (`<funktion>\t<pfad>`), deren Inhalt der Bau berührt hat, ohne dass sie in `BAU_EINGABEN` stehen. */
export function unerklaert(zeilen) {
  const pfade = zeilen.map((z) => z.split('\t')).filter(([funktion, pfad]) => pfad && !NUR_NAMEN.has(funktion) && frei(pfad) && !eingabe(pfad))
  return [...new Set(pfade.map(([, pfad]) => pfad))].sort()
}

/** Führt `befehl` mit Spur aus und ergänzt `abdruck` in `version.json`; Rückgabe: 1, wenn der Befehl scheitert (auch durch ein Signal), sonst 0. */
export function bauMitSpur(befehl, { wurzel, versionDatei, git, log = console.log }) {
  const ordner = mkdtempSync(join(tmpdir(), 'bau-spur-'))
  const vorlader = join(wurzel, 'tools', 'bau-eingaben-spur.cjs').replace(/\\/g, '/')
  const env = { ...process.env, BAU_SPUR: ordner, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${vorlader}`.trim() }
  const lauf = spawnSync(befehl, { cwd: wurzel, env, shell: true, stdio: 'inherit' })
  const zeilen = readdirSync(ordner).flatMap((d) => readFileSync(join(ordner, d), 'utf8').split('\n'))
  rmSync(ordner, { recursive: true, force: true })
  if (lauf.status !== 0) return 1
  const offen = unerklaert(zeilen)
  if (offen.length > 0) {
    log(`::warning::Bau liest freie Pfade außerhalb von BAU_EINGABEN (tools/bau-eingaben.mjs), Deploy baut neu: ${offen.join(', ')}`)
    return 0
  }
  let baum = ''
  try {
    baum = git(['ls-tree', '-r', '-z', 'HEAD'])
  } catch {
    log('Kein Git-Baum: version.json ohne Abdruck, der Deploy baut neu.')
    return 0
  }
  const version = JSON.parse(readFileSync(versionDatei, 'utf8'))
  writeFileSync(versionDatei, JSON.stringify({ ...version, abdruck: abdruck(baum) }))
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
  const git = (args) => execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
  process.exitCode = bauMitSpur(process.argv[2], { wurzel, versionDatei: join(wurzel, 'dist', 'version.json'), git })
}
