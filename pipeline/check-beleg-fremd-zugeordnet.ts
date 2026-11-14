/**
 * Zusicherungen zu `lib/beleg-fremd-zugeordnet.ts`: Berliner Datum, nur neu entstehende Fremdbesitz-Treffer, Verschieben statt Schreiben
 * und das Zurückziehen geschriebener Belegblöcke. Mit eigenem `Besitz` (ohne `ladeBesitz`, das Dateien liest). Läuft in `check:logic`.
 */
import { berlinDatum, fremdBesitzText, fremdeBesitzer, verschiebeFremdenBeleg, zieheFremdeBelegeZurueck, type Besitz } from './lib/beleg-fremd-zugeordnet.ts'
import type { OhneZuordnung } from './lib/meldungen-liste.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

// Datumsgrenzen in Berlin: Winterzeit (+1), Sommerzeit (+2), Umstellungstag.
pruefe('Winterzeit kurz vor Mitternacht UTC', berlinDatum('2026-11-12T22:59:59Z'), '2026-11-12')
pruefe('Winterzeit nach 23 Uhr UTC ist Folgetag', berlinDatum('2026-11-12T23:00:00Z'), '2026-11-13')
pruefe('Sommerzeit nach 22 Uhr UTC ist Folgetag', berlinDatum('2026-07-01T22:00:00Z'), '2026-07-02')
pruefe('Sommerzeit kurz davor', berlinDatum('2026-07-01T21:59:59Z'), '2026-07-01')
pruefe('Jahreswechsel', berlinDatum('2026-12-31T23:30:00Z'), '2027-01-01')

const SEITE = 'https://animationdigitalnetwork.com/video/1234-jojo'
const ANDERE = 'https://animationdigitalnetwork.com/video/9999-anderes'
const besitz = (belege: Besitz['belege'] = []): Besitz => ({
  zugeordnet: [[`${SEITE}#folge-1`, { titleId: 100 }], [ANDERE, { titleId: 300 }]],
  belege,
  verschoben: 0,
  gruppen: new Set(),
})

pruefe('Beleg einer anderen Kennung an zugeordneter Seite', fremdeBesitzer(besitz(), 200, [], SEITE), [{ titleId: 100, adresse: SEITE, besitzer: ['Handbeleg:200'] }])
pruefe('Schreibweise der Adresse egal (www, Schrägstrich)', fremdeBesitzer(besitz(), 200, [], 'https://www.animationdigitalnetwork.com/video/1234-jojo/').length, 1)
pruefe('Kennung ist selbst Besitzerin: kein Treffer', fremdeBesitzer(besitz(), 100, [], SEITE), [])
pruefe('Besitzer ist mitbeteiligt: kein Treffer', fremdeBesitzer(besitz(), 200, [100, 200], SEITE), [])
pruefe('andere Adresse: kein Treffer', fremdeBesitzer(besitz(), 200, [], 'https://animationdigitalnetwork.com/video/5555-frei'), [])
pruefe('schon vorher bestehender Treffer zählt nicht neu', fremdeBesitzer(besitz([{ anilistId: 400, url: SEITE }]), 200, [], SEITE), [])
pruefe('Besitzer hat eigenen Handbeleg: Adresse gilt als seine', fremdeBesitzer(besitz([{ anilistId: 100, url: SEITE }]), 200, [], SEITE), [])
pruefe('fremdBesitzText', fremdBesitzText({ titleId: 100, adresse: SEITE, besitzer: [] }), 'Adresse gehört schon Titel 100')

const MELDUNG = { url: 'https://example.org/gemeldet', plattform: 'adn', befund: 'dub', serientitel: 'JoJo', titel: null }

{
  const b = besitz()
  const warnungen: string[] = []
  const liste: OhneZuordnung[] = []
  pruefe('verschieben: fällt aus', verschiebeFremdenBeleg(b, 200, [200], SEITE, [{ id: 7 }, { id: 8 }], MELDUNG, warnungen, liste), true)
  pruefe('verschieben: Zähler und Gruppe (erste ID)', [b.verschoben, [...b.gruppen]], [1, [7]])
  const grund = 'Beleg für Titel 200 (Meldung 7, 8) nicht geschrieben: Adresse gehört schon Titel 100'
  pruefe('verschieben: Warnung', warnungen, [`${MELDUNG.url} — ${grund}, Meldung bleibt liegen`])
  pruefe('verschieben: Arbeitsliste', liste, [
    { url: MELDUNG.url, name: `JoJo — ${grund}`, plattform: 'adn', befund: 'dub', vorschlag: [200], zuTun: `Seite ${SEITE} gehört schon einem anderen Titel: Zuordnung klären (Beleg wird nicht geschrieben)` },
  ])
  pruefe('verschieben: freie Adresse wird geschrieben', verschiebeFremdenBeleg(b, 200, [200], 'https://animationdigitalnetwork.com/video/5555-frei', [{ id: 9 }], MELDUNG, warnungen, liste), false)
  pruefe('verschieben: freie Adresse ändert nichts', [b.verschoben, [...b.gruppen], warnungen.length, liste.length], [1, [7], 1, 1])
}

const block = (id: number, url?: string) => ['', `- anilistId: ${id}`, ...(url ? [`  url: ${url}`] : []), '  checkedAt: 2026-11-12']
const VORHER = ['- anilistId: 1', '  url: https://alt.example/', '  checkedAt: 2026-01-01']

{
  const zeilen = [...VORHER, ...block(200, SEITE), ...block(201), ...block(202, 'https://animationdigitalnetwork.com/video/5555-frei')]
  const warnungen: string[] = []
  const liste: OhneZuordnung[] = []
  const b = besitz()
  pruefe('zurückziehen: ein Beleg an fremder Adresse', zieheFremdeBelegeZurueck(b, zeilen, VORHER.length, [{ id: 7 }], MELDUNG, warnungen, liste), 1)
  pruefe('zurückziehen: Zeilen davor bleiben, übrige Blöcke bleiben in Reihenfolge', zeilen, [...VORHER, ...block(201), ...block(202, 'https://animationdigitalnetwork.com/video/5555-frei')])
  pruefe('zurückziehen: gemeldet', [b.verschoben, warnungen.length, liste.length], [1, 1, 1])
}

{
  // Der Besitzer steht selbst als Block in derselben Meldung: geteilte Seite, nichts wird zurückgezogen.
  const zeilen = [...VORHER, ...block(200, SEITE), ...block(100, SEITE)]
  const vorher = [...zeilen]
  pruefe('zurückziehen: Besitzer mitbeteiligt', zieheFremdeBelegeZurueck(besitz(), zeilen, VORHER.length, [{ id: 7 }], MELDUNG, [], []), 0)
  pruefe('zurückziehen: Zeilen unverändert', zeilen, vorher)
}

{
  const zeilen = [...VORHER]
  pruefe('zurückziehen: nichts geschrieben', zieheFremdeBelegeZurueck(besitz(), zeilen, VORHER.length, [{ id: 7 }], MELDUNG, [], []), 0)
  pruefe('zurückziehen: nichts geschrieben, Zeilen gleich', zeilen, VORHER)
}

if (fehler) process.exit(1)
console.log('check-beleg-fremd-zugeordnet: ok')
