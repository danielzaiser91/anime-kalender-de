#!/usr/bin/env node
/**
 * Bildet die Hauptansichten ab — Woche, Monat, Datenbank, News und die festen Seiten.
 *
 * Das Gegenstück zu `panel-bild.mjs`, das nur das Detail-Panel kennt. Der
 * Kalender ist das Kernstück der Seite und war bis zum 03.09.2026 nie
 * abgebildet: Alle Styling-Befunde kamen aus Screenshots, die Daniel selbst
 * gemacht hat.
 *
 * **Ohne Server**, wie das Panel-Werkzeug: `page.route()` beantwortet jede
 * Anfrage aus `dist/`, gerendert wird also genau das, was ausgeliefert wird.
 *
 * Aufruf: node tools/ansicht-bild.mjs [--handy] [--docs] [<ansicht> …]   (Vorgabe: alle)
 *         npm run check:ansichten
 *
 * Ergebnis: `ansicht-<name>-<hell|dunkel>.png` im Temp-Ordner; nur mit `--docs` (`npm run ansichten:bilder`) nach `docs/`.
 * Dort sind sie getrackt — ein gewöhnlicher Prüflauf soll keinen Diff erzeugen. Dazu je Ansicht die Zahl
 * der Konsolenfehler und ein Hinweis, wenn die Seite waagerecht scrollt — das
 * ist der Mangel, den man auf einem Bild am leichtesten übersieht.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { bilderOrdner } from './bilder-ordner.mjs'
import { pruefeFilterfenster } from './ansicht-filterfenster.mjs'
import { pruefeFilterfensterRechner } from './ansicht-filterfenster-rechner.mjs'
import { pruefeTrefferprobe } from './ansicht-trefferprobe.mjs'
import { pruefeAdressen } from './ansicht-adressen.mjs'
import { pruefeHoverCover } from './ansicht-hover-cover.mjs'
import { pruefeStatusfarben } from './ansicht-statusfarben.mjs'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const BILDER = bilderOrdner(WURZEL, 'ak-ansichten')
/*
  Alle Routen aus `shared`/`router.ts` — auch die, die nicht in der
  Navigation stehen. Gerade dort fällt ein Fehler sonst niemandem auf: Wer
  „Quellen" oder „Datenschutz" öffnet, tut das selten, und wenn, dann einmal.

  **Eine neue Route gehört in diese Liste.** „News" kam am 12.09.2026 dazu und
  stand einen halben Tag lang in keiner Bildprüfung — der Lauf meldete
  trotzdem „ok", weil er nur zählt, was er kennt. Ein Prüflauf, der eine Lücke
  nicht nennt, ist von einem bestandenen nicht zu unterscheiden.
*/
const ALLE = [
  'woche',
  'monat',
  'datenbank',
  'news',
  'saison',
  'abo',
  'newsletter',
  'quellen',
  'impressum',
  'datenschutz',
  'empfehlung',
]

/** Ein 1×1-Pixel-PNG, transparent — die Antwort auf jede fremde Bildanfrage. */
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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Zustand, in dem Beerus und Fool Night unter „Cartoon" standen (09.10.2026): Schalter „Anime ohne deutsche Synchro" an, danach
 * der Schnellfilter „Cartoon". Doppelte Kennungen in der Liste ließen Kacheln als Geister im Raster stehen. Jede Kachel im Raster
 * muss ein Cartoon sein, und das Raster darf keine fremden Knoten tragen.
 */
async function pruefeCartoonFilter(seite) {
  await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })
  await seite.getByText('Anime ohne deutsche Synchro').first().click()
  await seite.waitForTimeout(6000)
  await seite.getByRole('button', { name: /^Filter/ }).first().click()
  await seite.locator('[aria-label*="Cartoon"]').first().click()
  await seite.waitForTimeout(6000)
  const r = await seite.evaluate(() => {
    const raster = [...document.querySelectorAll('div.grid')].find((g) => g.children.length > 20)
    if (!raster) return 'kein Raster gefunden'
    const fiber = raster[Object.keys(raster).find((k) => k.startsWith('__reactFiber'))]
    const react = fiber.memoizedProps.children.length
    const karten = [...raster.children].filter((c) => c.classList.contains('group'))
    const fremd = karten.filter((k) => !/CARTOON/.test(k.innerText)).map((k) => k.innerText.split('\n')[3] ?? '?')
    return { fremd, geister: karten.length - react }
  })
  if (typeof r === 'string') return r
  if (r.fremd.length) return `✕ Kacheln ohne Cartoon im Raster: ${r.fremd.join(', ')}`
  if (r.geister > 0) return `✕ ${r.geister} Kachel(n) im Raster, die React nicht kennt`
  return 'ok'
}

