/**
 * Test: Die Ansicht „gemeldet“ der Netflix-Prüfliste zeigt im echten Chromium nur die gemeldeten Zeilen (15.11.2026, Prüfer 3933 A6).
 * Der Fake-DOM-Test (`extension/netflix-liste-ansicht.test.cjs`) sieht kein CSS; hier laden `melder.css` und `netflix-liste.css`
 * in eine leere Seite (kein Netz), vier Zeilen (zwei offen, zwei gemeldet = `ak-abgehakt`) und die Klassen des Kastens kommen
 * wie aus `ANSICHT_MODI`. Die Erweiterung hat nur ein dunkles Aussehen, ein zweites Thema gibt es dort nicht.
 * Aufruf: node tools/netflix-liste-css.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { browserDa } from './browser-weiche.mjs'

const EXT = resolve(import.meta.dirname, '..', 'extension')
const css = ['melder.css', 'netflix-liste.css'].map((d) => readFileSync(resolve(EXT, d), 'utf8')).join('\n')

const SEITE = `<!doctype html><meta charset="utf-8"><style>${css}</style><body>
<div class="ak-kasten" id="kasten"><div class="ak-liste">
<div class="ak-zeile" data-id="offen1"><a class="ak-titel">Offen 1</a></div>
<div class="ak-zeile" data-id="offen2"><a class="ak-titel">Offen 2</a></div>
<div class="ak-zeile ak-abgehakt" data-id="gemeldet1"><a class="ak-titel">Gemeldet 1</a></div>
<div class="ak-zeile ak-abgehakt" data-id="gemeldet2"><a class="ak-titel">Gemeldet 2</a></div>
</div></div>`

/** Sichtbar heißt: berechnetes `display` ist nicht `none`. */
const sichtbar = (seite, klassen) =>
  seite.evaluate((k) => {
    document.getElementById('kasten').className = `ak-kasten ${k}`.trim()
    return [...document.querySelectorAll('.ak-zeile')].filter((z) => getComputedStyle(z).display !== 'none').map((z) => z.dataset.id)
  }, klassen)

if (browserDa('netflix-liste-css', chromium)) {
  const browser = await chromium.launch()
  try {
    const seite = await browser.newPage()
    await seite.setContent(SEITE)
    assert.deepEqual(await sichtbar(seite, ''), ['offen1', 'offen2'], 'Standard: nur die offenen Zeilen')
    assert.deepEqual(await sichtbar(seite, 'ak-ansicht-gemeldet ak-mit-erledigten'), ['gemeldet1', 'gemeldet2'], 'gemeldet: nur die gemeldeten Zeilen, keine offenen')
    assert.deepEqual(await sichtbar(seite, 'ak-ansicht-gemeldet'), [], 'gemeldet ohne Erledigten-Zeilen: nichts (Kontrolle, dass nicht die offenen übrig bleiben)')
    assert.deepEqual(await sichtbar(seite, 'ak-mit-erledigten'), ['offen1', 'offen2', 'gemeldet1', 'gemeldet2'], 'Erledigte allein (ohne Ansicht): alle vier (Kontrolle)')
    console.log('netflix-liste-css: 4 Fälle ✓ (Ansicht „gemeldet“ im echten Chromium)')
  } finally {
    await browser.close()
  }
}
