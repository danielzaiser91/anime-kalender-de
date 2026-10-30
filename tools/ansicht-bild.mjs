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
import { pruefeEscapeStapel } from './ansicht-escape-stapel.mjs'
import { pruefeFilterknopf } from './ansicht-filterknopf.mjs'
import { pruefeTrefferprobe } from './ansicht-trefferprobe.mjs'
import { pruefeAdressen } from './ansicht-adressen.mjs'
import { pruefeHoverCover } from './ansicht-hover-cover.mjs'
import { pruefeStatusfarben } from './ansicht-statusfarben.mjs'
import { distPruefen } from './dist-frisch.mjs'
import { pruefeTvReihe, meldeTvReihe } from './ansicht-tv-reihe.mjs'
import { pruefeSaisonChip, meldeSaisonChip } from './ansicht-saison-chip.mjs'
import { eckenFehler } from './ecken-urteil.mjs'
import { messeDuell } from './ansicht-duell.mjs'
import { messeDetailsOverlay } from './ansicht-details-overlay.mjs'
import { pruefeFortsetzen } from './ansicht-fortsetzen.mjs'
import { meldeAbzeichen } from './ansicht-abzeichen.mjs'
import { meldeTerminKarte } from './ansicht-termin-karte.mjs'

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
  'entdecken',
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
  console.log(`  Saison-Karte und Ähnliche Titel: ${r.weitere.length ? 'rot' : 'ok (Karte nach Frist, weg beim Verlassen)'}`)
  for (const l of r.abweichungen) console.log(`  ✕ ${l}`)
  return r.abweichungen.length > 0
}

/*
  **„Entdecken“ (`#/entdecken`) wirklich durchspielen.** Die Bilder oben zeigen von der Route nur die Einleitung; hier werden sechs Duelle
  geklickt und Vorschläge, Leinwand und zweite Ebene gemessen: Handy 360 × 780 und Rechner 1440 × 900, hell und dunkel. Geprüft werden keine
  Konsolenfehler, kein waagerechtes Scrollen, jede sichtbare Schaltfläche ≥ 44 px, und an Pixeln die Cover der Vorschläge (Ecken rund,
  Unterkante und die Zeilen darunter mit und ohne Favorit gleich, ★-Plakette im Cover).
*/
const EMPFEHLUNG_GERAETE = [
  { name: 'handy', breite: 360, hoehe: 780, mobil: true },
  { name: 'desktop', breite: 1440, hoehe: 900, mobil: false },
]
const MIN_TIPPFLAECHE = 43.5
/** Summe der Farbkanal-Unterschiede, ab der zwei Pixel als verschieden gelten. */
const PIXEL_VERSCHIEDEN = 12
const EMPFEHLUNG_COVER = '.empf ul > li:first-child button.empf-kandidat'

/** Liest Pixel aus einem PNG. Läuft im Browser. */
async function lesePixelPng({ png, punkte }) {
  const bild = new Image()
  bild.src = `data:image/png;base64,${png}`
  await bild.decode()
  const leinwand = document.createElement('canvas')
  leinwand.width = bild.width
  leinwand.height = bild.height
  const g = leinwand.getContext('2d')
  g.drawImage(bild, 0, 0)
  return punkte.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3))
}

const farbAbstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/** Alle sichtbaren Schaltflächen und Links der Fläche, die niedriger als `min` px sind. Läuft im Browser. */
function zuNiedrigeFlaechen(min) {
  return [...document.querySelectorAll('.empf button, .empf a')]
    .filter((b) => !b.closest('[inert]') && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height < min)
    .map((b) => `${b.textContent?.trim().slice(0, 24)} (${Math.round(b.getBoundingClientRect().height)} px)`)
}

/** Lage des ersten Vorschlags-Covers und Pixel an Ecken und unter der Unterkante. */
async function messeEmpfehlungsCover(seite) {
  await seite.mouse.move(1, 1)
  await seite.waitForTimeout(500)
  const r = await seite.locator(EMPFEHLUNG_COVER).evaluate((e) => {
    const b = e.getBoundingClientRect()
    const p = e.querySelector('span[aria-hidden]')?.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height, plakette: p ? { x: p.x, y: p.y, w: p.width, h: p.height } : null }
  })
  const [x, y, w, h] = [r.x, r.y, r.w, r.h].map(Math.round)
  const unten = [1, 2, 3, 4].map((d) => [x + Math.round(w / 2), y + h - 1 + d])
  /* Ecke gegen den Hintergrund außerhalb des Covers (gleicher Schattenbereich), nie gegen Bildinhalt: Bild und Staffel-Verlauf wechseln je Vorschlag. */
  const punkte = [[x + 1, y + 1], [x + 1, y - 3], [x + w - 2, y + h - 2], [x + w - 2, y + h + 3], ...unten]
  const png = (await seite.screenshot()).toString('base64')
  return { r, farben: await seite.evaluate(lesePixelPng, { png, punkte }) }
}

