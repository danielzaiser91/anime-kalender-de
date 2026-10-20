/**
 * Prüft die Wand-Erkennung vor dem Beleg-Foto an nachgebauten Seiten (`pipeline/lib/cookie-banner.ts`, `beleg-bild.ts`): ein sauberer Artikel bekommt ein Bild,
 * Banner und Wände in verschiedener Bauart verschwinden, eine Wand, die sich nicht entfernen lässt, ergibt kein Bild (Daniel, 05.10.2026).
 * Aufruf: npx tsx pipeline/check-beleg-wand.ts   (Exit 1 bei Verstoß)
 */
import { chromium, type Browser, type Page } from 'playwright'
import { faelleDurchlaufen } from './lib/screenshot-wiederholen.ts'
import { belegAusschnitt, istEinfarbig, stuetzbegriffe } from './lib/beleg-bild.ts'
import { warteschlange, type BelegGedaechtnis } from './lib/beleg-lesung.ts'

const ARTIKEL = `<header style="height:60px;background:#eee">Kopf</header><article><h1>Netflix: Alle Anime-Neuzugänge im August</h1>${'<p>Der Streaming-Dienst baut sein Anime-Programm aus, mit mehreren Serien und Filmen. </p>'.repeat(12)}</article>`
const WAND = 'Wir verwenden Cookies. Mit Ihrer Einwilligung und contentpass: Kostenlos mit Werbung weiterlesen oder abonnieren, damit wir Ihre Daten verarbeiten dürfen.'
/** Absätze mit viel Leerraum drumherum: sitzt die Marke daneben, liegt sie auf leerer Fläche und die Aufnahme gilt als leer. */
const ZIEL = '<p>Zielwort steht in diesem Absatz mit genug Text für die Suche.</p>'
const LUFT = '<div style="height:300px"></div>'
const MIT_LEISTE = `<header style="position:sticky;top:0;height:64px;background:#eee">Kopf</header><article><h1>Überschrift des Artikels</h1>${LUFT}${ZIEL}${LUFT}<p>Ein weiterer Absatz mit ausreichend Text zum Lesen.</p></article>`
const KRITIK_EINGEKLAPPT = `<article><h1>Überschrift des Artikels</h1><p>Ein Absatz mit ausreichend Text zum Lesen im Kopf.</p><div style="max-height:100px;overflow:hidden"><p>Kurzer Anfang der Kritik.</p><p style="margin-top:700px">Zielwort steht in der eingeklappten Kritik.</p></div></article>`
/** Text im Dokument, aber unsichtbar (weiß auf Weiß): die Stützstelle sitzt dort, das Bild ist an der Marke leer. */
const UNSICHTBAR = `<article><h1>Überschrift des Artikels</h1><p>Ein Absatz mit ausreichend Text zum Lesen im Kopf.</p><p style="color:#fff;margin-top:200px">Zielwort steht in diesem unsichtbaren Absatz.</p><p>Ein weiterer Absatz mit ausreichend Text zum Lesen.</p></article>`
/** Kinoheld: der Titel steht oben, die Veröffentlichung weiter unten — die Marke gehört dorthin (Seite lokal über `route`, kein Netzabruf). */
const KINOHELD = `<article><h1>Kinoheld Film</h1><p>Titelwort steht ganz oben im Kopf des Artikels.</p>${LUFT}<p>Veröffentlichung: 12. Oktober 2026 im Kino.</p></article>`
const faelle: { name: string; html: string; erwartet: 'bild' | 'wand' | 'leer'; suchen?: string[]; mitMarke?: boolean; url?: string; markeAbAnteil?: number }[] = [
  { name: 'sauberer Artikel', html: ARTIKEL, erwartet: 'bild' },
  { name: 'klebende Leiste: Marke sitzt auf dem Absatz, nicht daneben', html: MIT_LEISTE, erwartet: 'bild', suchen: ['Zielwort'], mitMarke: true },
  { name: 'Titel nur in eingeklappter Kritik: keine Marke auf leerer Fläche', html: KRITIK_EINGEKLAPPT, erwartet: 'bild', suchen: ['Zielwort'] },
  { name: 'Marke auf unsichtbarem Text: Aufnahme gilt als leer', html: UNSICHTBAR, erwartet: 'leer', suchen: ['Zielwort'] },
  { name: 'Kinoheld: Marke sitzt bei „Veröffentlichung“, nicht beim Titel', html: KINOHELD, erwartet: 'bild', suchen: ['Titelwort'], url: 'https://www.kinoheld.de/film/test', markeAbAnteil: 0.4 },
  { name: 'festes Banner unten', html: `${ARTIKEL}<div id="x" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#fff">${WAND}</div>`, erwartet: 'bild' },
  { name: 'Wand mit Abdunklung (absolut, Ebene 100)', html: `${ARTIKEL}<div id="x" style="position:absolute;top:0;left:0;width:100%;height:2000px;z-index:100;background:rgba(0,0,0,.6)"><div style="margin:300px auto;width:400px;background:#fff">${WAND}</div></div>`, erwartet: 'bild' },
  { name: 'Dialog mit Rolle', html: `${ARTIKEL}<div id="x" role="dialog" style="position:relative;margin-top:-500px;background:#fff;height:400px">${WAND}</div>`, erwartet: 'bild' },
  { name: 'Wand im Artikel selbst', html: ARTIKEL.replace('</article>', `<div id="x" style="position:absolute;top:150px;left:0;width:100%;z-index:50;background:#fff;height:600px">${WAND}</div></article>`), erwartet: 'bild' },
  { name: 'Block ohne Positionierung vor dem Artikel', html: `<div id="x" style="background:#fff;height:900px;padding:20px">${WAND}</div>${ARTIKEL}`, erwartet: 'bild' },
  { name: 'einfarbige Aufnahme (Text schwarz auf schwarz)', html: ARTIKEL.replace('<article>', '<article style="background:#000;color:#000">').replace('<header', '<header style="background:#000"'), erwartet: 'wand' },
  {
    name: 'Wand, die sich sofort wieder aufbaut',
    html: `${ARTIKEL}<script>const bau = () => { const d = document.createElement('div'); d.id = 'x'; d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff'; d.textContent = 'Cookies und Einwilligung: contentpass, kostenlos mit Werbung weiterlesen, damit wir Ihre Daten verarbeiten dürfen.'; document.body.append(d) }; bau(); new MutationObserver(() => { if (!document.querySelector('#x')) bau() }).observe(document.body, { childList: true })</script>`,
    erwartet: 'wand',
  },
]

