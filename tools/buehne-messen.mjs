#!/usr/bin/env node
/**
 * Misst die Zellen der Bühne: Tippziele (≥ 44 px, nur Handy-Zellen) und Textkontrast (WCAG AA, alle Zellen, hell und dunkel).
 *
 * **Maßstab ist Vorher — und die Basis.** „Vorher" ist die Vorher-Zelle desselben Mockups. Ein Befund, den App-Code in
 * beide Zellen bringt, fällt dort nicht auf; darum gibt `--basis <datei>` die Messung der Vorher-Zellen auf main vor (erzeugt mit
 * `--schreibe <datei>` und `BUEHNE_DIST` auf die Bühne von main): Neu gegenüber der Basis ist rot („App-Basis …“).
 * Was die echte App heute schon verfehlt, steht als „bestehend" in der Zählung; rot wird der Lauf nur
 * für Befunde, die das Nachher (die Variante des Mockups) NEU hinzubringt — ein Mockup darf nichts verschlechtern.
 * Ein Mockup mit Vorher = Nachher (die Proben) ist damit immer grün, zeigt aber die Zahl des Bestands.
 *
 * Aufruf: node tools/buehne-messen.mjs [--mockup <Namensteil>] [--liste]   (`--liste` zeigt auch die bestehenden Befunde)
 *         node tools/buehne-messen.mjs --basis <datei> --nur-vorher   (Kopf: nur Vorher-Zellen der ersten Variante, gegen die Basis)
 *         node tools/buehne-messen.mjs --schreibe <datei>  (nur Vorher-Zellen der ersten Variante als Basis speichern)
 *         npm run buehne:messen        (baut die Bühne vorher neu)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { argument, durchlaufe, starteBuehne } from './buehne-seite.mjs'
import { kontrastImRahmen, MIN_TIPPZIEL, tippzieleImRahmen } from './buehne-messung.mjs'

const LISTE = process.argv.includes('--liste')

/** Misst eine Zelle; Tippziele nur im Handy-Rahmen. Doppelte Namen zählen einmal. */
async function messeZelle(z) {
  const [, geraet] = z.schluessel.split('-')
  /* Immer vom Anfang der Seite: Die App rollt von selbst zu „heute“ und schaltet dabei Knöpfe um — das soll nicht zwischen Vorher und Nachher auseinanderlaufen. */
  await z.frame.evaluate(() => scrollTo(0, 0))
  await z.frame.waitForTimeout(500)
  const tipp = geraet === '375' ? await z.frame.evaluate(tippzieleImRahmen, MIN_TIPPZIEL) : []
  const kontrast = await z.frame.evaluate(kontrastImRahmen)
  const einmalig = (liste) => [...new Map(liste.map((f) => [f.schluessel, f])).values()]
  return { tipp: einmalig(tipp), kontrast: einmalig(kontrast) }
}

/** Der Rest der Zellenkennung nach „vorher-"/„nachher-": `375-hell`. */
const ort = (schluessel) => schluessel.split('-').slice(1).join('-')

const zeile = (art, f) => (art === 'tipp' ? `${f.schluessel} ${f.w}×${f.h} px` : `${f.schluessel} ${f.verhaeltnis}:1 (soll ${f.soll}:1)`)

/**
 * Vergleicht eine Nachher-Messung mit der Vorher-Messung derselben Stelle (`vorher`) und gibt die neuen Befunde zurück.
 * Tippziele hängen nicht vom Thema ab: Dort zählt auch das Vorher des anderen Themas (`vorherAnders`) — die ganze App zeigt
 * je nach Scrollstand einmal mehr, einmal weniger Knöpfe, z. B. „heute“.
 */
function neueBefunde(nachher, vorher, vorherAnders) {
  const kennt = (liste) => new Set((liste ?? []).map((f) => f.schluessel))
  const bekannt = { tipp: kennt([...(vorher?.tipp ?? []), ...(vorherAnders?.tipp ?? [])]), kontrast: kennt(vorher?.kontrast) }
  return ['tipp', 'kontrast'].flatMap((art) => nachher[art].filter((f) => !bekannt[art].has(f.schluessel)).map((f) => ({ art, f })))
}

/** Neue Befunde werden einmal nachgemessen; was dabei verschwindet, war ein Zustand der Animation (Scroll, Einblenden), kein Befund. */
async function bestaendige(neu, zelle, alt, andere) {
  if (!neu.length) return neu
  const zweit = new Set(neueBefunde(await messeZelle(zelle), alt, andere).map(({ art, f }) => `${art}:${f.schluessel}`))
  return neu.filter(({ art, f }) => zweit.has(`${art}:${f.schluessel}`))
}

