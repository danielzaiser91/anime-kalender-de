/**
 * Messung der Karte „Termin offen“ im Detail-Panel (F77, Prüfer-Auflage A4, Messregel K9): am Handy (360 px), hell und dunkel.
 * Gemessen werden die Lage gegen den Kasten (bündig, im Fenster, Abstand), die Tippziele von Knopf und Quelle, die vier Ecken (rund: das Pixel
 * in der Ecke zeigt den Grund), die Randzeile der Unterkante (die mit dem größten Abstand zum Grund, nie eine feste Zeile: Bruchhöhen) und die
 * Zeile darunter (nur Grund). Der Titel ist ein eingefrorener Probetitel (`mitProbetitel`, in die Antwort auf `titles.json` eingefügt), nicht
 * ein echter Fall; fehlt `dist/data/titles.json`, ist die Messung rot. Regeln: `termin-karte-urteil.mjs`.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { lageFehler, pixelFehler } from './termin-karte-urteil.mjs'

const BREITE = 360
const RAND = 6
const KARTE = 'section[aria-label="Termin offen"]'
export const PROBE_ID = 990002
export const PROBE_NAME = 'Terminkartenprobe Eta'

/** `titel` (Inhalt von `titles.json`) samt einem Probetitel: Synchro angekündigt, kein Weg außer dem Anbieter der Ankündigung, kein Cartoon. Auch bei leerem Datenstand. */
export function mitProbetitel(titel) {
  const { tr: _tr, westlich: _westlich, ...vorlage } = titel[0] ?? { format: 'TV', genres: [], keywords: [], studios: [] }
  const probe = {
    ...vorlage,
    id: PROBE_ID,
    slug: 'terminkartenprobe-eta-990002',
    franchiseId: PROBE_ID,
    titleDe: PROBE_NAME,
    titleEn: PROBE_NAME,
    titleRomaji: PROBE_NAME,
    titleNative: PROBE_NAME,
    streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/PROBE', kind: 'stream', zugang: 'abo' }],
    watchLinks: [],
    os: true,
    /* Alles, was die Antwort „ohne“ in „fertig“ kippen würde (`hatSynchro`, `titleStatus`), kommt nicht aus der Vorlage. */
    hasVoices: undefined,
    deErstausgabe: undefined,
    jpEnd: undefined,
    einzelquelle: undefined,
    dubConfidence: 'low',
    jpYear: 2026,
    ankuendigung: { platform: 'crunchyroll', omuAb: '2026-10-07', synchro: 'angekuendigt', quellen: ['https://www.crunchyroll.com/de/news/synchro-probe'], stand: '2026-09-15' },
  }
  return [...titel, probe]
}

function mitProbe(antworte, dist) {
  return async (route) => {
    if (new URL(route.request().url()).pathname !== '/data/titles.json') return antworte(route)
    const titel = JSON.parse(await readFile(path.join(dist, 'data/titles.json'), 'utf8'))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mitProbetitel(titel)) })
  }
}

/** Rechtecke von Karte und Kasten (Seitenkoordinaten), Höhen von Knopf und Quelle. Läuft im Browser. */
function lage(karteSel) {
  const k = document.querySelector(karteSel)
  let kasten = k.previousElementSibling
  while (kasten && !(kasten.tagName === 'SECTION' && !kasten.hasAttribute('aria-label'))) kasten = kasten.previousElementSibling
  const rel = (e) => {
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), h: r.height }
  }
  const knopf = k.querySelector('button')
  const quelle = [...k.querySelectorAll('a')].find((a) => a.textContent.startsWith('Quelle'))
  return { karte: rel(k), kasten: rel(kasten), knoepfe: { Knopf: knopf.getBoundingClientRect().height, Quelle: quelle ? quelle.getBoundingClientRect().height : 0 } }
}

