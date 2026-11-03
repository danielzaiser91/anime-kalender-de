/**
 * Wächter: eine Wiederholmeldung eines Belegs mit `sonderfolgen` wird nicht noch einmal angehängt (31.10.2026).
 *
 * Anlass: Higurashi Kai, Amazon B09KX2VLPR. Der Handbeleg trägt `sonderfolgen: [25]` (Bonusfolge), die Erweiterung
 * misst Folge 25 ohne dieses Feld; `belegSchluessel` sah zwei verschiedene Belege, der Bau zählte „bis Folge 25 bei 24“
 * und stellte 30 Meldungen jeden Bau wieder zurück.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { haengeBelegeAn } from './lib/belege-anhaengen.ts'
import { belegSchluessel, neueBelegBloecke } from './lib/dub-confirmed.ts'

const fehler: string[] = []
let faelle = 0
function pruefe(name: string, ok: boolean, info?: unknown): void {
  faelle++
  if (ok) console.log(`✓ ${name}`)
  else {
    fehler.push(name)
    console.log(`✖ ${name}`, info ?? '')
  }
}

const alt = [
  '- anilistId: 900001',
  '  platform: primevideo',
  '  url: https://www.amazon.de/dp/B09KX2VLPR',
  '  dub: false',
  '  dubRanges:',
  '    - from: 1',
  '      to: 25',
  '      dub: false',
  '      checked: [1, 25]',
  '  sonderfolgen: [25]',
  "  checkedAt: '2026-10-13'",
  '',
].join('\n')

const messung = (bis: number, datum: string, extra: string[] = []): string[] => [
  '- anilistId: 900001',
  '  platform: primevideo',
  '  url: https://www.amazon.de/dp/B09KX2VLPR',
  '  dub: false',
  '  dubRanges:',
  '    - from: 1',
  `      to: ${bis}`,
  '      dub: false',
  `      checked: [1, ${bis}]`,
  ...extra,
  `  checkedAt: '${datum}'`,
]

const wieder = neueBelegBloecke(alt, messung(25, '2026-10-31')).neu
pruefe('Wiederholmeldung ohne sonderfolgen wird nicht angehängt', wieder.length === 0, wieder)

const echteNeue = neueBelegBloecke(alt, messung(24, '2026-10-31')).neu
pruefe('echte neue Messung (andere Spanne) wird angehängt', echteNeue.length === 1, echteNeue)

const anderesFeld = neueBelegBloecke(alt, messung(25, '2026-10-31', ['  teilBereich:', '    von: 1', '    bis: 12'])).neu
pruefe('anderes Zusatzfeld (teilBereich) bleibt ein Unterschied', anderesFeld.length === 1, anderesFeld)

const a = yaml.load(alt) as unknown[]
const b = yaml.load(messung(25, '2026-10-31').join('\n')) as unknown[]
pruefe('Schlüssel gleich trotz sonderfolgen und checkedAt', belegSchluessel(a[0]) === belegSchluessel(b[0]))

/*
  Der echte Fall (02.11.2026, Lauf 41507431955): Higurashi Kai B09KX2VLPR. Der Handbeleg vom 13.10. kennt den Adresshinweis
  „laut Adresse Staffel 2“ in der Notiz nicht, die Meldungen vom 31.10. (25035–25059) tragen ihn. Die Notiz allein machte den
  Beleg zu einem neuen, der ohne `sonderfolgen` „bis Folge 25 bei 24“ zählte; die 2552-Fälle oben hatten keine Notiz.
*/
const liste = yaml.load(readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')) as Record<string, unknown>[]
const echt = liste.find((x) => x.anilistId === 1889 && String(x.url).endsWith('/B09KX2VLPR'))!
const HINWEIS = ', laut Adresse Staffel 2'
const mitHinweis = (note: string) => note.replace(', zugang=abo_und_kauf', `${HINWEIS}, zugang=abo_und_kauf`)
const meldung = (aenderung: Record<string, unknown>): string[] => {
  const eintrag: Record<string, unknown> = { ...echt, checkedAt: '2026-10-31', note: mitHinweis(String(echt.note)), ...aenderung }
  delete eintrag.sonderfolgen
  return yaml.dump([eintrag]).trimEnd().split('\n')
}
const altText = yaml.dump([echt])

pruefe('echter Beleg: seine Notiz kennt den Adresshinweis nicht (Voraussetzung)', !String(echt.note).includes('laut Adresse'))
pruefe('echter Beleg: die Meldung mit Adresshinweis hängt ihn nicht erneut an', neueBelegBloecke(altText, meldung({})).neu.length === 0)
pruefe('anderer Staffelnummer-Hinweis: ebenso kein neuer Beleg', neueBelegBloecke(altText, meldung({ note: String(echt.note).replace(', zugang=abo_und_kauf', ', laut Adresse Staffel 3, zugang=abo_und_kauf') })).neu.length === 0)
pruefe('andere Tonspuren in der Notiz bleiben ein neuer Beleg', neueBelegBloecke(altText, meldung({ note: mitHinweis(String(echt.note)).replace('Tonspuren: 日本語', 'Tonspuren: Deutsch, 日本語') })).neu.length === 1)
pruefe('andere Adresse mit Adresshinweis bleibt ein neuer Beleg', neueBelegBloecke(altText, meldung({ url: 'https://www.amazon.de/gp/video/detail/B0CBKJKYM4' })).neu.length === 1)

/* Über den Schreibweg: die Datei bleibt Byte für Byte gleich, wenn nur der Hinweis neu ist. */
const ordner = mkdtempSync(join(tmpdir(), 'sonderfolgen-'))
const datei = join(ordner, 'dub-confirmed.yaml')
writeFileSync(datei, altText)
const meldungen: string[] = []
haengeBelegeAn({ datei, zeilen: meldung({}), heute: '2026-11-02', log: (t) => meldungen.push(t), warn: (t) => meldungen.push(t) })
pruefe('Schreibweg: Wiederholmeldung lässt die Datei unverändert', readFileSync(datei, 'utf8') === altText, meldungen)
rmSync(ordner, { recursive: true, force: true })

console.log(`check-beleg-sonderfolgen: ${fehler.length ? fehler.length + ' rot' : `${faelle} Fälle grün`}`)
process.exit(fehler.length ? 1 : 0)
