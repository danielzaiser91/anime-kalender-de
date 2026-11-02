/**
 * Zusicherung: **der Import fragt den Folgentitel vor der Zählung** (Jujutsu Kaisen, 18.09.2026: Netflix meldet „S1 F26",
 * gemeint ist Staffel 2, Folge 2). Lauf von `verteileMeldungen` gegen eine Kulisse (`AK_ROOT`) mit aniSearch-Folgentiteln —
 * ersetzt die Quelltext-Zusicherung auf die Reihenfolge der Aufrufe in `check-logic.ts`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'verteile-titel-'))
process.env.AK_ROOT = wurzel
const fehler: string[] = []
let faelle = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  faelle++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

const NOTIZ = 'Folge 26: Der versteckte Schatz, Teil 2 — Tonspuren: de'
const folgen = {
  '11': { folgen: [{ nr: 1, de: 'Ryomen Sukuna' }] },
  '22': { folgen: [{ nr: 1, de: 'Der versteckte Schatz' }, { nr: 2, de: 'Der versteckte Schatz, Teil 2' }] },
}

try {
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'anisearch.json'), JSON.stringify({ '1': { anisearchId: 11 }, '2': { anisearchId: 22 } }))
  writeFileSync(join(wurzel, 'data', 'anisearch-folgen.json'), JSON.stringify(folgen))
  const { verteileMeldungen } = await import('./lib/meldungen-verteilen.ts')
  /* Die Zählung allein (Anbieter zählt durch, 54 Folgen) legte Folge 26 in Staffel 1; der Titel sagt Staffel 2, Folge 2. */
  const staffeln = [{ id: 1, titel: 'Staffel 1', folgen: 30 }, { id: 2, titel: 'Staffel 2', folgen: 24 }]
  const anbieter = [{ seq: 1, name: 'Staffel 1', folgen: 54, erste: 1 }]
  const verteile = (plattform: string, notiz: string | null) =>
    verteileMeldungen([{ befund: 'dub', folge_nr: 26, notiz, plattform, staffel: 1 }], anbieter, staffeln)
  const zeile = (v: ReturnType<typeof verteile>) => ({ staffeln: [...v.jeStaffel], ueber: v.ueberFolgentitel })

  erwarte('Netflix mit Folgentitel: der Titel entscheidet (Staffel 2, Folge 2)', zeile(verteile('netflix', NOTIZ)), {
    staffeln: [[2, [{ folge: 2, dub: true }]]],
    ueber: 1,
  })
  erwarte('Netflix ohne Treffer im Titel: die Zählung gilt (Staffel 1, Folge 26)', zeile(verteile('netflix', 'Folge 26: Unbekannt')), {
    staffeln: [[1, [{ folge: 26, dub: true }]]],
    ueber: 0,
  })
  erwarte('andere Anbieter fragen den Folgentitel nicht', zeile(verteile('primevideo', NOTIZ)), {
    staffeln: [[1, [{ folge: 26, dub: true }]]],
    ueber: 0,
  })
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`FEHL check-verteile-folgentitel:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-verteile-folgentitel: ${faelle} Fälle ok.`)
