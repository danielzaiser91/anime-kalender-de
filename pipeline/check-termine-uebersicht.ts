/**
 * Zusicherung (Sammelseite `/termine/`, 13.10.2026): Sie führt auch Termine von Titeln ohne belegte Synchro und verspricht deshalb
 * nie „mit deutscher Synchro“, sondern nennt die Zahl der belegten. Cartoons zählen nur mit einem Weg mit `dub: true` (`synchroBelegt`).
 * Aufruf: `npm run check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { belegteTermine, uebersichtTexte } from './lib/termine-uebersicht.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, extra: Partial<Title>): Title => ({ id, streams: [], ...extra }) as Title
const termin = (titleId: number): Release => ({ titleId, slug: `t-${titleId}` }) as unknown as Release
const dubWeg = [{ platform: 'disney', url: 'u', dub: true }] as unknown as Title['streams']

const katalog = new Map<number, Title>([
  [1, titel(1, { dubConfidence: 'high' })],
  [2, titel(2, { dubConfidence: 'normal' })],
  [-3, titel(-3, { westlich: true, dubConfidence: 'very-high' })],
  [-4, titel(-4, { westlich: true, dubConfidence: 'low', streams: dubWeg })],
])
const gemischt = [1, 2, -3, -4].map(termin)

console.log('\nSammelseite /termine/: Zusage nur mit Beleg')
const texte = uebersichtTexte(gemischt.length, belegteTermine(gemischt, katalog), 2)
const alles = Object.values(texte).join(' | ')
pruefe('gemischte Liste: kein „mit deutscher Synchro“ in Überschrift, Stand, Titel, Beschreibung, Listenname', !/mit deutscher Synchro/i.test(alles), alles)
pruefe('Anime Stufe high und Cartoon mit dub-Weg zählen, Anime normal und Cartoon ohne dub-Weg nicht', belegteTermine(gemischt, katalog) === 2)
pruefe('der Stand nennt die Zahl der belegten und der Termine', texte.stand.includes('4 Veröffentlichungen, 2 davon stehen noch an.') && texte.stand.includes('belegt bei 2,'), texte.stand)
pruefe('ein Termin ohne Titel im Bestand zählt nicht als belegt', belegteTermine([termin(99)], katalog) === 0)

console.log('\nSammelseite /termine/: alles belegt')
const alle = [termin(1), termin(-4)]
const belegt = uebersichtTexte(alle.length, belegteTermine(alle, katalog), 0)
pruefe('sagt „bei allen belegt“ statt einer Zahl', belegt.stand.includes('bei allen belegt') && !/mit deutscher Synchro/i.test(Object.values(belegt).join(' ')), belegt.stand)

if (verletzt) {
  console.error(`\nSammelseite /termine/: ${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
