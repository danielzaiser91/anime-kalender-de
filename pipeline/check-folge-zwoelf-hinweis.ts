/**
 * Zusicherung: **eine Notiz am kuratierten Eintrag erreicht den Kasten im Panel** (18.10.2026, Villainess: Crunchyroll
 * kündigt eine Folge 12 an, die Japan nie hatte; der Hinweis steht als `note` in `data/curated/streaming-sommer-2026.yaml`).
 * Weg: `05-releases.ts` reicht `entry.note` an `Release.note` weiter, `kastenNotizVon()` wählt sie für den Kasten.
 * Die Notiz selbst darf entfallen, sobald Crunchyroll Folge 12 geliefert und erklärt hat — sie wird nicht erzwungen.
 * Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type { Release } from '../shared/types.ts'
import { kastenNotizVon } from '../web/src/components/detail/kasten-hinweise.ts'
import { laufeInKulisse } from './lib/kulisse-lauf.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

/** Wie oft `note: entry.note` als Eigenschaft in einem Objektliteral des Quelltexts steht. */
export function notizDurchgereicht(quelltext: string): number {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  let zahl = 0
  const besuche = (n: ts.Node): void => {
    if (ts.isPropertyAssignment(n) && n.name.getText(datei) === 'note' && n.initializer.getText(datei) === 'entry.note') zahl++
    ts.forEachChild(n, besuche)
  }
  besuche(datei)
  return zahl
}

const bau = readFileSync(new URL('./bau/05-releases.ts', import.meta.url), 'utf8')
pruefe('Der Bau reicht entry.note genau einmal an das Release weiter', notizDurchgereicht(bau) === 1, String(notizDurchgereicht(bau)))
pruefe('Ohne Durchreichen erkannt: Eigenschaft entfernt', notizDurchgereicht(bau.replace('note: entry.note,', 'note: undefined,')) === 0)
pruefe('Ohne Durchreichen erkannt: falscher Feldname', notizDurchgereicht(bau.replace('note: entry.note,', 'notiz: entry.note,')) === 0)
pruefe('Zwei Eigenschaften werden beide gezählt', notizDurchgereicht(bau.replace('note: entry.note,', 'note: entry.note, note: entry.note,')) === 2)
pruefe('Ohne Durchreichen erkannt: anderes Feld', notizDurchgereicht(bau.replace('note: entry.note,', 'note: entry.herkunft,')) === 0)

/* Die Notiz eines kuratierten Eintrags ist ein Satz Text: die Bestandsprüfung gegen eigene Kulissen (die Villainess-Zeile der echten Datei ist nicht Teil davon). */
const kuratiert = (zeilen: string) => laufeInKulisse('check-folge-zwoelf-hinweis-bestand.ts', { 'data/curated/kulisse.yaml': `- slug: kulisse-a\n${zeilen}- slug: kulisse-b\n  note: "Ein Satz."\n` })
pruefe('Kulisse: Notiz als Text ist grün', kuratiert('  note: "Folge 12 gab es in Japan nicht."\n').code === 0)
pruefe('Kulisse: Eintrag ohne Notiz ist grün (sie wird nicht verlangt)', kuratiert('').code === 0)
pruefe('Kulisse: Notiz als Objekt ist rot', kuratiert('  note:\n    text: x\n').code === 1)
pruefe('Kulisse: Notiz als Liste ist rot', kuratiert('  note:\n    - eins\n').code === 1)

/* Der Kasten wählt die Notiz des Releases, dessen Termin gilt: Treffer in der Mitte, andere ohne Notiz oder mit anderem Termin. */
const release = (slug: string, tag: string, note?: string) =>
  ({ slug, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: tag }, note }) as unknown as Release
const mitte = [release('a', '2026-08-02'), release('b', '2026-08-09', 'Hinweis'), release('c', '2026-08-16')]
pruefe('Der Kasten zeigt die Notiz des Releases mit Notiz', kastenNotizVon(mitte, '2026-10-18')?.note === 'Hinweis')
pruefe('Ohne Notiz zeigt der Kasten nichts', kastenNotizVon(mitte.map((r) => ({ ...r, note: undefined })), '2026-10-18') === undefined)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Notiz am Termin: Bau reicht sie durch, Kasten zeigt sie')
