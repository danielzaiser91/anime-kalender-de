#!/usr/bin/env node
/**
 * **Der Hinweiskasten der Erweiterung als Bild — ohne Amazon, ohne Anmeldung.**
 *
 * Am 02.09.2026 sind drei Fassungen der Fußzeile hintereinander falsch
 * ausgeliefert worden, jede aus einer Vermutung über das CSS. Daniels Vorgabe
 * danach: „prüf das styling selbst mit playwright und screenshots."
 *
 * Was hier gemessen wird, ist genau das, was sich ohne seine angemeldete
 * Sitzung messen lässt: **wie `melder.css` die Zeilen des Kastens anordnet.**
 * Die Daten der Seite (Folgenzahl, Tonspuren, Briefkasten) sind dafür ohne
 * Belang — der Kasten ist eine Spalte aus fünf Zeilen, und ob sie
 * nebeneinander oder untereinander stehen, entscheidet allein das Stylesheet.
 *
 * **Die Struktur stammt aus dem Code, nicht aus dem Gedächtnis:**
 * `kastenSkelett()` in `amazon.js` legt die fünf Zeilen an, der Takt schiebt
 * Prüflisten-Knopf und Melde-Knopf hinein. Ändert sich dort etwas, gehört es
 * hier nachgezogen — und die Zusicherung darunter meldet sich, wenn die
 * Klassennamen auseinanderlaufen.
 *
 * Aufruf:
 *
 *     node tools/melder-kasten-bild.mjs [ziel.png]
 *
 * Läuft headless; es erscheint kein Fenster.
 */
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(wurzel, 'extension/melder.css'), 'utf8')
const quelle = readFileSync(join(wurzel, 'extension/amazon.js'), 'utf8')
const ziel = process.argv[2] ?? join(wurzel, 'docs/melder-kasten.png')

/*
  **Die Klassennamen werden gegen den Code gehalten, bevor gemessen wird.**

  Ein Bild von einer Struktur, die es so nicht mehr gibt, ist schlimmer als
  keines: Es sieht richtig aus und misst etwas anderes.
*/
const gebraucht = [
  'ak-amazon-suchhinweis',
  'ak-z-titel',
  'ak-z-inhalt',
  'ak-z-melden',
  'ak-such-fuss',
  'ak-such-fuss-mitte',
  'ak-such-fuss-rechts',
  'ak-z-debug',
]
const fehlend = gebraucht.filter((k) => !quelle.includes(k))
if (fehlend.length) {
  console.error(`amazon.js kennt diese Klassen nicht mehr: ${fehlend.join(', ')}`)
  console.error('Die Struktur unten ist veraltet — erst nachziehen, dann messen.')
  process.exit(1)
}

/*
  **Amazons eigene Regeln gehören in die Kulisse.**

  Der erste Anlauf zeigte einen sauber zentrierten aniSearch-Knopf — auf der
  echten Seite klebte sein Text links (Daniel, 02.09.2026, mit Bild). Eine
  Kulisse ohne das fremde Stylesheet misst den **eigenen** Stil, nicht das
  Ergebnis: Amazon setzt für `a` unter anderem `display: inline` und
  `text-align: left`, und wo unser `display: flex` verliert, wirkt
  `justify-content` gar nicht mehr.

  Nachgestellt wird deshalb, was erfahrungsgemäß hineinreicht — mit **höherer
  Spezifität** als unsere Klassenregel, so wie es dort auch der Fall ist. Was
  hier durchgeht, geht auch auf der Seite durch.
*/
const amazonRegeln = `
  body a, body a:link, body a:visited {
    display: inline;
    text-align: left;
    text-decoration: underline;
    color: #0066c0;
    line-height: 19px;
  }
`

const seite = `<!doctype html><meta charset="utf-8">
<style>
  html { background: #0b0e13; }
  body { margin: 0; min-height: 420px; font: 13px/1.45 system-ui, sans-serif; }
  ${amazonRegeln}
  ${css}
</style>
<div class="ak-amazon-suchhinweis">
  <div class="ak-z-titel">
    <span class="ak-z-titel-text">Is This a Zombie? · 12 Folgen</span>
    <button type="button" class="ak-z-weg">✕</button>
  </div>
  <div class="ak-z-inhalt">
    <label class="ak-such-auswahl">
      <input type="checkbox" checked>
      Kauf/Abo · Is this a Zombie? (B0BYY9NN5D)
      <button type="button" class="ak-such-sprung">öffnen</button>
    </label>
    <label class="ak-such-auswahl">
      <input type="checkbox" checked>
      Kauf/Abo · Is this a Zombie? (B0B8TN9LSJ)
      <button type="button" class="ak-such-sprung">öffnen</button>
    </label>
  </div>
  <div class="ak-z-melden"><span class="ak-such-fertig">gemeldet ✓</span></div>
  <div class="ak-such-fuss">
    <span class="ak-such-fuss-links"></span>
    <span class="ak-such-fuss-mitte">
      <button type="button" class="ak-uebersicht ak-uebersicht-innen">Prime: alles geprüft</button>
    </span>
    <span class="ak-such-fuss-rechts"><a href="#">aniSearch</a></span>
  </div>
  <div class="ak-z-debug">
    <div class="ak-debugleiste">
      <button type="button" class="ak-debugknopf">▶</button>
      <span>Ruhemodus für Aufnahmen</span>
    </div>
  </div>
</div>`

