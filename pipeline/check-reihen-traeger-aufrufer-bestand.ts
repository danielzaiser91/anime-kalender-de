/**
 * Die Aufrufer der Reihen-Umhängung (14.10.2026): `anisearchKatalogReihenQuelle` (reiner Weg) und `anisearchKatalogReihen` (Rückweg) reichen `katalogWeg` weiter. Beide laden den
 * ausgelieferten Hauptbestand (`katalogAnker` liest `public/data/titles.json`), deshalb läuft die Prüfung in `check:bestand` und nicht in `check:logic`; die Titel sind erfunden,
 * der Inhalt von `titles.json` zählt nicht (Hauptbestand `bekannt` ist leer). Die reine Regel steht in `check-reihen-traeger.ts`.
 */
import { reihenFuerKatalog } from './bau/titel-hilfen.ts'
import { anisearchKatalogReihenQuelle } from './bau/anisearch-reihen-rein-bau.ts'
import { anisearchKatalogReihen } from './bau/anisearch-reihen-pruefliste.ts'
import type { ReinErgebnis } from './bau/anisearch-reihen-rein.ts'
import { EINZEL, ERSTE, KIND, SAMMEL, eintraege, kennung, verschoben, weg } from './lib/reihen-traeger-testdaten.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

console.log('anisearchKatalogReihenQuelle (rein) reicht katalogWeg weiter')
{
  let geschrieben: ReinErgebnis | undefined
  const vorher = process.env.REIHEN_QUELLE
  delete process.env.REIHEN_QUELLE
  const reihe = anisearchKatalogReihenQuelle(reihenFuerKatalog(eintraege, new Map()), eintraege, new Map(), verschoben, kennung, weg, (e) => { geschrieben = e })
  if (vorher !== undefined) process.env.REIHEN_QUELLE = vorher
  pruefe('Der Aufrufer liefert KIND in der Reihe der Zeile', reihe.get(KIND) === ERSTE, String(reihe.get(KIND)))
  pruefe('Der Sammeltitel steht nicht mehr in der Reihe-Zuordnung', !reihe.has(SAMMEL))
  pruefe('Die Prüfliste des reinen Wegs bekommt das Ergebnis', geschrieben?.reihe.get(KIND) === ERSTE)
}

console.log('anisearchKatalogReihen (Rückweg, REIHEN_QUELLE=anilist) reicht katalogWeg weiter')
{
  const alt = anisearchKatalogReihen(reihenFuerKatalog(eintraege, new Map()), eintraege, new Map(), verschoben, kennung, weg, () => undefined)
  pruefe('Der Rückweg liefert KIND in der Reihe der Zeile', alt.get(KIND) === ERSTE, String(alt.get(KIND)))
  pruefe('Gegenprobe: ein Titel ohne Träger-Fall bleibt allein', alt.get(EINZEL) === EINZEL)
}

console.log(fehler ? `\nAufrufer der Reihen-Umhängung: ${fehler} Zusicherung(en) verletzt.` : 'Aufrufer der Reihen-Umhängung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
