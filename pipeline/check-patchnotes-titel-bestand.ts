/**
 * Patch-Notes nennen Titel so, wie die Seite sie anzeigt (`titleDe`). Liest `public/data/titles.json`, gehört daher in `check:bestand`.
 * Prüft nur Namen, die als englischer/Romaji-Name eines Titels erkennbar sind (keine Heuristik über beliebige Wörter).
 */
import { lesePatchnotesDateien } from './lib/patchnotes.ts'
import { ALTFUNDE, titelMeldungen, type TitelNamen } from './lib/patchnotes-titel.ts'
import { readJson } from './lib/util.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`FEHLER: ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

const titel = readJson<TitelNamen[]>('public/data/titles.json', [])
const dateien = lesePatchnotesDateien().map((d) => ({ name: d.name, text: `${String(d.eintrag.text ?? '')} | ${String(d.eintrag.untertitel ?? '')}` }))
pruefe('Bestand: titles.json ist gelesen', titel.length > 0)
const meldungen = titelMeldungen(dateien, titel)
pruefe('Patch-Notes: genannte Titel entsprechen titleDe (Altfunde festgeschrieben)', meldungen.length === 0, meldungen)

// Gegenproben: falscher Name rot, richtiger grün, Altfund still, behobener Altfund meldet sich.
const probe: TitelNamen[] = [{ titleDe: 'Blue Exorcist', titleEn: 'Blue Exorcist', titleRomaji: 'Ao no Exorcist' }]
pruefe('Gegenprobe: abweichender Name wird gemeldet', titelMeldungen([{ name: 'x', text: 'Ao no Exorcist neu' }], probe, []).length === 1)
pruefe('Gegenprobe: angezeigter Name ist in Ordnung', titelMeldungen([{ name: 'x', text: 'Blue Exorcist neu' }], probe, []).length === 0)
pruefe('Gegenprobe: Altfund bleibt still', titelMeldungen([{ name: 'x', text: 'Ao no Exorcist neu' }], probe, ['x|Ao no Exorcist']).length === 0)
pruefe('Gegenprobe: behobener Altfund wird gemeldet', titelMeldungen([{ name: 'x', text: 'Blue Exorcist' }], probe, ['x|Ao no Exorcist']).length === 1)
pruefe('Gegenprobe: kleingeschriebenes Wort ist kein Titel', titelMeldungen([{ name: 'x', text: 'orange Pille' }], [{ titleDe: 'Orange', titleEn: 'orange' }], []).length === 0)
pruefe('Gegenprobe: Teilwort eines Wortes zählt nicht', titelMeldungen([{ name: 'x', text: 'Ao no Exorcists' }], probe, []).length === 0)
const lang: TitelNamen[] = [{ titleDe: 'Final Fantasy: Die Mächte', titleEn: 'Final Fantasy' }]
pruefe('Gegenprobe: ausgeschriebener angezeigter Name enthält den kürzeren Namen', titelMeldungen([{ name: 'x', text: 'Final Fantasy: Die Mächte neu' }], lang, []).length === 0)
pruefe('Gegenprobe: ein anderer Titel mit genau diesem Namen als titleDe erlaubt ihn', titelMeldungen([{ name: 'x', text: 'Final Fantasy neu' }], [...lang, { titleDe: 'Final Fantasy' }], []).length === 0)
pruefe('Gegenprobe: Wortanfang davor zählt nicht', titelMeldungen([{ name: 'x', text: 'XAo no Exorcist' }], probe, []).length === 0)
pruefe('Festschreibung: Altfunde sind eindeutig', new Set(ALTFUNDE).size === ALTFUNDE.length)

if (fehler > 0) process.exit(1)
