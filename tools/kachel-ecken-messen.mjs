/**
 * Anbieter-Leiste unten an den Kacheln (Daniel, 17.10.2026): Die unteren Cover-Ecken sind eckig (sonst Lücke zwischen Rand und Leiste),
 * und der goldene Favoritenrand schiebt die Leiste nicht nach oben. Gemessen wird an Pixeln der gebauten App, nicht an Klassen:
 * dieselbe Woche und derselbe Monat einmal ohne Favoriten, einmal mit allen Titeln als Favorit, je Thema (dunkel/hell), Desktop 1280 und Handy 360 px (Tap auf einen Tag, Tageszeilen).
 * Je Kachel (Woche: Cover, Monat: Cover-Knopf, Leiste = nächstes Geschwister bzw. letztes Kind):
 *  - Leiste: Unterkante gleich mit und ohne Favorit (Rechteck);
 *  - Ecke: der Pixel in der unteren linken und rechten Ecke der Leiste hat Leistenfarbe, nicht Seitengrund oder Gold (rund = Lücke);
 *  - unter der Leiste: die Pixel 1 bis 4 px darunter (1 = die Zeile gleich unter der letzten Leistenzeile) sind mit Favorit dieselben wie ohne (kein Ringrest darunter);
 *  - die Woche hat Kino-Saal-Kacheln (sonst bliebe deren Rand ungemessen).
 * Ohne Server: `page.route()` liefert `dist/` (vorher `npm run build`); `--dist <ordner>` misst einen anderen Bau (Vorher-Bilder).
 * Aufruf: `node tools/kachel-ecken-messen.mjs [--dist <ordner>] [--bilder <ordner>]`.
 */
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const arg = (name) => (process.argv.includes(name) ? path.resolve(process.argv[process.argv.indexOf(name) + 1]) : undefined)
const DIST = arg('--dist') ?? path.join(WURZEL, 'dist')
const BILDER = arg('--bilder')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }
/** Fremde Bilder (Cover) werden durch einen Verlauf ersetzt, damit ein Rand gegen ein Bild und nicht gegen Weiß geprüft wird. */
const COVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#4a5a80"/></svg>'
const THEMEN = ['dunkel', 'hell']
const ANSICHTEN = ['woche', 'monat', 'fenster', 'handy']
/** Eine Woche mit Kino-Saal (Termine am 27.10.; gemessen 17.10.2026); in der Woche vom 19.10. gibt es keinen. */
const DATUM = '2026-10-26'
const SELEKTOR = {
  woche: '.ak-breit-cover, div[class~="aspect-[2/3]"]',
  monat: 'button[class*="w-[22px]"][class*="overflow-hidden"]',
  /* Das Cover der Tageszeile im Fenster, das beim Zeigen auf ein Monats-Cover aufgeht. */
  fenster: '[data-schliesst] > span.relative',
}
/** Tage, die am Handy angetippt werden (die Schaltfläche eines Tages trägt den Monatspunkt), und die Mindestzahl Tageszeilen mit Favorit darin (26.10.2026: 9 ganz sichtbare). */
const TAGE_HANDY = 6
const TAG_KNOPF = 'button:has([data-monatspunkt])'
const MIN_HANDY = 5
/** So viele Monats-Cover mit Favorit werden für das Fenster angezeigt. */
const MAX_FENSTER = 6
/** Farbabstand (Summe der Kanäle), ab dem zwei Pixel als verschieden gelten; Kantenglättung bleibt darunter. */
const TOLERANZ = 48
/** Mindestzahl Kacheln mit Favoritenrand im Lauf „mit“; ohne sie wäre der Vergleich leer (Kennungen greifen nicht). */
const MIN_FAVORITEN = 5
/** Pixel je Kachel (`stellen`). */
const ANZAHL = 12
/** Mindestzahl Kino-Saal-Kacheln in der Woche (26.10.2026: 1). */
const MIN_SAAL = 1
/** Stellen unter der Leiste: [Index in `stellen`, Abstand in px unter der letzten Leistenzeile]. */
const UNTER = [[11, 1], [4, 2], [5, 3], [6, 4]]

