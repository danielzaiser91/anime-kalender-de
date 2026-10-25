/**
 * Rechnet die Abrufdaten der TMDB-Bilddateien nach (`inhaltAm`, 13.10.2026): Ein Datum darf nicht nach dem Tag des Commits liegen, in dem der
 * Eintrag samt Datum zuerst steht — geholt wird vor dem Einchecken, nie danach. Das fängt ein erfundenes oder zu junges Datum (auch ein zu spät
 * nachgetragenes für Altbestand, `tools/tmdb-bilddatum.mjs`). Eine flache Git-Kopie sieht nur spätere Commits und prüft dadurch milder, nie strenger.
 * Aufruf: `npm run check:bestand-liste`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATEIEN, erstesAuftreten, verlaufAusGit } from './tmdb-bilddatum.mjs'

const wurzel = join(import.meta.dirname, '..')
let verletzt = 0

for (const { datei } of DATEIEN) {
  const daten = JSON.parse(readFileSync(join(wurzel, datei), 'utf8'))
  const verlauf = verlaufAusGit(datei)
  let geprueft = 0
  for (const [id, e] of Object.entries(daten)) {
    if (!e?.inhaltAm) continue
    const tag = erstesAuftreten(verlauf, id, e, true)
    if (!tag) continue
    geprueft++
    if (e.inhaltAm > tag) {
      verletzt++
      console.error(`  ✖ ${datei} ${id}: Abruf ${e.inhaltAm} liegt nach dem ersten Commit (${tag})`)
    }
  }
  console.log(`  ✓ ${datei}: ${geprueft} datierte Einträge mit Commit gegengerechnet`)
}

if (verletzt) {
  console.error(`\n${verletzt} Abrufdatum liegt nach dem Commit, der den Eintrag zuerst enthält.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nTMDB-Bilddatum (Bestand): kein Datum liegt nach seinem Commit.')
console.log('VERSTÖSSE: 0')
