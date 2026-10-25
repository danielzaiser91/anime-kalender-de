/** `check-deutsche-folgenzahl-bestand.ts` als eigener Prozess gegen eine Kulisse: n ≥ Folgen = Hinweis (Exit 0), Folgenzahl oder Titel fehlt = Fehler (Exit 1). Läuft in `check:logic`. */
import { laufeGegenKulisse } from './lib/bestand-kulisse.ts'
import { type ErstausgabeVonHand } from './lib/erstausgabe-von-hand.ts'
import { bewerteDeutscheFolgenzahl } from './lib/deutsche-folgenzahl-bestand.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}
const SKRIPT = 'check-deutsche-folgenzahl-bestand.ts'
const eintrag = (id: number, n: number): ErstausgabeVonHand => ({ anilistId: id, title: `T${id}`, deFolgen: { n, name: 'q', url: 'u', zitat: 'z' } })
const yamlDatei = (e: unknown[]) => JSON.stringify(e) // JSON ist gültiges YAML
const titles = (t: unknown[]) => JSON.stringify(t)

// Bewertung (Mehrere Werte, damit Vertauschungen auffallen)
const titel = new Map([[901, { episodes: 5 }], [902, { episodes: 5 }], [903, { episodes: 5 }], [904, {}]])
const r = bewerteDeutscheFolgenzahl([eintrag(901, 5), eintrag(902, 4), eintrag(903, 9), eintrag(904, 2), eintrag(905, 2), eintrag(906, 2)], titel, new Set([906]))
pruefe('Hinweise: n = Folgen und n > Folgen', r.hinweise.join(',') === '901,903', r.hinweise.join(','))
pruefe('Fehler: Folgenzahl fehlt und Titel fehlt, zurückgestellt nicht', r.fehler.length === 2 && r.fehler[0]!.includes('904') && r.fehler[1]!.includes('905'), r.fehler.join('|'))
pruefe('Eintrag ohne deFolgen zählt nicht', bewerteDeutscheFolgenzahl([{ anilistId: 901 }], titel, new Set()).fehler.length === 0)

const lauf = (e: unknown[], t: unknown[]) => laufeGegenKulisse(SKRIPT, { 'data/erstausgabe-von-hand.yaml': yamlDatei(e), 'public/data/titles.json': titles(t) })
const a = lauf([eintrag(901, 5)], [{ id: 901, episodes: 5 }])
pruefe('n=5/episodes=5: Exit 0 mit WARNUNG-Zeile', a.code === 0 && /^⚠ WARNUNG Deutsche Folgenzahl: 1 überholt .*: 901$/m.test(a.aus), `${a.code} ${a.aus}`)
const b = lauf([eintrag(901, 5)], [{ id: 901 }])
pruefe('episodes leer: Exit 1', b.code === 1 && b.aus.includes('FEHLER') && !b.aus.includes('⚠ WARNUNG'), `${b.code} ${b.aus}`)
const c = lauf([eintrag(901, 5)], [])
pruefe('Titel fehlt: Exit 1', c.code === 1 && c.aus.includes('Titel nicht im Bestand'), `${c.code} ${c.aus}`)
const d = lauf([eintrag(901, 3)], [{ id: 901, episodes: 5 }])
pruefe('n < episodes: Exit 0 ohne WARNUNG', d.code === 0 && !d.aus.includes('⚠ WARNUNG'), `${d.code} ${d.aus}`)

if (fehler) process.exit(1)
console.log('Deutsche Folgenzahl: Hinweis bei n ≥ Folgen, Fehler bei fehlender Zahl oder fehlendem Titel, Prozess-Exit 0/1: 7 Fälle ok.')
