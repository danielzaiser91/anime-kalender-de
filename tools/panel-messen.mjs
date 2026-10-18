#!/usr/bin/env node
/**
 * Misst das Detail-Panel in der ausgelieferten Seite (`dist/`) und hält die Zusicherungen vom 12.10.2026 fest:
 * genau fünf Schriftgrößen (24 · 18 · 15 · 13 · 11 px), kein Tippziel unter 44 × 44, Kontrast AA (hell und dunkel), im Bild nur der
 * ✕-Knopf, Flaggen an der rechten Kante, Maße von Banner und Posterkarte, Unschärfe nur im Rückfall (Titel ohne Banner).
 * Exit 1 bei einem Verstoß.
 *
 * Aufruf: node tools/panel-messen.mjs [--docs] [--echte-bilder] [--dist <Ordner>] [--zeit]
 *   --docs          Bilder `docs/panel-kopf-<AniList-Id>-<handy|rechner>-<hell|dunkel>.png` (sonst nur Messung)
 *   --echte-bilder  Cover und Banner wirklich laden (sonst ein Punkt, wie `panel-bild.mjs`) — nötig für Bilder zum Ansehen
 *   --dist          anderes `dist/` (Vorher-Stand für `--zeit`)
 *   --breit         statt der festen Fälle rund 60 Titel quer durch den Bestand (jeder 60. Titel, jeder 40. Cartoon), nur hell
 *   --zeit          nur die Öffnungszeit des Panels messen (Median von 7, CPU 4-fach gedrosselt), keine Prüfung
 */
import { akVon } from './ak-von.mjs'
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { distPruefen } from './dist-frisch.mjs'
import { flaggenOhneLink, kontrast, kopfMasse, schriftgroessen, tippziele, totesBanner } from './panel-messen-browser.mjs'
import { AUSNAHMEN } from './trefferprobe-ausnahmen.mjs'
import { trefferprobe } from './trefferprobe-browser.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const DIST = path.resolve(arg('--dist') ?? path.join(WURZEL, 'dist'))
const MIT = (name) => process.argv.includes(name)
const FUENF = ['11', '13', '15', '18', '24']
/** Jujutsu Kaisen (mit Banner) und Rozen Maiden: Dreaming (ohne Banner, `listen/luecken/banner.md`). */
const TITEL = [{ name: '113415', ak: akVon('113415') }, { name: '65', ak: akVon('65') }]
const GERAETE = { handy: { width: 393, height: 1700 }, rechner: { width: 1280, height: 1100 } }
/** Handy-Seiten wie ein Telefon emulieren: überlagernde Leiste ohne Platzbedarf (`scrollbar-gutter` reserviert sonst 10 px). */
const TELEFON = { hasTouch: true, isMobile: true }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
const lies = (datei) => JSON.parse(readFileSync(path.join(DIST, 'data', datei), 'utf8'))
const daten = new Map([...lies('titles.json'), ...lies('cartoons.json')].map((t) => [t.id, t]))

/** `--breit`: jeder 60. Titel des Hauptbestands und jeder 40. Cartoon (rund 60 Panels) — findet Zustände, die die festen Fälle nicht zeigen (Kino, TV, Disc, Hinweise). */
function breiteFaelle() {
  const alle = [...daten.values()]
  const hauptbestand = alle.filter((t) => t.id > 0).filter((_, i) => i % 60 === 0)
  const cartoons = alle.filter((t) => t.id < 0).filter((_, i) => i % 40 === 0)
  return [...hauptbestand, ...cartoons].map((t) => ({ name: `breit-${t.id}`, ak: t.id }))
}