async function antworte(route) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COVER_SVG })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Rechteck der Cover und ihrer Leisten (Seitenkoordinaten). Läuft im Browser. */
function messeKacheln({ selektor, monat, ausschnitt }) {
  const [dx, dy] = ausschnitt ? [0, 0] : [scrollX, scrollY]
  return [...document.querySelectorAll(selektor)]
    .filter((el) => el.offsetParent !== null)
    /* Im Ausschnitt nur ganz sichtbare Kacheln: darunter liest das Bild keine Pixel. */
    .filter((el) => !ausschnitt || el.lastElementChild.getBoundingClientRect().bottom + 5 < innerHeight)
    .map((el) => {
      const leiste = monat ? el.lastElementChild : el.nextElementSibling
      const r = leiste.getBoundingClientRect()
      return { x: r.x + dx, w: r.width, leiste: r.height, oben: el.getBoundingClientRect().top + dy, unten: r.bottom + dy, breit: el.classList.contains('ak-breit-cover'), favorit: el.classList.contains('ring-ak-favorit-rand') || !!el.querySelector(':scope > .ring-ak-favorit-rand'), saal: el.classList.contains('ak-saal') }
    })
}

/** Versteckt (`'hidden'`) oder zeigt (`''`) alle Elemente mit `position: fixed`. Läuft im Browser. */
function setzeSichtbarkeitSchwebender(wert) {
  for (const el of document.querySelectorAll('body *')) if (getComputedStyle(el).position === 'fixed') el.style.visibility = wert
}