/** Druckt den Befund von `pruefeCartoonFilter`; wahr, wenn er rot ist. */
async function meldeCartoonFilter(seite) {
  const befund = await pruefeCartoonFilter(seite)
  console.log(`\nDatenbank, „Anime ohne deutsche Synchro" an + Cartoon-Filter: ${befund}`)
  return befund !== 'ok'
}

/** Abstände der unteren Werkzeugleiste (Portal am body; nur Kalender und Datenbank) zu Fensterrand unten, links, rechts. */
function untereLeisteMasse(seite) {
  return seite.evaluate(() => {
    const leiste = document.querySelector('body > [role=toolbar]')
    const r = leiste?.getBoundingClientRect()
    if (!r) return null
    const s = getComputedStyle(leiste)
    return {
      unten: Math.round(innerHeight - r.bottom),
      links: Math.round(r.left),
      rechts: Math.round(innerWidth - r.right),
      padUnten: parseFloat(s.paddingBottom),
      padRechts: parseFloat(s.paddingRight),
    }
  })
}

/** Die Handy-Navigation steht oben in der Kopfleiste (nicht fest am unteren Rand). Liefert `true`, wenn ja, sonst den Befund. */
function navigationOben(seite) {
  return seite.evaluate(() => {
    const navs = [...document.querySelectorAll('header nav')].filter((n) => n.getBoundingClientRect().height > 0)
    const r = navs[0]?.getBoundingClientRect()
    if (!r) return 'keine sichtbare Navigation in der Kopfleiste'
    if (getComputedStyle(navs[0]).position === 'fixed' || r.bottom > innerHeight / 3) return `Navigation nicht oben (Unterkante ${Math.round(r.bottom)} px)`
    return true
  })
}

/** Die Handy-Messungen einer Ansicht: untere Leiste, Navigation oben, Monatspunkte. Am Rechner leer. */
async function handyMessung(seite, handy, name) {
  if (!handy) return { nav: null, navOben: true, punkte: null }
  return {
    nav: await untereLeisteMasse(seite),
    navOben: await navigationOben(seite),
    punkte: name === 'monat' ? await pruefeMonatPunkte(seite) : null,
  }
}

/** Navigation oben, Werkzeugleiste unten bündig: kein Abstand unten, links, rechts. Meldet jede Abweichung; wahr, wenn alles stimmt. */
function handyLeistenOk({ name, nav: m, navOben }) {
  if (navOben !== true) {
    console.log(`  ✕ ${name}: ${navOben}`)
    return false
  }
  if (!m || (m.unten === 0 && m.links === 0 && m.rechts === 0 && m.padUnten >= 6 && m.padRechts >= 6)) return true
  console.log(`  ✕ ${name}: untere Leiste nicht bündig oder ohne Innenabstand (Rand unten ${m.unten}, links ${m.links}, rechts ${m.rechts} px; Padding unten ${m.padUnten}, rechts ${m.padRechts} px, mind. 6)`)
  return false
}

/**
 * Monatszelle am Handy (09.10.2026): Punkte in Anbieterfarbe statt Cover. Kein sichtbares Bild im Raster, jeder Punkt
 * mindestens 8 px, das Tippziel der Zelle mindestens 40 px hoch und breit, und der Knopf nennt Titel (aria-label).
 */
function pruefeMonatPunkte(seite) {
  return seite.evaluate(() => {
    const knoepfe = [...document.querySelectorAll('main button')].filter((b) => b.offsetParent && b.querySelector('[data-monatspunkt]'))
    const bilder = [...document.querySelectorAll('main img')].filter((i) => i.offsetParent).length
    const kleinPunkt = [...document.querySelectorAll('[data-monatspunkt]')].filter((p) => p.getBoundingClientRect().width < 8).length
    const kleinZiel = knoepfe.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 40 || r.height < 40 }).length
    const ohneTitel = knoepfe.filter((b) => !/: .{3,}/.test(b.getAttribute('aria-label') ?? '')).length
    return { zellen: knoepfe.length, bilder, kleinPunkt, kleinZiel, ohneTitel }
  })
}

/** Druckt Befunde von `pruefeMonatPunkte`; wahr, wenn rot. */
function monatPunkteRot(m) {
  const fehler = []
  if (m.zellen === 0) fehler.push('keine Zelle mit Punkten gefunden')
  if (m.bilder) fehler.push(`${m.bilder} sichtbare Bilder im Monat`)
  if (m.kleinPunkt) fehler.push(`${m.kleinPunkt} Punkte unter 8 px`)
  if (m.kleinZiel) fehler.push(`${m.kleinZiel} Tageszellen unter 40 px Tippziel`)
  if (m.ohneTitel) fehler.push(`${m.ohneTitel} Zellen ohne Titel im aria-label`)
  for (const f of fehler) console.log(`  ✕ Monat am Handy: ${f}`)
  return fehler.length > 0
}

