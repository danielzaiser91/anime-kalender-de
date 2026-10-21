/**
 * Zusicherungen zu den geteilten Crunchyroll-Seiten (`lib/cr-teilseiten.ts`, `bau/09-7-cr-teilseiten.ts`): Fenster je Titel über
 * Folgentitel (auch mit eingeschobener Zusammenfassung) oder über die Folgenzahl, nur bei Eindeutigkeit; sonst ein Grund für die
 * Prüfliste. Die Seiten sind den echten nachgebaut (Re:ZERO 25 = 13 + 12, Attack on Titan Staffel 3 mit durchgezählten Nummern).
 * Läuft in `check:logic`; der Bestandsteil steht in `check-cr-teilseiten-bestand.ts`.
 */
import { bereicheImFenster, ordneSeiteZu, type CrPosition, type Fenster, type UnserTitel, type Urteil } from './lib/cr-teilseiten.ts'
import { nurAusgelieferte } from './bau/pruefliste-bereinigen.ts'
import { bereicheBelegt, belegteFolgen } from './lib/cr-bereiche-belegt.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

interface Staffel {
  name: string
  /** Titel der Folgen; eine Zahl steht für so viele Folgen ohne Titel. */
  titel: (string | null)[] | number
  /** Wie viele Folgen ab Anfang deutsch sind (Vorgabe: alle). */
  deutsch?: number
  regulaer?: boolean
}

function seite(...staffeln: Staffel[]): CrPosition[] {
  return staffeln.flatMap((s, si) => {
    const titel = typeof s.titel === 'number' ? Array.from({ length: s.titel }, () => null) : s.titel
    return titel.map((t, i) => ({
      titel: t,
      deutsch: i < (s.deutsch ?? titel.length),
      regulaer: s.regulaer ?? true,
      staffel: si + 1,
      staffelName: s.name,
      nummer: String(i + 1),
    }))
  })
}

const folgen = (von: number, bis: number): string[] => Array.from({ length: bis - von + 1 }, (_, i) => `Titel Nummer ${von + i} eigener Name`)
const unser = (id: number, titel: string[] | null, episodes: number, zaehlt = true): UnserTitel => ({
  id,
  episodes,
  zaehlt,
  folgen: titel && titel.map((de, i) => ({ nr: i + 1, de, en: null })),
})
const von = (u: Map<number, Urteil>, id: number): string => {
  const x = u.get(id)!
  return 'fenster' in x ? `${x.fenster.quelle}:${x.fenster.positionen[0]! + 1}-${x.fenster.positionen.at(-1)! + 1}` : `offen:${x.grund}`
}

// 1. Re:ZERO: Crunchyroll zählt Staffel 2 mit 25 Folgen, wir 13 + 12; die Zahl allein löst das nicht (13 + 12 gegen 13/25/16).
const rezero = seite({ name: 'Staffel 1', titel: 13 }, { name: 'Staffel 2', titel: folgen(1, 25), deutsch: 20 }, { name: 'Staffel 3', titel: 16 })
const reZ = ordneSeiteZu([unser(1, folgen(1, 13), 13), unser(2, folgen(14, 25), 12)], rezero)
pruefe('Re:ZERO: Staffel 2 = 14–26 der Seite, Teil 2 = 27–38', von(reZ, 1) === 'titel:14-26' && von(reZ, 2) === 'titel:27-38', [von(reZ, 1), von(reZ, 2)])
const bereicheZ = (id: number) => bereicheImFenster((reZ.get(id) as { fenster: Fenster }).fenster, rezero).map((b) => `${b.from}-${b.to}`).join()
pruefe('Re:ZERO: deutsch sind 20 der 25 — in unserer Zählung 1–13 und 1–7', bereicheZ(1) === '1-13' && bereicheZ(2) === '1-7', [bereicheZ(1), bereicheZ(2)])

// 2. Zusammenfassung eingeschoben (SAO Alicization): nach der fünften Folge steht bei der Seite ein „Rückblick".
const mitRueck = seite({ name: 'Alicization', titel: [...folgen(1, 5), 'Rückblick auf alles bisher', ...folgen(6, 10)] })
const rueck = ordneSeiteZu([unser(1, folgen(1, 10), 10)], mitRueck)
const fe = rueck.get(1)
pruefe('Zusammenfassung: Folge 6 liegt hinter dem Rückblick', !!fe && 'fenster' in fe && fe.fenster.positionen.join() === '0,1,2,3,4,6,7,8,9,10', fe)