/** Liest Pixel (x, y) aus einem PNG. Läuft im Browser. */
async function lesePixel({ png, punkte }) {
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

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

async function neueSeite(browser, thema, favoriten, handy = false) {
  const geraet = handy ? { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }
  const kontext = await browser.newContext({ ...geraet, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
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

async function ladeAnsicht(seite, ansicht, datum) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/${ansicht}?d=${datum}`, { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(2500)
}

/** Die Kennungen der Titel auf zwei Wochen: Stern jeder Wochen-Kachel klicken und lesen, was gemerkt wurde (die App-Kennung steht nicht in `titles.json`). */
async function sammleKennungen(browser) {
  const seite = await neueSeite(browser, 'dunkel', [])
  const ids = []
  for (const datum of [DATUM, '2026-11-02', '2026-11-09']) {
    await ladeAnsicht(seite, 'woche', datum)
    await seite.evaluate(() => document.querySelectorAll('button[aria-label="Als Favorit merken"]').forEach((b) => b.click()))
    await seite.waitForTimeout(500)
    /* Das Init-Skript der Seite setzt die Favoriten bei jedem Laden zurück: je Woche lesen. */
    ids.push(...(await seite.evaluate(() => JSON.parse(localStorage.getItem('favorites') ?? '[]'))))
  }
  await seite.context().close()
  return [...new Set(ids)]
}

/** Eine Ansicht laden und messen: Rechtecke der Leisten und die Pixel an den geprüften Stellen. */
async function messeAnsicht(seite, ansicht) {
  await ladeAnsicht(seite, ansicht, DATUM)
  return messeSichtbare(seite, ansicht)
}

/** Messung der gerade sichtbaren Kacheln einer Art (Pixel aus einem Ganzseitenbild, das Fenster aus dem Bildausschnitt, weil es `fixed` steht). */
async function messeSichtbare(seite, ansicht) {
  const fenster = ansicht === 'fenster'
  const kacheln = await seite.evaluate(messeKacheln, { selektor: SELEKTOR[ansicht], monat: ansicht !== 'woche', ausschnitt: fenster })
  /* Schwebende Leisten (Umschalter unten) lägen im Ganzseitenbild über Kacheln und fälschten deren Pixel. */
  if (!fenster) await seite.evaluate(setzeSichtbarkeitSchwebender, 'hidden')
  const png = (await seite.screenshot({ fullPage: !fenster })).toString('base64')
  if (!fenster) await seite.evaluate(setzeSichtbarkeitSchwebender, '')
  const punkte = kacheln.flatMap((k) => stellen(k))
  const farben = await seite.evaluate(lesePixel, { png, punkte })
  return { kacheln, farben }
}

/** Zeigt nacheinander auf die Monats-Cover `indizes` und misst jedes Mal das Cover der Tageszeile im Fenster. */
async function messeFenster(seite, indizes) {
  await ladeAnsicht(seite, 'monat', DATUM)
  const gesamt = { kacheln: [], farben: [] }
  for (const i of indizes) {
    await seite.locator(`${SELEKTOR.monat}:visible`).nth(i).hover()
    await seite.waitForTimeout(600)
    const einzeln = await messeSichtbare(seite, 'fenster')
    gesamt.kacheln.push(...einzeln.kacheln)
    gesamt.farben.push(...einzeln.farben)
  }
  return gesamt
}

/** Am Handy (360 px, Touch): Tippt nacheinander die ersten Tage des Monats an und misst jedes Mal die Tageszeilen. */
async function messeHandy(seite) {
  await ladeAnsicht(seite, 'monat', DATUM)
  const gesamt = { kacheln: [], farben: [] }
  for (let i = 0; i < TAGE_HANDY; i++) {
    await seite.locator(TAG_KNOPF).nth(i).click()
    await seite.waitForTimeout(700)
    const einzeln = await messeSichtbare(seite, 'fenster')
    gesamt.kacheln.push(...einzeln.kacheln)
    gesamt.farben.push(...einzeln.farben)
    await seite.keyboard.press('Escape')
    await seite.mouse.click(5, 790)
    await seite.waitForTimeout(300)
  }
  return gesamt
}

/** Die Tageszeile am Handy, ohne und mit Favoriten (die Kennungen stammen vom Desktop, am Handy fände `sammleKennungen` keine). */
async function pruefeHandy(browser, thema, ids) {
  const lauf = {}
  for (const [art, favoriten] of [['mit', ids], ['ohne', []]]) {
    const seite = await neueSeite(browser, thema, favoriten, true)
    lauf[art] = await messeHandy(seite)
    await seite.context().close()
  }
  const f = bewerte(`${thema}/handy`, lauf.ohne, lauf.mit, MIN_HANDY)
  return { fehler: f, zeile: `${thema}/handy: ${lauf.ohne.kacheln.length} Kacheln, ${f.length} Fehler` }
}

/** Das Fenster mit der Tageszeile: dieselben Monats-Cover ohne und mit Favoriten anzeigen und vergleichen. */
async function pruefeFenster(browser, thema, ids, kachelnMit) {
  const indizes = kachelnMit.flatMap((k, i) => (k.favorit ? [i] : [])).slice(0, MAX_FENSTER)
  const lauf = {}
  for (const [art, favoriten] of [['mit', ids], ['ohne', []]]) {
    const seite = await neueSeite(browser, thema, favoriten)
    lauf[art] = await messeFenster(seite, indizes)
    await seite.context().close()
  }
  const f = bewerte(`${thema}/fenster`, lauf.ohne, lauf.mit, indizes.length)
  return { fehler: f, zeile: `${thema}/fenster: ${lauf.ohne.kacheln.length} Kacheln, ${f.length} Fehler` }
}

/** Geprüfte Pixel einer Leiste (die letzte Leistenzeile ist die auf ganze Pixel gerundete Unterkante minus eins, wie Chrome sie malt): untere Ecke links und rechts, je drei Pixel weiter innen und zwei Zeilen höher (Leistenfarbe; fehlt die letzte Leistenzeile, fällt das auf), drei Pixel unter der Mitte. */
function stellen(k) {
  const unten = Math.round(k.unten) - 1
  /* Die Seitenränder werden in der ersten Zeile über der Leiste gelesen (dort zeigt sich eine runde Ecke am stärksten). */
  const ersteCoverZeile = unten - Math.round(k.leiste)
  const mitte = Math.round(k.x + k.w / 2)
  return [
    [Math.ceil(k.x), unten],
    [Math.floor(k.x + k.w) - 1, unten],
    [Math.ceil(k.x) + 3, unten - 2],
    [Math.floor(k.x + k.w) - 4, unten - 2],
    [mitte, unten + 2],
    [mitte, unten + 3],
    [mitte, unten + 4],
    [Math.ceil(k.x), ersteCoverZeile],
    [Math.floor(k.x + k.w) - 1, ersteCoverZeile],
    [Math.ceil(k.x), unten - 20],
    [Math.floor(k.x + k.w) - 1, unten - 20],
    [mitte, unten + 1],
  ]
}

/** Vergleicht ohne und mit Favoriten; liefert Fehlertexte. */
export function bewerte(name, ohne, mit, mindestens = MIN_FAVORITEN) {
  const fehler = []
  if (ohne.kacheln.length !== mit.kacheln.length || ohne.kacheln.length === 0) return [`${name}: Kachelzahl ${ohne.kacheln.length} → ${mit.kacheln.length}`]
  const gold = mit.kacheln.filter((k) => k.favorit).length
  if (gold < mindestens) return [`${name}: nur ${gold} Kacheln mit Favoritenrand (mindestens ${mindestens}), der Vergleich wäre leer`]
  ohne.kacheln.forEach((k, i) => {
    const [a, b] = [ohne.farben.slice(i * ANZAHL, (i + 1) * ANZAHL), mit.farben.slice(i * ANZAHL, (i + 1) * ANZAHL)]
    const [mk, f] = [mit.kacheln[i], `${name} Kachel ${i}${k.breit ? ' (breit)' : ''}`]
    if (Math.abs(mk.unten - k.unten) > 0.01) fehler.push(`${f}: Leiste sitzt mit Favorit ${(mk.unten - k.unten).toFixed(2)} px tiefer`)
    for (const [n, ecke] of [[0, 'links'], [1, 'rechts']]) {
      for (const [lauf, farben] of [['ohne Favorit', a], ['mit Favorit', b]]) {
        if (abstand(farben[n], farben[n + 2]) > TOLERANZ) fehler.push(`${f}: untere Ecke ${ecke} ${lauf} nicht Leistenfarbe (rund?) ${farben[n]} statt ${farben[n + 2]}`)
      }
    }
    for (const [n, seite] of [[7, 'links'], [8, 'rechts']]) {
      for (const [lauf, farben] of [['ohne Favorit', a], ['mit Favorit', b]]) {
        if (abstand(farben[n], farben[n + 2]) > TOLERANZ) fehler.push(`${f}: Seitenrand ${seite} dicht über der Leiste eingezogen (runde Ecke?) ${lauf} ${farben[n]} statt ${farben[n + 2]}`)
      }
    }
    /* Eine Kachel direkt darunter (Monat: Cover stehen untereinander) zeigt mit Favorit ihren eigenen Rand an dieser Stelle. */
    const darunter = mit.kacheln.some((o) => o.oben < mk.unten + 5 && o.oben > mk.unten - 2 && o.x < mk.x + mk.w && o.x + o.w > mk.x)
    for (const [n, px] of UNTER) if (!darunter && abstand(a[n], b[n]) > TOLERANZ) fehler.push(`${f}: ${px} px unter der Leiste liegt mit Favorit ein Rand ${b[n]} statt ${a[n]}`)
  })
  return fehler
}

/** Die Woche muss Kino-Saal-Kacheln haben, sonst bliebe deren Unterkante ungemessen (Fehlertexte, leer = ok). */
export function saalFehler(name, kacheln, mindestens = MIN_SAAL) {
  const saal = kacheln.filter((k) => k.saal).length
  return saal < mindestens ? [`${name}: nur ${saal} Kino-Saal-Kacheln (mindestens ${mindestens}), ihre Unterkante bliebe ungemessen`] : []
}

/** Fehler und Ergebniszeile einer Ansicht; die Woche hat zusätzlich Kino-Saal-Kacheln (Zahl steht in der Zeile, damit das CI-Log sie zeigt). */
export function ansichtErgebnis(thema, ansicht, lauf) {
  const name = `${thema}/${ansicht}`
  const fehler = bewerte(name, lauf.ohne, lauf.mit)
  if (ansicht === 'woche') fehler.push(...saalFehler(name, lauf.mit.kacheln))
  const saal = ansicht === 'woche' ? ` (${lauf.mit.kacheln.filter((k) => k.saal).length} Saal)` : ''
  return { fehler, zeile: `${name}: ${lauf.ohne.kacheln.length} Kacheln${saal}, ${fehler.length} Fehler` }
}

/** Namen (Thema/Ansicht) der erwarteten Ergebniszeilen, die in `zeilen` fehlen: eine nicht aufgerufene Ansicht darf nie grün enden. */
export function fehlendeZeilen(zeilen) {
  const erwartet = THEMEN.flatMap((thema) => ANSICHTEN.map((ansicht) => `${thema}/${ansicht}`))
  return erwartet.filter((name) => !zeilen.some((z) => z.startsWith(`${name}: `)))
}

/** Alle Fehler der Ergebnisse (`{ fehler, zeile }` je Ansicht), dazu einer, wenn erwartete Ergebniszeilen fehlen. */
export function sammleFehler(gemessen) {
  const fehler = gemessen.flatMap((e) => e.fehler)
  const fehlend = fehlendeZeilen(gemessen.map((e) => e.zeile))
  if (fehlend.length) fehler.push(`Ergebniszeilen fehlen: ${fehlend.join(', ')}`)
  return fehler
}

/** Bild des Ausschnitts um die erste Favoriten-Kachel des Laufs „mit“ (in beiden Läufen dieselbe Stelle). */
async function bildVonKachel(seite, ansicht, datei, kachelnMit) {
  const index = kachelnMit.findIndex((k) => k.favorit)
  await seite.evaluate(({ selektor, i }) => [...document.querySelectorAll(selektor)].filter((el) => el.offsetParent !== null)[i].scrollIntoView({ block: 'center' }), { selektor: SELEKTOR[ansicht], i: index })
  await seite.waitForTimeout(300)
  await seite.screenshot({ path: datei })
}

/** Je Art von Fehler (Zahlen und Lauf herausgerechnet) Anzahl und erstes Beispiel. */
function zeigeArten(fehler) {
  const arten = new Map()
  for (const f of fehler) {
    const art = f.replace(/^[^:]*: /, '').replace(/ (ohne|mit) Favorit/, '').replace(/[\d.,-]+/g, '#')
    arten.set(art, [...(arten.get(art) ?? []), f])
  }
  return [...arten.values()].map((l) => `${l.length}x ${l[0]}`).join('\n')
}

/** Misst alle Ansichten im Browser und liefert die Ergebnisse (`{ fehler, zeile }`) in Reihenfolge. */
async function messeAlles() {
  if (BILDER) await mkdir(BILDER, { recursive: true })
  const browser = await chromium.launch()
  const ids = await sammleKennungen(browser)
  const gemessen = []
  const melde = (ergebnis) => {
    console.log(ergebnis.zeile)
    gemessen.push(ergebnis)
  }
  for (const thema of THEMEN) {
    for (const ansicht of ['woche', 'monat']) {
      const lauf = {}
      for (const [art, favoriten] of [['mit', ids], ['ohne', []]]) {
        const seite = await neueSeite(browser, thema, favoriten)
        lauf[art] = await messeAnsicht(seite, ansicht)
        if (BILDER) await bildVonKachel(seite, ansicht, path.join(BILDER, `kachel-ecken-${ansicht}-${thema}-${art}-favorit.png`), lauf.mit.kacheln)
        await seite.context().close()
      }
      melde(ansichtErgebnis(thema, ansicht, lauf))
      if (ansicht === 'monat') melde(await pruefeFenster(browser, thema, ids, lauf.mit.kacheln))
    }
    melde(await pruefeHandy(browser, thema, ids))
  }
  await browser.close()
  return gemessen
}

/** Exit-Code des Laufs: 0 ohne Fehler, sonst 1; `messe` ist eingespeist, damit der Test ohne Browser auskommt. */
export async function main(messe = messeAlles) {
  if (!arg('--dist') && !distPruefen(WURZEL)) return 1
  const fehler = sammleFehler(await messe())
  if (fehler.length) {
    console.error(`${fehler.length} Fehler, je Art das erste Beispiel:\n${zeigeArten(fehler)}`)
    return 1
  }
  console.log('Kachel-Ecken: Leiste sitzt mit Favorit gleich, Ecken eckig, nichts unter der Leiste.')
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main())