/**
 * Die untere Handy-Werkzeugleiste (Kalender Woche/Monat, Datenbank) passt bei 320 bis 440 px ohne Wischen: nichts ragt über den
 * Rand, die Leiste selbst scrollt nicht, und jedes Tippziel ist mindestens 40 × 40 px. Gibt die Abweichungen zurück.
 */
async function pruefeWerkzeugleiste(seite) {
  const abweichungen = []
  for (const breite of [320, 360, 393, 440]) {
    await seite.setViewportSize({ width: breite, height: 800 })
    for (const name of ['woche', 'monat', 'datenbank']) {
      await seite.goto('about:blank')
      await seite.goto(`http://ak.test/#/${name}`, { waitUntil: 'networkidle' })
      await seite.locator('[role=toolbar]').first().waitFor({ state: 'visible', timeout: 20_000 })
      await seite.waitForTimeout(1500)
      const m = await seite.evaluate(() => {
        const leiste = document.querySelector('[role=toolbar]')
        const rects = [...leiste.querySelectorAll('button, select')].map((e) => {
          const r = e.getBoundingClientRect()
          return { name: e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '?', links: r.left, rechts: r.right, b: r.width, h: r.height }
        })
        return { rollt: leiste.scrollWidth - leiste.clientWidth, fenster: innerWidth, rects }
      })
      const wo = `${name} ${breite} px`
      if (m.rollt > 0) abweichungen.push(`${wo}: Leiste scrollt (${m.rollt} px zu breit)`)
      for (const r of m.rects) {
        if (r.links < 0 || r.rechts > m.fenster - 8) abweichungen.push(`${wo}: „${r.name}" ragt in den Randabstand (${Math.round(r.links)}–${Math.round(r.rechts)} von ${m.fenster})`)
        if (r.b < 44 || r.h < 44) abweichungen.push(`${wo}: „${r.name}" ist nur ${Math.round(r.b)} × ${Math.round(r.h)} px groß (mind. 44 × 44)`)
      }
    }
  }
  return abweichungen
}

/** Cover-Vorschau der Listenzeilen in der Woche (Maus und Touch); wahr, wenn rot. */
async function meldeHoverCover() {
  const r = await pruefeHoverCover(chromium, antworteAusDist)
  const ok = r.maus ? `ok (nach ${Math.round(r.maus.nach)} ms)` : ''
  console.log(`\nCover-Vorschau (Woche, Maus und Touch): ${r.abweichungen.length ? '' : ok}`)
  for (const a of r.ansichten) console.log(`  ${a.name}: ${a.uebersprungen ? 'übersprungen (keine Ereignisse mit Cover in dieser Woche)' : `geprüft an „${a.zeile ?? '–'}“`}`)
  for (const l of r.abweichungen) console.log(`  ✕ ${l}`)
  return r.abweichungen.length > 0
}

/** Die Zusatzprüfungen nach den Bildern; wahr, wenn eine rot ist. */
async function meldeZusatzpruefungen(seite, ansichten, handy) {
  /* Der Cartoon-Filter wird am Rechner geprüft; am Handy liegt der Schalter im geschlossenen Filterfenster. */
  let rot = ansichten.includes('datenbank') && !handy ? await meldeCartoonFilter(seite) : false
  if (ansichten.includes('datenbank') && !handy && (await pruefeAdressen(seite, DIST))) rot = true
  if (['datenbank', 'news'].every((a) => ansichten.includes(a)) && !handy && (await pruefeStatusfarben(seite))) rot = true
  if (!handy && ['woche', 'datenbank'].every((a) => ansichten.includes(a))) {
    const rechner = await pruefeFilterfensterRechner(chromium, antworteAusDist)
    console.log(`\nFilterfenster am Rechner (1280 px, Woche und Datenbank): ${rechner.abweichungen.length ? '' : 'ok'}`)
    for (const l of rechner.abweichungen) console.log(`  ✕ ${l}`)
    if (rechner.abweichungen.length) rot = true
  }
  if (!handy && ansichten.includes('woche') && (await meldeHoverCover())) rot = true
  if (handy && ['woche', 'monat', 'datenbank'].every((a) => ansichten.includes(a))) {
    const leiste = await pruefeWerkzeugleiste(seite)
    console.log(`\nWerkzeugleiste unten (320/360/393/440 px): ${leiste.length ? '' : 'ok'}`)
    for (const l of leiste) console.log(`  ✕ ${l}`)
    if (leiste.length) rot = true
    const fenster = await pruefeFilterfenster(seite)
    console.log(`\nFilterfenster (320/375/393/440 px, Woche und Datenbank): ${fenster.abweichungen.length ? '' : 'ok'}`)
    for (const l of fenster.abweichungen) console.log(`  ✕ ${l}`)
    if (fenster.abweichungen.length) rot = true
    const treffer = await pruefeTrefferprobe(seite)
    console.log(`\nTrefferprobe (360 px, beide Themen, ${Object.values(treffer.geprueft).reduce((a, b) => a + b, 0)} Bedienelemente): ${treffer.abweichungen.length ? '' : 'ok'}`)
    for (const l of treffer.abweichungen) console.log(`  ✕ ${l}`)
    if (treffer.abweichungen.length) rot = true
  }
  return rot
}

