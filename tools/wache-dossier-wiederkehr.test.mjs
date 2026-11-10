// Abbruch mit Wiederkehr im Dossier: zweiter Versuch, Vermerk „vorübergehend“, dauerhafter Ausfall bleibt Befund. Feste Uhr, keine echte Pause.
import assert from 'node:assert/strict'
import { sammle } from './wache-urteil-dossier.mjs'
import { mitWiederkehr } from './wache-dossier-wiederkehr.mjs'

// 08:00 und 08:05 Berlin (MEZ, UTC+1) am 15.01.2027
const zeiten = [new Date('2027-01-15T07:00:00Z'), new Date('2027-01-15T07:05:00Z'), new Date('2027-01-15T07:10:00Z'), new Date('2027-01-15T07:15:00Z')]
const uhr = () => {
  let i = 0
  return () => zeiten[Math.min(i++, zeiten.length - 1)]
}
const folge = (...schritte) => {
  let i = 0
  return () => {
    const s = schritte[i++]
    if (s instanceof Error) throw s
    return s
  }
}
const pausen = []
const warte = (ms) => pausen.push(ms)

// 1. Gelingt sofort: Inhalt unverändert, keine Pause, kein Vermerk.
assert.equal(mitWiederkehr(folge('Läufe: 12'), uhr(), warte), 'Läufe: 12')
assert.equal(pausen.length, 0)

// 2. Abbruch als Fehlertext, dann ok: vorübergehend mit beiden Uhrzeiten, Inhalt des zweiten Versuchs, genau eine Pause.
const a = mitWiederkehr(folge('FEHLER: gh run list nach 15 s abgebrochen', 'Läufe: 12'), uhr(), warte)
assert.match(a, /^vorübergehend \(Abbruch 08:00, wieder ok 08:05; Fehler: FEHLER: gh run list nach 15 s abgebrochen\)\n\nLäufe: 12$/)
assert.equal(pausen.length, 1)
assert.ok(pausen[0] > 0)

// 3. Abbruch als Ausnahme (Quelle wirft), dann ok.
const b = mitWiederkehr(folge(new Error('GraphQL: Limit\nZeile 2'), 'Offen: 3'), uhr(), warte)
assert.match(b, /^vorübergehend \(Abbruch 08:00, wieder ok 08:05; Fehler: FEHLER beim Sammeln: GraphQL: Limit\)\n\nOffen: 3$/)

// 4. Zweimal Ausfall: bleibt Befund, ohne „vorübergehend“, mit dem Zeitpunkt des ersten Abbruchs.
const c = mitWiederkehr(folge('FEHLER: gh nach 15 s abgebrochen', 'FEHLER: gh nach 15 s abgebrochen'), uhr(), warte)
assert.match(c, /^FEHLER: gh nach 15 s abgebrochen\n\(auch der zweite Versuch scheiterte, erster Abbruch 08:00;/)
assert.doesNotMatch(c, /vorübergehend/)
const d = mitWiederkehr(folge(new Error('x'), new Error('y')), uhr(), warte)
assert.match(d, /^FEHLER beim Sammeln: y\n\(auch der zweite/)

// 5. Ein Text, der nur mittendrin „FEHLER:“ nennt, ist kein Ausfall (kein zweiter Versuch).
pausen.length = 0
assert.equal(mitWiederkehr(folge('Quelle X: letzter Fehler: FEHLER: alt'), uhr(), warte), 'Quelle X: letzter Fehler: FEHLER: alt')
assert.equal(pausen.length, 0)

// 6. Verdrahtung: sammle() nutzt es je Quelle; der Kopf „Stand“ bleibt, die übrigen Quellen bleiben unberührt.
pausen.length = 0
const alle = sammle(
  [
    ['a.txt', folge('A ok')],
    ['b.txt', folge('FEHLER: gh nach 15 s abgebrochen', 'B ok')],
    ['c.txt', folge('FEHLER: dauerhaft', 'FEHLER: dauerhaft')],
  ],
  uhr(),
  warte,
)
assert.equal(pausen.length, 2)
assert.match(alle[0][1], /^Stand: .*\n\nA ok$/)
assert.match(alle[1][1], /^Stand: .*\n\nvorübergehend \(Abbruch/)
assert.match(alle[1][1], /B ok$/)
assert.match(alle[2][1], /\n\nFEHLER: dauerhaft\n\(auch der zweite/)

console.log('wache-dossier-wiederkehr: 6 Fallgruppen ok (sofort, Fehlertext, Ausnahme, dauerhaft, Fehlalarm, sammle)')
