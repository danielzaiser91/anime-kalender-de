/**
 * Zusicherungen zu `baueWarteschlange()` aus `lib/anisearch-warteschlange.ts`: nur Titel mit Kennung in der ID-Brücke; geholt wird, was
 * fehlt, ohne `info`, veraltet oder ohne Archivdatei ist (oder alles mit `force`); Neues vor Auffrischung, darin Titel mit Termin zuerst,
 * sonst stabile Reihenfolge; `limit` schneidet danach. Die Archivdateien liegen in einem Temp-Ordner (Arbeitsordner wird gewechselt,
 * der Pfad im Modul ist relativ). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import { ARCHIV_DIR, baueWarteschlange } from './lib/anisearch-warteschlange.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const vorher = process.cwd()
const ordner = mkdtempSync(join(tmpdir(), 'ak-anisearch-warteschlange-'))
process.chdir(ordner)
try {
  mkdirSync(ARCHIV_DIR, { recursive: true })
  const archiv = (anisearchId: number) => writeFileSync(`${ARCHIV_DIR}/${anisearchId}.html.gz`, '')

  const titel = (id: number) => ({ id }) as Title
  const termin = (titleId: number) => ({ titleId }) as Release
  const frisch = { info: {}, fetchedAt: 'frisch' }
  const alt = { info: {}, fetchedAt: 'alt' }
  const veraltet = (e: { fetchedAt?: string }) => e.fetchedAt === 'alt'
  const basis = { ids: {} as Record<number, number>, titles: [] as Title[], releases: [] as Release[], cache: {}, force: false, limit: 100, veraltet }
  const ids = (q: Title[]) => q.map((t) => t.id)

  pruefe('leere Eingabe', baueWarteschlange(basis), [])

  // Ohne Kennung in der Brücke nie, auch nicht mit force; Kennung 0 zählt als fehlend.
  pruefe('nur Titel mit Kennung', ids(baueWarteschlange({ ...basis, ids: { 1: 501, 3: 0 }, titles: [titel(1), titel(2), titel(3)], force: true })), [1])

  // Gründe zum Holen, je einzeln; Titel 9 hat nichts davon und bleibt draußen.
  archiv(501)
  archiv(502)
  archiv(503)
  archiv(509)
  const fall = {
    ...basis,
    ids: { 1: 501, 2: 502, 3: 503, 4: 504, 9: 509 },
    titles: [titel(9), titel(1), titel(2), titel(3), titel(4)],
    cache: { 1: { fetchedAt: 'frisch' }, 2: alt, 4: frisch, 9: frisch },
  }
  // 3 fehlt im Cache (neu, vorn), dann 1 (ohne info), 2 (veraltet), 4 (Archivdatei fehlt) in Eingangsreihenfolge.
  pruefe('Gründe: neu, ohne info, veraltet, ohne Archiv', ids(baueWarteschlange(fall)), [3, 1, 2, 4])
  pruefe('force holt alles mit Kennung', ids(baueWarteschlange({ ...fall, force: true })), [3, 9, 1, 2, 4])
  pruefe('Archivdatei der aniSearch-Kennung, nicht der Titel-Id', ids(baueWarteschlange({ ...fall, ids: { ...fall.ids, 4: 501 } })), [3, 1, 2])
  pruefe('veraltet bekommt den Cache-Eintrag', ids(baueWarteschlange({ ...fall, veraltet: (e) => e === fall.cache[9] })), [3, 9, 1, 4])

  // Reihenfolge: neu vor Auffrischung, darin Termin zuerst; Termin hebt keinen Auffrischer über einen Neuen.
  const ordnung = {
    ...basis,
    ids: { 1: 601, 2: 602, 3: 603, 4: 604, 5: 605 },
    titles: [titel(1), titel(2), titel(3), titel(4), titel(5)],
    cache: { 1: alt, 2: alt, 5: alt },
    releases: [termin(2), termin(4), termin(2), termin(99)],
  }
  pruefe('neu vor alt, darin Termin zuerst', ids(baueWarteschlange(ordnung)), [4, 3, 2, 1, 5])
  pruefe('limit schneidet nach dem Sortieren', ids(baueWarteschlange({ ...ordnung, limit: 2 })), [4, 3])
  pruefe('limit 0', ids(baueWarteschlange({ ...ordnung, limit: 0 })), [])

  // Die Eingabeliste bleibt unverändert (filter kopiert vor dem Sortieren).
  const eingang = [titel(2), titel(1)]
  baueWarteschlange({ ...ordnung, titles: eingang })
  pruefe('Eingabe unverändert', ids(eingang), [2, 1])
} finally {
  process.chdir(vorher)
  rmSync(ordner, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-anisearch-warteschlange: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-anisearch-warteschlange: ok')