/** Ecken rund, Unterkante und Zeilen darunter mit und ohne Favorit gleich, Plakette im Cover. */
function pruefeEmpfehlungsCover(ohne, mit) {
  const fehler = []
  fehler.push(...eckenFehler(ohne.farben))
  if (Math.round(ohne.r.y + ohne.r.h) !== Math.round(mit.r.y + mit.r.h)) fehler.push('Unterkante des Covers verschiebt sich mit Favorit')
  ohne.farben.slice(4).forEach((f, i) => {
    if (farbAbstand(f, mit.farben[4 + i]) >= PIXEL_VERSCHIEDEN) fehler.push(`Zeile ${i + 1} unter dem Cover ändert sich mit Favorit (Ringrest)`)
  })
  const p = mit.r.plakette
  const c = mit.r
  if (!p) fehler.push('keine ★-Plakette mit Favorit')
  else if (p.x < c.x || p.y < c.y || p.x + p.w > c.x + c.w || p.y + p.h > c.y + c.h) fehler.push('★-Plakette ragt aus dem Cover')
  return fehler
}

/** Einleitung → sechs Duelle → Vorschläge (messen, ★ setzen, messen) → Leinwand → zweite Ebene; liefert die Befunde. */
async function spieleEmpfehlung(browser, geraet, thema) {
  const kontext = await browser.newContext({
    viewport: { width: geraet.breite, height: geraet.hoehe },
    isMobile: geraet.mobil,
    hasTouch: geraet.mobil,
    colorScheme: thema === 'dunkel' ? 'dark' : 'light',
  })
  const seite = await kontext.newPage()
  const fehler = []
  const kennung = `${geraet.name}/${thema}`
  seite.on('console', (m) => m.type() === 'error' && fehler.push(`${kennung}: Konsole ${m.text().slice(0, 140)}`))
  seite.on('pageerror', (e) => fehler.push(`${kennung}: ${String(e).slice(0, 140)}`))
  await seite.route('**/*', antworteAusDist)
  const los = seite.getByRole('button', { name: "Los geht's" })
  await seite.goto('http://ak.test/#/entdecken', { waitUntil: 'networkidle' })
  await los.waitFor({ timeout: 20_000 })
  await los.click()
  await seite.waitForTimeout(900)
  for (const f of await messeDuell(seite, lesePixelPng)) fehler.push(`${kennung}: Duell ${f}`)
  for (let i = 0; i < 6; i++) {
    await seite.locator('.empf-kandidat').nth(i % 2).click()
    await seite.waitForTimeout(700)
  }
  await seite.waitForSelector(EMPFEHLUNG_COVER, { timeout: 10_000 })
  await seite.waitForTimeout(600)
  for (const f of await pruefeFortsetzen(seite, geraet.breite, EMPFEHLUNG_COVER)) fehler.push(`${kennung}: ${f}`)
  await seite.waitForTimeout(600)
  const niedrig = await seite.evaluate(zuNiedrigeFlaechen, MIN_TIPPFLAECHE)
  if (niedrig.length) fehler.push(`${kennung}: Tippfläche unter 44 px: ${niedrig.join(' | ')}`)
  const ohne = await messeEmpfehlungsCover(seite)
  for (const f of await messeDetailsOverlay(seite, EMPFEHLUNG_COVER, lesePixelPng, 'ohne Favorit')) fehler.push(`${kennung}: ${f}`)
  await seite.locator('.empf ul > li:first-child button[aria-pressed]').click()
  const mit = await messeEmpfehlungsCover(seite)
  for (const f of await messeDetailsOverlay(seite, EMPFEHLUNG_COVER, lesePixelPng, 'mit Favorit')) fehler.push(`${kennung}: ${f}`)
  for (const f of pruefeEmpfehlungsCover(ohne, mit)) fehler.push(`${kennung}: ${f}`)
  await seite.locator(EMPFEHLUNG_COVER).click()
  await seite.waitForTimeout(1200)
  await seite.locator('.empf-szene').evaluate((e) => e.scrollTo({ top: e.clientHeight, behavior: 'instant' }))
  await seite.waitForTimeout(600)
  const breit = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (breit > 0) fehler.push(`${kennung}: Seite scrollt waagerecht um ${breit} px`)
  await kontext.close()
  return fehler
}

