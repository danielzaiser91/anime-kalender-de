/**
 * Fälle zu `findeFremdeBelege` (28.10.2026) ohne `public/data`: der echte Heidi-Fall vor PR 2263 (Disney+-Beleg von Heidi 1974 an
 * der Adresse des Cartoons Heidi 2015, wörtlich aus Bestand und Beleg) als Rot-Beispiel, eine Sammelseite („Freezing“) als Ausnahme.
 * Läuft in `check:logic`; der Bestand wird in `check-handbeleg-fremde-adresse-bestand.ts` geprüft.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { streamAdressen } from './lib/fremde-adressen.ts'
import { findeFremdeBelege } from './lib/handbeleg-fremde-adresse.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const HEIDI_CARTOON = 'https://www.disneyplus.com/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd'
const HEIDI_BELEG = 'https://www.disneyplus.com/de-de/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd'
const FREEZING = 'https://www.amazon.de/gp/video/detail/B0FREEZ001'
const SUCHE = 'https://www.amazon.de/s?k=Freezing'
const EIGEN = 'https://www.amazon.de/gp/video/detail/B0EIGEN001'

const wurzel = mkdtempSync(join(tmpdir(), 'handbeleg-fremd-'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
writeFileSync(join(wurzel, 'public/data/cartoons.json'), JSON.stringify([{ id: -62475, titleEn: 'Heidi', streams: [{ url: HEIDI_CARTOON }] }]))
writeFileSync(join(wurzel, 'public/data/ohne-synchro.json'), JSON.stringify([{ id: 900011, titleEn: 'Freezing OVA', streams: [{ url: FREEZING, seite: SUCHE }] }, { id: 900012 }]))
const fremd = streamAdressen(wurzel)
rmSync(wurzel, { recursive: true, force: true })

const titel = new Set([2225, 900001, 900002, 900003])
const ohneAusnahme = {}
const heidi = findeFremdeBelege([{ anilistId: 2225, url: HEIDI_BELEG }], titel, fremd, ohneAusnahme)
pruefe('Heidi 1974: Disney+-Beleg an der Adresse des Cartoons (mit de-de) ist offen', heidi.offen.length === 1 && heidi.offen[0]!.anilistId === 2225 && heidi.offen[0]!.fuehrtAuch[0] === 'cartoons.json:-62475', heidi)

const freezing = [{ anilistId: 900001, url: FREEZING }]
pruefe('Sammelseite ohne Ausnahme: offen', findeFremdeBelege(freezing, titel, fremd, ohneAusnahme).offen.length === 1)
const mit = findeFremdeBelege(freezing, titel, fremd, { 900001: { url: FREEZING } })
pruefe('Sammelseite mit benannter Ausnahme: nicht offen, als ausgenommen gezählt', mit.offen.length === 0 && mit.ausgenommen.join() === '900001', mit)
pruefe('Ausnahme gilt nur für ihre Kennung: der Beleg einer zweiten Staffel bleibt offen', findeFremdeBelege([{ anilistId: 900002, url: FREEZING }], titel, fremd, { 900001: { url: FREEZING } }).offen.length === 1)
pruefe('Ausnahme gilt nur für ihre Adresse: dieselbe Kennung an anderer fremder Adresse bleibt offen', findeFremdeBelege([{ anilistId: 900001, url: HEIDI_BELEG }], titel, fremd, { 900001: { url: FREEZING } }).offen.length === 1)
pruefe('Eigene Adresse: kein Treffer', findeFremdeBelege([{ anilistId: 900003, url: EIGEN }], titel, fremd, ohneAusnahme).offen.length === 0)
pruefe('Beleg eines Titels außerhalb von titles.json (Cartoon, negative Kennung) zählt nicht', findeFremdeBelege([{ anilistId: -62475, url: HEIDI_CARTOON }], titel, fremd, ohneAusnahme).offen.length === 0)
pruefe('Beleg ohne Adresse oder Kennung zählt nicht', findeFremdeBelege([{ anilistId: 2225 }, { url: HEIDI_BELEG }], titel, fremd, ohneAusnahme).offen.length === 0)
pruefe('Zweiter Eintrag im Cartoon-Bestand (ohne Streams) bricht den Lauf nicht', fremd.size === 3, [...fremd.keys()])
pruefe('Adresse nur als Seite (Suchseite) eines fremden Eintrags zählt ebenfalls', findeFremdeBelege([{ anilistId: 900002, url: SUCHE }], titel, fremd, ohneAusnahme).offen.length === 1)

if (fehler) process.exit(1)
console.log(`check-handbeleg-fremde-adresse: ${faelle} Fälle grün, Handbeleg an fremder Adresse wird gemeldet.`)