// 3. Zu wenige Treffer (unter 80 %) oder ein Versatz, der schrumpft: kein Titelfenster
const wenig = ordneSeiteZu([unser(1, [...folgen(1, 4), 'Etwas ganz anderes hier', 'Noch etwas anderes hier'], 6, false)], seite({ name: 'S', titel: folgen(1, 6) }))
pruefe('Unter 80 % Treffer ordnen die Titel nicht zu', von(wenig, 1).startsWith('offen:'), von(wenig, 1))
const schrumpft = ordneSeiteZu([unser(1, [...folgen(1, 3), ...folgen(5, 5), ...folgen(4, 4), ...folgen(6, 8)], 8)], seite({ name: 'S', titel: folgen(1, 9) }))
pruefe('Schrumpfender Versatz ist ein Widerspruch', von(schrumpft, 1).includes('schrumpft'), von(schrumpft, 1))

// 4. Folgenzahl ohne Titel: eindeutige Zuordnung gleich großer Staffeln in der Reihenfolge
const zwei = ordneSeiteZu([unser(1, null, 12), unser(2, null, 12)], seite({ name: 'S1', titel: 12 }, { name: 'S2', titel: 12 }))
pruefe('2 x 12 gegen 12 + 12: der Reihe nach', von(zwei, 1) === 'zahl:1-12' && von(zwei, 2) === 'zahl:13-24', [von(zwei, 1), von(zwei, 2)])
const mehrdeutig = ordneSeiteZu([unser(1, null, 12)], seite({ name: 'S1', titel: 12 }, { name: 'S2', titel: 12 }))
pruefe('12 gegen 12 + 12: mehrdeutig, keine Zuordnung', von(mehrdeutig, 1).includes('dieselbe Folgenzahl'), von(mehrdeutig, 1))
const eindeutig = ordneSeiteZu([unser(1, null, 13)], seite({ name: 'S1', titel: 12 }, { name: 'S2', titel: 13 }, { name: 'S3', titel: 12 }))
pruefe('13 gegen 12 + 13 + 12: die mittlere', von(eindeutig, 1) === 'zahl:13-25', von(eindeutig, 1))
const summe = ordneSeiteZu([unser(1, null, 13), unser(2, null, 12)], seite({ name: 'S2', titel: 25 }))
pruefe('13 + 12 gegen 25: hintereinander', von(summe, 1) === 'zahl:1-13' && von(summe, 2) === 'zahl:14-25', [von(summe, 1), von(summe, 2)])
const vertauscht = ordneSeiteZu([unser(1, null, 13), unser(2, null, 12)], seite({ name: 'S1', titel: 12 }, { name: 'S2', titel: 13 }))
pruefe('13 + 12 gegen 12 + 13: andere Reihenfolge, keine Zuordnung', von(vertauscht, 1).includes('anderer Reihenfolge'), von(vertauscht, 1))
const ova = ordneSeiteZu([unser(1, null, 12)], seite({ name: 'OVAs', titel: 3, regulaer: false }, { name: 'Staffel 1', titel: 12 }))
pruefe('OVA-Block zählt nicht mit; das Fenster liegt hinter ihm', von(ova, 1) === 'zahl:4-15', von(ova, 1))
const ungleich = ordneSeiteZu([unser(1, null, 12)], seite({ name: 'S1', titel: 13 }))
pruefe('12 gegen 13: geht nicht auf', von(ungleich, 1).startsWith('offen:'), von(ungleich, 1))
const film = ordneSeiteZu([unser(1, null, 1, false)], seite({ name: 'S1', titel: 1 }))
pruefe('Ein Film ohne Titel wird nicht über die Zahl zugeordnet', von(film, 1).startsWith('offen:'), von(film, 1))

// 5. Titel und Zahl sagen Verschiedenes, oder zwei Fenster überlappen: Prüfliste
const streit = ordneSeiteZu([unser(1, folgen(13, 24), 12), unser(2, null, 12)], seite({ name: 'S1', titel: folgen(1, 12) }, { name: 'S2', titel: folgen(13, 24) }))
pruefe('Titel nennen die zweite Staffel, die Zahl die erste: Widerspruch', von(streit, 1).startsWith('offen:Titel nennen'), von(streit, 1))
const doppelt = ordneSeiteZu([unser(1, folgen(1, 12), 12), unser(2, folgen(1, 12), 12)], seite({ name: 'S1', titel: folgen(1, 12) }))
pruefe('Zwei Titel mit denselben Folgen überlappen: beide offen', von(doppelt, 1).includes('überlappt') && von(doppelt, 2).includes('überlappt'), [von(doppelt, 1), von(doppelt, 2)])

