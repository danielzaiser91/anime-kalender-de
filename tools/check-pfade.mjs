/**
 * Kein Pfad darf einen Ordnernamen doppelt enthalten.
 *
 * ## Der Fall
 *
 * Zwischen dem 10. und dem 24.08.2026 wuchs im Repository eine rekursive
 * Ordner-Verschachtelung heran: `data/proposals` lag zuletzt **21 Ebenen** tief,
 * `data/adn-raw` dreizehn. 15.614 von 66.679 Dateien waren byte-identische
 * Kopien ihrer Originale eine Ebene höher.
 *
 * Die Ursache stand in `tools/commit-data.sh`: `cp -r QUELLE ZIEL` legt die
 * Quelle **in** das Ziel, wenn das Ziel bereits ein Verzeichnis ist — und genau
 * das war nach dem `git reset --hard` eine Zeile höher der Normalfall.
 *
 * ## Warum es niemand bemerkt hat
 *
 * Weil nichts kaputt ging. Die Läufe liefen grün, die Daten stimmten, der
 * Kalender zeigte das Richtige. Nur wuchs im Hintergrund eine Kopie der Kopie,
 * bei jedem Lauf eine Ebene tiefer — am 21.08.2026 sieben Ebenen an einem Tag.
 *
 * Aufgefallen ist es erst, als Windows die Pfadlänge nicht mehr hergab und
 * `git pull` mit „Filename too long" abbrach. Bis dahin waren vierzehn Tage
 * vergangen.
 *
 * ## Was hier geprüft wird
 *
 * Ein Ordnername, der auf seinem eigenen Pfad ein zweites Mal vorkommt, ist im
 * Datenbestand dieses Projekts immer ein Fehler. Die Prüfung ist absichtlich
 * stumpf: Sie kennt den Grund nicht und braucht ihn nicht zu kennen.
 *
 * Zusätzlich eine Obergrenze für die Pfadlänge — 180 Zeichen, weit unter
 * Windows' 260, aber weit über allem, was hier legitim vorkommt. Sie fängt eine
 * Verschachtelung, die sich über *verschiedene* Namen aufbaut und der Prüfung
 * oben entginge.
 *
 * Aufruf: node tools/check-pfade.mjs
 */
import { execFileSync } from 'node:child_process'

/** Der Verzeichnisbaum, wie git ihn kennt — nicht wie er lokal ausgecheckt ist. */
const dateien = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n')
  .filter(Boolean)

const MAX_LAENGE = 180
const doppelt = []
const zuLang = []

for (const pfad of dateien) {
  const teile = pfad.split('/').slice(0, -1)
  const gesehen = new Set()
  for (const teil of teile) {
    if (gesehen.has(teil)) {
      doppelt.push({ pfad, name: teil })
      break
    }
    gesehen.add(teil)
  }
  if (pfad.length > MAX_LAENGE) zuLang.push(pfad)
}

console.log(`Pfade geprüft: ${dateien.length}`)

let fehler = 0

if (doppelt.length) {
  fehler++
  console.error(`\n✗ ${doppelt.length} Pfad(e) enthalten einen Ordnernamen doppelt:`)
  const jeName = {}
  for (const d of doppelt) jeName[d.name] = (jeName[d.name] ?? 0) + 1
  for (const [name, n] of Object.entries(jeName).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.error(`    „${name}" — ${n}×`)
  }
  console.error(`  Beispiel: ${doppelt[0].pfad.slice(0, 120)}`)
  console.error('  Wahrscheinlich hat ein `cp -r` in ein bestehendes Verzeichnis kopiert.')
} else {
  console.log('✓ Kein Pfad enthält einen Ordnernamen doppelt.')
}

if (zuLang.length) {
  fehler++
  console.error(`\n✗ ${zuLang.length} Pfad(e) länger als ${MAX_LAENGE} Zeichen:`)
  for (const p of zuLang.slice(0, 3)) console.error(`    ${p.length}: ${p.slice(0, 110)}…`)
  console.error('  Auf Windows scheitert der Checkout ab 260 Zeichen — mit Repo-Pfad davor früher.')
} else {
  console.log(`✓ Kein Pfad länger als ${MAX_LAENGE} Zeichen.`)
}

process.exit(fehler ? 1 : 0)
