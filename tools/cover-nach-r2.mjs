/**
 * Lädt die eigenen aniSearch-Cover in den R2-Bucket `anime-kalender-cover` (Domain `cover.anime-kalender.de`).
 *
 * Quelle ist das Artefakt `cover-ausgabe-<Lauf>` des Workflows „Datenlauf auf Abruf“ (Lauf `data:anisearch-cover`), das je Lauf nur die neu geholten Bilder
 * enthält. Jede Datei muss im Manifest `data/cover-eigen.json` unter genau diesem Pfad stehen und die dort vermerkte Größe haben, sonst wird sie nicht hochgeladen.
 * Wiederholbar: Ein erneutes Hochladen derselben Datei überschreibt sie mit denselben Bytes.
 *
 * Aufruf (angemeldetes wrangler genügt; aniSearch wird dabei nie angefragt):
 *   node tools/cover-nach-r2.mjs --lauf <Kennung des Datenlaufs>   (lädt das Artefakt per gh in einen Temp-Ordner)
 *   node tools/cover-nach-r2.mjs --ordner <Pfad zu cover-ausgabe>
 * Weitere Schalter: --parallel N (Standard 8), --trocken (nur prüfen und zählen)
 */
import { execFile, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 'anime-kalender-cover'
const REPO = 'danielzaiser91/anime-kalender-de'
/** 30 Tage: Der Dateiname trägt die Kennung, nicht den Inhalt; ein neu geholtes Bild soll nach einem Monat überall ankommen. */
const CACHE_CONTROL = 'public, max-age=2592000'
const WRANGLER = join(WURZEL, 'node_modules/wrangler/bin/wrangler.js')

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i < 0 ? undefined : (process.argv[i + 1] ?? '')
}

function ordnerBestimmen() {
  if (arg('--ordner')) return arg('--ordner')
  const lauf = arg('--lauf')
  if (!lauf) throw new Error('--lauf <Kennung> oder --ordner <Pfad> angeben')
  const ziel = mkdtempSync(join(tmpdir(), 'cover-ausgabe-'))
  execFileSync('gh', ['run', 'download', lauf, '--repo', REPO, '-n', `cover-ausgabe-${lauf}`, '-D', ziel], { stdio: 'inherit' })
  return ziel
}

/** Jede Datei des Ordners gegen das Manifest; liefert die Aufträge und die Gründe, warum eine Datei übersprungen wird. */
export function auftraegeAus(ordner, manifest) {
  const eintraege = Object.entries(manifest).filter(([, e]) => e.datei)
  const nachPfad = new Map(eintraege.map(([id, e]) => [e.datei, { id, groesse: e.groesse }]))
  const aufgaben = []
  const abgelehnt = []
  const bilder = existsSync(join(ordner, 'anisearch')) ? readdirSync(join(ordner, 'anisearch')) : []
  for (const name of bilder) {
    const key = `anisearch/${name}`
    const soll = nachPfad.get(key)
    const datei = join(ordner, key)
    if (!soll) abgelehnt.push(`${key}: steht nicht im Manifest`)
    else if (soll.groesse !== statSync(datei).size) abgelehnt.push(`${key}: Größe ${statSync(datei).size} statt ${soll.groesse}`)
    else aufgaben.push({ key, datei })
  }
  return { aufgaben, abgelehnt }
}

const hochladen = (a) =>
  new Promise((ok, fehler) => {
    const args = [WRANGLER, 'r2', 'object', 'put', `${BUCKET}/${a.key}`, '--file', a.datei, '--content-type', 'image/webp', '--cache-control', CACHE_CONTROL, '--remote']
    execFile(process.execPath, args, { cwd: WURZEL }, (e, _out, err) => (e ? fehler(new Error(`${a.key}: ${String(err).trim().split('\n').pop()}`)) : ok()))
  })

/** Mit bis zu `breite` gleichzeitigen Aufrufen; jede Datei bekommt zwei weitere Versuche. */
async function abarbeiten(aufgaben, breite) {
  const fehlerListe = []
  let fertig = 0
  const warteschlange = [...aufgaben]
  const arbeiter = async () => {
    for (let a = warteschlange.shift(); a; a = warteschlange.shift()) {
      let letzter
      for (let versuch = 0; versuch < 3; versuch++) {
        try {
          await hochladen(a)
          letzter = undefined
          break
        } catch (e) {
          letzter = e
        }
      }
      if (letzter) fehlerListe.push(letzter.message)
      if (++fertig % 100 === 0) console.log(`  ${fertig}/${aufgaben.length}`)
    }
  }
  await Promise.all(Array.from({ length: breite }, arbeiter))
  return fehlerListe
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(WURZEL, 'data/cover-eigen.json'), 'utf8'))
  const { aufgaben, abgelehnt } = auftraegeAus(ordnerBestimmen(), manifest)
  abgelehnt.forEach((z) => console.error(`übersprungen — ${z}`))
  console.log(`${aufgaben.length} Bilder zum Hochladen nach ${BUCKET}, ${abgelehnt.length} übersprungen`)
  if (process.argv.includes('--trocken')) return
  const fehler = await abarbeiten(aufgaben, Number(arg('--parallel')) || 8)
  fehler.forEach((z) => console.error(`Fehlschlag — ${z}`))
  console.log(`${aufgaben.length - fehler.length} hochgeladen, ${fehler.length} Fehlschläge`)
  if (fehler.length || abgelehnt.length) process.exitCode = 1
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('cover-nach-r2.mjs')) await main()
