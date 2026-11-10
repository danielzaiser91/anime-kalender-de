/**
 * Wache: Jede eigene Cover-Datei aus `data/cover-eigen.json` liegt im Bucket (per HEAD gegen cover.anime-kalender.de, eigene Domain, gedrosselt).
 * Anlass: 16 Einträge lieferten am 10.11.2026 404, weil ihr Datenlauf-Artefakt nie hochgeladen worden war (`tools/cover-nach-r2.mjs` kennt nur das
 * ihm übergebene Artefakt, nie das Manifest).
 *
 * Aufruf: node tools/cover-bucket-pruefen.mjs [--parallel N] [--basis <Adresse>]
 * Exit 0 = alle da, 1 = mindestens eine Datei fehlt (404/410, mit Liste), 2 = nur Nichtauskunft (Zeitüberschreitung, 429, 5xx): kein Befund, aber blind.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASIS = 'https://cover.anime-kalender.de/'

/** Nur 404/410 verneinen; alles andere außer 2xx ist Nichtauskunft. */
export function urteilVonStatus(status) {
  if (status >= 200 && status < 300) return 'da'
  return status === 404 || status === 410 ? 'fehlt' : 'unklar'
}

/** `kopf(datei)` liefert den HTTP-Status oder wirft; jede Datei des Manifests wird mit höchstens `breite` gleichzeitigen Aufrufen gefragt. */
export async function pruefeBucket(manifest, kopf, breite = 4) {
  const dateien = [...new Set(Object.values(manifest).map((e) => e.datei).filter(Boolean))]
  const ergebnis = { gesamt: dateien.length, fehlt: [], unklar: [] }
  const warteschlange = [...dateien]
  const arbeiter = async () => {
    for (let d = warteschlange.shift(); d; d = warteschlange.shift()) {
      let urteil
      try {
        urteil = urteilVonStatus(await kopf(d))
      } catch {
        urteil = 'unklar'
      }
      if (urteil !== 'da') ergebnis[urteil].push(d)
    }
  }
  await Promise.all(Array.from({ length: breite }, arbeiter))
  ergebnis.fehlt.sort()
  ergebnis.unklar.sort()
  return ergebnis
}

/** Exit-Code und Ergebniszeile (Zählzeile nennt jede Kategorie). */
export function berichte(e) {
  const zeile = `Cover-Bucket: ${e.gesamt} Dateien, ${e.fehlt.length} fehlen, ${e.unklar.length} ohne Auskunft`
  const liste = [...e.fehlt.map((d) => `fehlt — ${d}`), ...e.unklar.map((d) => `unklar — ${d}`)]
  return { zeile, liste, code: e.fehlt.length ? 1 : e.unklar.length ? 2 : 0 }
}

async function main() {
  const arg = (n) => process.argv[process.argv.indexOf(n) + 1]
  const basis = process.argv.includes('--basis') ? arg('--basis') : BASIS
  const breite = Number(process.argv.includes('--parallel') ? arg('--parallel') : 4) || 4
  const manifest = JSON.parse(readFileSync(join(WURZEL, 'data/cover-eigen.json'), 'utf8'))
  const kopf = async (d) => (await fetch(basis + d, { method: 'HEAD', signal: AbortSignal.timeout(15000) })).status
  const b = berichte(await pruefeBucket(manifest, kopf, breite))
  b.liste.forEach((z) => console.error(z))
  console.log(b.zeile)
  process.exitCode = b.code
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('cover-bucket-pruefen.mjs')) await main()
