#!/usr/bin/env node
/**
 * Nimmt jedes Mockup der Bühne auf: je Fall und Variante die Zellen Vorher/Nachher × Gerät × Thema (hell, dunkel) als PNG.
 *
 * Aufruf: node tools/buehne-bilder.mjs [--mockup <Namensteil>] [--aus <Ordner>]
 *         npm run buehne:bilder        (baut die Bühne vorher neu)
 *
 * Ergebnis: `<aus>/<mockup>/<fall>/<vorher|nachher-<Variante>>-<Gerät>-<Thema>[-<HHMM>].png` (Vorgabe `buehne-bilder/`, ignoriert;
 * `-<HHMM>` nur bei Mockups mit `zeiten`).
 * Das Bild ist die Zelle samt Beschriftung — dieselbe Ansicht, die ein Link der Bühne zeigt. Nach einem Umbau muss
 * „Nachher" der echten Komponente dem Bild vor dem Umbau gleichen (Konzept, Punkt 6).
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { argument, durchlaufe, starteBuehne } from './buehne-seite.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')

async function nimmAuf({ mockup, fall, variante, zeit, zellen }, ordner, dateien) {
  const ziel = path.join(ordner, mockup, fall)
  await mkdir(ziel, { recursive: true })
  for (const z of zellen) {
    const [teil, geraet, thema] = z.schluessel.split('-')
    const uhr = zeit ? `-${zeit.slice(11, 16).replace(':', '')}` : ''
    const name = `${teil === 'vorher' ? 'vorher' : `nachher-${variante}`}-${geraet}-${thema}${uhr}.png`
    await z.figur.asElement().screenshot({ path: path.join(ziel, name) })
    dateien.add(path.join(ziel, name))
  }
}

/** Der ganze Lauf; `starte` und `ausgabe` sind austauschbar (Test mit Attrappe-Browser). Setzt `process.exitCode` bei Absturz/Fremdanfrage. */
export async function lauf({ starte, filter, aus, ausgabe }) {
  const ordner = path.resolve(WURZEL, aus)
  const { browser, seite, fremde } = await starte()
  const dateien = new Set()
  let abstuerze = []
  try {
    abstuerze = await durchlaufe(seite, filter, (ansicht) => nimmAuf(ansicht, ordner, dateien))
  } finally {
    await browser.close()
  }
  for (const a of abstuerze) ausgabe(`  ✕ ${a}`)
  if (abstuerze.length) process.exitCode = 1
  ausgabe(`${dateien.size} Bilder in ${ordner}`)
  for (const d of dateien) ausgabe(`  ${path.relative(ordner, d)}`)
  if (fremde.length) {
    ausgabe(`\n  ✕ ${fremde.length} Anfragen nach draußen, z. B. ${fremde[0]}`)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await lauf({ starte: starteBuehne, filter: argument('--mockup', ''), aus: argument('--aus', 'buehne-bilder'), ausgabe: console.log })
}
