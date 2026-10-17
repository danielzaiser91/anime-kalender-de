/**
 * Favoriten-Rand in der gebauten App (Daniel, 17.10.2026): Favorit = Gold, Finale = Grün, beides = Doppelrand — und kein Maß ändert sich.
 * Je Breite (Desktop 1280, Handy 375) und Thema: dieselbe Woche und derselbe Monat einmal ohne, einmal mit Favoriten laden;
 * jede Kachel muss danach dasselbe Rechteck haben (getBoundingClientRect), und der Rand (Schatten, Kontur) darf keine Nachbarkachel berühren.
 * Dazu Bilder: Vergleichstafel (normal, Favorit, Start, Start+Favorit, Finale, Finale+Favorit nebeneinander), Woche, Monat.
 * Ohne Server: `page.route()` liefert `dist/` (vorher `npm run build`). Aufruf: `node tools/favoriten-rand-messen.mjs [--docs-bilder]`.
 */
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const BILDER = path.join(WURZEL, 'daniel-zum-abarbeiten', 'berichte', 'bilder')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }
/** Fremde Bilder (Cover) werden durch einen Verlauf ersetzt, damit ein Rand gegen ein Bild und nicht gegen Weiß geprüft wird. */
const COVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b7a99"/><stop offset="1" stop-color="#2c3550"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="120" r="50" fill="#b9c2d9" opacity=".5"/></svg>'
const BREITEN = [
  { name: 'desktop', breite: 1280, hoehe: 900 },
  { name: 'handy', breite: 375, hoehe: 812 },
]
const THEMEN = ['dunkel', 'hell']
const WOCHEN_SUCHE = 14

async function antworte(route) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COVER_SVG })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Alle Wochen-Kacheln (Cover) mit Rechteck, Art (Fahnentext) und Außenmaß des Rands. Läuft im Browser. */
function messeWoche() {
  const alle = [...document.querySelectorAll('.ak-breit-cover, div[class~="aspect-[2/3]"]')]
  return alle.map((el, i) => {
    const r = el.getBoundingClientRect()
    const text = el.textContent ?? ''
    const art = /Staffelfinale/.test(text) ? 'finale' : /Staffelstart/.test(text) ? 'start' : 'plain'
    const schatten = getComputedStyle(el).boxShadow
    const spreads = [...schatten.matchAll(/rgba?\([^)]*\)\s+0px 0px 0px ([\d.]+)px(?!\s+inset)/g)].map((m) => Number(m[1]))
    return { i, art, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, aussen: Math.max(0, ...spreads), schatten, innen: !!el.querySelector('.pointer-events-none[class*="inset-ring"]') }
  })
}

/** Alle Monats-Kacheln (Cover-Knöpfe am Desktop, Punkte am Handy). Läuft im Browser. */
function messeMonat() {
  const alle = [...document.querySelectorAll('button[class*="w-[22px]"][class*="overflow-hidden"], [data-monatspunkt]')].filter((el) => el.offsetParent !== null)
  return alle.map((el, i) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const kontur = s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset)
    const spreads = [...s.boxShadow.matchAll(/rgba?\([^)]*\)\s+0px 0px 0px ([\d.]+)px/g)].map((m) => Number(m[1]))
    return { i, art: el.dataset.art ?? 'plain', x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, aussen: Math.max(0, kontur, ...spreads) + parseFloat(s.marginLeft) * 0, schatten: s.boxShadow, favorit: 'favorit' in el.dataset }
  })
}

/** Berührt der Rand (Rechteck plus Außenmaß) eine andere Kachel? Gibt die Paare zurück. */
export function beruehrungen(kacheln) {
  const paare = []
  for (const a of kacheln) {
    for (const b of kacheln) {
      if (a.i === b.i) continue
      const aussen = a.aussen
      const quer = a.x - aussen < b.x + b.w && a.x + a.w + aussen > b.x && a.y - aussen < b.y + b.h && a.y + a.h + aussen > b.y
      if (quer) paare.push([a.i, b.i])
    }
  }
  return paare
}