/** Sieben weitere Fälle: Flaggen ohne MAL-Kennung, ohne Wertung, Cartoon mit und ohne Wertung (TMDB), dazu ein eigener Handlungstext mit Quellen und Lizenz und zwei Cartoons mit gefalteten Wegen (Jack mit Staffelzeilen, Om Nom mit Staffelspannen). */
function flaggenFaelle() {
  const alle = [...daten.values()]
  const waehle = (name, test) => ({ name, ak: alle.find(test)?.id })
  return [
    waehle('ohne-mal', (t) => t.anisearchId && !t.malId && t.score !== undefined),
    waehle('ohne-wertung', (t) => t.anisearchId && t.malId && t.score === undefined),
    waehle('cartoon-tmdb', (t) => t.westlich && t.tmdbId && t.score !== undefined),
    waehle('cartoon-ohne-wertung', (t) => t.westlich && t.tmdbId && t.score === undefined),
    { name: 'eigene-handlung', ak: akVon('198369') },
    { name: 'cartoon-jack', ak: -92684 },
    { name: 'cartoon-omnom', ak: -57480 },
  ]
}

/** Ohne Server: Alles unter `ak.test` kommt aus `dist/`, fremde Bilder sind ein Punkt oder (mit `--echte-bilder`) echt. */
async function beantworte(route) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'ak.test') {
    if (MIT('--echte-bilder') && route.request().resourceType() === 'image') return route.continue()
    return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  }
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

