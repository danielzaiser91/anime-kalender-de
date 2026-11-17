/**
 * Klick/Tipp aufs Such-Icon der Kopfleiste muss das Suchfeld fokussieren und den Fokus behalten (Issue 4072).
 * Je Versuch: Fokus-Ziel nach 50, 300 und 1000 ms und die Folge der focus/blur-Ereignisse an Eingabefeldern.
 * Dazu Tastatur: Tab erreicht das Icon, Enter und Leertaste fokussieren das Feld; am aufklappbaren Handy-Feld
 * (390 px, Datenbank) schließt Escape und gibt den Fokus ans Icon zurück.
 * Aufruf allein: node tools/ansicht-such-icon-fokus.mjs [Versuche] [--url https://anime-kalender.de]
 * (ohne --url aus dist/, Standard 20 je Fall; mit --url gegen die Live-Seite, Anfragen werden nicht abgefangen)
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tasteUrteil } from './such-icon-taste-urteil.mjs'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
const PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const BASIS = 'http://ak.test'
const ICON = 'button[aria-label="Suche öffnen"]'
const FAELLE = [
  { name: 'Rechner 1366 Start', pfad: '/#/woche', viewport: { width: 1366, height: 900 } },
  { name: 'Handy 390 Start', pfad: '/#/woche', viewport: { width: 390, height: 844 }, handy: true },
  { name: 'Handy 390 Datenbank', pfad: '/#/datenbank', viewport: { width: 390, height: 844 }, handy: true },
]
const TASTEN_FAELLE = [
  { name: 'Rechner 1366 Start', pfad: '/#/woche', viewport: { width: 1366, height: 900 }, escape: false },
  { name: 'Handy 390 Datenbank', pfad: '/#/datenbank', viewport: { width: 390, height: 844 }, handy: true, escape: true },
]

async function ausDist(route) {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Läuft im Browser: wer hat den Fokus? „feld“ = sichtbares Suchfeld. */
function fokusZiel() {
  const a = document.activeElement
  if (a?.tagName === 'INPUT' && a.type === 'search' && a.offsetParent !== null) return 'feld'
  return a ? `${a.tagName.toLowerCase()}${a.getAttribute('aria-hidden') ? '(versteckt)' : ''}` : 'nichts'
}

/** Läuft im Browser: hängt den Ereignis-Schreiber an. */
function horchen() {
  window.__folge = []
  for (const art of ['focus', 'blur']) {
    document.addEventListener(art, (e) => {
      if (e.target.tagName === 'INPUT') window.__folge.push(`${art}:${e.target.type}${e.target.getAttribute('aria-hidden') ? '(versteckt)' : ''}`)
    }, true)
  }
}

async function versuch(seite, handy) {
  await seite.evaluate(horchen)
  const icon = seite.locator(ICON).first()
  if (handy) await icon.tap()
  else await icon.click()
  const ziele = []
  let t = 0
  for (const ms of [50, 300, 1000]) {
    await seite.waitForTimeout(ms - t)
    t = ms
    ziele.push(await seite.evaluate(fokusZiel))
  }
  const folge = await seite.evaluate(() => window.__folge)
  return { ziele, folge, ok: ziele[1] === 'feld' && ziele[2] === 'feld' }
}

/** Liefert { zeilen, abweichungen }; `n` Versuche je Fall. */
export async function pruefeSuchIconFokus(chromium, n = 20, antworte = ausDist, { drossel = 1, sofort = false, basis = '' } = {}) {
  const browser = await chromium.launch(process.env.AK_CHROME ? { executablePath: process.env.AK_CHROME } : {})
  const zeilen = []
  const abweichungen = []
  for (const f of FAELLE) {
    const ctx = await browser.newContext({ viewport: f.viewport, hasTouch: !!f.handy, isMobile: !!f.handy })
    const seite = await ctx.newPage()
    if (!basis) await seite.route('**/*', antworte)
    if (drossel > 1) await (await ctx.newCDPSession(seite)).send('Emulation.setCPUThrottlingRate', { rate: drossel })
    let fehl = 0
    let beispiel = ''
    for (let i = 0; i < n; i++) {
      await seite.goto('about:blank')
      await seite.goto((basis || BASIS) + f.pfad, { waitUntil: sofort ? 'commit' : 'networkidle' })
      await seite.locator(ICON).first().waitFor({ state: 'visible' })
      if (!sofort) await seite.waitForTimeout(300)
      const r = await versuch(seite, f.handy)
      if (!r.ok) {
        fehl++
        beispiel ||= `${r.ziele.join('/')} · ${r.folge.join(' → ')}`
      }
    }
    zeilen.push({ fall: f.name, versuche: n, fehl, beispiel })
    if (fehl) abweichungen.push(`${f.name}: ${fehl} von ${n} ohne Fokus (${beispiel})`)
    await ctx.close()
  }
  await browser.close()
  return { zeilen, abweichungen }
}

