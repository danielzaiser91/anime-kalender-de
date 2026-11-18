/**
 * **`ohne-weg.json`: Kennung → Grund, warum ein Titel keinen Streaming-Weg hat** (18.11.2026; Regeln: `lib/ohne-weg.ts`).
 * Gelesen werden die fertig geschriebenen Dateien (wie `13-11`/`13-12`): erst dort stehen `streams` und `watchLinks` endgültig,
 * und die Cartoons liegen nicht in der Titel-Zuordnung des Baus. Das Detail-Panel lädt die Datei erst, wenn ein Titel ohne Weg offen ist.
 */
import { log, readJson, warn, writeJson } from '../lib/util.ts'
import { ladeHandbelege } from '../lib/dub-confirmed.ts'
import { baueOhneWeg, OFFEN_HOECHSTENS, type OhneWegEingabe } from '../lib/ohne-weg.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'
import { ohneWegFehler } from '../lib/pruefung.ts'
import { ohneStreamingWeg } from '../../shared/ohne-weg.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'

const OUT = 'public/data'

/** Zählt je Grund, für die Logzeile. */
function zaehleGruende(e: Record<number, { reason: string }>): string {
  const n = new Map<string, number>()
  for (const x of Object.values(e)) n.set(x.reason, (n.get(x.reason) ?? 0) + 1)
  return [...n].map(([g, z]) => `${g} ${z}`).join(', ')
}

export function schreibeOhneWeg(): void {
  const titel = [...readJson<Title[]>(`${OUT}/titles.json`, []), ...readJson<Title[]>(`${OUT}/cartoons.json`, [])]
  const eingabe: OhneWegEingabe = {
    titel,
    termine: readJson(`${OUT}/events.json`, []),
    handbelege: ladeHandbelege(),
    justwatch: readJson('data/justwatch-audio.json', {}),
    heute: todayIso(),
  }
  const eintraege = baueOhneWeg(eingabe)
  const { fehler, warnungen } = ohneWegFehler(eintraege, titel.filter(ohneStreamingWeg).map((t) => t.id), OFFEN_HOECHSTENS)
  brichAbBeiWiderspruch(fehler, 'Widerspruch/Widersprüche in ohne-weg.json — Bau abgebrochen.')
  for (const w of warnungen) warn(`⚠ WARNUNG ${w}`)
  writeJson(`${OUT}/ohne-weg.json`, eintraege)
  log(`ohne-weg.json: ${Object.keys(eintraege).length} Titel ohne Streaming-Weg (${zaehleGruende(eintraege)})`)
}
