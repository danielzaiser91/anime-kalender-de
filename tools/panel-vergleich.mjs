#!/usr/bin/env node
/**
 * Beweist, dass ein Umbau am Detail-Panel nichts an der Darstellung ändert: Baut die Seite für
 * zwei Commits, öffnet das Panel für eine feste Stichprobe von Titeln und vergleicht das
 * gerenderte HTML — das Gegenstück zu `tools/bau-vergleich.mjs` für `web/src`.
 *
 * Gebaut wird je Commit in einem eigenen Worktree auf dem Datenbestand der Basis; die Uhr der
 * Seite steht in beiden Läufen auf demselben Zeitpunkt (Countdowns, „seit", „heute").
 * Ausgeliefert wird ohne Server aus `dist/` (wie `panel-bild.mjs`), fremde Bilder sind ein Punkt.
 *
 * Aufruf:
 *   node tools/panel-vergleich.mjs [basis] [kandidat] [anzahl]   Vorgabe: origin/main HEAD 80
 * Exit 0 = gleich, 1 = verschieden (Unterschiede unter $TMPDIR/panel-vergleich/).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const WURZEL = path.resolve(import.meta.dirname, '..')
const ABLAGE = path.join(tmpdir(), 'panel-vergleich')
const UHR = new Date('2026-09-26T10:00:00+02:00')
const git = (...args) => execFileSync('git', ['-C', WURZEL, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()
const EIN_PUNKT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

/** Baut `sha` mit dem Datenbestand von `basisSha`; liefert das `dist/`-Verzeichnis. */
function baue(sha, basisSha) {
  const ziel = path.join(ABLAGE, `dist-${sha.slice(0, 12)}-auf-${basisSha.slice(0, 12)}`)
  if (existsSync(path.join(ziel, 'index.html'))) return ziel
  const baum = path.join(ABLAGE, `baum-${sha.slice(0, 12)}`)
  if (existsSync(baum)) git('worktree', 'remove', '--force', baum)
  git('worktree', 'add', '--quiet', '--detach', baum, sha)
  try {
    symlinkSync(path.join(WURZEL, 'node_modules'), path.join(baum, 'node_modules'))
    execFileSync('git', ['-C', baum, 'checkout', basisSha, '--', 'public/data'], { stdio: 'ignore' })
    console.log(`baue Seite ${sha.slice(0, 12)} …`)
    const lauf = spawnSync('npx', ['vite', 'build', '--outDir', ziel, '--emptyOutDir'], { cwd: baum, encoding: 'utf8' })
    if (lauf.status !== 0) throw new Error(`vite build ${sha.slice(0, 12)} gescheitert:\n${lauf.stderr.slice(-2000)}`)
    return ziel
  } finally {
    git('worktree', 'remove', '--force', baum)
  }
}

/** Feste Stichprobe: gleichmäßig über den Bestand verteilt, jede Art von Titel kommt vor. */
function stichprobe(basisSha, anzahl) {
  const titel = JSON.parse(git('show', `${basisSha}:public/data/titles.json`))
  const schritt = Math.max(1, Math.floor(titel.length / anzahl))
  return titel.filter((_, i) => i % schritt === 0).slice(0, anzahl).map((t) => t.id)
}

/** Der Browser, den Playwright erwartet — oder, wo der fehlt, `CHROMIUM` bzw. der vorinstallierte. */
function starteBrowser() {
  if (existsSync(chromium.executablePath())) return chromium.launch()
  const ersatz = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium'
  return chromium.launch(existsSync(ersatz) ? { executablePath: ersatz } : {})
}

async function rendere(dist, ids) {
  const browser = await starteBrowser()
  const seite = await browser.newPage({ viewport: { width: 560, height: 1200 } })
  await seite.clock.install({ time: UHR })
  await seite.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    const datei = path.join(dist, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!datei.startsWith(dist) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    const typ = TYPEN[path.extname(datei)] ?? 'application/octet-stream'
    return route.fulfill({ status: 200, contentType: typ, body: await readFile(datei) })
  })
  const ergebnis = {}
  for (const id of ids) {
    await seite.goto('about:blank')
    await seite.goto(`http://ak.test/#/datenbank?t=${id}`, { waitUntil: 'networkidle' })
    const panel = seite.locator('[data-panel="titel"]')
    try {
      await panel.waitFor({ state: 'visible', timeout: 15_000 })
      await seite.waitForLoadState('networkidle')
      ergebnis[id] = await panel.evaluate((el) => el.outerHTML)
    } catch {
      ergebnis[id] = '<kein Panel>'
    }
  }
  await browser.close()
  return ergebnis
}

const basis = git('rev-parse', process.argv[2] ?? 'origin/main')
const kandidat = git('rev-parse', process.argv[3] ?? 'HEAD')
const anzahl = Number(process.argv[4] ?? 80)
mkdirSync(ABLAGE, { recursive: true })
const ids = stichprobe(basis, anzahl)
const [a, b] = [await rendere(baue(basis, basis), ids), await rendere(baue(kandidat, basis), ids)]
const verschieden = ids.filter((id) => a[id] !== b[id])
const ohnePanel = ids.filter((id) => a[id] === '<kein Panel>').length
for (const id of verschieden) {
  writeFileSync(path.join(ABLAGE, `${id}-basis.html`), a[id])
  writeFileSync(path.join(ABLAGE, `${id}-kandidat.html`), b[id])
}
if (!verschieden.length) {
  console.log(`gleich: ${ids.length - ohnePanel} Panels von ${kandidat.slice(0, 12)} wie ${basis.slice(0, 12)} (${ohnePanel} ohne Panel)`)
  process.exit(0)
}
console.log(`VERSCHIEDEN bei ${verschieden.length} von ${ids.length}: ${verschieden.join(', ')} — Dateien in ${ABLAGE}`)
process.exit(1)
