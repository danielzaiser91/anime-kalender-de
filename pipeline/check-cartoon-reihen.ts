/**
 * Zusicherungen zu den Cartoon-Reihen (Wikidata): Fälle aus echten Antworten und die Untergrenze auf dem echten Bestand.
 * Hintergrund: docs/wissen/cartoon-reihen.md. Läuft in `check:logic`.
 */
import { readJson } from './lib/util.ts'
import {
  bildeReihen, gemeinsamesWort, leseEntitaeten, pruefeReihen, qidAusExternalIds,
  type ReihenEintrag,
} from './lib/cartoon-reihen.ts'
import { cartoonReihen, REIHEN_DATEI } from './bau/cartoon-reihen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

// Gekürzte echte Antwort von wbgetentities (09.10.2026): Star Wars: The Clone Wars und die Trilogie-Item von War for Cybertron.
const antwort = {
  entities: {
    Q632672: {
      labels: { en: { value: 'Star Wars: The Clone Wars' } },
      claims: {
        P8345: [{ mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q462' } } }, rank: 'normal' }],
        P155: [{ mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q382289' } } }, rank: 'normal' }],
        P156: [
          { mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q42051' } } }, rank: 'normal' },
          { mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q97365172' } } }, rank: 'normal' },
          { mainsnak: { snaktype: 'somevalue' }, rank: 'normal' },
        ],
      },
    },
    Q65091279: { labels: { en: { value: 'Transformers: War for Cybertron Trilogy' } }, claims: {} },
    Q1: { missing: '' },
  },
}
const gelesen = leseEntitaeten(antwort, '2026-10-09')
pruefe('Entitäten: Franchise gelesen', gelesen.Q632672?.rel?.P8345?.[0] === 'Q462')
pruefe('Entitäten: Nachfolger ohne Wert verworfen', gelesen.Q632672?.rel?.P156?.length === 2)
pruefe('Entitäten: leeres Item hat leere Beziehungen', Object.keys(gelesen.Q65091279?.rel ?? { x: 1 }).length === 0)
pruefe('Entitäten: fehlendes Item fehlt', gelesen.Q1 === undefined)
pruefe('external_ids: Kennung', qidAusExternalIds({ wikidata_id: 'Q632672' }) === 'Q632672')
pruefe('external_ids: keine Kennung', qidAusExternalIds({ wikidata_id: null }) === null && qidAusExternalIds({ wikidata_id: '' }) === null)

const e = (qid: string, rel: Record<string, string[]> = {}, label?: string): ReihenEintrag => ({ qid, rel, label, geholtAm: '2026-10-09' })
const namen = new Map<number, string>([
  [-1, 'Danny Phantom'], [-2, 'T.U.F.F. Puppy'], [-3, 'Ben 10'], [-4, 'Ben 10: Omniverse'], [-5, 'Hazbin Hotel'], [-6, 'Helluva Boss'],
  [-7, 'Solo'], [-8, 'Siege'], [-9, 'Earthrise'], [-10, 'Gleich A'], [-11, 'Gleich B'],
])
const daten: Record<string, ReihenEintrag> = {
  1: e('Q1', { P156: ['Q2'] }), 2: e('Q2', { P155: ['Q1'] }),
  3: e('Q3', { P8345: ['Q99'] }), 4: e('Q4', { P8345: ['Q99'] }),
  5: e('Q5'), 6: e('Q6', { P144: ['Q5'] }),
  7: e('Q7', { P8345: ['Q98'] }),
  8: e('Q8'), 9: e('Q9'),
  10: e('Q10'), 11: e('Q10'),
}
const hand = [{ name: 'Hand', ids: [-8, -9], quelle: 'https://example.org/x' }]
const reihen = bildeReihen(daten, namen, hand)
const gruppe = (id: number) => reihen.find((r) => r.glieder.includes(id))?.id
pruefe('Sendeplatz-Kante ohne gemeinsames Wort bildet keine Reihe', gruppe(-1) === undefined && gruppe(-2) === undefined)
pruefe('gemeinsamer Hub bildet eine Reihe', gruppe(-3) === -4 && gruppe(-4) === -4, JSON.stringify(reihen))
pruefe('Ableger (P144) zwischen zwei Cartoons', gruppe(-5) === -6)
pruefe('Einzelner Hub-Treffer ist keine Reihe', gruppe(-7) === undefined)
pruefe('Handreihe', gruppe(-8) === -9 && gruppe(-9) === -9)
pruefe('Dasselbe Item = dieselbe Reihe', gruppe(-10) === -11)
pruefe('Reihen sind in sich stimmig', pruefeReihen(reihen, hand).length === 0, pruefeReihen(reihen, hand).join(';'))
pruefe('Umgezogener Cartoon stiftet keine Reihe', bildeReihen(daten, namen, hand, new Set([-4])).every((r) => !r.glieder.includes(-3)))
pruefe('Wortriegel: Sendeplatz', !gemeinsamesWort('Danny Phantom', 'T.U.F.F. Puppy') && gemeinsamesWort('Teen Titans', 'Teen Titans Go!'))
pruefe(
  'Prüfung meldet Doppelzuordnung, fehlenden Beleg und Handreihe ohne Quelle',
  pruefeReihen([{ id: -1, glieder: [-1, -2], belege: [] }, { id: -2, glieder: [-2, -3], belege: ['x'] }], [{ name: 'H', ids: [-1, -2], quelle: 'kein' }]).length >= 3,
)

// Echter Bestand: Untergrenze (09.10.2026: 48 Reihen / 130 Titel aus Wikidata; nie auf den Messwert des Augenblicks senken).
const cartoons = Object.values(readJson<Record<string, { id: number; titleEn: string }>>('data/cartoons.json', {}))
if (cartoons.length && Object.keys(readJson<object>(REIHEN_DATEI, {})).length) {
  const echte = cartoonReihen(cartoons)
  const titel = echte.reduce((n, r) => n + r.glieder.length, 0)
  pruefe('Echter Bestand: mindestens 40 Cartoon-Reihen', echte.length >= 40, `${echte.length}`)
  pruefe('Echter Bestand: mindestens 110 Cartoons mit Reihe', titel >= 110, `${titel}`)
  pruefe('Echter Bestand: Trilogie War for Cybertron steht zusammen', echte.some((r) => [-100617, -117682, -128255].every((i) => r.glieder.includes(i))))
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu Cartoon-Reihen verletzt`)
  process.exit(1)
}
console.log('Cartoon-Reihen: Zusicherungen erfüllt')
