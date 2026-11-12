/**
 * Bestandswache für die JustWatch-Folgestaffeln (11.11.2026, PR 3484): Von 139 Einträgen wirkten im Bestand nur 18, den Rest sperrt ein Riegel.
 * Springt die wirkende Zahl um mehr als `FOLGESTAFFEL_SPRUNG` gegen den Stand (`lib/folgestaffel-wirkung.ts`), steht eine Zeile „⚠ WARNUNG“
 * im Lauf-Log (`bestand_warnungen` in `tools/commit-data.sh`); sperren tut die Wache nie, sie ist rein beobachtend (Exit immer 0).
 */
import { type Title } from '../shared/types.ts'
import { readJson } from './lib/util.ts'
import { type JwEintrag } from './bau/11-2-2-wege-ohne-weg.ts'
import { sprungZeile, wirkendImBestand } from './lib/folgestaffel-wirkung.ts'

const titles = new Map(readJson<Title[]>('public/data/titles.json', []).map((t) => [t.id, t] as const))
const jw = readJson<Record<string, JwEintrag>>('data/justwatch-audio.json', {})
if (!titles.size || !Object.keys(jw).length) {
  console.log('⚠ WARNUNG Folgestaffel-Einträge: nicht gemessen (public/data/titles.json oder data/justwatch-audio.json leer)')
} else {
  const { eintraege, wirkend } = wirkendImBestand(jw, titles)
  const zeile = sprungZeile(wirkend, eintraege)
  if (zeile) console.log(zeile)
  console.log(`Folgestaffel-Einträge im Bestand: ${eintraege} angelegt, ${wirkend} wirken, ${eintraege - wirkend} gesperrt`)
}
console.log('VERSTÖSSE: 0')
