/**
 * Zusicherungen zu `worker/src/pruefung-stand-anbieter.ts` (`rechneAnbieter`, ohne Datenbank): was als erledigt zählt (seit dem
 * Prüfstand gemeldet oder wartend; Wiedervorlage nur nach Prüfstand), Staffeln, gedeckte Ziele, Suchadressen als Ziele.
 * Den Weg über den Briefkasten prüft `tools/worker-pruefstand.test.ts`. Läuft in `check:logic`.
 */
import { rechneAnbieter, type Gemeldet } from '../worker/src/pruefung-stand-anbieter.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const P = 'disney'
const gemeldet = (teil: Partial<Record<keyof Gemeldet, Map<string, Set<string>> | Map<string, Set<number>> | Set<string>>> = {}): Gemeldet => ({
  unterwegs: new Map(),
  seitPruefstand: new Map(),
  staffeln: new Map(),
  wartendeStaffeln: new Map(),
  ...(teil as Partial<Gemeldet>),
})
const anbieter = (extra: Record<string, unknown> = {}) => ({ name: 'Disney+', plattform: P, offen: 5, gesamt: 9, gemeldet: 0, ...extra })
const ziel = (url: string, extra: Record<string, unknown> = {}) => ({ url, titel: url.toUpperCase(), ...extra })

pruefe('ohne Ziele und Meldungen', rechneAnbieter(anbieter(), gemeldet()), {
  name: 'Disney+',
  plattform: P,
  gesamt: 9,
  offen: 5,
  titel: 0,
  unterwegs: 0,
  ohneSeite: 0,
  ziel: null,
  ziele: [],
})
pruefe('ohneSeite ohne Suchadressen aus der Zahl', rechneAnbieter(anbieter({ ohneSeite: 7 }), gemeldet()).ohneSeite, 7)

{
  const r = rechneAnbieter(
    anbieter({ ziele: [ziel('a'), ziel('b'), ziel('c'), ziel('d', { seit: '2026-10-01' }), ziel('e', { seit: '2026-10-01' })] }),
    gemeldet({ seitPruefstand: new Map([[P, new Set(['a', 'e'])], ['netflix', new Set(['b'])]]), unterwegs: new Map([[P, new Set(['c', 'd', 'x'])]]) }),
  )
  pruefe('erledigt: seit Prüfstand (a, e) oder wartend ohne Wiedervorlage (c); andere Plattform zählt nicht (b); Wiedervorlage wartend bleibt offen (d)', r.ziele.map((z) => z.url), ['b', 'd'])
  pruefe('offen abzüglich erledigter Adressen, Titel, unterwegs', [r.offen, r.titel, r.unterwegs, r.ziel], [2, 2, 3, 'b'])
}

pruefe('offen nie unter 0', rechneAnbieter(anbieter({ offen: 1, ziele: [ziel('a'), ziel('b')] }), gemeldet({ seitPruefstand: new Map([[P, new Set(['a', 'b'])]]) })).offen, 0)

{
  const g = gemeldet({
    seitPruefstand: new Map([[P, new Set(['s1', 's2', 's3'])]]),
    staffeln: new Map([['s1', new Set([1])], ['s2', new Set([1])]]),
    wartendeStaffeln: new Map([['s2', new Set([2])]]),
  })
  const r = rechneAnbieter(anbieter({ ziele: [ziel('s1', { staffeln: [1, 2] }), ziel('s2', { staffeln: [1, 2] }), ziel('s3', { staffeln: [] })] }), g)
  pruefe('Staffeln: offen, bis jede gemeldet oder wartend ist; leere Staffelliste wie ohne', r.ziele.map((z) => z.url), ['s1'])
  pruefe('Staffeln: Adresse zählt trotzdem als erledigt in „offen“', r.offen, 2)
}

pruefe(
  'gedeckte Ziele fallen weg, zählen aber nicht als erledigt',
  (({ offen, ziele }) => [offen, ziele.map((z) => z.url)])(rechneAnbieter(anbieter({ ziele: [ziel('a'), ziel('b')] }), gemeldet({ gedeckt: new Set(['a']) }))),
  [5, ['b']],
)

{
  const r = rechneAnbieter(
    anbieter({ ohneSeite: 99, ziele: [ziel('t')], suchAdressen: ['q1', 'q2', 'q3'] }),
    gemeldet({ seitPruefstand: new Map([[P, new Set(['q1'])]]), unterwegs: new Map([[P, new Set(['q2'])]]) }),
  )
  pruefe('Suchadressen: hinter den Titelseiten, ohne Titel, erledigte fallen weg', r.ziele, [ziel('t'), { url: 'q3', titel: '' }])
  pruefe('Suchadressen: ohneSeite gezählt statt übernommen, nicht in „titel“, offen abzüglich', [r.ohneSeite, r.titel, r.offen, r.ziel], [1, 1, 3, 't'])
}

pruefe('nur Suchadressen: erstes Ziel ist die erste offene Suche', rechneAnbieter(anbieter({ suchAdressen: ['q1', 'q2'] }), gemeldet({ seitPruefstand: new Map([[P, new Set(['q1'])]]) })).ziel, 'q2')

{
  const viele = Array.from({ length: 40 }, (_, i) => ziel(`z${i}`))
  pruefe('alle Ziele, nicht die ersten 25', rechneAnbieter(anbieter({ ziele: viele }), gemeldet()).ziele.length, 40)
}

if (fehler) process.exit(1)
console.log('check-pruefung-stand-anbieter: ok')