const RESET_BREITEN = [390, 768, 820, 1024, 1180, 1279, 1440]

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const LANGE_SUCHE = 'Sword Art Online Alicization War of Underworld'

/** Der Kopf-Worst-Case ab 768 px: iPad-Kennung (Install-Knopf erlaubt), Install-Ereignis, gefüllte Suche. */
async function oeffneKopfWorstCase(browser, breite, thema) {
  const handy = breite < 768
  const kontext = await browser.newContext({
    viewport: { width: breite, height: 900 },
    isMobile: handy,
    hasTouch: handy || breite >= 768,
    userAgent: handy ? undefined : IPAD_UA,
    colorScheme: thema === 'dunkel' ? 'dark' : 'light',
  })
  const seite = await kontext.newPage()
  await seite.route('**/*', antworteAusDist)
  await seite.addInitScript(() => {
    setTimeout(() => {
      const e = new Event('beforeinstallprompt')
      e.prompt = () => Promise.resolve()
      e.userChoice = new Promise(() => {})
      window.dispatchEvent(e)
    }, 300)
  })
  /* Die Fläche „Entdecken“ deckt die App-Kopfleiste voll ab (eigene Kopfzeile), darum geht man von der Datenbank aus. */
  await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  const feld = seite.locator('header input[type="search"]').first()
  if (await feld.isVisible()) await feld.fill(LANGE_SUCHE)
  await seite.waitForTimeout(1500)
  /* Die einmalige Installationsfrage (nach 1,2 s) legt sich über die Seite; ein Klick auf den Hintergrund schließt sie. */
  const frage = seite.locator('div.fixed.inset-0 > [role="dialog"]')
  if (await frage.count()) await seite.mouse.click(3, 3)
  return { kontext, seite }
}

/** Was der Kopf zeigt: sichtbare Menü-Knöpfe, Überlauf, Treffer in der Mitte des ersten Knopfs, Platzhalter-Breite. */
function messeKopf() {
  const knoepfe = [...document.querySelectorAll('header button[aria-label^="Menü"]')].filter((k) => k.offsetWidth > 0)
  const r = knoepfe[0]?.getBoundingClientRect()
  const treffer = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.getAttribute('aria-label') : null
  const kopf = document.querySelector('header')
  return { anzahl: knoepfe.length, treffer, ueberlauf: kopf.scrollWidth - kopf.clientWidth }
}

/** Platzhalter „Anime suchen“ ganz lesbar? Leert ein Feld im Kopf kurz und misst den Text gegen die Eingabefläche. */
async function platzhalterAbgeschnitten(seite) {
  const feld = seite.locator('header input[type="search"]:visible').first()
  if (!(await feld.count())) return false
  await feld.fill('')
  return feld.evaluate((el) => {
    const stil = getComputedStyle(el)
    const zeichen = document.createElement('canvas').getContext('2d')
    zeichen.font = `${stil.fontSize} ${stil.fontFamily}`
    const platz = el.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight)
    return zeichen.measureText(el.placeholder).width > platz
  })
}

/** Je Breite: genau ein sichtbarer Menü-Knopf (Burger), erreichbar, Kopf ohne Überlauf. */
async function pruefeZuruecksetzen(browser, breite, thema) {
  const kennung = `zurücksetzen ${breite}/${thema}`
  const { kontext, seite } = await oeffneKopfWorstCase(browser, breite, thema)
  const fehler = []
  const kopf = await seite.evaluate(messeKopf)
  if (kopf.anzahl !== 1) fehler.push(`${kennung}: ${kopf.anzahl} sichtbare Menü-Knöpfe statt 1`)
  else if (!/Menü/.test(String(kopf.treffer))) fehler.push(`${kennung}: Knopf wird überdeckt (Treffer: ${kopf.treffer})`)
  if (kopf.ueberlauf > 0) fehler.push(`${kennung}: Kopfleiste läuft um ${kopf.ueberlauf} px über`)
  if (breite >= 1024 && (await platzhalterAbgeschnitten(seite))) fehler.push(`${kennung}: Suchplatzhalter abgeschnitten`)
  await seite.screenshot({ path: path.join(BILDER, `empfehlung-reset-${breite}-${thema}.png`), clip: { x: 0, y: 0, width: breite, height: 120 } })
  await kontext.close()
  return fehler
}

