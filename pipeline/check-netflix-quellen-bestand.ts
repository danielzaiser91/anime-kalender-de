/**
 * Bestandswache: Titel, deren Quellen (Datensatz, aniSearch, JustWatch) verschiedene Netflix-Kennungen nennen
 * (`lib/netflix-quellen-abweichung.ts`). Zählt alle; eine Warnzeile für jeden, der nicht auf der Prüfliste
 * (`public/data/pruefstand.json`, Netflix) steht. Exit 0 immer, rot nur bei unlesbarer Eingabe. Test: `check-netflix-quellen.ts`.
 * Optional: Pfade von Titeldatei, aniSearch, JustWatch und Prüfstand als Argumente (Ablauftest).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { abweichendeNetflixKennungen, nachPruefliste, titelAufPruefliste, type QuellenDateien, type QuellenTitel } from './lib/netflix-quellen-abweichung.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T

export function main(titelPfad: string, anisearchPfad: string, justwatchPfad: string, standPfad: string): number {
  const titel = lies<QuellenTitel[]>(titelPfad)
  const dateien: QuellenDateien = { anisearch: lies(anisearchPfad), justwatch: lies(justwatchPfad) }
  const stand = lies<{ anbieter: { plattform: string; ziele?: { url: string }[] }[] }>(standPfad)
  const zielUrls = (stand.anbieter.find((a) => a.plattform === 'netflix')?.ziele ?? []).map((z) => z.url)
  const aufListe = titelAufPruefliste(titel, zielUrls)
  const funde = abweichendeNetflixKennungen(titel, dateien)
  const geteilt = nachPruefliste(funde, aufListe)
  console.log(`  ✓ Netflix-Kennungen der Quellen: ${funde.length} Titel mit Abweichung, ${geteilt.aufListe.length} auf der Prüfliste, ${geteilt.offen.length} ohne`)
  for (const f of geteilt.offen) {
    console.log(`  ⚠ WARNUNG Netflix-Kennung: Titel ${f.id} nennt ${JSON.stringify(f.kennungen)} — auf die Prüfliste (node tools/erneut-melden.mjs ${f.id}:netflix)`)
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2)
  const pfad = (i: number, rel: string) => a[i] ?? fileURLToPath(new URL(rel, import.meta.url))
  process.exit(
    main(pfad(0, '../public/data/titles.json'), pfad(1, '../data/anisearch.json'), pfad(2, '../data/justwatch-audio.json'), pfad(3, '../public/data/pruefstand.json')),
  )
}
