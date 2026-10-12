#!/usr/bin/env node
/**
 * Nimmt jedes Mockup der Bühne auf: je Fall und Variante die Zellen Vorher/Nachher × Gerät × Thema (hell, dunkel) als PNG.
 *
 * Aufruf: node tools/buehne-bilder.mjs [--mockup <Namensteil>] [--aus <Ordner>]
 *         npm run buehne:bilder        (baut die Bühne vorher neu)
 *
 * Ergebnis: `<aus>/<mockup>/<fall>/<vorher|nachher-<Variante>>-<Gerät>-<Thema>.png` (Vorgabe `buehne-bilder/`, ignoriert).
 * Das Bild ist die Zelle samt Beschriftung — dieselbe Ansicht, die ein Link der Bühne zeigt. Nach einem Umbau muss
 * „Nachher" der echten Komponente dem Bild vor dem Umbau gleichen (Konzept, Punkt 6).
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { argument, durchlaufe, starteBuehne } from './buehne-seite.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')

async function nimmAuf({ mockup, fall, variante, zellen }, ordner, dateien) {
  const ziel = path.join(ordner, mockup, fall)
  await mkdir(ziel, { recursive: true })
  for (const z of zellen) {
    const [teil, geraet, thema] = z.schluessel.split('-')
    const name = `${teil === 'vorher' ? 'vorher' : `nachher-${variante}`}-${geraet}-${thema}.png`
    await z.figur.asElement().screenshot({ path: path.join(ziel, name) })
    dateien.push(path.join(ziel, name))
  }
}

async function main() {
  const ordner = path.resolve(WURZEL, argument('--aus', 'buehne-bilder'))
  const { browser, seite, fremde } = await starteBuehne()
  const dateien = []
  try {
    await durchlaufe(seite, argument('--mockup', ''), (ansicht) => nimmAuf(ansicht, ordner, dateien))
  } finally {
    await browser.close()
  }
  console.log(`${dateien.length} Bilder in ${ordner}`)
  for (const d of dateien) console.log(`  ${path.relative(ordner, d)}`)
  if (fremde.length) {
    console.log(`\n  ✕ ${fremde.length} Anfragen nach draußen, z. B. ${fremde[0]}`)
    process.exitCode = 1
  }
}

await main()
