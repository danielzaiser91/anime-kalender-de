/**
 * Zusicherung (Super Beerus, 13.10.2026): Weiß der Datensatz „nur Untertitel“ (Ankündigung oder Termin mit `sprache: omu`),
 * zeigt die Blase der Anbieter-Pille das statt „Sprache offen“. Aufruf: `npm run check:logic`.
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { streamNurOmu, synchroAngekuendigt } from '../shared/ankuendigung.ts'
import { alleOhneSprachbeleg, streamStatus, zeilenGruppen } from '../web/src/components/detail/legende-zeilen.ts'
import { legendeFuer } from '../web/src/components/detail/pille.tsx'
import { TEXTE_ZEILEN } from '../web/src/lib/i18n-zeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const weg = (platform: string, extra: Partial<StreamLink> = {}): StreamLink => ({ platform, url: `https://x/${platform}`, ...extra }) as StreamLink
const termin = (platform: string, sprache?: 'omu' | 'offen'): Release => ({ slug: `${platform}-x`, titleId: 1, platform, ...(sprache ? { sprache } : {}) }) as unknown as Release
const titel = (ankuendigung?: { platform: string; synchro: 'offen' | 'angekuendigt' }): Title => ({ id: 1, ...(ankuendigung ? { ankuendigung } : {}) }) as unknown as Title

console.log('\nBlase „nur Untertitel“:')
pruefe('Ankündigung des Anbieters: omu', streamStatus(titel({ platform: 'crunchyroll', synchro: 'offen' }), weg('crunchyroll'), []) === 'omu')
pruefe('Termin mit Quelle „nur Originalton“ beim Anbieter: omu (Netflix, Vigilantes)', streamStatus(titel(), weg('netflix'), [termin('netflix', 'omu')]) === 'omu')
pruefe('Termin mit offener Sprache: bleibt offen', streamStatus(titel(), weg('netflix'), [termin('netflix', 'offen')]) === 'offen')
pruefe('ein Termin ohne Kennzeichnung dabei: bleibt offen', streamStatus(titel(), weg('netflix'), [termin('netflix', 'omu'), termin('netflix')]) === 'offen')
pruefe('anderer Anbieter: bleibt offen', streamStatus(titel(), weg('primevideo'), [termin('netflix', 'omu')]) === 'offen')
pruefe('belegtes Deutsch geht vor', streamStatus(titel({ platform: 'crunchyroll', synchro: 'offen' }), weg('crunchyroll', { dub: true }), []) === 'belegt')
pruefe('JustWatch-Flagge geht vor', streamStatus(titel(), weg('netflix', { dubQuelle: 'justwatch', dubStand: '2026-10-01' }), [termin('netflix', 'omu')]) === 'jwDeutsch')
pruefe('JustWatch-Hinweis geht vor', streamStatus(titel(), weg('netflix', { dubQuelle: 'justwatch', dubStand: '2026-10-01', dubHintOnly: true }), [termin('netflix', 'omu')]) === 'justwatch')

console.log('\nFolgen für den Kasten:')
const sortiert = [{ art: 'abo', plattformen: [weg('netflix')], streamWege: [] }] as unknown as Parameters<typeof alleOhneSprachbeleg>[0]
pruefe('nur-Untertitel-Zeile steht bei „Weitere Anbieter“', zeilenGruppen(sortiert, titel(), [termin('netflix', 'omu')])[0]?.[1] === 'offen')
pruefe('nur-Untertitel-Zeile zählt als ohne Sprachbeleg', alleOhneSprachbeleg(sortiert, titel(), [termin('netflix', 'omu')]))
const t = (k: string) => (TEXTE_ZEILEN as Record<string, string>)[k] ?? k
pruefe('Legende wiederholt „nur Untertitel“ nicht (die Blase sagt es schon)', legendeFuer(['omu'], false, t) === undefined)

console.log('\nTooltip:')
pruefe('„noch nicht erschienen“ nur bei angekündigter Synchro', synchroAngekuendigt(titel({ platform: 'crunchyroll', synchro: 'angekuendigt' }), weg('crunchyroll')) && !synchroAngekuendigt(titel({ platform: 'crunchyroll', synchro: 'offen' }), weg('crunchyroll')) && !synchroAngekuendigt(titel(), weg('netflix')))
pruefe('streamNurOmu ohne Termine: false', !streamNurOmu(titel(), weg('netflix')))

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
