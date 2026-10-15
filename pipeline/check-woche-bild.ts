/**
 * Prüft das Foto der Wochenprogramm-Zeile an einer nachgebauten Seite (kein Netzabruf, `setContent`): der Ausschnitt beginnt beim Wochentag-Streifen
 * und reicht bis unter die Zeile, ist nie höher als erlaubt, die Marke liegt auf der Zeile, und das Ablegen trägt Schlüssel, Zeit und Marke ein.
 * Der Aufbau (Raster zu vier Spalten, Streifen mit dem Wochentag, je Eintrag Cover, `h3`, `p` mit Flagge) wurde am 15.10.2026 im Lauf gemessen.
 * Aufruf: npx tsx pipeline/check-woche-bild.ts   (Exit 1 bei Verstoß)
 */
import { readFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { belegeFuehren, bilderAnlegen, zeileFotografieren } from './lib/woche-bild.ts'
import { zeilenSchluessel, type WocheBelege } from './lib/woche-beleg.ts'
import { eintraegeAus, rohLesen, type WochenEintrag } from './scrape-crunchyroll-woche.ts'

const FLAGGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAADwyuo0AAAAEUlEQVR4nGNgYPj/n4EBjQEAgB8F/e0PKPUAAAAASUVORK5CYII='
/** Eine Karte wie im Artikel: Cover als Bild, Titel als `h3`, darunter `p` mit Flagge, Folge und Uhrzeit. */
const karte = (titel: string, marke?: string) =>
  `<div><p><img alt="Cover" width="120" height="180" style="background:#468"></p><h3>${titel}</h3><p${marke ? ` data-woche-zeile="${marke}"` : ''}><img alt="Deutschland Flagge" src="${FLAGGE}" width="12" height="9"> Folge 12<br>19:20 Uhr</p></div>`
const tag = (name: string) => `<div style="background:#245;padding:14px;text-align:center"><b>${name}</b></div>`
const raster = (karten: string) => `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:20px 0">${karten}</div>`
const seite = (inhalt: string) => `<!doctype html><html><body style="margin:0;width:900px;background:#000;color:#fff;font:14px sans-serif"><h1>Wochenprogramm</h1><div style="height:1800px"></div>${inhalt}</body></html>`

const kurz = seite(`${tag('Dienstag')}${raster(karte('Andere Serie'))}${tag('Mittwoch')}${raster([karte('Erste'), karte('Zweite'), karte('Tomb Raider King', '0-0')].join(''))}${tag('Donnerstag')}${raster(karte('Spaeter'))}`)
const lang = seite(`${tag('Samstag')}${raster([...Array.from({ length: 40 }, (_, i) => karte(`Serie ${i}`)), karte('Letzte', '1-0')].join(''))}`)

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  console.log(ok ? '✓' : '✗', name, ok || gefunden === undefined ? '' : JSON.stringify(gefunden))
  if (!ok) fehler++
}

/** Läuft im Browser: die Lage der Elemente, an denen die Aufnahme gemessen wird (Seite ohne Bildlauf, Koordinaten ab Seitenanfang). */
const lage = (s: Page, marke: string) =>
  s.evaluate((m) => {
    const p = document.querySelector(`[data-woche-zeile="${m}"]`)!
    const streifen = [...document.querySelectorAll('b')].filter((b) => b.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1)!
    const t = p.parentElement!.querySelector('h3')!.getBoundingClientRect()
    const z = p.getBoundingClientRect()
    return {
      streifenOben: streifen.getBoundingClientRect().top + window.scrollY,
      zeileUnten: z.bottom + window.scrollY,
      titelOben: t.top + window.scrollY,
      links: Math.min(t.left, z.left),
      rechts: Math.max(t.right, z.right),
    }
  }, marke)

/** Läuft im Browser: Breite und Höhe des WebP-Bilds. */
const masse = (s: Page, bild: Buffer) =>
  s.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/webp;base64,' + b64)).blob())
    return { breite: bmp.width, hoehe: bmp.height }
  }, bild.toString('base64'))

