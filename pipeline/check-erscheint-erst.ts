/**
 * Zusicherungen zu `erscheintErst` (shared/logic.ts): Wann trägt ein Titel das Label „Geplant"? Läuft in `check:logic`.
 * Anlass: Reihenliste „Yaiba", 10.10.2026 — Teil mit Original in der Zukunft zeigte gar nichts.
 */
import { erscheintErst } from '../shared/logic.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

const heute = '2026-10-10'
pruefe('volles Datum in der Zukunft: geplant (Shin Samurai-den YAIBA 2)', erscheintErst({ jpStart: '2027-01-09', jpStatus: 'NOT_YET_RELEASED', jpYear: 2027 }, heute))
pruefe('volles Datum heute oder früher: nicht geplant, auch bei veraltetem Status', !erscheintErst({ jpStart: '2026-10-10', jpStatus: 'NOT_YET_RELEASED' }, heute) && !erscheintErst({ jpStart: '2025-04-05', jpYear: 2025 }, heute))
pruefe('ohne Datum entscheidet der Status', erscheintErst({ jpStatus: 'NOT_YET_RELEASED' }, heute) && !erscheintErst({ jpStatus: 'FINISHED', jpYear: 2030 }, heute))
pruefe('Jahr allein: nur strikt später als dieses Jahr', erscheintErst({ jpYear: 2027 }, heute) && !erscheintErst({ jpYear: 2026 }, heute) && !erscheintErst({ jpYear: 1993 }, heute))
pruefe('Monat: erst ab dem Folgemonat', erscheintErst({ jpStart: '2026-12' }, heute) && !erscheintErst({ jpStart: '2026-10' }, heute))
pruefe('ohne jede Angabe: nicht geplant', !erscheintErst({}, heute))

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'erscheintErst: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
