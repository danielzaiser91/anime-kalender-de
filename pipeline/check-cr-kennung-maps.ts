/**
 * Klasse „letzter gewinnt“ schließen: Crunchyroll führt 219 von 768 Serienkennungen im Dub-Bestand unter zwei Adressen
 * (und mehrere im Kalender). Eine Map, die mit `set(<Serienkennung>, …)` gefüllt wird, ohne zu gruppieren oder zu wählen,
 * lässt den zuletzt gelesenen Eintrag still gewinnen. Dieser Wächter liest jede Quelldatei unter pipeline/ und shared/
 * (ohne Prüfungen) per Syntaxbaum: jede solche Map muss in ERLAUBT mit Begründung stehen (eigene Auswahlregel, bewusst
 * erster Eintrag, sammelt alles) – sonst `gruppiereJeKennung` (lib/je-kennung.ts) nehmen. Aufruf: `tsx pipeline/check-cr-kennung-maps.ts`
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findeKennungsMaps } from './lib/cr-kennung-map-wache.ts'

/** `datei::mapName` → warum diese Map nicht blind den letzten Eintrag nimmt. */
const ERLAUBT: Record<string, string> = {
  'pipeline/bau/09-4-2-bloecke.ts::nachSerienId': 'wählt je Kennung den Eintrag mit den meisten deutschen Folgen und sammelt die Titel aller Adressen',
  'pipeline/lib/cr-ja-deckung.ts::nachKennung': 'wählt je Kennung den Eintrag mit den meisten deutschen Folgen und sammelt die Titel aller Adressen',
  'pipeline/bau/cr-serie-geteilt.ts::jung': 'behält je Kennung den jüngsten Abruf (geprueftAm)',
  'pipeline/lib/cr-block-standardname.ts::je': 'behält je Kennung den jüngsten Abruf (geprueftAm)',
  'pipeline/lib/crunchyroll-termine.ts::raus': 'behält je Kennung den Eintrag mit dem größeren Gewicht',
  'pipeline/lib/crunchyroll-adressen.ts::kachelSeit': 'behält je Kennung die jüngste Kachel (Vergleich vor dem Schreiben)',
  'pipeline/bau/04-cr-sendeplaetze.ts::titlesByCrSeries': 'sammelt alle Titel einer Kennung in einer Liste',
  'pipeline/bau/widerlegung-woche.ts::karte': 'sammelt alle Sprachen je Kennung und Tag in einer Menge',
  'pipeline/messung-cr-katalog.ts::jeSerie': 'Messskript: bewusst der erste Eintrag je Kennung (has-Prüfung davor)',
  'pipeline/messung-cr-katalog.ts::adressenJeSerie': 'sammelt die Adressen aller Einträge einer Kennung',
  'pipeline/scrape-crunchyroll-dub.ts::jeSerie': 'Abruf-Cache: je Kennung wird die Serie einmal gelesen, weitere Adressen übernehmen sie (schon-Prüfung davor)',
}

function quellDateien(wurzel: string, ordner: string): string[] {
  const dateien: string[] = []
  for (const e of readdirSync(join(wurzel, ordner), { withFileTypes: true })) {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) dateien.push(...quellDateien(wurzel, pfad))
    else if (/\.ts$/.test(e.name) && !/^check-|\.test\./.test(e.name)) dateien.push(pfad.replaceAll('\\', '/'))
  }
  return dateien
}

export function pruefeKennungsMaps(wurzel: string): { gelesen: number, fremde: string[], veraltet: string[] } {
  const dateien = [...quellDateien(wurzel, 'pipeline'), ...quellDateien(wurzel, 'shared')]
  const gefunden = new Set<string>()
  const fremde: string[] = []
  for (const datei of dateien) {
    for (const m of findeKennungsMaps(readFileSync(join(wurzel, datei), 'utf8'))) {
      const schluessel = `${datei}::${m.name}`
      gefunden.add(schluessel)
      if (!(schluessel in ERLAUBT)) fremde.push(`${datei}:${m.zeile} Map „${m.name}“ schlüsselt nach Serienkennung ohne Gruppierung`)
    }
  }
  const veraltet = Object.keys(ERLAUBT).filter((k) => !gefunden.has(k))
  return { gelesen: dateien.length, fremde, veraltet }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const wurzel = process.env.AK_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const { gelesen, fremde, veraltet } = pruefeKennungsMaps(wurzel)
  if (gelesen === 0) {
    console.error('FEHL check-cr-kennung-maps: keine Quelldatei gelesen')
    process.exit(1)
  }
  for (const f of fremde) console.error(`  ✖ ${f} – gruppiereJeKennung nehmen oder in ERLAUBT mit Begründung eintragen`)
  for (const v of veraltet) console.error(`  ✖ ERLAUBT-Eintrag ohne Fundstelle: ${v}`)
  if (fremde.length || veraltet.length) {
    console.error(`FEHL check-cr-kennung-maps: ${fremde.length} Map(s) ohne Gruppierung, ${veraltet.length} veraltete Ausnahme(n)`)
    process.exit(1)
  }
  console.log(`check-cr-kennung-maps: ${gelesen} Dateien gelesen, ${Object.keys(ERLAUBT).length} Ausnahmen begründet, keine Map blind nach Serienkennung.`)
}
