/**
 * Bestandsprüfung zur Folgentitel-Lücke (Daniel, 01.11.2026, Beyblade X ab Folge 66), aufgerufen von `check-folgentitel-sprache-bestand.ts` (Tor `check:bestand`):
 * Die Zahl der Folgen im deutschen Bereich ohne Titel darf je Titel nur sinken (`data/folgentitel-offen.json`, Auswertung in `folgentitel-luecke.ts`),
 * und kein RTL+-Titel mit belegter Zählung fehlt in der Folgendatei. Beides ist **nur eine Warnung** (`⚠ WARNUNG`-Zeile, Exit 0): Rot stoppt den ganzen
 * Bestandsbau, und eine neue Folge ohne Quelle ist kein kaputter Eingang. Fehler nur bei fehlender Liste und wenn die Prüfung fast nichts liest.
 * Test: `check-folgentitel-luecke.ts`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { rtlplusFolgentitel, type RtlplusEintrag } from '../bau/folgentitel-rtlplus.ts'
import { bewerteLuecken, leereImDeutschen, summe, type FolgenDatei, type OffenListe } from './folgentitel-luecke.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T
const kennungen = (liste: string[]): string => `${liste.slice(0, 10).join(', ')}${liste.length > 10 ? ', …' : ''}`

/** RTL+-Nummern mit Titel, die die Folgendatei als leere Zeile führt, obwohl die vorhandenen Titel die Zählung belegen. */
export function rtlplusFehlt(datei: FolgenDatei, rtl: RtlplusEintrag | undefined): number[] {
  const vorhanden = new Map(datei.f.filter(([, t]) => t).map(([nr, t]) => [nr, t] as const))
  const aus = rtlplusFolgentitel(vorhanden, rtl)
  const leer = new Set(datei.f.filter(([, t]) => !t).map(([nr]) => nr))
  return [...(aus?.keys() ?? [])].filter((nr) => leer.has(nr))
}

/** Gibt die Zahl der Fehler zurück (0 oder 1); Warnungen zählen nicht. */
export function pruefeLuecken(wurzel: string): number {
  const listePfad = join(wurzel, 'data', 'folgentitel-offen.json')
  if (!existsSync(listePfad)) {
    console.error('FEHLER: Lückenliste folgentitel-offen.json fehlt')
    return 1
  }
  const soll = lies<OffenListe>(listePfad)
  const rtl = lies<{ titel?: Record<string, RtlplusEintrag> }>(join(wurzel, 'data', 'rtlplus-folgen.json')).titel ?? {}
  const ordner = join(wurzel, 'public', 'data', 'folgen')
  const dateien = readdirSync(ordner).filter((f) => /^\d+\.json$/.test(f))
  if (dateien.length < 1000) {
    console.error(`FEHLER: nur ${dateien.length} Folgenlisten gelesen — die Lückenprüfung misst nichts`)
    return 1
  }
  const ist: Record<string, number> = {}
  const rtlFehlt: string[] = []
  for (const datei of dateien) {
    const id = datei.slice(0, -5)
    const d = lies<FolgenDatei>(join(ordner, datei))
    const leer = leereImDeutschen(d).length
    if (leer) ist[id] = leer
    if (rtlplusFehlt(d, rtl[id]).length) rtlFehlt.push(id)
  }
  const b = bewerteLuecken(ist, soll)
  if (rtlFehlt.length) console.log(`  ⚠ WARNUNG Folgentitel: ${rtlFehlt.length} Titel mit RTL+-Titeln, die in der Folgendatei fehlen: ${kennungen(rtlFehlt)}`)
  if (b.mehr.length) console.log(`  ⚠ WARNUNG Folgentitel: ${b.mehr.length} Titel mit mehr Lücken als in folgentitel-offen.json (Quelle suchen, sonst Zeile eintragen): ${kennungen(b.mehr)}`)
  if (b.weniger.length) console.log(`  ⚠ WARNUNG Folgentitel: ${b.weniger.length} Titel mit weniger Lücken als gelistet (Zeile in folgentitel-offen.json kürzen oder streichen): ${kennungen(b.weniger)}`)
  if (!rtlFehlt.length && !b.mehr.length && !b.weniger.length) console.log(`  ✓ Folgentitel: ${summe(ist)} Folgen ohne deutschen Titel in ${Object.keys(ist).length} Titeln, so viele wie gelistet`)
  return 0
}
