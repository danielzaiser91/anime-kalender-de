/**
 * Zusicherungen zu Wegen, deren `dub: true` nicht gemessen ist: Joyn gilt pauschal als deutsch (Daniel, 02.09.2026), ein
 * Prime-Kanal erbt das Ja seines Anbieters (13.10.2026). Läuft in `check:logic`. Erfundene Titel, kein Netz.
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { setzeJoynDeutsch } from './bau/joyn-pauschal.ts'

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const bereiche = [{ from: 1, to: 12, dub: true }]
const joyn = (extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'joyn', url: 'https://www.joyn.de/serien/x', ...extra }) as StreamLink
const netflix = (): StreamLink => ({ platform: 'netflix', url: 'https://www.netflix.com/title/1' }) as StreamLink
const titelMit = (streams: StreamLink[]): Title => ({ id: 900001, streams }) as unknown as Title

console.log('\nJoyn pauschal:')
const offen = [joyn(), netflix()]
pruefe('Joyn ohne Urteil: dub true, Zahl 1', setzeJoynDeutsch([titelMit(offen)]) === 1 && offen[0]!.dub === true, offen)
pruefe('Andere Anbieter bleiben offen', offen[1]!.dub === undefined, offen)
const nein = [joyn({ dub: false })]
pruefe('Joyn mit Handbeleg Nein bleibt Nein', setzeJoynDeutsch([titelMit(nein)]) === 0 && nein[0]!.dub === false, nein)
const gemessen = [joyn({ dub: true, dubRanges: bereiche })]
pruefe('Joyn mit eigenem Ja zählt nicht mit', setzeJoynDeutsch([titelMit(gemessen)]) === 0, gemessen)

if (verletzt) {
  console.error(`\n${verletzt} von ${gesamt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log(`\ncheck-dub-abgeleitet: ${gesamt} Prüfungen ok`)