/** Misst einen Zustand; `lesePixel` liest Pixel aus einem PNG (läuft im Browser). Liefert die Fehlertexte. */
async function messe(seite, lesePixel, name) {
  const karte = seite.locator(KARTE).first()
  await karte.scrollIntoViewIfNeeded()
  await seite.waitForTimeout(400)
  const z = await seite.evaluate(lage, KARTE)
  const x = Math.round(z.karte.l)
  const y = Math.round(z.karte.t)
  const w = Math.round(z.karte.r - z.karte.l)
  const h = Math.round(z.karte.b - z.karte.t)
  const png = (await seite.screenshot({ clip: { x: x - RAND, y: y - RAND, width: w + 2 * RAND, height: h + 2 * RAND } })).toString('base64')
  const mx = RAND + Math.round(w / 2)
  const unten = RAND + h
  const zeilen = [-4, -3, -2, -1, 0, 1].map((d) => [mx, unten + d])
  const px = await lesePixel({ png, punkte: [[RAND, RAND], [RAND - 3, RAND - 3], [RAND + w - 1, unten - 1], [RAND + w + 2, unten + 2], [mx, unten + 4], [mx, unten + 2], ...zeilen] })
  const [ecke, aussen, eckeU, aussenU, grund, darunter, ...rest] = px
  const mehr = (a) => a.reduce((s, v, i) => s + Math.abs(v - grund[i]), 0)
  const rand = rest.reduce((beste, f) => (mehr(f) > mehr(beste) ? f : beste), rest[0])
  const fehler = [...lageFehler({ ...z, breite: BREITE }), ...pixelFehler({ ecken: [ecke, aussen, eckeU, aussenU], rand, grund, darunter })]
  console.log(`  ${name}: Karte ${z.karte.l}–${z.karte.r} px (Kasten ${z.kasten.l}–${z.kasten.r}), ${z.karte.t - z.kasten.b} px unter dem Kasten, Knopf ${Math.round(z.knoepfe.Knopf)} px, Quelle ${Math.round(z.knoepfe.Quelle)} px hoch, Rand-Abstand zum Grund ${mehr(rand)}`)
  return fehler.map((f) => `${name}: ${f}`)
}

/** Beide Themen am Handy; druckt die Ergebniszeile und gibt wahr zurück, wenn etwas rot ist. */
export async function meldeTerminKarte({ chromium, antworte, dist, lesePixel }) {
  if (!existsSync(path.join(dist, 'data/titles.json'))) {
    console.log('\nKarte „Termin offen“ (360 px): ✕ dist/data/titles.json fehlt, nichts gemessen')
    return true
  }
  const browser = await chromium.launch()
  const fehler = []
  for (const thema of ['dunkel', 'hell']) {
    const kontext = await browser.newContext({ viewport: { width: BREITE, height: 800 }, isMobile: true, hasTouch: true, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
    const seite = await kontext.newPage()
    await seite.route('**/*', mitProbe(antworte, dist))
    await seite.goto(`http://ak.test/#/datenbank?t=${PROBE_ID}`, { waitUntil: 'networkidle' })
    try {
      await seite.waitForSelector(KARTE, { timeout: 15_000 })
      fehler.push(...(await messe(seite, (a) => seite.evaluate(lesePixel, a), thema)))
    } catch (e) {
      const sicht = await seite.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)).catch(() => '')
      fehler.push(`${thema}: keine Karte „Termin offen“ für „${PROBE_NAME}“ gefunden (${String(e).slice(0, 80)}; Seite zeigt: ${sicht})`)
    }
    await kontext.close()
  }
  await browser.close()
  console.log(`\nKarte „Termin offen“ im Detail-Panel (360 px, hell und dunkel, „${PROBE_NAME}“; Lage gegen den Kasten, Tippziele, vier Ecken, Randzeile der Unterkante, Zeile darunter): ${fehler.length ? '' : 'ok'}`)
  for (const f of fehler) console.log(`  ✕ ${f}`)
  return fehler.length > 0
}
