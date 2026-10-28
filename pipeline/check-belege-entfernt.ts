/**
 * Zusicherung: **Ein entfernter Fehlbeleg kommt über abgeholte Browser-Meldungen nicht zurück** (28.10.2026).
 *
 * Fälle wörtlich aus dem Bestandsbau 151fefb5b: Der Made-in-Abyss-Beleg (97986, B0CWLSM344), den #2257 entfernt hatte,
 * wurde im Block „Aus dem Browser gemeldet“ wieder angehängt; der Heidi-Beleg (2225) an der Disney+-Seite des Cartoons
 * (#2263) hätte denselben Weg. Geprüft wird `haengeBelegeAn` gegen eine Wegwerf-Datei, dazu der Bestand: Kein Eintrag
 * aus `data/belege-entfernt.yaml` steht in `data/dub-confirmed.yaml`. Läuft in `check:logic`.
 */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { haengeBelegeAn } from './lib/belege-anhaengen.ts'
import { istEntfernt, ladeBelegeEntfernt } from './lib/belege-entfernt.ts'
import { ROOT } from './lib/util.ts'

const MIA = [
  '- anilistId: 97986',
  '  title: "Made in Abyss"',
  '  platform: primevideo',
  '  url: https://www.amazon.de/gp/video/detail/B0CWLSM344',
  '  dub: true',
  "  checkedAt: '2026-09-28'",
  '  note: "Tonspuren: Deutsch, Deutsch Dialogue Boost: Medium, Deutsch Dialogue Boost: High — Amazon-Seite B0CWLSM344: alle 6 Folgen geprüft, Abos: keine Angabe, zugang=kauf"',
]
const heidi = (url: string) => [
  '- anilistId: 2225',
  '  title: "Heidi"',
  '  platform: disneyplus',
  `  url: ${url}`,
  '  dub: true',
  "  checkedAt: '2026-10-16'",
  '  note: "Folgen 1–39 mit deutschem Ton — Tonspuren: de, fr-FR"',
]
const DISNEY = 'https://www.disneyplus.com/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd'
const NAGATORO = [
  '- anilistId: 140596',
  '  title: "Don’t Toy with Me, Miss Nagatoro 2nd Attack"',
  '  platform: primevideo',
  '  url: https://www.amazon.de/gp/video/detail/B0CH4TWTLL',
  '  dub: true',
  "  checkedAt: '2026-09-28'",
]
const mitKennung = (block: string[], id: number) => block.map((z, i) => (i === 0 ? `- anilistId: ${id}` : z))
const mitUrl = (block: string[], url: string) => block.map((z) => (z.startsWith('  url: ') ? `  url: ${url}` : z))

const ordner = mkdtempSync(join(tmpdir(), 'belege-entfernt-'))
const eintraege = (zeilen: string[]) => {
  const datei = join(ordner, 'dub-confirmed.yaml')
  copyFileSync(join(ROOT, 'data', 'belege-entfernt.yaml'), join(ordner, 'belege-entfernt.yaml'))
  writeFileSync(datei, '# Kopf\n\n- anilistId: 1\n  url: https://www.netflix.com/title/1\n  dub: true\n')
  const meldungen: string[] = []
  haengeBelegeAn({ datei, zeilen, heute: '2026-10-28', log: (t) => meldungen.push(t), warn: (t) => meldungen.push(t) })
  const alle = (yaml.load(readFileSync(datei, 'utf8')) as { anilistId: number; url: string }[]).slice(1)
  return { alle: alle.map((b) => `${b.anilistId} ${b.url.split('/').pop()}`), meldungen }
}

const fehler: string[] = []
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const n = { faelle: 0 }
const fall = (name: string, zeilen: string[], soll: string[], meldung?: RegExp) => {
  n.faelle++
  const e = eintraege(zeilen)
  erwarte(name, e.alle, soll)
  if (meldung && !e.meldungen.some((m) => meldung.test(m))) fehler.push(`${name}: Meldung fehlt (${e.meldungen.join(' | ')})`)
}

fall('Made in Abyss (97986, B0CWLSM344) bleibt weg', MIA, [], /1 Beleg\(e\) stehen in belege-entfernt\.yaml/)
fall('Heidi bei Disney+ (ohne Segment) bleibt weg', heidi(DISNEY), [], /belege-entfernt/)
fall('Heidi bei Disney+ mit Ländersegment bleibt weg', heidi(DISNEY.replace('.com/', '.com/de-de/')), [])
fall('mehrere Blöcke: nur der entfernte fällt weg', [...MIA, '', ...NAGATORO], ['140596 B0CH4TWTLL'])
fall('Kontrolle: dieselbe Seite an der Folgestaffel (114745) bleibt erlaubt', mitKennung(MIA, 114745), ['114745 B0CWLSM344'])
fall('Kontrolle: dieselbe Kennung an einer anderen Seite bleibt erlaubt', mitUrl(MIA, 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA'), ['97986 B0AAAAAAAA'])
fall('Kontrolle: dieselbe Kennung bei Netflix bleibt erlaubt', mitUrl(MIA, 'https://www.netflix.com/title/80990007'), ['97986 80990007'])
fall('Kontrolle: ein Beleg ohne Eintrag wird angehängt', NAGATORO, ['140596 B0CH4TWTLL'])
fall('Kontrolle: Heidi an einer anderen Disney+-Seite bleibt erlaubt', heidi('https://www.disneyplus.com/browse/entity-00000000-0000-0000-0000-000000000000'), ['2225 entity-00000000-0000-0000-0000-000000000000'])
n.faelle++
erwarte('Dopplung: derselbe Block zweimal ergibt nur einen', eintraege([...NAGATORO, '', ...NAGATORO]).alle, ['140596 B0CH4TWTLL'])

/* Der Bestand: Liste gelesen (nicht leer), und nichts davon steht in den Handbelegen. */
n.faelle++
const liste = ladeBelegeEntfernt(join(ROOT, 'data', 'belege-entfernt.yaml'))
if (liste.length < 2) fehler.push(`data/belege-entfernt.yaml: ${liste.length} Einträge, erwartet mindestens 2 (Heidi, Made in Abyss)`)
const belege = yaml.load(readFileSync(join(ROOT, 'data', 'dub-confirmed.yaml'), 'utf8')) as { anilistId?: number; url?: string }[]
const zurueck = belege.filter((b) => istEntfernt(liste, b.anilistId, b.url)).map((b) => `${b.anilistId} ${b.url}`)
if (zurueck.length) fehler.push(`Entfernte Belege stehen wieder in data/dub-confirmed.yaml: ${zurueck.join('; ')}`)

rmSync(ordner, { recursive: true, force: true })
if (fehler.length) {
  console.error(`check-belege-entfernt: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-belege-entfernt: ${n.faelle} Fälle grün, ${liste.length} entfernte Belege kommen nicht über Browser-Meldungen zurück.`)
