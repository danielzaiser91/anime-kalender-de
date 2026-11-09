/**
 * **Eine Kanal-Meldung „kein Deutsch“ nach dem Messdatum startet die Nein-Frist neu** (07.11.2026).
 *
 * Bei einem Kanal-Titel zeigt Amazon die Sprachen des Kanals (`kanal-titel.ts`); die Meldung ist deshalb kein Beleg und
 * `fetch-pruefungen.ts` lässt sie aus oder schreibt sie ohne Urteil. Das Nein im Handbeleg behielt sein altes Datum, die
 * Wiedervorlage („Das Nein vom … ist N Tage alt“, `shared/nein-wiedervorlage.ts`) blieb offen, obwohl jemand gerade nachgesehen
 * hatte (Prime, 07.11.2026: 22 von 116 Wiedervorlagen). Hier trägt das jüngste Nein des Titels bei diesem Anbieter `nachgemessenAm`.
 * Das Feld ist kein Urteil: `checkedAt` und die Kachel-Regel bleiben, nichts wird gelöscht.
 */
import { toIsoDate } from '../../shared/time.ts'
import { juengsteNein, type NeinBeleg } from '../../shared/nein-wiedervorlage.ts'
import { anfaenge, lies } from './nein-datum-erneuern.ts'

/** Der Teil einer Meldung, den die Regel liest. */
export interface NachmessMeldung {
  plattform: string
  befund: string
  notiz: string | null
  gemeldet_am: string
  titel_id?: number | null
}

const schluessel = (id: unknown, plattform: unknown): string => `${id}|${plattform}`

/** Je Titel und Anbieter der jüngste Tag (Berlin) einer Kanal-Meldung „kein Deutsch“. */
export function nachmessungen(meldungen: NachmessMeldung[]): Map<string, string> {
  const raus = new Map<string, string>()
  for (const m of meldungen) {
    if (m.befund !== 'kein_dub' || !/Kanal-Titel/.test(m.notiz ?? '') || !Number.isFinite(m.titel_id)) continue
    const tag = toIsoDate(new Date(m.gemeldet_am))
    const k = schluessel(m.titel_id, m.plattform)
    if (tag > (raus.get(k) ?? '')) raus.set(k, tag)
  }
  return raus
}

const setzeFeld = (block: string[], datum: string): string[] => {
  const zeile = `  nachgemessenAm: '${datum}'`
  const vorhanden = block.findIndex((z) => /^\s+nachgemessenAm:/.test(z))
  if (vorhanden >= 0) return block.map((z, i) => (i === vorhanden ? zeile : z))
  const nach = block.findIndex((z) => /^\s+checkedAt:/.test(z))
  return nach < 0 ? block : [...block.slice(0, nach + 1), zeile, ...block.slice(nach + 1)]
}

/** Trägt die Nachmessung am jüngsten Nein-Beleg ein, sofern sie später liegt als dessen Datum und Nachmessung. */
export function merkeNachmessung(alt: string, meldungen: NachmessMeldung[]): { text: string; gemerkt: number } {
  const tage = nachmessungen(meldungen)
  if (!tage.size) return { text: alt, gemerkt: 0 }
  const text = alt.split('\n')
  const von = anfaenge(text)
  const bloecke = von.map((start, n) => ({ start, ende: von[n + 1] ?? text.length }))
  const gelesen = bloecke.map((b) => lies(text.slice(b.start, b.ende)) as NeinBeleg | null)
  const nein = new Set(juengsteNein(gelesen.filter((b) => b !== null)))
  let gemerkt = 0
  // Von hinten, damit eingefügte Zeilen die Anfänge der übrigen Blöcke nicht verschieben.
  for (let n = bloecke.length - 1; n >= 0; n--) {
    const b = gelesen[n]
    const datum = b && nein.has(b) ? tage.get(schluessel(b.anilistId, b.platform)) : undefined
    const stand = b ? String(b.nachgemessenAm ?? b.checkedAt ?? '').slice(0, 10) : ''
    if (!b || !datum || datum <= stand || datum <= String(b.checkedAt ?? '').slice(0, 10)) continue
    const { start, ende } = bloecke[n]!
    text.splice(start, ende - start, ...setzeFeld(text.slice(start, ende), datum))
    gemerkt++
  }
  return { text: text.join('\n'), gemerkt }
}
