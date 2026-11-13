/**
 * Zusicherungen zu `web/src/lib/vorlieben.ts` an einer Speicher-Attrappe: Lesen nimmt nur echtes `true` (Zeichenkette, Zahl,
 * fremde Schlüssel fallen weg), kaputtes JSON und gesperrter Speicher geben die Standardansicht; `discAus` folgt dem Ausschluss
 * `disc`, nicht dem Einschluss; Nachführen merkt nur, was sich zwischen vorher und nachher geändert hat (ein per Adresse
 * eingeschalteter Filter wird keine Vorliebe), schreibt nichts ohne Änderung und wirft bei gesperrtem Speicher nie. Läuft in `check:logic`.
 */
// Modul für das `await import` auf Dateiebene: vorlieben.ts liest localStorage erst beim Aufruf, die Attrappe steht trotzdem vorher.
export {}

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const g = globalThis as Record<string, unknown>
const speicher = new Map<string, string>()
let schreibzugriffe = 0
const offen = {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => {
    schreibzugriffe++
    speicher.set(k, v)
  },
}
const gesperrt = {
  getItem: () => {
    throw new Error('gesperrt')
  },
  setItem: () => {
    throw new Error('gesperrt')
  },
}
g.localStorage = offen

const { vorliebenAus, vorliebenLesen, vorliebenNachfuehren } = await import('../web/src/lib/vorlieben.ts')
const { EMPTY_FILTERS, emptyLists } = await import('../web/src/lib/filters.ts')

const LEER = {
  favoritesOnly: false,
  kostenlosOnly: false,
  confirmedOnly: false,
  availableOnly: false,
  discAus: false,
  favoritesExcluded: false,
  kostenlosExcluded: false,
  confirmedExcluded: false,
  availableExcluded: false,
  zweitanbieterExcluded: false,
}
const gemerkt = () => JSON.parse(speicher.get('vorlieben') ?? 'null') as unknown

// Lesen
pruefe('leerer Speicher → Standardansicht', vorliebenLesen(), LEER)
speicher.set('vorlieben', '{kaputt')
pruefe('kaputtes JSON → Standardansicht', vorliebenLesen(), LEER)
speicher.set('vorlieben', 'null')
pruefe('JSON null → Standardansicht (Zugriff auf null wirft, catch fängt)', vorliebenLesen(), LEER)
speicher.set('vorlieben', JSON.stringify({ favoritesOnly: 'true', discAus: 1, kostenlosOnly: true, fremd: true, zweitanbieterExcluded: true }))
pruefe('nur echtes true zählt, fremde Schlüssel fallen weg', vorliebenLesen(), { ...LEER, kostenlosOnly: true, zweitanbieterExcluded: true })
g.localStorage = gesperrt
pruefe('gesperrter Speicher → Standardansicht', vorliebenLesen(), LEER)
g.localStorage = offen
speicher.clear()

// vorliebenAus
pruefe('leere Filter → keine Vorliebe', vorliebenAus(EMPTY_FILTERS), LEER)
const mitDisc = { ...EMPTY_FILTERS, excluded: { ...emptyLists(), releaseTypes: ['disc' as const] } }
pruefe('Ausschluss disc → discAus', vorliebenAus(mitDisc).discAus, true)
const discEin = { ...EMPTY_FILTERS, releaseTypes: ['disc' as const] }
pruefe('Einschluss disc ist kein discAus', vorliebenAus(discEin).discAus, false)
pruefe('Schalter wandern 1:1', vorliebenAus({ ...EMPTY_FILTERS, confirmedOnly: true, availableExcluded: true }), { ...LEER, confirmedOnly: true, availableExcluded: true })

// Nachführen
vorliebenNachfuehren(EMPTY_FILTERS, EMPTY_FILTERS)
pruefe('ohne Änderung kein Schreibzugriff', schreibzugriffe, 0)
pruefe('ohne Änderung kein Eintrag', speicher.has('vorlieben'), false)

vorliebenNachfuehren(EMPTY_FILTERS, mitDisc)
pruefe('Disc ausblenden wird gemerkt', gemerkt(), { ...LEER, discAus: true })

// Push-Adresse schaltet favoritesOnly ein (vorher und nachher gleich), daneben wird kostenlosOnly umgelegt.
const perAdresse = { ...mitDisc, favoritesOnly: true }
vorliebenNachfuehren(perAdresse, { ...perAdresse, kostenlosOnly: true })
pruefe('Adress-Filter wird keine Vorliebe, nur der umgelegte Schalter', gemerkt(), { ...LEER, discAus: true, kostenlosOnly: true })

const vorZaehler = schreibzugriffe
vorliebenNachfuehren(EMPTY_FILTERS, mitDisc)
pruefe('Änderung, die schon gemerkt ist, schreibt nicht', schreibzugriffe, vorZaehler)

vorliebenNachfuehren(mitDisc, EMPTY_FILTERS)
pruefe('Ausschalten wird gemerkt, Rest bleibt', gemerkt(), { ...LEER, kostenlosOnly: true })

g.localStorage = gesperrt
try {
  vorliebenNachfuehren(EMPTY_FILTERS, mitDisc)
  pruefe('gesperrter Speicher wirft nicht', true, true)
} catch (e) {
  pruefe('gesperrter Speicher wirft nicht', String(e), 'kein Fehler')
}
g.localStorage = offen

if (fehler) {
  console.error(`check-vorlieben: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-vorlieben: alle Zusicherungen grün')
