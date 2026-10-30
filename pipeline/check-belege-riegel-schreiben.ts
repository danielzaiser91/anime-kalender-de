/**
 * Zusicherung: **Der Beleg-Schreibweg liest vor dem Schreiben und entdoppelt die fertige Fassung** — als Lauf von
 * `haengeBelegeAn` gegen eine Wegwerf-Datei (`AK_ROOT`), nicht als Textsuche in `belege-anhaengen.ts` und `dub-confirmed.ts`.
 * Ersetzt „fetch-pruefungen ruft den Riegel vor dem Schreiben" und „nutzt diesen Abgleich" aus `check-logic.ts`.
 * Läuft in `check:logic`.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const kulisse = mkdtempSync(join(tmpdir(), 'belege-riegel-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'data'), { recursive: true })
const datei = join(kulisse, 'data', 'dub-confirmed.yaml')
const block = (id: number, asin: string) => [`- anilistId: ${id}`, '  platform: primevideo', `  url: https://www.amazon.de/dp/${asin}`, '  dub: true', "  checkedAt: '2026-10-30'"]
const fehler: string[] = []
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const ids = () => ((yaml.load(readFileSync(datei, 'utf8')) as { anilistId: number }[]) ?? []).map((b) => b.anilistId)
try {
  const { haengeBelegeAn } = await import('./lib/belege-anhaengen.ts')
  const meldungen: string[] = []
  const lauf = (zeilen: string[]) => haengeBelegeAn({ datei, zeilen, heute: '2026-10-30', log: (t) => meldungen.push(t), warn: (t) => meldungen.push(t) })
  const setze = (text: string) => writeFileSync(datei, text)
  copyFileSync(fileURLToPath(new URL('../data/belege-entfernt.yaml', import.meta.url)), join(kulisse, 'data', 'belege-entfernt.yaml'))

  /* Der Beleg kommt an, ein wörtlich vorhandener nicht noch einmal. */
  setze(block(900301, 'B0AAAAAAAA').join('\n') + '\n')
  lauf([...block(900301, 'B0AAAAAAAA'), '', ...block(900302, 'B0BBBBBBBB')])
  erwarte('neuer Beleg wird angehängt, vorhandener nicht doppelt', ids(), [900301, 900302])

  /* Die fertige Fassung wird vor dem Schreiben entdoppelt: eine schon vorhandene Dopplung geht beim Anhängen weg. */
  setze([...block(900303, 'B0CCCCCCCC'), '', ...block(900303, 'B0CCCCCCCC')].join('\n') + '\n')
  lauf(block(900304, 'B0DDDDDDDD'))
  erwarte('Dopplung im Bestand fällt beim Schreiben weg', ids(), [900303, 900304])
  erwarte('… und meldet es', meldungen.some((m) => /doppelt|Doppel|entdoppelt/i.test(m)), true)

  /* Erst lesen, dann schreiben: zwei url-Zeilen ergeben kein YAML — Fehler, Datei unverändert. */
  const vorher = [...block(900305, 'B0EEEEEEEE')].join('\n') + '\n'
  setze(vorher)
  let geworfen = ''
  try {
    lauf([...block(900306, 'B0FFFFFFFF'), '  url: https://www.amazon.de/dp/B0GGGGGGGG'])
  } catch (e) {
    geworfen = (e as Error).message
  }
  erwarte('doppelte url-Zeile: Fehler "nichts geschrieben"', /nichts geschrieben/.test(geworfen), true)
  erwarte('… Datei unverändert', readFileSync(datei, 'utf8'), vorher)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-belege-riegel-schreiben:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log('check-belege-riegel-schreiben: 6 Fälle ok.')