/** Läuft im Browser: aria-label des Fokus und ob ein Suchfeld sichtbar ist. */
function tastenStand() {
  const a = document.activeElement
  return { label: a?.getAttribute('aria-label') ?? a?.tagName, feld: [...document.querySelectorAll('input[type="search"]')].some((e) => e.offsetParent !== null) }
}

async function tastenVersuch(seite, taste, escape) {
  let erreicht = false
  for (let k = 0; k < 40 && !erreicht; k++) {
    await seite.keyboard.press('Tab')
    erreicht = (await seite.evaluate(tastenStand)).label === 'Suche öffnen'
  }
  const r = { erreicht, taste, escape }
  if (erreicht) {
    await seite.keyboard.press(taste)
    await seite.waitForTimeout(300)
    r.ziel = await seite.evaluate(fokusZiel)
  }
  if (erreicht && escape && r.ziel === 'feld') {
    await seite.keyboard.press('Escape')
    await seite.waitForTimeout(300)
    const st = await seite.evaluate(tastenStand)
    r.nachEscape = st.label
    r.feldNoch = st.feld
  }
  return tasteUrteil(r)
}

/** Tastaturfälle; `n` Versuche je Fall, abwechselnd Enter und Leertaste. Liefert { zeilen, abweichungen }. */
export async function pruefeSuchIconTastatur(chromium, n = 6, antworte = ausDist, { basis = '' } = {}) {
  const browser = await chromium.launch(process.env.AK_CHROME ? { executablePath: process.env.AK_CHROME } : {})
  const zeilen = []
  const abweichungen = []
  for (const f of TASTEN_FAELLE) {
    const ctx = await browser.newContext({ viewport: f.viewport, hasTouch: !!f.handy, isMobile: !!f.handy })
    const seite = await ctx.newPage()
    if (!basis) await seite.route('**/*', antworte)
    let fehl = 0
    let beispiel = ''
    for (let i = 0; i < n; i++) {
      await seite.goto('about:blank')
      await seite.goto((basis || BASIS) + f.pfad, { waitUntil: 'networkidle' })
      await seite.locator(ICON).first().waitFor({ state: 'visible' })
      await seite.waitForTimeout(300)
      const grund = await tastenVersuch(seite, i % 2 ? 'Space' : 'Enter', f.escape)
      if (grund) {
        fehl++
        beispiel ||= grund
      }
    }
    zeilen.push({ fall: `${f.name} Tastatur${f.escape ? ' mit Escape' : ''}`, versuche: n, fehl, beispiel })
    if (fehl) abweichungen.push(`${f.name} Tastatur: ${fehl} von ${n} falsch (${beispiel})`)
    await ctx.close()
  }
  await browser.close()
  return { zeilen, abweichungen }
}

/** Liest `[Versuche] [--url Adresse]`; Schrägstrich am Ende der Adresse fällt weg. */
export function leseArgumente(argv) {
  const i = argv.indexOf('--url')
  const basis = i >= 0 ? (argv[i + 1] ?? '').replace(/\/+$/, '') : ''
  const rest = i >= 0 ? argv.filter((_, k) => k !== i && k !== i + 1) : argv
  return { basis, n: Number(rest[0]) || 20 }
}

/** Wahr, wenn dieses Modul direkt gestartet wurde (Pfadvergleich statt file://-Text, der unter Windows nie passt). */
export function istHauptmodul(metaUrl, argv1) {
  return !!argv1 && path.resolve(fileURLToPath(metaUrl)) === path.resolve(argv1)
}

if (istHauptmodul(import.meta.url, process.argv[1])) {
  const { chromium } = await import('playwright')
  const { basis, n } = leseArgumente(process.argv.slice(2))
  const r = await pruefeSuchIconFokus(chromium, n, undefined, { drossel: Number(process.env.AK_DROSSEL) || 1, sofort: !!process.env.AK_SOFORT, basis })
  const t = await pruefeSuchIconTastatur(chromium, Math.min(n, 10), undefined, { basis })
  console.log('| Fall | Versuche | Fehlversuche | Beispiel (Fokus 50/300/1000 ms · Ereignisse bzw. Tastatur) |\n|---|---|---|---|')
  for (const z of [...r.zeilen, ...t.zeilen]) console.log(`| ${z.fall} | ${z.versuche} | ${z.fehl} | ${z.beispiel || '–'} |`)
  process.exit(0)
}