async function oeffne(seite, ak, thema) {
  await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/datenbank?t=${ak}`, { waitUntil: 'networkidle' })
  const panel = seite.locator('[data-panel="titel"]')
  await panel.waitFor({ state: 'visible', timeout: 20_000 })
  await panel.locator('[data-kopf]').waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(MIT('--echte-bilder') ? 2500 : 600)
  return panel
}

/** Erwartete Flaggen aus den Daten und der Regel in `detail/verweise.ts` / `flaggen.tsx`. */
function erwarteteFlaggen(t) {
  const quelle = t.westlich && t.tmdbId ? 'TMDB' : t.anisearchId ? 'aniSearch' : undefined
  const wertung = t.score === undefined ? undefined : (t.score / 10).toFixed(1).replace('.', ',')
  return { quelle: quelle ?? (wertung ? (t.scoreQuelle === 'tmdb' ? 'TMDB' : 'aniSearch') : undefined), wertung, mal: Boolean(t.malId), link: Boolean(quelle) }
}

function pruefeFlaggen(t, m) {
  const soll = erwarteteFlaggen(t)
  const probleme = []
  const texte = m.flaggen.map((f) => f.text)
  const quelle = texte.find((x) => !x.startsWith('MAL'))
  if (Boolean(quelle) !== Boolean(soll.quelle)) probleme.push(`Quell-Flagge ${quelle ? 'da' : 'fehlt'}, erwartet ${soll.quelle ?? 'keine'}`)
  if (quelle && !quelle.startsWith(soll.quelle)) probleme.push(`Quell-Flagge „${quelle}“, erwartet ${soll.quelle}`)
  if (quelle && soll.wertung && !quelle.includes(`★ ${soll.wertung}`) && !quelle.includes(`★${soll.wertung}`)) probleme.push(`Wertung ${soll.wertung} fehlt in „${quelle}“`)
  if (quelle && !soll.wertung && quelle.includes('★')) probleme.push('Stern ohne Wertung')
  if (texte.some((x) => x.startsWith('MAL')) !== soll.mal) probleme.push(`MAL-Flagge ${soll.mal ? 'fehlt' : 'steht trotz fehlender Kennung'}`)
  if (m.flaggenBox && Math.abs(m.flaggenBox.r - m.kopf.r) > 0.5) probleme.push(`Flaggen ${Math.round(m.kopf.r - m.flaggenBox.r)} px von der rechten Kante`)
  return probleme
}

function pruefeKopf(t, geraet, m) {
  const probleme = []
  const handy = geraet === 'handy'
  const soll = { banner: handy ? 200 : 240, poster: handy ? [120, 180] : [140, 210], ueberhang: handy ? 72 : 84 }
  if (m.kopf.h !== soll.banner) probleme.push(`Banner ${m.kopf.h} px hoch, erwartet ${soll.banner}`)
  if (m.poster.w !== soll.poster[0] || m.poster.h !== soll.poster[1]) probleme.push(`Posterkarte ${m.poster.w}×${m.poster.h}, erwartet ${soll.poster.join('×')}`)
  const ueberhang = Math.round(m.kopf.b - m.poster.t)
  if (ueberhang !== soll.ueberhang) probleme.push(`Poster ragt ${ueberhang} px in das Banner, erwartet ${soll.ueberhang}`)
  if (m.name.l < m.poster.r) probleme.push('Name steht nicht rechts neben der Posterkarte')
  if (m.knoepfeImBild.length !== 1 || m.knoepfeImBild[0].label !== 'Schließen') probleme.push(`Knöpfe im Bild: ${JSON.stringify(m.knoepfeImBild.map((k) => k.label))}, erwartet nur „Schließen“`)
  else if (m.knoepfeImBild[0].w !== 44 || m.knoepfeImBild[0].h !== 44) probleme.push(`✕ ${m.knoepfeImBild[0].w}×${m.knoepfeImBild[0].h}, erwartet 44×44`)
  const ohneBanner = !t.bannerImage
  if (m.filterElemente !== (ohneBanner ? 1 : 0)) probleme.push(`${m.filterElemente} Elemente mit Filter, erwartet ${ohneBanner ? 1 : 0} (nur der Rückfall)`)
  return probleme
}

/** Trefferprobe über das ganze Panel (jedes Bedienelement anklickbar). Nichts geprüft = rot, sonst läuft die Probe ins Leere. */
async function trefferprobePanel(seite) {
  const r = await seite.evaluate(trefferprobe, { wurzel: '[data-panel="titel"]', ausnahmen: AUSNAHMEN })
  if (r.geprueft === 0) return ['Trefferprobe: kein Bedienelement im Panel gefunden']
  return r.befunde.map((b) => `Verdeckt: ${b}`)
}

/** Eine Messzelle (Titel × Gerät × Thema): alle Zusicherungen, dazu die gefundenen Schriftgrößen für die Gesamtprüfung. */
async function messeZelle(seite, fall, geraet, thema, groessenGesamt) {
  const panel = await oeffne(seite, fall.ak, thema)
  const rot = []
  const groessen = await seite.evaluate(schriftgroessen)
  for (const [px, beispiele] of Object.entries(groessen)) {
    groessenGesamt.add(px)
    if (!FUENF.includes(px)) rot.push(`Schriftgröße ${px} px (${beispiele.slice(0, 3).join(' | ')})`)
  }
  for (const f of await seite.evaluate(tippziele, 44)) rot.push(`Tippziel ${f.w}×${f.h}: ${f.schluessel}`)
  for (const f of await seite.evaluate(kontrast)) rot.push(`Kontrast ${f.verhaeltnis}:1 (soll ${f.soll}): ${f.schluessel}`)
  const m = await seite.evaluate(kopfMasse)
  rot.push(...pruefeKopf(daten.get(fall.ak), geraet, m), ...pruefeFlaggen(daten.get(fall.ak), m))
  if (MIT('--docs') && !fall.name.includes('-')) await panel.screenshot({ path: path.join(WURZEL, 'docs', `panel-kopf-${fall.name}-${geraet}-${thema}.png`) })
  // Zuletzt: beide Proben scrollen das Panel und würden Maße und Bild danach verfälschen.
  rot.push(...(await trefferprobePanel(seite)))
  for (const f of await seite.evaluate(flaggenOhneLink)) rot.push(`Verdeckt: ${f}`)
  for (const f of await seite.evaluate(totesBanner)) rot.push(`Totes Banner: ${f}`)
  return { rot, kastenTop: Math.round(m.kastenTop) }
}

/** Nur die Trefferprobe bei 360 px (kleinste verbreitete Handybreite, die übrigen Messungen laufen bei 393 px), beide Themen. */
async function messeSchmal(browser) {
  const rot = []
  const seite = await browser.newPage({ viewport: { width: 360, height: 1700 }, ...TELEFON })
  await seite.route('**/*', beantworte)
  for (const fall of [...TITEL, ...flaggenFaelle()]) {
    for (const thema of fall.name.includes('-') ? ['hell'] : ['hell', 'dunkel']) {
      await oeffne(seite, fall.ak, thema)
      const befunde = await trefferprobePanel(seite)
      console.log(`  ${befunde.length ? '✕' : 'ok'} ${fall.name} 360 px ${thema}: Trefferprobe, ${befunde.length} Verstöße`)
      rot.push(...befunde.map((b) => `${fall.name} 360 px ${thema}: ${b}`))
    }
  }
  await seite.close()
  return rot
}

async function messeAlles() {
  const browser = await chromium.launch()
  const rot = []
  const groessenGesamt = new Set()
  for (const [geraet, viewport] of Object.entries(GERAETE)) {
    const seite = await browser.newPage({ viewport, ...(geraet === 'handy' ? TELEFON : {}) })
    await seite.route('**/*', beantworte)
    const faelle = MIT('--breit') && geraet === 'handy' ? breiteFaelle() : [...TITEL, ...(geraet === 'handy' ? flaggenFaelle() : [])]
    for (const fall of faelle) {
      for (const thema of fall.name.includes('-') ? ['hell'] : ['hell', 'dunkel']) {
        const z = await messeZelle(seite, fall, geraet, thema, groessenGesamt)
        console.log(`  ${z.rot.length ? '✕' : 'ok'} ${fall.name} ${geraet} ${thema}: Kasten beginnt bei ${z.kastenTop} px, ${z.rot.length} Verstöße`)
        rot.push(...z.rot.map((r) => `${fall.name} ${geraet} ${thema}: ${r}`))
      }
    }
    await seite.close()
  }
  rot.push(...(await messeSchmal(browser)))
  await browser.close()
  console.log(`  Schriftgrößen gefunden: ${[...groessenGesamt].sort((a, b) => a - b).join(', ')} px`)
  if (groessenGesamt.size !== 5) rot.push(`${groessenGesamt.size} Schriftgrößen statt genau fünf`)
  return rot
}

/** Öffnungszeit: von der Adressänderung bis zwei Bildwiederholungen nach dem Erscheinen des Kopfs; Median, CPU 4-fach gedrosselt. */
async function messeZeit() {
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: GERAETE.handy, ...TELEFON })
  await seite.route('**/*', beantworte)
  await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })
  const cdp = await seite.context().newCDPSession(seite)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  for (const fall of TITEL) {
    const zeiten = []
    for (let i = 0; i < 8; i++) {
      zeiten.push(await seite.evaluate((ak) => new Promise((fertig) => {
        const t0 = performance.now()
        const mo = new MutationObserver(() => {
          if (!document.querySelector('[data-panel="titel"]')) return
          mo.disconnect()
          requestAnimationFrame(() => requestAnimationFrame(() => fertig(performance.now() - t0)))
        })
        mo.observe(document.body, { childList: true, subtree: true })
        setTimeout(() => fertig(-1), 20_000)
        location.hash = `#/datenbank?t=${ak}`
      }), fall.ak))
      await seite.locator('[data-panel="titel"] button[aria-label="Schließen"]').first().click()
      await seite.locator('[data-panel="titel"]').waitFor({ state: 'detached' })
      console.log(`    Lauf ${i}: ${Math.round(zeiten[zeiten.length - 1])} ms`)
      await seite.waitForTimeout(400)
    }
    const gemessen = zeiten.slice(1).sort((a, b) => a - b)
    console.log(`  ${fall.name}: Panel offen nach ${Math.round(gemessen[3])} ms (Median von 7, gedrosselt; alle: ${gemessen.map(Math.round).join(' ')})`)
  }
  await browser.close()
}

async function main() {
  if (!arg('--dist') && !distPruefen(WURZEL)) return
  if (MIT('--zeit')) return messeZeit()
  const rot = await messeAlles()
  if (rot.length) {
    console.log(`\n  ✕ ${rot.length} Verstöße:`)
    for (const r of rot.slice(0, 60)) console.log(`    ${r}`)
    process.exitCode = 1
  } else console.log('\n  ok  fünf Schriftgrößen, Tippziele ≥ 44, Kontrast AA, nur ✕ im Bild, Flaggen und Maße stimmen')
}

await main()
