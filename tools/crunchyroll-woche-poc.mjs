/**
 * PoC: Was bringt Crunchyrolls Wochenprogramm, das unser Bestand nicht kennt? (25.09.2026)
 *
 * Liest `data/crunchyroll-woche.json` (von `pipeline/scrape-crunchyroll-woche.ts`) und hält jede
 * Synchro-Zeile gegen den gebauten Bestand:
 *
 * - **Zuordnung** über die Serienkennung: Welche unserer Titel führen einen Crunchyroll-Weg mit
 *   dieser Kennung? Eine Kennung ist ein Franchise, keine Staffel (CLAUDE.md) — bei mehreren
 *   Kandidaten entscheidet die Staffelangabe im Artikeltitel gegen unsere Staffelnamen. Kein
 *   eindeutiger Titel heißt „offen", nie geraten.
 * - **Bekannt oder neu:** Trägt der Termin des Titels die Folge schon (`schedule.observed`)?
 *
 * Aufruf: node tools/crunchyroll-woche-poc.mjs
 */
import { readFileSync } from 'node:fs'

const wurzel = new URL('..', import.meta.url)
const lies = (p) => JSON.parse(readFileSync(new URL(p, wurzel), 'utf8'))
const woche = lies('data/crunchyroll-woche.json')
const titel = lies('public/data/titles.json')
const r = lies('public/data/releases.json')
const releases = Array.isArray(r) ? r : r.releases

const kennung = (url) => /\/series\/([A-Z0-9]+)/.exec(url ?? '')?.[1] ?? null
const jeKennung = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'crunchyroll') continue
    const k = kennung(s.url)
    if (k) jeKennung.set(k, [...new Set([...(jeKennung.get(k) ?? []), t])])
  }
}
const staffelAus = (s) => Number(/(?:staffel|season|part|teil)\s*(\d+)/i.exec(s ?? '')?.[1] ?? /\b(\d+)(?:st|nd|rd|th) season/i.exec(s ?? '')?.[1] ?? NaN)

const zeilen = []
for (const e of woche.eintraege.filter((x) => x.sprache === 'de')) {
  const kandidaten = jeKennung.get(e.seriesId) ?? []
  let ziel = kandidaten.length === 1 ? kandidaten[0] : null
  let wie = kandidaten.length === 1 ? 'Kennung' : ''
  if (!ziel && kandidaten.length > 1) {
    const nr = staffelAus(e.titel) || 1
    const passend = kandidaten.filter((t) => {
      const namen = [t.titleDe, t.titleEn, t.titleRomaji].filter(Boolean)
      const n = Math.max(...namen.map((x) => staffelAus(x) || 1))
      return n === nr && t.format !== 'MOVIE' && t.format !== 'SPECIAL' && t.format !== 'OVA'
    })
    if (passend.length === 1) {
      ziel = passend[0]
      wie = `Kennung + Staffel ${nr}`
    } else wie = `${kandidaten.length} Kandidaten, Staffel ${nr}: ${passend.length} passend`
  }
  if (!kandidaten.length) wie = 'Kennung unbekannt'
  let stand = '—'
  if (ziel) {
    const rel = releases.filter((x) => x.titleId === ziel.id && x.platform === 'crunchyroll')
    const beob = Object.assign({}, ...rel.map((x) => x.schedule?.observed ?? {}))
    const fehlen = []
    for (let f = e.von; f <= e.bis; f++) if (!beob[f]) fehlen.push(f)
    stand = !rel.length ? 'kein Termin bei uns' : fehlen.length ? `neu: Folge ${fehlen.join(',')}` : 'bekannt'
  }
  zeilen.push({ e, ziel, wie, stand })
  console.log(
    `${e.datum} ${e.titel.slice(0, 44).padEnd(44)} F${e.von}${e.bis !== e.von ? `-${e.bis}` : ''}${e.abweichend ? '*' : ''} → ` +
      `${ziel ? `${ziel.id} ${(ziel.titleDe ?? ziel.titleEn ?? ziel.titleRomaji).slice(0, 30)}` : 'offen'} (${wie}) · ${stand}`,
  )
}
const zugeordnet = zeilen.filter((z) => z.ziel).length
const neu = zeilen.filter((z) => z.stand.startsWith('neu')).length
console.log(`\n${zeilen.length} Synchro-Zeilen · ${zugeordnet} eindeutig zugeordnet · ${neu} mit Folgen, die unser Bestand nicht kennt`)
