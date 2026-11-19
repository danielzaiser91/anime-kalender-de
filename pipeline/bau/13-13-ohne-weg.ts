/**
 * **`ohne-weg.json`: Kennung → Grund, warum ein Titel keinen Streaming-Weg hat** (18.11.2026; Regeln: `lib/ohne-weg.ts`).
 * Gelesen werden die fertig geschriebenen Dateien (wie `13-11`/`13-12`): erst dort stehen `streams` und `watchLinks` endgültig,
 * und die Cartoons liegen nicht in der Titel-Zuordnung des Baus. Das Detail-Panel lädt die Datei erst, wenn ein Titel ohne Weg offen ist.
 */
import { log, readJson, warn, writeJson } from '../lib/util.ts'
import { ladeHandbelege } from '../lib/dub-confirmed.ts'
import { baueOhneWeg, OFFEN_HOECHSTENS, zaehleVeralteteBefunde, type OhneWegEingabe } from '../lib/ohne-weg.ts'
import { BEFUND_MAX_TAGE } from '../lib/jw-vertrauen.ts'
import { ladeAndereWerke, ohneAndereWerke } from '../lib/ohne-weg-andere-werke.ts'
import { abgelaufenWarnung, offenUrsachen } from '../lib/ohne-weg-offen.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'
import { ohneWegFehler } from '../lib/pruefung.ts'
import { ohneStreamingWeg } from '../../shared/ohne-weg.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'

const OUT = 'public/data'

/** Zählt je Grund, alphabetisch, für die Logzeile. */
export function zaehleGruende(e: Record<number, { reason: string }>): string {
  const n = new Map<string, number>()
  for (const x of Object.values(e)) n.set(x.reason, (n.get(x.reason) ?? 0) + 1)
  return [...n].sort().map(([g, z]) => `${g} ${z}`).join(', ')
}

/** Die Eingabe der Regeln aus den fertig geschriebenen Dateien; `tools/ohne-weg-gruende.ts` liest genauso, damit Messung und Bau nicht auseinanderlaufen. */
export function ladeOhneWegEingabe(): OhneWegEingabe {
  return {
    titel: [...readJson<Title[]>(`${OUT}/titles.json`, []), ...readJson<Title[]>(`${OUT}/cartoons.json`, [])],
    termine: readJson(`${OUT}/events.json`, []),
    handbelege: ladeHandbelege(),
    justwatch: ohneAndereWerke(readJson('data/justwatch-audio.json', {}), ladeAndereWerke()),
    discAusgaben: readJson('data/disc-ausgaben.json', {}),
    heute: todayIso(),
  }
}

/** `bauer` und `grenze` setzen nur Tests (kaputter Bauer, Grenze 0); im Bau gelten die Vorgaben. */
export function schreibeOhneWeg({ bauer = baueOhneWeg, grenze = OFFEN_HOECHSTENS }: { bauer?: typeof baueOhneWeg; grenze?: number } = {}): void {
  const eingabe = ladeOhneWegEingabe()
  const titel = eingabe.titel
  const eintraege = bauer(eingabe)
  const { fehler, warnungen } = ohneWegFehler(eintraege, titel.filter(ohneStreamingWeg).map((t) => t.id), grenze)
  brichAbBeiWiderspruch(fehler, 'Widerspruch/Widersprüche in ohne-weg.json — Bau abgebrochen.')
  for (const w of warnungen) warn(`⚠ WARNUNG ${w}`)
  const alterung = abgelaufenWarnung(offenUrsachen(eingabe, eintraege))
  if (alterung) warn(`⚠ WARNUNG ${alterung}`)
  writeJson(`${OUT}/ohne-weg.json`, eintraege)
  log(`ohne-weg.json: ${Object.keys(eintraege).length} Titel ohne Streaming-Weg (${zaehleGruende(eintraege)})`)
  log(`ohne-weg.json: ${zaehleVeralteteBefunde(eingabe, eintraege)} Titel mit erschienener Disc bleiben offen, weil ihr JustWatch-Befund älter als ${BEFUND_MAX_TAGE} Tage ist`)
}
