/**
 * Bilanz „Katalogblock ohne Zahl im Namen“ (Auftrag omu-begleiter-blockname-ohne-zahl): zählt über alle Paare (Titel, Crunchyroll-Serie)
 * mit Synchro-Beleg am Weg (`dub === true`, nicht abgeleitet) und datiertem deutschem Block, wie viele Paare der Block-Zuordnung
 * vorher (nur Zahl im Namen, `katalogBlock`) und nachher (`blockWahl`) gelingen, je Weg bzw. Verwerfungsgrund.
 * Liest `public/data/titles.json` und `data/crunchyroll-dub.json` (Datenstand: Hash des Eingangs im PR-Text).
 * Aufruf: npx tsx tools/omu-blockname-bilanz.ts [--liste]
 */
import { readFileSync } from 'node:fs'
import { crunchyrollSeriesId } from '../pipeline/lib/crunchyroll.ts'
import { blockWahlFuer } from '../pipeline/bau/block-wahl-titel.ts'
import { katalogStaffeln } from '../pipeline/bau/widerlegung-staffel.ts'
import { katalogBlock } from './cr-katalogblock.mjs'
import type { Title } from '../shared/types.ts'
import type { CrDubData } from '../pipeline/lib/crunchyroll-dub.ts'

const titles = new Map((JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[]).map((t) => [t.id, t]))
const crDub = JSON.parse(readFileSync('data/crunchyroll-dub.json', 'utf8')) as CrDubData
const hatDatum = (b: { deutscheFolgen?: { verfuegbarAb?: string }[] }) => (b.deutscheFolgen ?? []).some((f) => f.verfuegbarAb)

const nachher: Record<string, string[]> = {}
let paare = 0
let vorher = 0
for (const t of titles.values()) {
  const kennungen = new Set(t.streams.filter((s) => s.platform === 'crunchyroll' && s.dub === true && !s.dubAbgeleitet).map((s) => crunchyrollSeriesId(s.url)))
  for (const k of kennungen) {
    if (!k) continue
    const bloecke = crDub.serien.filter((s) => s.katalog === 'de' && s.seriesId === k).flatMap((s) => s.staffeln ?? [])
    if (!bloecke.some(hatDatum)) continue
    paare++
    if (katalogBlock(crDub.serien, k, katalogStaffeln(t, titles, k))) vorher++
    const w = blockWahlFuer(t, titles, k, crDub.serien)
    const schluessel = w.treffer ? `zugeordnet über ${w.weg}` : `offen: ${w.grund}`
    nachher[schluessel] ??= []
    nachher[schluessel].push(`${t.titleEn ?? t.titleRomaji} (${t.id})`)
  }
}
console.log(`Paare mit Synchro-Beleg und datiertem deutschem Block: ${paare}`)
console.log(`vorher (Zahl im Blocknamen): ${vorher} zugeordnet, ${paare - vorher} offen`)
for (const [k, v] of Object.entries(nachher).sort()) console.log(`nachher ${k}: ${v.length}`, process.argv.includes('--liste') ? v.join('; ') : '')
