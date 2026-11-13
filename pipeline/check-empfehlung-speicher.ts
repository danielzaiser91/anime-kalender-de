/**
 * Zusicherungen zu `web/src/lib/empfehlung-speicher.ts` an einer Speicher-Attrappe: „Meine Anbieter“ lesen (nur Zeichenketten, kaputtes
 * JSON und Nicht-Listen leer), die Wahl der Reise fällt ohne eigenen Eintrag auf „Meine Anbieter“ zurück, mit eigenem Eintrag nicht
 * (auch nicht bei leerer Liste), Schreiben berührt „Meine Anbieter“ nicht; gesperrter Speicher wirft nie. „Gesehen“ und „Verworfen“
 * liegen unter getrennten Schlüsseln. Der Hook `useReiseAnbieter` bleibt ungetestet. Läuft in `check:logic`.
 */
// Modul für das `await import` oben auf Dateiebene: Das Modul darf erst nach der Speicher-Attrappe laden.
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
const offen = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v), removeItem: (k: string) => void speicher.delete(k) }
const gesperrt = {
  getItem: () => {
    throw new Error('gesperrt')
  },
  setItem: () => {
    throw new Error('gesperrt')
  },
  removeItem: () => {
    throw new Error('gesperrt')
  },
}
g.localStorage = offen
g.window = { dispatchEvent: () => true }
g.CustomEvent ??= class {
  constructor(public type: string) {}
}

const { eigeneAnbieterLesen, empfehlungGesehen, empfehlungVerworfen, reiseAnbieterLesen, reiseAnbieterSchreiben } = await import('../web/src/lib/empfehlung-speicher.ts')

const neu = (eintraege: Record<string, string>) => {
  speicher.clear()
  for (const [k, v] of Object.entries(eintraege)) speicher.set(k, v)
}

// „Meine Anbieter“
neu({})
pruefe('Meine Anbieter: nichts gespeichert', eigeneAnbieterLesen(), [])
neu({ meineAnbieter: '["netflix","crunchyroll"]' })
pruefe('Meine Anbieter: Liste', eigeneAnbieterLesen(), ['netflix', 'crunchyroll'])
neu({ meineAnbieter: '["netflix",3,null,{"a":1},"adn"]' })
pruefe('Meine Anbieter: nur Zeichenketten', eigeneAnbieterLesen(), ['netflix', 'adn'])
neu({ meineAnbieter: '{"netflix":true}' })
pruefe('Meine Anbieter: keine Liste', eigeneAnbieterLesen(), [])
neu({ meineAnbieter: '[kaputt' })
pruefe('Meine Anbieter: kaputtes JSON', eigeneAnbieterLesen(), [])

// Wahl der Reise
neu({ meineAnbieter: '["netflix"]' })
pruefe('Reise ohne eigenen Eintrag: Meine Anbieter', reiseAnbieterLesen(), ['netflix'])
neu({ meineAnbieter: '["netflix"]', 'empfehlung:anbieter': '["adn"]' })
pruefe('Reise mit eigenem Eintrag', reiseAnbieterLesen(), ['adn'])
neu({ meineAnbieter: '["netflix"]', 'empfehlung:anbieter': '[]' })
pruefe('Reise: leere Wahl bleibt leer', reiseAnbieterLesen(), [])
neu({ meineAnbieter: '["netflix"]', 'empfehlung:anbieter': '"adn"' })
pruefe('Reise: keine Liste', reiseAnbieterLesen(), [])
neu({ meineAnbieter: '["netflix"]', 'empfehlung:anbieter': '[1,"adn"]' })
pruefe('Reise: nur Zeichenketten', reiseAnbieterLesen(), ['adn'])
neu({ meineAnbieter: '["netflix"]', 'empfehlung:anbieter': '{' })
pruefe('Reise: kaputtes JSON fällt nicht zurück', reiseAnbieterLesen(), [])

neu({ meineAnbieter: '["netflix"]' })
reiseAnbieterSchreiben(['adn', 'disneyplus'])
pruefe('Schreiben: eigener Schlüssel', speicher.get('empfehlung:anbieter'), '["adn","disneyplus"]')
pruefe('Schreiben: Meine Anbieter unberührt', speicher.get('meineAnbieter'), '["netflix"]')
pruefe('Schreiben, dann lesen', reiseAnbieterLesen(), ['adn', 'disneyplus'])
reiseAnbieterSchreiben([])
pruefe('leere Wahl geschrieben und gelesen', reiseAnbieterLesen(), [])

// Gesperrter Speicher: lesen leer, schreiben still.
g.localStorage = gesperrt
let geworfen = false
let gelesen: unknown
try {
  gelesen = [eigeneAnbieterLesen(), reiseAnbieterLesen()]
  reiseAnbieterSchreiben(['adn'])
} catch {
  geworfen = true
}
g.localStorage = offen
pruefe('gesperrt: kein Fehler', geworfen, false)
pruefe('gesperrt: leer gelesen', gelesen, [[], []])

// Gesehen und Verworfen: getrennte Schlüssel.
neu({})
empfehlungGesehen.write(new Set([1, 2]))
empfehlungVerworfen.write(new Set([3]))
pruefe('Schlüssel', [...speicher.keys()].sort(), ['empfehlung:gesehen', 'empfehlung:verworfen'])
pruefe('Gesehen und Verworfen getrennt', [[...empfehlungGesehen.read()], [...empfehlungVerworfen.read()]], [[1, 2], [3]])

if (fehler) {
  console.error(`check-empfehlung-speicher: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-empfehlung-speicher: ok')
