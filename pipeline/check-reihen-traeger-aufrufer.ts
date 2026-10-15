/**
 * Die Aufrufer der Reihen-Umhängung (14.10.2026): `anisearchKatalogReihenQuelle` (Weiche, reiner Weg und Rückweg `REIHEN_QUELLE=anilist`) und `anisearchKatalogReihen` reichen `katalogWeg` weiter.
 * Der Hauptbestand kommt als Parameter (`[]`), nicht aus `public/data/titles.json`; die Prüflisten gehen in einen Wegwerf-Ordner (`lib/pruefliste-umleiten.ts`), nie nach `data/`.
 * Die Standardwerte von `schreibe` gelten als Verhalten und werden beobachtet. Die reine Regel steht in `check-reihen-traeger.ts`.
 */
import { ordner, raeumeAuf } from './lib/pruefliste-umleiten.ts'
import { existsSync } from 'node:fs'
import { reihenFuerKatalog } from './bau/titel-hilfen.ts'
import { REIN_PRUEFLISTE_DATEI, anisearchKatalogReihenQuelle } from './bau/anisearch-reihen-rein-bau.ts'
import { PRUEFLISTE_DATEI, anisearchKatalogReihen } from './bau/anisearch-reihen-pruefliste.ts'
import type { ReinErgebnis } from './bau/anisearch-reihen-rein.ts'
import { EINZEL, ERSTE, KIND, SAMMEL, eintraege, kennung, verschoben, weg } from './lib/reihen-traeger-testdaten.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

/** Führt `f` mit gesetztem (`wert`) bzw. entferntem `REIHEN_QUELLE` aus und stellt den alten Wert wieder her. */
function mitQuelle<T>(wert: string | undefined, f: () => T): T {
  const vorher = process.env.REIHEN_QUELLE
  if (wert === undefined) delete process.env.REIHEN_QUELLE
  else process.env.REIHEN_QUELLE = wert
  try {
    return f()
  } finally {
    if (vorher === undefined) delete process.env.REIHEN_QUELLE
    else process.env.REIHEN_QUELLE = vorher
  }
}

const basis = () => reihenFuerKatalog(eintraege, new Map())
const weiche = (schreibe?: (e: ReinErgebnis) => void) => anisearchKatalogReihenQuelle(basis(), eintraege, new Map(), verschoben, kennung, weg, schreibe, [])

console.log('Weiche, reiner Weg: katalogWeg weitergereicht, Prüfliste an die übergebene Funktion')
{
  let geschrieben: ReinErgebnis | undefined
  const reihe = mitQuelle(undefined, () => weiche((e) => { geschrieben = e }))
  pruefe('Der Aufrufer liefert KIND in der Reihe der Zeile', reihe.get(KIND) === ERSTE, String(reihe.get(KIND)))
  pruefe('Der Sammeltitel steht nicht mehr in der Reihe-Zuordnung', !reihe.has(SAMMEL))
  pruefe('Die Prüfliste des reinen Wegs bekommt das Ergebnis', geschrieben?.reihe.get(KIND) === ERSTE)
  pruefe('Mit übergebener Funktion entsteht keine Datei', !existsSync(REIN_PRUEFLISTE_DATEI))
}

console.log('Weiche, reiner Weg ohne Funktion: die Standardfunktion schreibt die Prüfliste')
{
  mitQuelle(undefined, () => weiche())
  pruefe('Die Standardfunktion schreibt die Prüfliste des reinen Wegs', existsSync(REIN_PRUEFLISTE_DATEI), REIN_PRUEFLISTE_DATEI)
}

console.log('anisearchKatalogReihen (Rückweg) direkt: übergebene Funktion statt Datei')
{
  const aufrufe: string[] = []
  const alt = anisearchKatalogReihen(basis(), eintraege, new Map(), verschoben, kennung, weg, (teil) => { aufrufe.push(teil) }, [])
  pruefe('Der Rückweg liefert KIND in der Reihe der Zeile', alt.get(KIND) === ERSTE, String(alt.get(KIND)))
  pruefe('Gegenprobe: ein Titel ohne Träger-Fall bleibt allein', alt.get(EINZEL) === EINZEL)
  pruefe('Die übergebene Funktion wird genau einmal für den Katalog gerufen', aufrufe.join() === 'katalog', aufrufe.join())
  pruefe('Mit übergebener Funktion entsteht keine Datei des Standardwegs', !existsSync(PRUEFLISTE_DATEI))
}

console.log('Weiche, Rückweg (REIHEN_QUELLE=anilist): katalogWeg weitergereicht, Standardfunktion schreibt')
{
  pruefe('Vorher keine Prüfliste des Standardwegs', !existsSync(PRUEFLISTE_DATEI))
  const reihe = mitQuelle('anilist', () => weiche())
  pruefe('Der Rückweg über die Weiche liefert KIND in der Reihe der Zeile', reihe.get(KIND) === ERSTE, String(reihe.get(KIND)))
  pruefe('Gegenprobe über die Weiche: ein Titel ohne Träger-Fall bleibt allein', reihe.get(EINZEL) === EINZEL)
  pruefe('Die Standardfunktion schreibt die Prüfliste des Standardwegs', existsSync(PRUEFLISTE_DATEI), PRUEFLISTE_DATEI)
}

raeumeAuf()
console.log(`Prüflisten-Ordner ${ordner} entfernt.`)
console.log(fehler ? `\nAufrufer der Reihen-Umhängung: ${fehler} Zusicherung(en) verletzt.` : 'Aufrufer der Reihen-Umhängung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