// Ein Fenster, das auch nur eine Folge über das Seitenende ragt, wird nicht zugeordnet (Seite hat 11, wir 12 Folgen)
const zuLang = ordneSeiteZu([unser(1, folgen(1, 12), 12)], seite({ name: 'S1', titel: folgen(1, 11) }))
pruefe('Fenster ragt 1 über das Seitenende: keine Zuordnung, Grund', von(zuLang, 1).startsWith('offen:Fenster') && von(zuLang, 1).includes('ragt über'), von(zuLang, 1))
const passt = ordneSeiteZu([unser(1, folgen(1, 11), 11)], seite({ name: 'S1', titel: folgen(1, 11) }))
pruefe('Fenster endet genau am Seitenende: zugeordnet', von(passt, 1) === 'titel:1-11', von(passt, 1))

// 6. Bereiche in unserer Zählung, nur die deutschen Folgen
const gemischt = seite({ name: 'S', titel: 6 })
gemischt[1]!.deutsch = false
gemischt[4]!.deutsch = false
const b = bereicheImFenster({ positionen: [0, 1, 2, 3, 4, 5], quelle: 'zahl' }, gemischt).map((x) => `${x.from}-${x.to}`).join()
pruefe('Lücken in der deutschen Fassung bleiben Lücken', b === '1-1,3-4,6-6', b)

// 7. Eine Zeile, die der Dublettenabgleich entfernt hat, bleibt nicht auf der Prüfliste (JJK Kouhen, 12.10.2026)
const eintrag = (titleId: number) => ({ titleId, titel: 'x', url: 'u', grund: 'g' })
const bereinigt = nurAusgelieferte([eintrag(1), eintrag(10021915)], new Set([1])).map((p) => p.titleId).join()
pruefe('Prüfliste: ein entfallener Titel wird gestrichen, ein vorhandener bleibt', bereinigt === '1', bereinigt)

// 8. Ohne Folgenzahl gilt ein Bereich nur auf belegten deutschen Folgen (Reincarnated Aristocrat S3, 20.10.2026)
const katalog = { scrapedAt: '', serien: [{ url: 'u', katalog: 'de', geprueftAm: '', staffeln: [{ name: 'Staffel 3', folgen: 5, kacheln: 5, deutsch: 3, fremd: 0, deutscheFolgen: [1, 2, 4].map((nummer) => ({ nummer, guid: `G${nummer}`, verfuegbarAb: '2026-10-18T15:00:00Z' })) }] }] } as unknown as CrDubData
const belegt = belegteFolgen(katalog, 'u', 3)
const ok = (...r: [number, number, boolean?][]) => bereicheBelegt(r.map(([from, to, dub]) => ({ from, to, dub: dub ?? true })), belegt)
pruefe('Belegte Folgen: 1, 2 und 4 der Staffel 3', [...belegt].sort().join() === '1,2,4', [...belegt])
pruefe('Bereich 1-2 auf belegten Folgen gilt', ok([1, 2]))
pruefe('Bereich 4-4 (genau eine Folge) gilt', ok([4, 4]))
pruefe('Bereich 1-4 über die Lücke 3 gilt nicht', !ok([1, 4]))
pruefe('Bereich 4-5 über die höchste belegte Folge hinaus gilt nicht', !ok([4, 5]))
pruefe('Bereich ab 0 gilt nicht', !ok([0, 1]))
pruefe('Bereich ohne Ton (dub false) gilt nicht', !ok([1, 2, false]))
pruefe('Umgekehrter Bereich gilt nicht', !ok([2, 1]))
pruefe('Zwei Bereiche, einer unbelegt, gelten nicht', !ok([1, 2], [5, 5]))
pruefe('Andere Staffel: nichts belegt', !bereicheBelegt([{ from: 1, to: 1, dub: true }], belegteFolgen(katalog, 'u', 2)))
pruefe('Staffelnummer unbekannt: nichts belegt', belegteFolgen(katalog, 'u', undefined).size === 0)
pruefe('Andere Adresse: nichts belegt', belegteFolgen(katalog, 'x', 3).size === 0)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den geteilten Crunchyroll-Seiten verletzt`)
  process.exit(1)
}
console.log('Geteilte Crunchyroll-Seiten: Zusicherungen erfüllt')
