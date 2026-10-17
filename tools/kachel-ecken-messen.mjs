/**
 * Anbieter-Leiste unten an den Kacheln (Daniel, 17.10.2026): Die unteren Cover-Ecken sind eckig (sonst Lücke zwischen Rand und Leiste),
 * und der goldene Favoritenrand schiebt die Leiste nicht nach oben. Gemessen wird an Pixeln der gebauten App, nicht an Klassen:
 * dieselbe Woche und derselbe Monat einmal ohne Favoriten, einmal mit allen Titeln als Favorit, je Thema (dunkel/hell), Desktop 1280.
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
/** Eine Woche mit Kino-Saal (Termine am 27.10.; gemessen 17.10.2026); in der Woche vom 19.10. gibt es keinen. */
const DATUM = '2026-10-26'
const SELEKTOR = {
  woche: '.ak-breit-cover, div[class~="aspect-[2/3]"]',
  monat: 'button[class*="w-[22px]"][class*="overflow-hidden"]',
  /* Das Cover der Tageszeile im Fenster, das beim Zeigen auf ein Monats-Cover aufgeht. */
  fenster: '[data-schliesst] > span.relative',
}
/** So viele Monats-Cover mit Favorit werden für das Fenster angezeigt. */
const MAX_FENSTER = 6
/** Farbabstand (Summe der Kanäle), ab dem zwei Pixel als verschieden gelten; Kantenglättung bleibt darunter. */
const TOLERANZ = 48
/** Mindestzahl Kacheln mit Favoritenrand im Lauf „mit“; ohne sie wäre der Vergleich leer (Kennungen greifen nicht). */
const MIN_FAVORITEN = 5
/** Pixel je Kachel (`stellen`). */
const ANZAHL = 12
/** Mindestzahl Kino-Saal-Kacheln in der Woche (26.10.2026: 2). */
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
    .map((el) => {
      const leiste = monat ? el.lastElementChild : el.nextElementSibling
      const r = leiste.getBoundingClientRect()
      return { x: r.x + dx, w: r.width, oben: el.getBoundingClientRect().top + dy, unten: r.bottom + dy, breit: el.classList.contains('ak-breit-cover'), favorit: el.classList.contains('ring-ak-favorit-rand'), saal: el.classList.contains('ak-saal') }
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

async function neueSeite(browser, thema, favoriten) {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
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
  console.log(`${thema}/fenster: ${lauf.ohne.kacheln.length} Kacheln, ${f.length} Fehler`)
  return f
}

/** Geprüfte Pixel einer Leiste: untere Ecke links und rechts, je drei Pixel weiter innen und zwei Zeilen höher (Leistenfarbe; fehlt die letzte Leistenzeile, fällt das auf), drei Pixel unter der Mitte. */
function stellen(k) {
  const unten = Math.floor(k.unten) - 1
  const mitte = Math.round(k.x + k.w / 2)
  return [
    [Math.ceil(k.x), unten],
    [Math.floor(k.x + k.w) - 1, unten],
    [Math.ceil(k.x) + 3, unten - 2],
    [Math.floor(k.x + k.w) - 4, unten - 2],
    [mitte, unten + 2],
    [mitte, unten + 3],
    [mitte, unten + 4],
    [Math.ceil(k.x), unten - 5],
    [Math.floor(k.x + k.w) - 1, unten - 5],
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

async function main() {
  if (!arg('--dist') && !distPruefen(WURZEL)) return
  if (BILDER) await mkdir(BILDER, { recursive: true })
  const browser = await chromium.launch()
  const ids = await sammleKennungen(browser)
  const fehler = []
  for (const thema of THEMEN) {
    for (const ansicht of ['woche', 'monat']) {
      const lauf = {}
      for (const [art, favoriten] of [['mit', ids], ['ohne', []]]) {
        const seite = await neueSeite(browser, thema, favoriten)
        lauf[art] = await messeAnsicht(seite, ansicht)
        if (BILDER) await bildVonKachel(seite, ansicht, path.join(BILDER, `kachel-ecken-${ansicht}-${thema}-${art}-favorit.png`), lauf.mit.kacheln)
        await seite.context().close()
      }
      const f = bewerte(`${thema}/${ansicht}`, lauf.ohne, lauf.mit)
      console.log(`${thema}/${ansicht}: ${lauf.ohne.kacheln.length} Kacheln, ${f.length} Fehler`)
      fehler.push(...f)
      if (ansicht === 'woche') fehler.push(...saalFehler(`${thema}/woche`, lauf.mit.kacheln))
      if (ansicht === 'monat') fehler.push(...(await pruefeFenster(browser, thema, ids, lauf.mit.kacheln)))
    }
  }
  await browser.close()
  if (fehler.length) {
    console.error(`${fehler.length} Fehler, je Art das erste Beispiel:\n${zeigeArten(fehler)}`)
    process.exit(1)
  }
  console.log('Kachel-Ecken: Leiste sitzt mit Favorit gleich, Ecken eckig, nichts unter der Leiste.')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
