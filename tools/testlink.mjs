#!/usr/bin/env node
/**
 * Testlink für Daniel: findet einen Titel, baut den Panel-Link in der Form, die live gilt, öffnet ihn gegen https://anime-kalender.de
 * und gibt ihn nur aus, wenn das Detail-Panel genau diesen Titel zeigt (sonst Fehler mit Grund, Exit 1).
 *
 * Aufruf: node tools/testlink.mjs <Suchbegriff | ak> [--ansicht woche|datenbank] [--datum JJJJ-MM-TT]
 *
 * Warum nicht einfach `?t=<id aus public/data>`: `public/data/` trägt die AniList-Kennung, die Seite kennt seit 05.10.2026 nur die
 * eigene `ak` (`data/kennungen.json`). Ein Link mit der AniList-Kennung zeigt „keine Metadaten" oder — schlimmer — einen anderen Titel.
 * Cartoons (negative Kennung) bleiben, wie sie sind.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const SEITE = 'https://anime-kalender.de'
/* Reihenfolge = Vorrang bei gleichem Treffer: Hauptbestand vor Cartoons vor dem Katalog ohne Synchro. */
const QUELLEN = ['titles-core.json', 'titles.json', 'cartoons.json', 'ohne-synchro.json']

function fehler(text) {
  console.error(`✕ ${text}`)
  process.exit(1)
}

function argumente(argv) {
  const opt = { ansicht: 'woche', datum: undefined, begriff: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ansicht') opt.ansicht = argv[++i]
    else if (argv[i] === '--datum') opt.datum = argv[++i]
    else opt.begriff.push(argv[i])
  }
  if (!['woche', 'datenbank'].includes(opt.ansicht)) fehler(`--ansicht muss woche oder datenbank sein, nicht „${opt.ansicht}"`)
  if (opt.datum && !/^\d{4}-\d{2}-\d{2}$/.test(opt.datum)) fehler(`--datum muss JJJJ-MM-TT sein, nicht „${opt.datum}"`)
  if (!opt.begriff.length) fehler('Aufruf: node tools/testlink.mjs <Suchbegriff | ak> [--ansicht woche|datenbank] [--datum JJJJ-MM-TT]')
  return { ...opt, begriff: opt.begriff.join(' ') }
}

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '')
const namen = (t) => [t.titleDe, t.titleEn, t.titleRomaji, t.titleNative].filter(Boolean)

/** Alle Titel aus `public/data/`, je AniList-Kennung einmal (die Quelle mit Vorrang gewinnt). */
function alleTitel() {
  const gesehen = new Map()
  for (const datei of QUELLEN) {
    for (const t of JSON.parse(readFileSync(path.join(WURZEL, 'public/data', datei), 'utf8'))) {
      if (!gesehen.has(t.id)) gesehen.set(t.id, { ...t, quelle: datei })
    }
  }
  return [...gesehen.values()]
}

/** 0 = Name stimmt (ohne Satzzeichen, Groß/Klein) überein, 1 = beginnt damit, 2 = enthält es, sonst null. */
function rang(t, begriff) {
  const b = norm(begriff)
  const n = namen(t).map(norm)
  if (n.includes(b)) return 0
  if (n.some((x) => x.startsWith(b))) return 1
  return n.some((x) => x.includes(b)) ? 2 : null
}

function findeTitel(begriff) {
  const treffer = alleTitel()
    .map((t) => ({ t, r: rang(t, begriff) }))
    .filter((x) => x.r !== null)
  if (!treffer.length) fehler(`Kein Titel in public/data gefunden für „${begriff}"`)
  const beste = Math.min(...treffer.map((x) => x.r))
  const spitze = treffer.filter((x) => x.r === beste)
  if (spitze.length > 1) {
    const zeilen = spitze.slice(0, 8).map((x) => `  ${x.t.id}  ${namen(x.t)[0]}  (${x.t.jpYear ?? '?'}, ${x.t.quelle})`)
    fehler(`„${begriff}" ist mehrdeutig (${spitze.length} Treffer), genauer suchen oder die Kennung angeben:\n${zeilen.join('\n')}`)
  }
  return spitze[0].t
}

/** AniList-Kennung → `ak` aus `data/kennungen.json` (eine zusammengeführte Kennung geht auf ihren Nachfolger `zuAk`). */
const AK = new Map(JSON.parse(readFileSync(path.join(WURZEL, 'data/kennungen.json'), 'utf8')).titel.map((z) => [z[1], z[3] ?? z[0]]))

/** Kennung, wie die Seite sie führt; Cartoons (negativ) bleiben unverändert. */
const akOhneFehler = (anilist) => (anilist < 0 ? anilist : AK.get(anilist))

function akVon(anilist) {
  const ak = akOhneFehler(anilist)
  if (ak === undefined) fehler(`Keine Kennung für AniList ${anilist} in data/kennungen.json`)
  return ak
}

/** Öffnet den Link und liefert, was das Panel zeigt: `{ name }` oder `{ grund }`. */
async function pruefeLink(link, titel) {
  const browser = await chromium.launch()
  try {
    const seite = await browser.newPage({ locale: 'de-DE' })
    await seite.goto(link, { waitUntil: 'load' })
    const panel = seite.locator('[data-panel="titel"]').first()
    await panel.waitFor({ state: 'attached', timeout: 25_000 }).catch(() => {})
    const name = await panel.getAttribute('aria-label').catch(() => null)
    if (name) return namen(titel).includes(name) ? { name } : { grund: `das Panel zeigt einen anderen Titel: „${name}"` }
    const aside = await seite.locator('aside').first().innerText().catch(() => '')
    return { grund: aside ? `Panel ohne Titel: „${aside.replace(/\s+/g, ' ').trim()}"` : 'kein Panel geöffnet' }
  } finally {
    await browser.close()
  }
}

async function main() {
  const { begriff, ansicht, datum } = argumente(process.argv.slice(2))
  const titel = /^-?\d+$/.test(begriff) ? alleTitel().find((t) => akOhneFehler(t.id) === Number(begriff)) : findeTitel(begriff)
  if (!titel) fehler(`Keine Kennung ${begriff} in public/data`)
  const ak = akVon(titel.id)
  const link = `${SEITE}/#/${ansicht}?${datum ? `d=${datum}&` : ''}t=${ak}`
  const befund = await pruefeLink(link, titel)
  if (befund.grund) fehler(`${link}\n  ${namen(titel)[0]} (ak ${ak}): ${befund.grund}`)
  console.error(`✓ ${befund.name} (ak ${ak}, AniList ${titel.id}, ${titel.quelle})`)
  console.log(link)
}

await main()