const browser = await chromium.launch()
const seiteObj = await browser.newPage({ viewport: { width: 520, height: 420 } })
await seiteObj.setContent(seite)

/* Gemessen wird die Lage, nicht der Eindruck — das Bild ist der Beleg dazu. */
const lage = await seiteObj.evaluate(() => {
  const kasten = document.querySelector('.ak-amazon-suchhinweis')
  const knopf = document.querySelector('.ak-uebersicht-innen')
  const link = document.querySelector('.ak-such-fuss-rechts a')
  const fertig = document.querySelector('.ak-such-fertig')
  const platz = document.querySelector('.ak-such-fuss-links')
  const r = (e) => (e ? e.getBoundingClientRect() : null)
  const k = r(kasten)
  return {
    kastenBreite: Math.round(k.width),
    knopf: r(knopf) && { x: Math.round(r(knopf).x - k.x), breite: Math.round(r(knopf).width), y: Math.round(r(knopf).y - k.y) },
    link: r(link) && { x: Math.round(r(link).x - k.x), breite: Math.round(r(link).width), y: Math.round(r(link).y - k.y) },
    fertig: r(fertig) && { breite: Math.round(r(fertig).width), hoehe: Math.round(r(fertig).height) },
    leererPlatz: platz ? getComputedStyle(platz).display : '—',
    /*
      **Der Text in der Pille, nicht die Pille.** Gemessen wird der Kasten des
      Textknotens selbst — nur so fällt auf, dass er linksbündig steht, während
      sein Rahmen die halbe Breite einnimmt.
    */
    linkText: (() => {
      if (!link || !link.firstChild) return null
      const bereich = document.createRange()
      bereich.selectNodeContents(link)
      const t = bereich.getBoundingClientRect()
      const l = r(link)
      return {
        linksAbstand: Math.round(t.x - l.x),
        rechtsAbstand: Math.round(l.right - t.right),
      }
    })(),
    linkDisplay: link ? getComputedStyle(link).display : '—',
    /* Das X sitzt oben rechts — auf Höhe des Titels, am rechten Rand. */
    weg: (() => {
      const w = document.querySelector('.ak-z-weg')
      const t = document.querySelector('.ak-z-titel')
      if (!w || !t) return null
      const a = r(w)
      const b = r(t)
      return { rechtsAbstand: Math.round(b.right - a.right), obenAbstand: Math.round(a.y - b.y) }
    })(),
  }
})

await seiteObj.screenshot({ path: ziel })
await browser.close()

const g = (b) => (b ? '  ok   ' : '  FEHL ')
let fehler = 0
const pruefe = (bedingung, text) => {
  console.log(g(bedingung) + text)
  if (!bedingung) fehler++
}

console.log('Hinweiskasten — gemessen\n')
console.log(`  Kasten ${lage.kastenBreite} px breit, leerer Fußzeilen-Platz: ${lage.leererPlatz}`)
console.log(`  Prüfliste  x=${lage.knopf?.x} y=${lage.knopf?.y} breit=${lage.knopf?.breite}`)
console.log(`  aniSearch  x=${lage.link?.x} y=${lage.link?.y} breit=${lage.link?.breite}`)
console.log(`  gemeldet   breit=${lage.fertig?.breite} hoch=${lage.fertig?.hoehe}\n`)

pruefe(lage.leererPlatz === 'none', 'der leere dritte Platz der Fußzeile ist ausgeblendet')
pruefe(lage.knopf && lage.link && lage.knopf.y === lage.link.y, 'Prüfliste und aniSearch stehen auf einer Zeile')
pruefe(lage.knopf && lage.link && lage.knopf.x < lage.link.x, 'die Prüfliste steht links, aniSearch rechts')
pruefe(
  lage.knopf && lage.link && Math.abs(lage.knopf.breite - lage.link.breite) <= 1,
  'beide sind gleich breit (je eine Hälfte)',
)
pruefe(lage.fertig && lage.fertig.breite > lage.kastenBreite * 0.8, '„gemeldet ✓" nimmt die volle Breite')
pruefe(lage.fertig && lage.fertig.hoehe >= 28, '… mit fester Höhe statt Innenabstand')
/*
  Die beiden Zusicherungen, die den Fall vom 02.09.2026 halten: Unser `display`
  muss sich gegen Amazons `inline` durchsetzen, und der Text muss mittig in
  seiner Pille stehen — gleicher Abstand links wie rechts, zwei Pixel Toleranz
  für die Rundung.
*/
pruefe(lage.linkDisplay === 'flex', 'die Pille bleibt ein Flex-Container, auch gegen Amazons Regeln')
pruefe(
  lage.linkText && Math.abs(lage.linkText.linksAbstand - lage.linkText.rechtsAbstand) <= 2,
  `der aniSearch-Text steht mittig (links ${lage.linkText?.linksAbstand}, rechts ${lage.linkText?.rechtsAbstand})`,
)

/* Der Ausweg aus einem Titel, der bei Prime nicht zu finden ist (02.09.2026). */
pruefe(lage.weg && lage.weg.rechtsAbstand <= 1, 'das X sitzt am rechten Rand der Titelzeile')
pruefe(lage.weg && lage.weg.obenAbstand <= 4, '… auf Höhe des Titels')

console.log(`\nBild: ${ziel}`)
if (!existsSync(ziel)) {
  console.error('Kein Bild geschrieben.')
  process.exit(1)
}
process.exit(fehler ? 1 : 0)
