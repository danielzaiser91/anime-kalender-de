/**
 * Warnung (kein Fehler, Exit 0): Eine Notiz an einem Termin nennt eine andere Fassung als die deutsche.
 *
 * Wir verfolgen nur die deutsche Fassung (Daniel, 13.10.2026: „englisch interessiert nicht“); Originalton,
 * Untertitel und fremde Tonspuren in `note` sind unnötig, wo ein Abzeichen oder die Überschrift die Fassung schon nennt.
 * Termine mit `sprache: omu` / `offen` dürfen sie nennen: dort ist die Fassung die Auskunft. Regel: docs/wissen/datensatz.md,
 * „Notizen am Termin“. Aufruf: `npm run check:logic`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const ANDERE_FASSUNG = /Originalton|Originalfassung|im Original|Untertitel|\bOmU\b|\bUT\b|englisch|japanisch/i

/** Wahr, wenn der Notiztext eine andere Fassung als die deutsche nennt. */
export function nenntAndereFassung(note: string): boolean {
  return ANDERE_FASSUNG.test(note)
}

type Eintrag = { slug?: string; note?: string; sprache?: string }

const proben: Array<[string, boolean]> = [
  ['Deutsche Synchronisation und englischer Originalton mit Untertiteln; zuerst drei Folgen.', true],
  ['Folgen 25–30, deutsche und japanische Tonspur.', true],
  ['Folge 1 von 12, allein vorab veröffentlicht: 47 Minuten Laufzeit.', false],
  ['Geschnitten wie bei TOGGO.', false],
]
for (const [text, erwartet] of proben) {
  if (nenntAndereFassung(text) !== erwartet) {
    console.error(`  ✖ Probe: „${text}“ sollte ${erwartet ? 'warnen' : 'nicht warnen'}`)
    process.exit(1)
  }
}

const ordner = new URL('../data/curated/', import.meta.url)
let warnungen = 0
for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.yaml'))) {
  const liste = yaml.load(readFileSync(new URL(datei, ordner), 'utf8'))
  if (!Array.isArray(liste)) continue
  for (const e of liste as Eintrag[]) {
    if (!e.note || e.sprache === 'omu' || e.sprache === 'offen' || !nenntAndereFassung(e.note)) continue
    warnungen++
    console.warn(`  ⚠ ${datei} ${e.slug}: Notiz nennt eine andere Fassung als die deutsche — streichen, wenn sie nichts Eigenes belegt: „${e.note.slice(0, 90)}“`)
  }
}
console.log(warnungen ? `${warnungen} Warnung(en), kein Fehler.` : '  ✓ keine Notiz nennt eine andere Fassung')