/** Dieselben Kacheln vorher/nachher: gleiche Anzahl, gleiche Rechtecke (auf 0,01 px). */
export function gleicheMasse(vorher, nachher) {
  if (vorher.length !== nachher.length) return [`Anzahl ${vorher.length} → ${nachher.length}`]
  const abweichungen = []
  for (let n = 0; n < vorher.length; n++) {
    const [a, b] = [vorher[n], nachher[n]]
    for (const k of ['x', 'y', 'w', 'h']) if (Math.abs(a[k] - b[k]) > 0.01) abweichungen.push(`Kachel ${n} ${k}: ${a[k]} → ${b[k]}`)
  }
  return abweichungen
}

async function neueSeite(browser, viewport, thema, favoriten) {
  const kontext = await browser.newContext({ viewport: { width: viewport.breite, height: viewport.hoehe }, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  /* Die Kennungs-Umzüge der App (anilist → ak, `kennung:*`) laufen sonst an und leeren die gesetzten Favoriten. */
  await kontext.addInitScript((ids) => {
    localStorage.setItem('kennung:ak1', '1')
    localStorage.setItem('kennung:umleitung', '999999')
    localStorage.setItem('favorites', JSON.stringify(ids))
  }, favoriten)
  const seite = await kontext.newPage()
  await seite.route('**/*', antworte)
  return seite
}

async function lade(seite, ansicht, datum) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/${ansicht}?d=${datum}`, { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(2500)
}

/** Montage-Montag der n-ten Woche ab dem 12.10.2026. */
function wocheAb(n) {
  const d = new Date(Date.UTC(2026, 9, 12 + 7 * n))
  return d.toISOString().slice(0, 10)
}

/** Erste Woche mit Staffelstart, Staffelfinale und einer schlichten schmalen Kachel; dort die Indizes und per Stern-Klick die Titel-IDs. */
async function findeWoche(browser) {
  const seite = await neueSeite(browser, BREITEN[0], 'dunkel', [])
  for (let n = 0; n < WOCHEN_SUCHE; n++) {
    const datum = wocheAb(n)
    await lade(seite, 'woche', datum)
    const kacheln = await seite.evaluate(messeWoche)
    const wahl = { start: kacheln.find((k) => k.art === 'start'), finale: kacheln.find((k) => k.art === 'finale'), plain: kacheln.find((k) => k.art === 'plain') }
    if (!wahl.start || !wahl.finale || !wahl.plain) continue
    const ids = []
    for (const k of [wahl.plain, wahl.start, wahl.finale]) ids.push(await sterneTitel(seite, k.i))
    await seite.context().close()
    return { datum, wahl, ids }
  }
  throw new Error('keine Woche mit Start, Finale und schlichter Kachel in den nächsten Wochen')
}

/** Klickt den Stern der i-ten Kachel und liest, welche ID neu in den Favoriten steht. Läuft im Seitenkontext. */
async function sterneTitel(seite, i) {
  const vorher = await seite.evaluate(() => JSON.parse(localStorage.getItem('favorites') ?? '[]'))
  await seite.evaluate((idx) => {
    const kachel = [...document.querySelectorAll('.ak-breit-cover, div[class~="aspect-[2/3]"]')][idx]
    kachel.querySelector('button[aria-label="Als Favorit merken"]').click()
  }, i)
  await seite.waitForTimeout(300)
  const nachher = await seite.evaluate(() => JSON.parse(localStorage.getItem('favorites') ?? '[]'))
  return nachher.find((id) => !vorher.includes(id))
}

/** Baut die Vergleichstafel aus den HTML-Fassungen (vorher) und den Kacheln der Seite (nachher). Läuft im Browser. */
function baueTafel({ vorherHtml, indizes }) {
  const kacheln = [...document.querySelectorAll('.ak-breit-cover, div[class~="aspect-[2/3]"]')]
  const tafel = document.createElement('div')
  tafel.style.cssText = `position:fixed;inset:0;z-index:99999;overflow:auto;padding:16px;display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;background:${getComputedStyle(document.body).backgroundColor}`
  const eintrag = (titel, html, breite) => {
    const feld = document.createElement('div')
    feld.style.cssText = `width:${breite}px;color:var(--ak-text);font:12px sans-serif`
    feld.innerHTML = `<div style="margin-bottom:6px">${titel}</div>${html}`
    tafel.appendChild(feld)
  }
  const namen = { plain: 'normal', start: 'Start', finale: 'Finale' }
  for (const [art, i] of Object.entries(indizes)) {
    const breite = kacheln[i].parentElement.getBoundingClientRect().width
    eintrag(namen[art], vorherHtml[art], breite)
    eintrag(`${namen[art]} + Favorit`, kacheln[i].parentElement.outerHTML, breite)
  }
  document.body.appendChild(tafel)
}

async function einLauf(browser, viewport, thema, woche) {
  const vorher = await neueSeite(browser, viewport, thema, [])
  await lade(vorher, 'woche', woche.datum)
  const wVor = await vorher.evaluate(messeWoche)
  const vorherHtml = await vorher.evaluate((idx) => {
    const k = [...document.querySelectorAll('.ak-breit-cover, div[class~="aspect-[2/3]"]')]
    return Object.fromEntries(Object.entries(idx).map(([art, i]) => [art, k[i].parentElement.outerHTML]))
  }, Object.fromEntries(Object.entries(woche.wahl).map(([art, k]) => [art, k.i])))
  await lade(vorher, 'monat', woche.datum)
  const mVor = await vorher.evaluate(messeMonat)
  await vorher.context().close()

  const nach = await neueSeite(browser, viewport, thema, woche.ids)
  await lade(nach, 'woche', woche.datum)
  const wNach = await nach.evaluate(messeWoche)
  await nach.screenshot({ path: path.join(BILDER, `favoriten-rand-r2-${viewport.name}-${thema}-woche.png`) })
  await nach.evaluate(baueTafel, { vorherHtml, indizes: Object.fromEntries(Object.entries(woche.wahl).map(([art, k]) => [art, k.i])) })
  await nach.screenshot({ path: path.join(BILDER, `favoriten-rand-r2-${viewport.name}-${thema}-vergleich.png`) })
  await lade(nach, 'monat', woche.datum)
  const mNach = await nach.evaluate(messeMonat)
  await nach.screenshot({ path: path.join(BILDER, `favoriten-rand-r2-${viewport.name}-${thema}-monat.png`) })
  await nach.context().close()
  return { wVor, wNach, mVor, mNach }
}

/** Setzt die Prüfungen eines Laufs zusammen: Maße gleich, kein Berühren neuer Nachbarn, Zahl der Favoriten-Kacheln. */
function bewerte(name, { wVor, wNach, mVor, mNach }) {
  const fehler = []
  const meldung = (text, liste) => liste.length && fehler.push(`${name}: ${text} — ${liste.slice(0, 5).join('; ')}`)
  meldung('Woche: Maße ändern sich', gleicheMasse(wVor, wNach))
  meldung('Monat: Maße ändern sich', gleicheMasse(mVor, mNach))
  const neuW = beruehrungen(wNach).filter(([a, b]) => !beruehrungen(wVor).some(([c, d]) => c === a && d === b))
  const neuM = beruehrungen(mNach).filter(([a, b]) => !beruehrungen(mVor).some(([c, d]) => c === a && d === b))
  meldung('Woche: Rand berührt neue Nachbarn', neuW.map((p) => p.join('↔')))
  meldung('Monat: Rand berührt neue Nachbarn', neuM.map((p) => p.join('↔')))
  const goldW = wNach.filter((k, n) => k.schatten !== wVor[n]?.schatten).length
  const goldM = mNach.filter((k, n) => k.schatten !== mVor[n]?.schatten || k.favorit).length
  console.log(`${name}: Woche ${wNach.length} Kacheln (${goldW} mit neuem Rand), Monat ${mNach.length} (${goldM} mit Favoriten-Rand), Maße gleich: ${gleicheMasse(wVor, wNach).length + gleicheMasse(mVor, mNach).length === 0 ? 'ja' : 'NEIN'}`)
  return fehler
}

async function main() {
  if (!distPruefen(WURZEL)) return
  await mkdir(BILDER, { recursive: true })
  const browser = await chromium.launch()
  const woche = await findeWoche(browser)
  console.log(`Woche ab ${woche.datum}, Favoriten ${woche.ids.join(', ')}, Kacheln ${JSON.stringify(Object.fromEntries(Object.entries(woche.wahl).map(([a, k]) => [a, k.i])))}`)
  const fehler = []
  for (const viewport of BREITEN) {
    for (const thema of THEMEN) fehler.push(...bewerte(`${viewport.name}/${thema}`, await einLauf(browser, viewport, thema, woche)))
  }
  await browser.close()
  if (fehler.length) {
    console.error(fehler.join('\n'))
    process.exit(1)
  }
  console.log('Favoriten-Rand: Maße gleich, kein neues Berühren.')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
