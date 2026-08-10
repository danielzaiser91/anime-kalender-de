/**
 * Prüft den aniSearch-Parser gegen archivierte Seiten.
 *
 * Der Parser liest fremdes HTML — eine Umbenennung einer CSS-Klasse dort
 * genügt, und er liefert stillschweigend leere Felder. Weil das Archiv unter
 * `data/anisearch-raw/` die Originalabschnitte aufhebt, lässt sich das ohne
 * einen einzigen neuen Abruf feststellen: Was gestern noch erkannt wurde, muss
 * heute noch erkannt werden.
 *
 * Aufruf:
 *   npm run data:anisearch:check            — Stichprobe über das Archiv
 *   npm run data:anisearch:check -- 20658   — eine bestimmte aniSearch-ID
 */
import { gunzipSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extractInfo } from './fetch-anisearch.ts'

const ARCHIV = 'data/anisearch-raw'
/** Wie viele Seiten die Stichprobe umfasst, wenn keine ID genannt ist. */
const STICHPROBE = 40

function lade(datei: string): string {
  return gunzipSync(readFileSync(`${ARCHIV}/${datei}`)).toString('utf8')
}

function main(): void {
  if (!existsSync(ARCHIV)) {
    console.error(`Kein Archiv unter ${ARCHIV} — erst "npm run data:anisearch" laufen lassen.`)
    process.exit(1)
  }
  const alle = readdirSync(ARCHIV).filter((d) => d.endsWith('.html.gz'))
  if (!alle.length) {
    console.error('Archiv ist leer.')
    process.exit(1)
  }

  const gewuenscht = process.argv[2]
  if (gewuenscht) {
    const datei = `${gewuenscht}.html.gz`
    if (!alle.includes(datei)) {
      console.error(`${gewuenscht} liegt nicht im Archiv.`)
      process.exit(1)
    }
    console.log(JSON.stringify(extractInfo(lade(datei)), null, 2))
    return
  }

  // Gleichmäßig über den Bestand verteilt statt die ersten n — sonst prüft man
  // immer dieselbe Ecke des Alphabets.
  const schritt = Math.max(1, Math.floor(alle.length / STICHPROBE))
  const probe = alle.filter((_, i) => i % schritt === 0).slice(0, STICHPROBE)

  const zaehler = {
    format: 0,
    episodes: 0,
    episodesEstimated: 0,
    runtimeMinutes: 0,
    season: 0,
    studios: 0,
    broadcast: 0,
    synonyms: 0,
    deutsch: 0,
    dubbed: 0,
  }
  const leer: string[] = []

  for (const datei of probe) {
    const info = extractInfo(lade(datei))
    if (!info || !info.languages.length) {
      leer.push(datei.replace('.html.gz', ''))
      continue
    }
    if (info.format) zaehler.format++
    if (info.episodes) zaehler.episodes++
    if (info.episodesEstimated) zaehler.episodesEstimated++
    if (info.runtimeMinutes) zaehler.runtimeMinutes++
    if (info.season) zaehler.season++
    if (info.studios?.length) zaehler.studios++
    if (info.broadcast) zaehler.broadcast++
    if (info.synonyms?.length) zaehler.synonyms++
    const de = info.languages.find((l) => l.language === 'Deutsch')
    if (de) zaehler.deutsch++
    if (de?.dubbed) zaehler.dubbed++
  }

  console.log(`Stichprobe: ${probe.length} von ${alle.length} archivierten Seiten\n`)
  for (const [feld, treffer] of Object.entries(zaehler)) {
    const anteil = Math.round((treffer / probe.length) * 100)
    console.log(`  ${feld.padEnd(18)} ${String(treffer).padStart(3)}  ${anteil}%`)
  }

  // Format und Folgenzahl stehen auf praktisch jeder Seite. Fehlen sie
  // reihenweise, hat aniSearch die Struktur geändert und der Parser greift ins
  // Leere — ohne einen Fehler zu werfen.
  //
  // Die Folgenzahl steht hier, weil genau sie schon einmal still danebenlag:
  // Eine Regex nahm die letzte Zahl des Feldes und traf damit die Laufzeit
  // statt der Folgenzahl. Erkannt wurden 3 % statt 100 % — und die erste
  // Fassung dieser Prüfung hätte das durchgewinkt, weil sie nur aufs Format
  // sah. Eine Schwelle taugt nur für das, was sie tatsächlich beobachtet.
  const schwellen: [string, number, number][] = [
    ['Format', zaehler.format / probe.length, 0.9],
    ['Folgenzahl', zaehler.episodes / probe.length, 0.8],
    ['deutscher Block', zaehler.deutsch / probe.length, 0.9],
  ]
  const gerissen = schwellen.filter(([, ist, soll]) => ist < soll)
  if (leer.length || gerissen.length) {
    console.error(`\nFEHLER: Die Seitenstruktur hat sich vermutlich geändert.`)
    if (leer.length) {
      console.error(`  ${leer.length} Seiten ohne Sprachblock: ${leer.slice(0, 10).join(', ')}`)
    }
    for (const [name, ist, soll] of gerissen) {
      console.error(`  ${name}: ${Math.round(ist * 100)}% erkannt, erwartet mindestens ${soll * 100}%`)
    }
    process.exit(1)
  }
  console.log('\nParser greift.')
}

main()