/** `--basis`/`--schreibe` des Aufrufs: gelesene Basis bzw. Schreibfunktion für `lauf` (Absturz-Zeilen beim Schreiben setzen Exit 1). */
function basisAusAufruf() {
  const lese = argument('--basis', '')
  const ziel = argument('--schreibe', '')
  const schreibe = (m, rot) => {
    writeFileSync(ziel, JSON.stringify(m))
    if (rot.length) process.exitCode = 1
    console.log(`Basis: ${Object.keys(m).length} Zellen nach ${ziel}${rot.map((r) => `\n  ✕ ${r}`).join('')}`)
  }
  return { basis: lese ? JSON.parse(readFileSync(lese, 'utf8')) : null, schreibe: ziel ? schreibe : null, nurVorher: process.argv.includes('--nur-vorher') }
}

/** Neue Befunde einer Vorher-Zelle gegenüber derselben Zelle auf main (`basis`); ohne Eintrag (neues Mockup) bleibt es leer. */
async function appBefunde(z, vorFall, vorher, basis) {
  const [geraet, thema] = ort(z.schluessel).split('-')
  const anders = thema === 'hell' ? 'dunkel' : 'hell'
  const alt = basis[`${vorFall}/${geraet}-${thema}`]
  if (!alt) return []
  const andere = basis[`${vorFall}/${geraet}-${anders}`]
  const neu = await bestaendige(neueBefunde(vorher.get(`${vorFall}/${geraet}-${thema}`), alt, andere), z, alt, andere)
  return neu.map(({ art, f }) => `${vorFall} App-Basis ${ort(z.schluessel)}: ${zeile(art, f)}`)
}

/** Der ganze Lauf; `starte` und `ausgabe` sind austauschbar (Test mit Attrappe-Browser). Setzt `process.exitCode` bei Befunden. */
export async function lauf({ starte, filter, ausgabe, liste = LISTE, basis = null, schreibe = null, nurVorher = false }) {
  nurVorher ||= Boolean(schreibe)
  const { browser, seite, fremde } = await starte()
  const vorher = new Map()
  let rot = []
  let gemessen = 0
  try {
    rot = await durchlaufe(seite, filter, async ({ mockup, fall, variante, zeit, zellen }) => {
      /* Befunde dieser Einheit: nur der erfolgreiche Versuch zählt (durchlaufe übernimmt ihn), sonst stünden sie nach einer Wiederholung doppelt. */
      const befunde = []
      const schluesselVorFall = `${mockup}/${fall}${zeit ? `@${zeit.slice(11, 16)}` : ''}`
      for (const z of zellen.filter((c) => c.schluessel.startsWith('vorher'))) {
        vorher.set(`${schluesselVorFall}/${ort(z.schluessel)}`, await messeZelle(z))
        if (basis) befunde.push(...(await appBefunde(z, schluesselVorFall, vorher, basis)))
        if (nurVorher) gemessen++
      }
      if (nurVorher) return befunde
      for (const z of zellen.filter((c) => c.schluessel.startsWith('nachher'))) {
        const messung = await messeZelle(z)
        const [geraet, thema] = ort(z.schluessel).split('-')
        const alt = vorher.get(`${schluesselVorFall}/${geraet}-${thema}`)
        const andere = vorher.get(`${schluesselVorFall}/${geraet}-${thema === 'hell' ? 'dunkel' : 'hell'}`)
        const neu = await bestaendige(neueBefunde(messung, alt, andere), z, alt, andere)
        gemessen++
        const bestehend = messung.tipp.length + messung.kontrast.length - neu.length
        ausgabe(`  ${neu.length ? '✕' : 'ok'} ${schluesselVorFall} ${variante} ${ort(z.schluessel)}: ${neu.length} neu, ${bestehend} bestehend (Tippziele ${messung.tipp.length}, Kontrast ${messung.kontrast.length})`)
        for (const { art, f } of neu) befunde.push(`${schluesselVorFall} ${variante} ${ort(z.schluessel)}: ${zeile(art, f)}`)
        if (liste) for (const art of ['tipp', 'kontrast']) for (const f of messung[art]) ausgabe(`      ${art === 'tipp' ? 'Tippziel' : 'Kontrast'} ${zeile(art, f)}`)
      }
      return befunde
    }, { nurErsteVariante: nurVorher })
  } finally {
    await browser.close()
  }
  if (schreibe) return schreibe(Object.fromEntries(vorher), rot)
  if (!gemessen) rot.push('keine einzige Zelle gemessen — Bühne oder Selektor kaputt')
  if (fremde.length) rot.push(`${fremde.length} Anfragen nach draußen, z. B. ${fremde[0]}`)
  if (rot.length) {
    ausgabe(`\n  ✕ ${rot.length} neue Befunde:`)
    for (const r of rot.slice(0, 40)) ausgabe(`    ${r}`)
    process.exitCode = 1
  } else if (nurVorher) ausgabe(`\n  ok  ${gemessen} Vorher-Zellen gemessen, nichts gegenüber der Basis (main) verschlechtert`)
  else ausgabe(`\n  ok  ${gemessen} Nachher-Zellen gemessen, nichts gegenüber Vorher verschlechtert`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await lauf({ starte: starteBuehne, filter: argument('--mockup', ''), ausgabe: console.log, ...basisAusAufruf() })