type Fall = (typeof faelle)[number]

/** Ein Fall auf frischer Seite; die Seite wird auch bei einem Fehler geschlossen, damit die Wiederholung neu beginnt. */
async function pruefeFall(browser: Browser, f: Fall): Promise<boolean> {
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  try {
    return await pruefeAufSeite(seite, f)
  } finally {
    await seite.close()
  }
}

async function pruefeAufSeite(seite: Page, f: Fall): Promise<boolean> {
  const dokument = `<!doctype html><html><body style="margin:0;${f.name.startsWith('einfarbig') ? 'background:#000' : ''}">${f.html}</body></html>`
  if (f.url) {
    await seite.route(f.url, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: dokument }))
    await seite.goto(f.url)
  } else await seite.setContent(dokument)
  const b = await belegAusschnitt(seite, f.suchen ?? [])
  const bild = typeof b === 'object'
  const uebrig = await seite.evaluate(() => Boolean(document.querySelector('#x')))
  /* Die Marke muss auf Text liegen, nicht auf leerer Fläche daneben. */
  const marke = typeof b === 'object' ? b.markierung : undefined
  const markeOk = typeof b !== 'object' || !marke || !(await istEinfarbig(seite, b.bild.toString('base64'), marke))
  const markeDa = !f.mitMarke || Boolean(marke)
  const markeTief = f.markeAbAnteil === undefined || (marke?.[1] ?? 0) >= f.markeAbAnteil
  const ok = f.erwartet === 'bild' ? bild && !uebrig && markeOk && markeDa && markeTief : f.erwartet === 'leer' ? b === 'leer' : !bild
  console.log(ok ? '✓' : '✗', f.name, bild ? 'Bild' : String(b), uebrig ? '(Sperre noch im Dokument)' : '')
  return ok
}

const browser = await chromium.launch()
let fehler = await faelleDurchlaufen(faelle, (f) => pruefeFall(browser, f), console.log)
await browser.close()
/* Kinoheld sucht zuerst „Veröffentlichung“, andere Seiten nur ihre eigenen Begriffe. */
const sb = [stuetzbegriffe('https://www.kinoheld.de/film/x', ['A']), stuetzbegriffe('https://kinoheld.de/film/x', ['A']), stuetzbegriffe('https://www.joyn.de/serien/x', ['A'])]
const sbOk = sb[0]!.join() === 'Veröffentlichung,A' && sb[1]!.join() === 'Veröffentlichung,A' && sb[2]!.join() === 'A'
console.log(sbOk ? '✓' : '✗', 'Stützbegriffe: nur Kinoheld sucht „Veröffentlichung“', sb.map((x) => x.join('+')).join(' | '))
if (!sbOk) fehler++
/* Warteschlange: ein entzogenes Bild (Leser sieht nichts) kommt vor dem Altbestand, auch wenn es jünger ist. */
const GEDAECHTNIS = {
  'https://www.kinoheld.de/film/alt': { zuletzt: '2026-10-05', lesungen: [{ am: '2026-10-05', hash: 'a', bild: 'a.webp', qs: 'ok' }] },
  'https://www.kinoheld.de/film/entzogen': { zuletzt: '2026-10-07', lesungen: [{ am: '2026-10-07', hash: 'b', qs: 'wand' }] },
} as unknown as BelegGedaechtnis
const reihenfolge = warteschlange(Object.keys(GEDAECHTNIS), GEDAECHTNIS, '2026-10-12', 7, 5)
const schlangeOk = reihenfolge[0] === 'https://www.kinoheld.de/film/entzogen' && reihenfolge.length === 2
console.log(schlangeOk ? '✓' : '✗', 'Warteschlange: Artikel ohne Bild zuerst', reihenfolge.join(' '))
if (!schlangeOk) fehler++
console.log(fehler ? `${fehler} Verstöße` : 'alle Fälle in Ordnung')
process.exit(fehler ? 1 : 0)
