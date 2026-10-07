import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { ROOT } from './util.ts'

/**
 * Bestätigt eine Crunchyroll-Zuordnung an den Folgen: Wie viele Folgentitel unserer Liste stehen (sinngemäß) auch bei einer Staffel der Serie?
 *
 * Staffelname und Folgenzahl (`entferneFremdeNachStaffeln`) sagen nur, dass die Serie passen kann; die Titel je Folge sind der Beleg (Daniel,
 * 07.10.2026: „es muss bestätigt werden … je Episode"). Verglichen wird mit allen Staffeln der Serie zusammen, weil unsere Titel oft eine Staffel
 * einer langen Serie sind. Ein Titel gilt als gleich, wenn von den Wörtern (ab drei Buchstaben, ohne Plattformzusatz) des kürzeren mindestens 60 % im anderen stehen.
 */
const schwelle = 0.6
const normiert = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const woerter = (s: string): Set<string> => new Set(normiert(s).split(' ').filter((w) => w.length > 2 && w !== 'netflix'))

function aehnlich(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n / Math.min(a.size, b.size) >= schwelle
}

/** Anteil (0–1) unserer Folgentitel, die bei der Crunchyroll-Serie vorkommen; `undefined`, wo die Rohdatei fehlt. */
export function crFolgenAnteil(serienKennung: string, unsereTitel: string[]): number | undefined {
  const datei = resolve(ROOT, 'data/crunchyroll-raw', `${serienKennung}.de.json.gz`)
  if (!existsSync(datei) || !unsereTitel.length) return undefined
  const roh = JSON.parse(gunzipSync(readFileSync(datei)).toString()) as { episodes?: Record<string, { items?: { title?: string }[] }> }
  const cr = Object.values(roh.episodes ?? {}).flatMap((s) => (s.items ?? []).map((e) => woerter(e.title ?? '')))
  return unsereTitel.filter((u) => { const w = woerter(u); return cr.some((c) => aehnlich(w, c)) }).length / unsereTitel.length
}

/** Ab diesem Anteil gilt die Zuordnung an den Folgen als bestätigt. */
export const BESTAETIGT_AB = schwelle
