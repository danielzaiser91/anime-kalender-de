/**
 * Bestandswache: Die Handbelege Kengan Ashura S2 (146638), Mushoku Tensei Cour 2 (127720) und Spy × Family (140960) nennen nach dem
 * Verschmelzen keinen Deutsch-Bereich über der Folgenzahl ihres Titels (Serienzählung statt Staffelzählung, 28.10.2026).
 * Rot, der Titel wird zurückgestellt (Marke). Die Regel steht in `lib/handbeleg-staffelzaehlung.ts`, ihr Test in `check-handbeleg-staffelzaehlung.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { ladeHandbelege } from './lib/dub-confirmed.ts'
import { staffelzaehlungVerletzt, STAFFELZAEHLUNG_IDS } from './lib/handbeleg-staffelzaehlung.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Title } from '../shared/types.ts'

const TITEL = 'public/data/titles.json'
if (!existsSync(TITEL)) {
  console.error(`FEHLER: ${TITEL} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const datei = readJson<Title[] | { titles: Title[] }>(TITEL, [])
const folgen = new Map((Array.isArray(datei) ? datei : datei.titles).map((t) => [t.id, t.episodes ?? 0]))
const zeilen = staffelzaehlungVerletzt(ladeHandbelege(), folgen)
const treffer = meldeVerletzte(
  STAFFELZAEHLUNG_IDS.map((id) => ({ id })),
  'handbeleg-staffelzaehlung-bestand',
  'Handbeleg nennt Deutsch-Folgen über der Folgenzahl des Titels (Serienzählung statt Staffelzählung)',
  (t) => zeilen.some((z) => z.startsWith(`${t.id} `)),
)
for (const z of zeilen) console.error(`FEHLER: Handbeleg ${z}`)
console.log(`Handbelege in Staffelzählung: ${STAFFELZAEHLUNG_IDS.length} Titel geprüft, ${zeilen.length} über der Folgenzahl`)
console.log(`VERSTÖSSE: ${treffer.length}`)
process.exit(treffer.length ? 1 : 0)
