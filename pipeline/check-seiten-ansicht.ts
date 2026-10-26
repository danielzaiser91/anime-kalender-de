/** Fälle für `brauchtSeitenAnsicht`: Kalender und Datenbank holen das Bündel der Seitenansichten nicht (Start-Budget). */
import assert from 'node:assert/strict'
import { brauchtSeitenAnsicht } from '../web/src/lib/seiten-ansicht.ts'

// Feste Listen, nicht aus dem Modul: neue Ansichten müssen hier bewusst eingeordnet werden.
const NICHT = ['woche', 'monat', 'datenbank', 'entdecken'] as const
const NACHGELADEN = ['news', 'saison', 'abo', 'newsletter', 'quellen', 'impressum', 'datenschutz'] as const
for (const v of NICHT) assert.equal(brauchtSeitenAnsicht(v), false, v)
for (const v of NACHGELADEN) assert.equal(brauchtSeitenAnsicht(v), true, v)
console.log(`check-seiten-ansicht: ok (${NICHT.length} ohne, ${NACHGELADEN.length} mit Seitenansicht)`)
