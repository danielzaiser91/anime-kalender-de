/**
 * Prüft den gemeinsamen Kern der `*_HOECHSTENS`-Ratschen (`lib/hoechstens-ratsche.ts`): an der Grenze grün, eins darüber rot,
 * Warnzeilen für neue und weggefallene Kennungen und für einen Bestand unter der Grenze; Werte fest eingetragen. Läuft in `check:logic`.
 */
import { ratschenWarnzeilen, ueberHoechstens } from './lib/hoechstens-ratsche.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

pruefe('genau an der Grenze nicht darüber', !ueberHoechstens(27, 27))
pruefe('eins darüber ist darüber', ueberHoechstens(28, 27))
pruefe('eins darunter nicht darüber', !ueberHoechstens(26, 27))
pruefe('Grenze 0 mit einem Treffer ist darüber', ueberHoechstens(1, 0))
pruefe('Grenze 0 ohne Treffer nicht darüber', !ueberHoechstens(0, 0))

const ids = [10, 20, 30]
pruefe('Warnung: Bestand an der Grenze, ohne Optionen keine Zeile', ratschenWarnzeilen('X', ids, 3).length === 0)
const unter = ratschenWarnzeilen('X', ids, 4)
pruefe('Warnung: eins unter der Grenze nennt Bestand, Grenze und neue Grenze', unter.length === 1 && unter[0] === '  ⚠ WARNUNG X: Bestand 3 liegt unter der Grenze 4, Grenze auf 3 nachziehen', unter)
pruefe('Warnung: Luft 2, Bestand + Luft = Grenze keine Zeile', ratschenWarnzeilen('X', ids, 5, { luft: 2 }).length === 0)
const mitLuft = ratschenWarnzeilen('X', ids, 6, { luft: 2 })
pruefe('Warnung: Luft 2, eins darunter, neue Grenze = Bestand + Luft', mitLuft.length === 1 && mitLuft[0]!.endsWith('Grenze auf 5 nachziehen'), mitLuft)
pruefe('Warnung: leerer Bestand unter Grenze', ratschenWarnzeilen('X', [], 1).length === 1)

pruefe('Bekannte gleich: keine Zeile', ratschenWarnzeilen('X', ids, 3, { bekannt: [30, 10, 20] }).length === 0)
const neu = ratschenWarnzeilen('X', ids, 3, { bekannt: [10, 20] })
pruefe('Bekannte: neue Kennung namentlich, genau eine Zeile', neu.length === 1 && neu[0] === '  ⚠ WARNUNG X: 1 Kennungen nicht in der bekannten Liste: 30', neu)
const weg = ratschenWarnzeilen('X', [10, 20], 2, { bekannt: [10, 20, 99] })
pruefe('Bekannte: weggefallene Kennung namentlich, genau eine Zeile', weg.length === 1 && weg[0] === '  ⚠ WARNUNG X: 1 bekannte Kennungen sind weg, aus der Liste streichen: 99', weg)
const beides = ratschenWarnzeilen('X', ['a', 'b'], 1, { bekannt: ['b', 'c'] })
pruefe('Bekannte: Text-Kennungen, neu vor weg', beides.length === 2 && beides[0]!.includes('nicht in der bekannten Liste: a') && beides[1]!.includes('streichen: c'), beides)
const alles = ratschenWarnzeilen('X', [1], 5, { bekannt: [2] })
pruefe('Bekannte und Bestand unter Grenze: drei Zeilen', alles.length === 3, alles)

if (fehler) {
  console.error(`[hoechstens-ratsche] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[hoechstens-ratsche] ${faelle} Fälle grün (Grenze, eins darüber/darunter, Luft, neue und weggefallene Kennungen)`)