/** Alle Breiten, beide Themen; druckt die Ergebniszeile zur Kopfleiste; wahr, wenn etwas rot ist. */
async function meldeZuruecksetzen() {
  const browser = await chromium.launch()
  const fehler = []
  for (const breite of RESET_BREITEN) {
    for (const thema of ['dunkel', 'hell']) fehler.push(...(await pruefeZuruecksetzen(browser, breite, thema)))
  }
  await browser.close()
  console.log(`\nKopfleiste in Entdecken (${RESET_BREITEN.join('/')} px, hell und dunkel; iPad-Kennung mit Install-Ereignis und gefüllter Suche; genau ein Knopf, nicht überdeckt, Kopfleiste ohne Überlauf, Platzhalter lesbar): ${fehler.length ? '' : 'ok'}`)
  for (const f of fehler) console.log(`  ✕ ${f}`)
  return fehler.length > 0
}

/** Beide Geräte, beide Themen; druckt die Ergebniszeile; wahr, wenn etwas rot ist. */
async function meldeEmpfehlung() {
  const browser = await chromium.launch()
  const fehler = []
  for (const geraet of EMPFEHLUNG_GERAETE) {
    for (const thema of ['dunkel', 'hell']) fehler.push(...(await spieleEmpfehlung(browser, geraet, thema)))
  }
  await browser.close()
  const faelle = EMPFEHLUNG_GERAETE.length * 2
  console.log(`\nEntdecken (Reise durchgespielt, ${faelle} Fälle: Handy und Rechner, hell und dunkel; Konsole, Scrollen, Tippflächen, Ecken und Unterkante der Cover, Startbildschirm mit Vorgeschichte 70 zu 30, Details-Overlay mit und ohne Favorit: Ecken, Lage, Zeilen darunter, Abdunklung; Duell-Karte mit und ohne gewinnt/verliert: Ecken, Unterkante, Ring): ${fehler.length ? '' : 'ok'}`)
  for (const f of fehler) console.log(`  ✕ ${f}`)
  return fehler.length > 0
}

/** Filter-Knopf der Datenbank: gleiche Stelle zu, offen, zu (1366/1920 px, hell/dunkel); wahr, wenn rot. */
async function meldeFilterknopf() {
  const r = await pruefeFilterknopf(chromium, antworteAusDist)
  console.log(`\nFilter-Knopf der Datenbank springt nicht (1366/1920 px, hell und dunkel, ohne, mit einem und mit vielen Filtern, ${r.faelle} Fälle; zugeklappt nur der Knopf; Escape nur mit Fokus im Dock, auch aus dem Eingabefeld, Sprecher-Eingabe zuerst, Fokus zurück; aria-controls): ${r.abweichungen.length ? '' : 'ok'}`)
  for (const l of r.abweichungen) console.log(`  ✕ ${l}`)
  return r.abweichungen.length > 0
}

/** Escape in gestapelten Ebenen (Detail-Panel + Quellen, Trailer, Cover): schließt genau die oberste; wahr, wenn rot. */
async function meldeEscapeStapel() {
  const r = await pruefeEscapeStapel(chromium, antworteAusDist)
  console.log(`\nEscape schließt nur die oberste Ebene (Detail-Panel mit Quellen-Fenster, Trailer-Kino, Cover-Schicht und Patch-Notes-Dialog, Einzelfälle ohne Panel mit Einstellungen und Patch Notes, ${r.faelle} Fälle; zweiter Escape schließt das Panel): ${r.abweichungen.length ? '' : 'ok'}`)
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
  if (!handy && ansichten.includes('datenbank') && (await meldeFilterknopf())) rot = true
  if (!handy && ansichten.includes('datenbank') && (await meldeEscapeStapel())) rot = true
  if (!handy && ansichten.includes('woche') && (await meldeHoverCover())) rot = true
  if (!handy && ansichten.includes('entdecken') && (await meldeEmpfehlung())) rot = true
  if (!handy && ansichten.includes('entdecken') && (await meldeZuruecksetzen())) rot = true
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
    if (meldeTvReihe(await pruefeTvReihe(DIST))) rot = true
    if (await meldeAbzeichen({ chromium, antworte: antworteAusDist, dist: DIST, lesePixel: lesePixelPng })) rot = true
    if (await meldeTerminKarte({ chromium, antworte: antworteAusDist, dist: DIST, lesePixel: lesePixelPng })) rot = true
    if (meldeSaisonChip(await pruefeSaisonChip(DIST))) rot = true
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
