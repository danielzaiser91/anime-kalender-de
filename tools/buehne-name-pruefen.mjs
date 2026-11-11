#!/usr/bin/env node
/**
 * Prüft gegen `buehne-dist/` (nach `npm run buehne:bauen`), dass in der TV-Box von Probe `probe-tv-box` (YAIBA, ProSieben MAXX
 * mit Joyn-Weg) der Sendername bei 375 und 512 px, hell und dunkel, nicht gekappt ist („ProSieben …" statt „ProSieben MAXX").
 * Anlass 10.11.2026: PREMIERE-Marke plus Play/TV/Kalender ließen dem Namen am Handy zu wenig Breite. Exit 1 bei einem Befund.
 */
import { pathToFileURL } from 'node:url'
import { oeffneZellen, starteBuehne } from './buehne-seite.mjs'
import { gekappteNamenImRahmen, kappungsBefunde } from './buehne-name-kappung.mjs'

/** Misst alle Nachher-Zellen der Probe; gibt `{ zellen, befunde }` zurück (`zellen` = Zahl gemessener Zellen mit Namen). */
export async function messeProbe(seite) {
  const zellen = (await oeffneZellen(seite, { mockup: 'probe-tv-box', variante: 'A', fall: 'yaiba-joyn', teil: 'nachher' })).filter((z) => z.schluessel.startsWith('nachher'))
  const gemessen = []
  for (const z of zellen) {
    await z.frame.evaluate(() => [...document.querySelectorAll('[data-termin-name]')].find((e) => /MAXX/.test(e.textContent ?? ''))?.scrollIntoView({ block: 'center' }))
    const hatName = await z.frame.evaluate(() => [...document.querySelectorAll('[data-termin-name]')].some((e) => /ProSieben/.test(e.textContent ?? '')))
    gemessen.push({ schluessel: z.schluessel, hatName, gekappt: await z.frame.evaluate(gekappteNamenImRahmen) })
  }
  return { zellen: gemessen.filter((g) => g.hatName).length, von: gemessen.length, befunde: kappungsBefunde(gemessen) }
}

async function main() {
  const { browser, seite, fremde } = await starteBuehne()
  let ergebnis
  try {
    ergebnis = await messeProbe(seite)
  } finally {
    await browser.close()
  }
  for (const b of ergebnis.befunde) console.error(`  ✕ ${b}`)
  if (ergebnis.zellen < 4 || fremde.length) {
    console.error(`  ✕ nur ${ergebnis.zellen} von 4 Zellen mit Sendernamen gemessen, ${fremde.length} Anfragen nach draußen`)
    process.exitCode = 1
  }
  if (ergebnis.befunde.length) process.exitCode = 1
  console.log(`buehne-name-pruefen: ${ergebnis.zellen} Zellen gemessen, ${ergebnis.befunde.length} gekappte Namen`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
