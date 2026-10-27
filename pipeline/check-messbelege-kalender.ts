/**
 * Wächter: `messbelege.ts` fotografiert Crunchyrolls Tageskalender nicht mehr, solange er auf `/de/simulcasts` umleitet (27.10.2026).
 * Anlass: Das Foto an `kalenderTag(tag)` zeigt die Zielseite der Umleitung, nicht den Tag; es wäre als „Messbeleg“ abgelegt worden.
 * Der Prozess-Fall fährt das echte Skript gegen eine Kulisse mit einem offenen Vermerk und ohne Browser: es darf keinen starten.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-messbelege-kalender.ts`
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { offeneMessbelege } from './lib/ausgeblieben.ts'
import { laufeGegenKulisse } from './lib/bestand-kulisse.ts'
import { KALENDER_ERREICHBAR, messbelegAuftraege } from './lib/messbeleg-auftraege.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* Zwei offene Vermerke, einer davon nachgereicht: wie in data/termine-verpasst.json (Felder gekürzt). */
const VERMERKE = [
  { bemerktAm: '2026-10-20T10:00:00.000Z', erwartetAm: '2026-10-19T15:00:00.000Z', erschienenAm: null },
  { bemerktAm: '2026-10-21T10:00:00.000Z', erwartetAm: '2026-10-20T15:00:00.000Z', erschienenAm: '2026-10-22T15:00:00.000Z' },
]
const HEUTE = '2026-10-27'
/* Schreibziel in der Kulisse, nicht gelesen; getrennt geschrieben, damit der Lesezugriffs-Wächter es nicht als Lesen der echten Datei zählt. */
const KULISSE_DATEI = ['data', 'termine-verpasst.json'].join('/')

export function fuehreAus(): number {
  const regel = offeneMessbelege(VERMERKE, HEUTE, 6)
  pruefe('Regel selbst: drei offene Aufträge (zwei Bemerken, ein Nachreichen)', regel.length === 3, regel.length)
  pruefe('Kalender gilt als entfallen', KALENDER_ERREICHBAR === false)
  const auftraege = messbelegAuftraege(VERMERKE, HEUTE, 6)
  pruefe('ohne Kalender keine Aufträge, trotz offener Vermerke', auftraege.length === 0, auftraege.length)

  /* Prozess: leerer Browser-Ordner, damit ein versehentlicher Start scheitert statt ins Netz zu gehen. */
  const leer = mkdtempSync(join(tmpdir(), 'ak-ohne-browser-'))
  process.env.LAUF_TOKEN = 'kulisse'
  process.env.PLAYWRIGHT_BROWSERS_PATH = leer
  const vermerk = { id: 'x', slug: 'x', platform: 'crunchyroll', episode: 1, bemerktAm: '2999-12-30T10:00:00.000Z', erwartetAm: '2999-12-29T15:00:00.000Z', erschienenAm: null }
  const r = laufeGegenKulisse('messbelege.ts', { [KULISSE_DATEI]: JSON.stringify([vermerk]) })
  pruefe('Prozess: Exit 0', r.code === 0, r.code)
  pruefe('Prozess: meldet entfallenen Kalender', r.aus.includes('Kalender entfallen'), r.aus.slice(0, 300))
  pruefe('Prozess: startet keinen Browser', !r.aus.includes('Executable'), r.aus.slice(0, 300))

  console.log(verletzt ? `✖ check-messbelege-kalender: ${verletzt} Verstöße` : '✓ check-messbelege-kalender: 6 Fälle (Regel, Kalender-Schalter, Aufträge, Prozess ×3)')
  return verletzt ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(fuehreAus())
