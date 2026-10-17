/**
 * Das Mail-Abzeichen trägt dieselbe Kennfarbe wie die Seite (Daniel, 17.10.2026): Finale Gelbgrün (`ak-finale`), nicht mehr Gold —
 * Gold ist dort nur noch Favorit. Start und TV-Premiere ohne Wortlaut „Premiere" bleiben bei Gold, „Premiere" bei Türkis.
 *
 * Aufruf: `npx tsx tools/worker-mail-badge.test.ts`
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { badge, FINALE_GRUEN } from '../worker/src/mail-abschnitte.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const termin = (zusatz: Partial<ReleaseEvent>): ReleaseEvent =>
  ({ id: 'a', releaseSlug: 'x', titleId: 900001, name: 'X', date: '2026-10-20', releaseType: 'weekly', platform: 'netflix', ...zusatz }) as ReleaseEvent

const finale = badge(termin({ staffelfinale: true }))
const start = badge(termin({ staffelstart: true }))
const premiere = badge(termin({ platform: 'tv', tvPremiere: true }))
const keins = badge(termin({}))

pruefe(finale.includes('>Finale<') && finale.includes(`color:${FINALE_GRUEN}`) && finale.includes(`border:1px solid ${FINALE_GRUEN}`), 'Finale: grüner Rand und grüne Schrift')
pruefe(FINALE_GRUEN === '#86d93a', 'Finale-Grün ist der dunkle Ton der Seite (--ak-finale)')
pruefe(!finale.includes('#fbbf24'), 'Finale: kein Gold mehr')
pruefe(start.includes('>Start<') && start.includes('#fbbf24') && !start.includes(FINALE_GRUEN), 'Start bleibt Gold')
pruefe(premiere.includes('#2dd4bf') && !premiere.includes(FINALE_GRUEN), 'Premiere bleibt Türkis')
pruefe(keins === '', 'ohne Auszeichnung kein Abzeichen')

if (fehler > 0) {
  console.error(`worker-mail-badge: ${fehler} Fehler`)
  process.exit(1)
}
console.log('worker-mail-badge: ok')
