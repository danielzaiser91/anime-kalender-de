/**
 * Prüft die Wand-Erkennung vor dem Beleg-Foto an nachgebauten Seiten (`pipeline/lib/cookie-banner.ts`, `beleg-bild.ts`): ein sauberer Artikel bekommt ein Bild,
 * Banner und Wände in verschiedener Bauart verschwinden, eine Wand, die sich nicht entfernen lässt, ergibt kein Bild (Daniel, 05.10.2026).
 * Aufruf: npx tsx pipeline/check-beleg-wand.ts   (Exit 1 bei Verstoß)
 */
import { chromium } from 'playwright'
import { belegAusschnitt } from './lib/beleg-bild.ts'

const ARTIKEL = `<header style="height:60px;background:#eee">Kopf</header><article><h1>Netflix: Alle Anime-Neuzugänge im August</h1>${'<p>Der Streaming-Dienst baut sein Anime-Programm aus, mit mehreren Serien und Filmen. </p>'.repeat(12)}</article>`
const WAND = 'Wir verwenden Cookies. Mit Ihrer Einwilligung und contentpass: Kostenlos mit Werbung weiterlesen oder abonnieren, damit wir Ihre Daten verarbeiten dürfen.'
const faelle: { name: string; html: string; erwartet: 'bild' | 'wand' }[] = [
  { name: 'sauberer Artikel', html: ARTIKEL, erwartet: 'bild' },
  { name: 'festes Banner unten', html: `${ARTIKEL}<div id="x" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#fff">${WAND}</div>`, erwartet: 'bild' },
  { name: 'Wand mit Abdunklung (absolut, Ebene 100)', html: `${ARTIKEL}<div id="x" style="position:absolute;top:0;left:0;width:100%;height:2000px;z-index:100;background:rgba(0,0,0,.6)"><div style="margin:300px auto;width:400px;background:#fff">${WAND}</div></div>`, erwartet: 'bild' },
  { name: 'Dialog mit Rolle', html: `${ARTIKEL}<div id="x" role="dialog" style="position:relative;margin-top:-500px;background:#fff;height:400px">${WAND}</div>`, erwartet: 'bild' },
  { name: 'Wand im Artikel selbst', html: ARTIKEL.replace('</article>', `<div id="x" style="position:absolute;top:150px;left:0;width:100%;z-index:50;background:#fff;height:600px">${WAND}</div></article>`), erwartet: 'bild' },
  { name: 'Block ohne Positionierung vor dem Artikel', html: `<div id="x" style="background:#fff;height:900px;padding:20px">${WAND}</div>${ARTIKEL}`, erwartet: 'bild' },
  {
    name: 'Wand, die sich sofort wieder aufbaut',
    html: `${ARTIKEL}<script>const bau = () => { const d = document.createElement('div'); d.id = 'x'; d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff'; d.textContent = 'Cookies und Einwilligung: contentpass, kostenlos mit Werbung weiterlesen, damit wir Ihre Daten verarbeiten dürfen.'; document.body.append(d) }; bau(); new MutationObserver(() => { if (!document.querySelector('#x')) bau() }).observe(document.body, { childList: true })</script>`,
    erwartet: 'wand',
  },
]

const browser = await chromium.launch()
let fehler = 0
for (const f of faelle) {
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await seite.addInitScript('window.__name = (f) => f')
  await seite.evaluate('window.__name = (f) => f')
  await seite.setContent(`<!doctype html><html><body style="margin:0">${f.html}</body></html>`)
  const b = await belegAusschnitt(seite, [])
  const bild = typeof b === 'object'
  const uebrig = await seite.evaluate(() => Boolean(document.querySelector('#x')))
  const ok = f.erwartet === 'bild' ? bild && !uebrig : !bild
  console.log(ok ? '✓' : '✗', f.name, bild ? 'Bild' : String(b), uebrig ? '(Sperre noch im Dokument)' : '')
  if (!ok) fehler++
  await seite.close()
}
await browser.close()
console.log(fehler ? `${fehler} Verstöße` : 'alle Fälle in Ordnung')
process.exit(fehler ? 1 : 0)