const browser = await chromium.launch()
const s = await browser.newPage({ viewport: { width: 900, height: 900 } })
await s.addInitScript('window.__name = (f) => f')
try {
  await s.setContent(kurz)
  const a = await zeileFotografieren(s, '0-0')
  const g = await lage(s, '0-0')
  pruefe('kurzer Tag: Bild und Marke da', Boolean(a?.bild.length) && Boolean(a?.markierung), a?.markierung)
  const m = a?.markierung ?? [0, 0, 0, 0]
  pruefe('die Marke liegt im Bild', m.every((x) => x >= 0) && m[0] + m[2] <= 1.001 && m[1] + m[3] <= 1.001, m)
  pruefe('die Marke sitzt unten (Titel und Zeile der letzten Karte), nicht am Bildanfang', m[1] > 0.5 && m[1] + m[3] > 0.9, m)
  const groesse = await masse(s, a!.bild)
  const soll = g.zeileUnten + 16 - (g.streifenOben - 40)
  pruefe('der Ausschnitt reicht vom Streifen des Wochentags (40 px Rand) bis 16 px unter die Zeile, 900 px breit', Math.abs(groesse.hoehe - soll) <= 2 && groesse.breite === 900, { groesse, soll })
  const x = (v: number) => Math.round(v * 900)
  const y = (v: number) => Math.round(v * groesse.hoehe)
  const clipOben = g.zeileUnten + 16 - groesse.hoehe
  pruefe('die Marke umschließt Titel und Zeile: links und rechts je 6 px Rand, oben 4 px über dem Titel, unten 4 px unter der Zeile', Math.abs(x(m[0]) - (g.links - 6)) <= 2 && Math.abs(x(m[0] + m[2]) - (g.rechts + 6)) <= 2 && Math.abs(y(m[1]) - (g.titelOben - 4 - clipOben)) <= 2 && Math.abs(y(m[1] + m[3]) - (g.zeileUnten + 4 - clipOben)) <= 2, { m, g, clipOben })
  pruefe('das Bild ist ein WebP', a!.bild.subarray(8, 12).toString('latin1') === 'WEBP')
  pruefe('unbekannte Marke: kein Bild', (await zeileFotografieren(s, '9-9')) === undefined)

  /* Steht der Streifen ganz oben, beginnt das Bild bei 0 und nicht davor. */
  await s.setContent(`<!doctype html><html><body style="margin:0;width:900px;background:#000;color:#fff;font:14px sans-serif">${tag('Montag')}${raster(karte('Erste', 'o-0'))}</body></html>`)
  const oben = await zeileFotografieren(s, 'o-0')
  const go = await lage(s, 'o-0')
  pruefe('Streifen ganz oben: das Bild beginnt bei 0 und reicht bis 16 px unter die Zeile', Math.abs((await masse(s, oben!.bild)).hoehe - (go.zeileUnten + 16)) <= 2, { go })
  await s.setContent('<!doctype html><html><body style="margin:0;width:900px;background:#000;color:#fff"><div><p data-woche-zeile="n-0">Folge 12</p></div></body></html>')
  pruefe('Zeile ohne Titel im Block: kein Bild', (await zeileFotografieren(s, 'n-0')) === undefined)

  /* Die Marken, die das Einlesen setzt, führen zur richtigen Zeile (Katalogtitel und Zeilen ohne Folge verschieben nichts). */
  await s.route('https://bild.test/**', (r) => r.fulfill({ contentType: 'image/png', body: Buffer.from(FLAGGE.split(',')[1]!, 'base64') }))
  const flagge = (art: 'deutschland-flagge' | 'japan-flag') => `<img alt="${art}" src="https://bild.test/x/${art}.png">`
  const artikelKarte = (titel: string, kennung: string, zeilen: string[]) =>
    `<div><h3><a href="https://www.crunchyroll.com/de/series/${kennung}/x">${titel}</a></h3>${zeilen.join('')}</div>`
  const zeileMit = (art: 'deutschland-flagge' | 'japan-flag', text: string) => `<p>${flagge(art)} ${text}</p>`
  await s.setContent(
    `<!doctype html><html><body><h1>Crunchyrolls aktuelles Wochenprogramm vom 12. bis 18. Oktober</h1><p>Aktualisiert: 12. Oktober 2026</p>` +
      `<b>Montag</b>${artikelKarte('A', 'GAAA', [zeileMit('deutschland-flagge', 'Folge 1<br>10:00 Uhr'), zeileMit('japan-flag', 'Folge 1<br>10:00 Uhr')])}` +
      `<b>Katalogtitel</b>${artikelKarte('K', 'GKKK', [zeileMit('deutschland-flagge', 'Folge 5<br>10:00 Uhr')])}` +
      `<b>Dienstag</b>${artikelKarte('B', 'GBBB', [zeileMit('japan-flag', 'bald mehr'), zeileMit('deutschland-flagge', 'Folge 3<br>19:20 Uhr')])}</body></html>`,
  )
  await s.evaluate('window.__name = (f) => f')
  const roh = await rohLesen(s)
  const gelesen = eintraegeAus(roh, '2026-10-12')
  const titelZur = (marke: string) => s.evaluate((m) => document.querySelector(`[data-woche-zeile="${m}"]`)!.parentElement!.querySelector('h3')!.textContent, marke)
  const beschreibung = await Promise.all(gelesen.eintraege.map(async (e, k) => `${e.titel}:${e.sprache}:${await titelZur(gelesen.marken[k]!)}`))
  pruefe('Einlesen: jede Zeile hat eine Marke, die auf ihren Block führt (Katalogtitel und Zeile ohne Folge zählen nicht)', beschreibung.join() === 'A:de:A,A:ja:A,B:de:B' && gelesen.marken.length === 3, { beschreibung, marken: gelesen.marken })
  pruefe('Einlesen: die Marke der deutschen Zeile von B nennt die Zeile mit „Folge 3“, nicht die davor', (await s.evaluate((m) => document.querySelector(`[data-woche-zeile="${m}"]`)!.textContent, gelesen.marken[2]!))?.includes('Folge 3') === true, gelesen.marken)

  await s.setContent(lang)
  const l = await zeileFotografieren(s, '1-0')
  pruefe('langer Tag (Streifen weit über der Zeile): trotzdem Bild und Marke', Boolean(l?.bild.length) && Boolean(l?.markierung))
  const gl = await lage(s, '1-0')
  pruefe('der Streifen liegt weiter als 1500 px über der Zeile, das Bild ist auf 1500 px gekappt', gl.zeileUnten - gl.streifenOben > 1500 && (await masse(s, l!.bild)).hoehe === 1500, gl)
  const lm = l?.markierung ?? [0, 0, 0, 0]
  pruefe('langer Tag: die Marke liegt trotz Kappung auf der Zeile (unten im Bild)', lm[1] > 0.8 && lm[1] + lm[3] <= 1.001, lm)

  /* Ablegen: Schlüssel, Zeit und Marke kommen in die Liste; ohne Antwort der Ablage bleibt die Zeile offen. */
  await s.setContent(kurz)
  const echt = globalThis.fetch
  process.env.LAUF_TOKEN = 'pruefung'
  const angefragt: string[] = []
  let antwort = 200
  globalThis.fetch = (async (url: string) => {
    angefragt.push(String(url))
    return new Response('{}', { status: antwort })
  }) as typeof fetch
  const belege: WocheBelege = {
    k: { seriesId: 'GT00378123', titel: 'Tomb Raider King', von: 12, bis: 12, datum: '2026-10-14', zeit: '19:20', artikel: 'https://x/', erstmalsAm: '2026-10-12T11:04:14.990Z' },
  }
  antwort = 500
  const keins = await bilderAnlegen(s, belege, [{ schluessel: 'k', marke: '0-0' }], '2026-10-15T13:00:00.000Z')
  pruefe('Ablage antwortet mit Fehler: kein neues Bild, die Zeile bleibt ohne Schlüssel', keins === 0 && !belege.k!.bild)
  antwort = 200
  const eins = await bilderAnlegen(s, belege, [{ schluessel: 'k', marke: '0-0' }], '2026-10-15T13:00:00.000Z')
  pruefe('Ablage antwortet: ein Bild, Schlüssel, Zeit und Marke stehen an der Zeile', eins === 1 && belege.k!.bild?.endsWith('.webp') === true && belege.k!.bildAm === '2026-10-15T13:00:00.000Z' && belege.k!.markierung?.length === 4, belege.k)
  pruefe('der Schlüssel geht an die Ablage des Workers (`/beleg?key=`)', angefragt.at(-1)!.includes('/beleg?key=www.crunchyroll.com%2Fwochenprogramm%2Fgt00378123%2F2026-10-14-f12-'), angefragt.at(-1))
  /* Die Liste fortführen: neue Zeilen vermerken, die mit Marke im Artikel fotografieren, die ohne bleiben offen. */
  const eintrag = (seriesId: string, extra: Partial<WochenEintrag> = {}): WochenEintrag => ({ seriesId, titel: seriesId, sprache: 'de', von: 12, bis: 12, datum: '2026-10-14', zeit: '19:20', abweichend: false, ...extra })
  const jetzt = '2026-10-15T13:00:00.000Z'
  const gefuehrt = await belegeFuehren(s, { [zeilenSchluessel(eintrag('GT00378123'))]: { ...belege.k!, bild: undefined, bildAm: undefined, markierung: undefined } }, [eintrag('GT00378123'), eintrag('GANDERE')], ['0-0', '9-9'], 'https://x/', jetzt)
  pruefe('Liste fortführen: die Zeile mit Marke bekommt ihr Bild, die ohne Marke bleibt offen, die erste Sichtung bleibt', gefuehrt.neu === 1 && gefuehrt.offen === 1 && gefuehrt.belege[zeilenSchluessel(eintrag('GT00378123'))]?.erstmalsAm === '2026-10-12T11:04:14.990Z' && !gefuehrt.belege[zeilenSchluessel(eintrag('GANDERE'))]?.bild, gefuehrt)
  const viele = Array.from({ length: 25 }, (_, i) => eintrag(`G${i}`))
  const vorher = angefragt.length
  const grenze = await belegeFuehren(s, {}, viele, viele.map(() => '0-0'), 'https://x/', jetzt)
  pruefe('höchstens 20 Fotos je Lauf, der Rest bleibt offen', grenze.neu === 20 && grenze.offen === 5 && angefragt.length - vorher === 20, { neu: grenze.neu, offen: grenze.offen, angefragt: angefragt.length - vorher })
  const quelleBild = readFileSync(new URL('./lib/woche-bild.ts', import.meta.url), 'utf8')
  pruefe('belegeAktualisieren liest und schreibt die Liste im Repo und meldet einen Abbruch als Vorfall', quelleBild.includes('readJson<WocheBelege>(BELEGE_DATEI, {})') && quelleBild.includes('writeJson(BELEGE_DATEI, r.belege, true)') && quelleBild.includes("meldeAbbruch('wochenprogramm-bilder', err)"))
  const quelleLauf = readFileSync(new URL('./scrape-crunchyroll-woche.ts', import.meta.url), 'utf8')
  pruefe('der Wochenprogramm-Lauf ruft den Bild-Schritt erst nach dem Schreiben der Zeilen auf', quelleLauf.indexOf("writeJson('data/crunchyroll-woche.json'") < quelleLauf.indexOf('await belegeAktualisieren(seite, eintraege, marken, artikel, programm.geholtAm)'), quelleLauf.indexOf('belegeAktualisieren'))
  /* Seite nicht gezeichnet (Text schwarz auf schwarz): die Marke liegt auf leerer Fläche, es gibt kein Bild. */
  await s.setContent('<!doctype html><html><body style="margin:0;width:900px;background:#000;color:#000"><div style="height:1800px"></div><div><h3>Titel</h3><p data-woche-zeile="e-0">Folge 12<br>19:20 Uhr</p></div></body></html>')
  pruefe('Marke auf leerer Fläche: kein Bild', (await zeileFotografieren(s, 'e-0')) === undefined)
  await s.setContent(kurz)
  /* Ohne Arbeit rührt der Schritt die Seite nicht an: das Fenster behält seine Breite (sonst würde ohne Token oder ohne offene Zeile umsonst umgestellt). */
  await s.setViewportSize({ width: 700, height: 900 })
  const keineZeile = await bilderAnlegen(s, {}, [], '2026-10-15T13:00:00.000Z')
  pruefe('keine offene Zeile: nichts geschieht', keineZeile === 0 && s.viewportSize()?.width === 700)
  delete process.env.LAUF_TOKEN
  const vorToken = angefragt.length
  const ohneToken = await bilderAnlegen(s, { k: { ...belege.k!, bild: undefined } }, [{ schluessel: 'k', marke: '0-0' }], '2026-10-15T13:00:00.000Z')
  pruefe('ohne Token wird nichts fotografiert und nichts angefragt', ohneToken === 0 && angefragt.length === vorToken && s.viewportSize()?.width === 700)
  globalThis.fetch = echt
} finally {
  await browser.close()
}
console.log(fehler ? `${fehler} Verstöße` : 'alle Fälle in Ordnung')
process.exit(fehler ? 1 : 0)
