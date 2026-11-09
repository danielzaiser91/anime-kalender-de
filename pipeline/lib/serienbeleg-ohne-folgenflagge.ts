/**
 * Bestandszählung (Entscheidung 09.11.2026): Titel, deren Serien-Synchro belegt ist (`synchroBelegt`, z. B. MyDubList high), ohne dass eine Folge
 * die deutsche Flagge trägt. Keine Folgenflagge aus der Serienmarke zu erfinden gilt; der Folgenbereich sagt es dafür im Text
 * (`serienbeleg-hinweis.ts`). Nur Zahl und Kennungen, kein Rot. Untergrenze der Messung: weniger als 1000 Titel gelesen = Fehler.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { synchroBelegt } from '../../shared/titles.ts'
import type { Title } from '../../shared/types.ts'
import { serienbelegOhneFolgenbeleg } from '../../web/src/components/detail/serienbeleg-hinweis.ts'
import { deutscheBereicheDerWege, folgeIstDeutsch } from '../../web/src/components/detail/stream-bereiche.ts'

export interface FolgenListe { f: [number, string][]; de: [number, number][] }

/** Kennungen der Titel mit Serienbeleg und ohne Folgenflagge; `liste` liefert die Folgendatei oder `undefined`. */
export function serienbelegOhneFlagge(titel: Title[], liste: (id: number) => FolgenListe | undefined): number[] {
  const raus: number[] = []
  for (const t of titel) {
    const d = liste(t.id)
    if (!d) continue
    const wege = deutscheBereicheDerWege(t)
    if (serienbelegOhneFolgenbeleg(synchroBelegt(t), d.f.map(([nr]) => nr), (nr) => folgeIstDeutsch(nr, d.de, wege))) raus.push(t.id)
  }
  return raus
}

/** Druckt die Zahl; gibt 1 zurück, wenn die Prüfung fast nichts gelesen hat. */
export function pruefeSerienbeleg(wurzel: string): number {
  const titel = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'titles.json'), 'utf8')) as Title[]
  if (titel.length < 1000) {
    console.error(`FEHLER: nur ${titel.length} Titel gelesen — die Serienbeleg-Zählung misst nichts`)
    return 1
  }
  const lesen = (id: number): FolgenListe | undefined => {
    const pfad = join(wurzel, 'public', 'data', 'folgen', `${id}.json`)
    return existsSync(pfad) ? (JSON.parse(readFileSync(pfad, 'utf8')) as FolgenListe) : undefined
  }
  const ids = serienbelegOhneFlagge(titel, lesen)
  const kopf = ids.slice(0, 10).join(', ')
  console.log(`  ✓ Serienbeleg ohne Folgenflagge: ${ids.length} Titel (Stand 09.11.2026: 632, davon 95 mit leeren Folgentiteln; keine Folgenflagge aus der Serienmarke, der Folgenbereich nennt es im Text)${ids.length ? `: ${kopf}${ids.length > 10 ? ', …' : ''}` : ''}`)
  return 0
}
