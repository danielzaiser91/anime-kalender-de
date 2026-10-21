/**
 * Amazon-Produktseiten aus Anime2You-Artikeln (Wochenwache 20.10.2026, DD-16): Die Übersichtstabelle der
 * „Blu-ray-Neuheiten bei Amazon“-Artikel verlinkt jede Ausgabe mit ihrem vollen Namen und ihrem Termin. Nur ein
 * Treffer auf Namen UND Tag und Monat zählt; der Partner-Tag des Artikels (`?tag=…`) wird nie übernommen.
 *
 * Aufruf: node tools/amazon-tabelle.mjs [--schreiben] <artikel-url>...
 * Ohne `--schreiben` druckt es nur die Vorschläge für Handeinträge in data/curated/disc-*.yaml ohne `buyUrl`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ZEILE = /<tr>\s*<td><a [^>]*href="https:\/\/www\.amazon\.de\/dp\/(B0[A-Z0-9]{8})[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>\s*<td>(\d{2})\.(\d{2})\.<\/td>/g

/** Die Tabelle nennt nur den Titel, nicht die Ausgabe: bei einer Sonderausgabe bleibt die Suche, bis ein Artikel die Ausgabe verlinkt. */
const SONDERAUSGABE = /limited|sammelschuber|steelbook|steelcase|exklusiv/i

export function normalisiere(s) {
  return s
    .toLowerCase()
    .replace(/&#8211;|&#8217;|&amp;|&#038;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Tabellenzeilen eines Artikels: Kennung, Name (Linktext) und Termin als `MM-TT`. */
export function zeilenAusArtikel(html) {
  const aus = []
  for (const m of html.matchAll(ZEILE)) aus.push({ asin: m[1], name: normalisiere(m[2].replace(/<[^>]+>/g, '')), tag: `${m[4]}-${m[3]}` })
  return aus
}

/** Kennung zu Name und Termin; gehören zum selben Schlüssel zwei Kennungen, bleibt keine übrig (uneindeutig). */
export function kennungZu(zeilen, name, tag) {
  const asins = new Set(zeilen.filter((z) => z.name === normalisiere(name) && z.tag === tag).map((z) => z.asin))
  return asins.size === 1 ? [...asins][0] : undefined
}

export function amazonAdresse(asin) {
  return `https://www.amazon.de/dp/${asin}`
}

/**
 * Trägt `buyUrl` in den Eintrag mit dem Slug ein (Zeile vor `schedule:`); ein Eintrag mit vorhandener
 * `buyUrl` bleibt unberührt. Gibt immer den (ggf. unveränderten) Text zurück.
 */
export function buyUrlEintragen(text, slug, adresse) {
  const zeilen = text.split('\n')
  const start = zeilen.findIndex((z) => z === `- slug: ${slug}`)
  let ende = zeilen.findIndex((z, i) => i > start && z.startsWith('- slug:'))
  if (ende < 0) ende = zeilen.length
  const block = zeilen.slice(start, ende)
  if (block.some((z) => /^\s+buyUrl:/.test(z))) return text
  const ziel = block.findIndex((z) => /^\s+schedule:/.test(z))
  if (ziel < 0) return text
  zeilen.splice(start + ziel, 0, `  buyUrl: ${adresse}`)
  return zeilen.join('\n')
}

/** Eintrag mit Slug, Name, Termin (`MM-TT`) und ob schon eine `buyUrl` steht, aus dem Text einer Handdatei. */
export function eintraegeAus(text) {
  const aus = []
  const zeilen = text.split('\n')
  let akt
  for (const z of zeilen) {
    const s = z.match(/^- slug: (\S+)$/)
    if (s) aus.push((akt = { slug: s[1], name: '', tag: '', hatBuyUrl: false }))
    else if (akt) {
      const n = z.match(/^\s+titleDe: "(.*)"$/)
      const d = z.match(/^\s+schedule:.*firstEpisodeDate: "\d{4}-(\d{2}-\d{2})"/)
      const ed = z.match(/^\s+edition: "(.*)"$/)
      if (ed) akt.sonderausgabe = SONDERAUSGABE.test(ed[1])
      if (n) akt.name = n[1]
      if (d) akt.tag = d[1]
      if (/^\s+buyUrl:/.test(z)) akt.hatBuyUrl = true
    }
  }
  return aus
}

/** Kennung für einen Handeintrag: nicht bei vorhandener `buyUrl`, oder Sonderausgabe. */
export function vorschlagFuer(zeilen, e) {
  if (e.hatBuyUrl || e.sonderausgabe) return undefined
  return kennungZu(zeilen, e.name, e.tag)
}

/** Vorschläge für den Text einer Handdatei; mit `schreiben` steht die neue Fassung in `text`. */
export function bearbeiteDatei(text, zeilen, schreiben) {
  const vorschlaege = []
  for (const e of eintraegeAus(text)) {
    const asin = vorschlagFuer(zeilen, e)
    if (!asin) continue
    vorschlaege.push({ slug: e.slug, name: e.name, adresse: amazonAdresse(asin) })
    if (schreiben) text = buyUrlEintragen(text, e.slug, amazonAdresse(asin))
  }
  return { text, vorschlaege }
}

async function main(args) {
  const schreiben = args.includes('--schreiben')
  const zeilen = []
  for (const u of args.filter((a) => a.startsWith('http'))) {
    const r = await fetch(u, { headers: { 'user-agent': 'anime-kalender-de' } })
    zeilen.push(...zeilenAusArtikel(await r.text()))
  }
  const ordner = 'data/curated'
  for (const f of fs.readdirSync(ordner).filter((x) => x.startsWith('disc-'))) {
    const datei = path.join(ordner, f)
    const { text, vorschlaege } = bearbeiteDatei(fs.readFileSync(datei, 'utf8'), zeilen, schreiben)
    for (const v of vorschlaege) console.log(`${f}\t${v.slug}\t${v.name}\t${v.adresse}`)
    if (schreiben) fs.writeFileSync(datei, text)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
