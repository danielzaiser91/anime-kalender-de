/**
 * Titel, die aus dem Hauptbestand verschwunden sind, weil sie in `ohne-synchro.json` (hinter dem Toggle) stehen,
 * sind verschoben, nicht verloren (PR 2144: Madoka Walpurgisnacht, Rascal Dear Friend, Beerus).
 * Die Delta-Wache zählt sie als begründet und nennt sie namentlich.
 */
import { execFileSync } from 'node:child_process'
import type { Title } from '../../shared/types.ts'
import { anzeigeName } from '../../shared/titles.ts'

type Kurz = Pick<Title, 'id' | 'titleDe' | 'titleEn' | 'titleRomaji'>

/** Anzeigenamen der Titel, die im vorigen Hauptbestand standen, im jetzigen fehlen und in `ohneSynchro` zu finden sind. */
export function verschobeneTitel(vorher: Kurz[], jetzt: Kurz[], ohneSynchro: Kurz[]): string[] {
  const imHaupt = new Set(jetzt.map((t) => t.id))
  const verlagert = new Set(ohneSynchro.map((t) => t.id))
  return vorher.filter((t) => !imHaupt.has(t.id) && verlagert.has(t.id)).map((t) => anzeigeName(t))
}

/**
 * Der Hauptbestand eines Commits (Vorgabe `HEAD`, der Stand, gegen den die Historie-Zeile misst).
 * Ohne Git oder ohne Datei: leer, die Wache erklärt dann nichts.
 */
export function titelAusCommit(wurzel: string, stand = 'HEAD'): Kurz[] {
  try {
    const text = execFileSync('git', ['show', `${stand}:public/data/titles.json`], {
      cwd: wurzel,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const roh = JSON.parse(text) as Kurz[] | Record<string, Kurz>
    return Array.isArray(roh) ? roh : Object.values(roh)
  } catch {
    return []
  }
}
