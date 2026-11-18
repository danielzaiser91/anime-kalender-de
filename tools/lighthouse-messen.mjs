#!/usr/bin/env node
/**
 * **Lighthouse mobil (gedrosselt, Standardprofil) gegen den Build oder die Live-Seite** (18.11.2026, Auftrag perf-waechter).
 *
 * Misst die Seiten aus `tools/lighthouse-grenzen.mjs` (`SEITEN`: Name → Hash-Adresse) je `--n`-mal, bildet den Median je Kennzahl
 * (LCP, CLS, TBT, Byte-Gewicht, vier Kategorien) und vergleicht ihn mit den Grenzen des Profils. Lighthouse kommt per `npx` in fester
 * Fassung (keine Abhängigkeit im Lockfile), Chrome ist Playwrights Chromium (`CHROME_PATH` geht vor).
 *
 * Aufruf: `node tools/lighthouse-messen.mjs (--dist dist | --basis https://anime-kalender.de/) --profil pr|live [--n 3] [--nur-messen] [--ausgabe datei.json]`
 * `--dist` liefert den Ordner für die Dauer der Messung selbst aus (`dist-http.mjs`, Port frei auf 127.0.0.1, danach geschlossen).
 * Exit 1, wenn ein Median eine Grenze reißt oder eine Grenze gegenüber main gelockert wurde (Ratsche, nur im PR-Ereignis).
 */
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { distAusliefern } from './dist-http.mjs'
import { GRENZEN, SEITEN } from './lighthouse-grenzen.mjs'
import { gelockert, kennzahlen, mediane, tabelle, verstoesse } from './lighthouse-urteil.mjs'

export const LIGHTHOUSE = 'lighthouse@13.6.0'
const GRENZEN_PFAD = 'tools/lighthouse-grenzen.mjs'
const FRIST_LAUF_MS = 240000
const WURZEL = path.resolve(import.meta.dirname, '..')

const arg = (name, vorgabe) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : vorgabe)
const hat = (name) => process.argv.includes(`--${name}`)

/** Chrome für Lighthouse: `CHROME_PATH`, sonst Playwrights Chromium, sonst sucht Lighthouse selbst. */
async function chromePfad() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const { chromium } = await import('playwright')
  return existsSync(chromium.executablePath()) ? chromium.executablePath() : undefined
}

/** Ein Lighthouse-Lauf; liefert die Kennzahlen oder wirft mit dem Ende der Ausgabe. Asynchron: `--dist` liefert im selben Prozess aus. */
async function einLauf(adresse, chrome) {
  const kind = spawn('npx', ['-y', LIGHTHOUSE, adresse, '--output=json', '--output-path=stdout', '--quiet', '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-sandbox'], {
    timeout: FRIST_LAUF_MS,
    env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) },
  })
  const aus = []
  const fehler = []
  kind.stdout.on('data', (d) => aus.push(d))
  kind.stderr.on('data', (d) => fehler.push(d))
  const [code, signal] = await new Promise((fertig) => kind.on('close', (c, s) => fertig([c, s])))
  if (code !== 0) throw new Error(`Lighthouse ${adresse}: Exit ${code ?? signal}\n${Buffer.concat(fehler).toString().slice(-2000)}`)
  const bericht = JSON.parse(Buffer.concat(aus).toString())
  if (bericht.runtimeError) throw new Error(`Lighthouse ${adresse}: ${bericht.runtimeError.message}`)
  return kennzahlen(bericht)
}

/** Grenzen auf main (erster Elternteil des Merge-Commits im PR-Ereignis); null außerhalb eines PR oder wenn die Datei dort fehlt. */
async function grenzenAufMain() {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') return null
  try {
    const text = execFileSync('git', ['show', `HEAD^1:${GRENZEN_PFAD}`], { cwd: WURZEL, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] })
    const datei = path.join(mkdtempSync(path.join(tmpdir(), 'lh-grenzen-')), 'main.mjs')
    writeFileSync(datei, text)
    return (await import(pathToFileURL(datei).href)).GRENZEN
  } catch {
    console.log(`lighthouse: ${GRENZEN_PFAD} auf main nicht lesbar, Ratsche ohne Basis`)
    return null
  }
}

/** Misst alle Seiten `n`-mal (Seiten abwechselnd, damit eine Störung nicht alle Läufe einer Seite trifft). */
async function messeAlle(basis, seiten, n, chrome) {
  const laeufe = Object.fromEntries(Object.keys(seiten).map((s) => [s, []]))
  for (let i = 0; i < n; i++) {
    for (const [seite, hash] of Object.entries(seiten)) {
      const k = await einLauf(basis + hash, chrome)
      laeufe[seite].push(k)
      console.log(`${seite} Lauf ${i + 1}: ${JSON.stringify(k)}`)
    }
  }
  return laeufe
}

async function main() {
  const profil = arg('profil', 'pr')
  const n = Number(arg('n', 3))
  const auslieferung = hat('dist') ? await distAusliefern(arg('dist')) : undefined
  const basis = auslieferung?.basis ?? arg('basis', 'https://anime-kalender.de/')
  let laeufe
  try {
    laeufe = await messeAlle(basis, SEITEN, n, await chromePfad())
  } finally {
    await auslieferung?.schliessen()
  }
  const ergebnis = Object.fromEntries(Object.entries(laeufe).map(([s, l]) => [s, mediane(l)]))
  const fehler = hat('nur-messen') ? [] : [...Object.entries(ergebnis).flatMap(([s, w]) => verstoesse(s, w, GRENZEN[profil]?.[s])), ...gelockert(GRENZEN, await grenzenAufMain()).map((z) => `Ratsche gelockert: ${z}`)]
  const md = `### Lighthouse mobil (${profil}, Median aus ${n} Läufen, ${LIGHTHOUSE})\n\n${tabelle(ergebnis, GRENZEN[profil])}\n\n${fehler.length ? fehler.map((f) => `- ✖ ${f}`).join('\n') : '✓ alle Grenzen gehalten'}\n`
  console.log(md)
  if (hat('ausgabe')) {
    mkdirSync(path.dirname(arg('ausgabe')), { recursive: true })
    writeFileSync(arg('ausgabe'), JSON.stringify({ profil, n, lighthouse: LIGHTHOUSE, ergebnis, laeufe, fehler }, null, 2))
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
  process.exit(fehler.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