/** Beantwortet jede Anfrage aus `dist/`; auch das Rechner-Filterfenster (eigener Browser) nutzt sie. */
async function antworteAusDist(route) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  /*
    **Fremde Bilder werden beantwortet, nicht abgewiesen.**

    Die Cover liegen bei AniList. Ein `route.abort()` sparte den Abruf, warf
    aber je Bild einen Konsolenfehler — sechzig Stück in der Datenbank-Ansicht,
    und die Fehlerzählung dieses Werkzeugs war damit wertlos. Ein
    Einpunkt-PNG kostet nichts und hält die Konsole sauber für die Fehler, um
    die es geht.
  */
  if (url.hostname !== 'ak.test') {
    return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  }
  const rel = url.pathname === '/' ? '/index.html' : url.pathname
  const datei = path.join(DIST, rel)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({
    status: 200,
    contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
    body: await readFile(datei),
  })
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const gewaehlt = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const ansichten = gewaehlt.length ? gewaehlt : ALLE

  /*
    **Zwei Breiten, nicht eine.** Ein Kalender wird unterwegs aufgerufen — und
    375 × 812 ist der Zustand, in dem eine Sieben-Spalten-Woche zuerst bricht.
    Aufruf: `node tools/ansicht-bild.mjs --handy [<ansicht> …]`.
  */
  const HANDY = process.argv.includes('--handy')
  const breite = HANDY ? 375 : 1280
  const hoehe = HANDY ? 812 : 900
  const browser = await chromium.launch()
  /* Handy = Telefon: überlagernde Leiste ohne Platzbedarf (`scrollbar-gutter` in styles.css reserviert sonst 10 px). */
  const seite = await browser.newPage({ viewport: { width: breite, height: hoehe }, hasTouch: HANDY, isMobile: HANDY })

  const fehler = []
  seite.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text().slice(0, 160))
  })
  seite.on('pageerror', (e) => fehler.push(String(e).slice(0, 160)))

  await seite.route('**/*', antworteAusDist)

  const befunde = []
  for (const name of ansichten) {
    for (const thema of ['dunkel', 'hell']) {
      fehler.length = 0
      await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
      await seite.goto('about:blank')
      await seite.goto(`http://ak.test/#/${name}`, { waitUntil: 'networkidle' })
      await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
      /* Der Datenabruf läuft nach dem ersten Bild — sonst fotografiert man den Ladezustand. */
      await seite.waitForTimeout(2500)
      await seite.screenshot({
        path: path.join(BILDER, `ansicht-${name}-${HANDY ? 'handy-' : ''}${thema}.png`),
        fullPage: false,
      })
      if (thema === 'dunkel') {
        /*
          **Waagerechtes Scrollen ist der Mangel, den ein Bild verschweigt.**
          Auf dem Screenshot sieht eine zu breite Tabelle aus wie eine
          abgeschnittene; erst die Zahl sagt, dass der Besucher schieben muss.
        */
        const breite = await seite.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          fenster: window.innerWidth,
        }))
        befunde.push({ name, fehler: [...fehler], ueberbreite: breite.doc - breite.fenster, ...(await handyMessung(seite, HANDY, name)) })
      }
    }
  }

  let rot = await meldeZusatzpruefungen(seite, ansichten, HANDY)
  await browser.close()

  console.log('\nAnsicht        Überbreite  Konsolenfehler')
  for (const b of befunde) {
    const ueber = b.ueberbreite > 1 ? `${b.ueberbreite} px` : '—'
    console.log(`  ${b.name.padEnd(12)} ${ueber.padEnd(11)} ${b.fehler.length || '—'}`)
    for (const f of b.fehler.slice(0, 3)) console.log(`      ${f}`)
    if (b.ueberbreite > 1 || b.fehler.length || !handyLeistenOk(b) || (b.punkte && monatPunkteRot(b.punkte))) rot = true
  }
  console.log(rot ? '\n  ✕ etwas stimmt nicht — siehe oben' : '\n  ok  keine Überbreite, keine Fehler')
  if (rot) process.exitCode = 1
}

await main()
