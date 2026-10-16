/**
 * Zusicherung: Ein Handbeleg „deutsch“ stützt sich nicht allein auf JustWatch (16.10.2026, Fruits Basket S1 bei Prime).
 * JustWatch nennt den Ton je Serie; die Staffel ohne Deutsch bekam so ein Ja. Eigene Sichtung oder Messung muss in der Notiz stehen.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-handbeleg-serienton.ts`
 */
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { stuetztSichNurAufJustWatch } from './lib/handbeleg-serienton.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const alt =
  'Crunchyroll-Kanal: ohne Kanal-Abo zeigt Amazon keine deutsche Tonspur; JustWatch (07.09.2026) führt für den Crunchyroll Amazon Channel Ton de — auf Daniels Entscheidung vom 17.09.2026 als Beleg übernommen'
pruefe('Fall Fruits Basket S1: der alte Beleg wird erkannt', stuetztSichNurAufJustWatch({ dub: true, note: alt }))
pruefe('ein Nein mit JustWatch in der Notiz ist kein Serienton-Ja', !stuetztSichNurAufJustWatch({ dub: false, note: alt }))
pruefe(
  'Sichtung durch Daniel mit Datum zählt als eigene Quelle',
  !stuetztSichNurAufJustWatch({ dub: true, note: 'Daniel, 10.10.2026: alle Folgen deutsch; JustWatch nennt keine Tonspur' }),
)
pruefe('Amazon-Tonspuren zählen als eigene Quelle', !stuetztSichNurAufJustWatch({ dub: true, note: 'Tonspuren: Deutsch — JustWatch nennt de' }))
pruefe('Crunchyroll-Schnittstelle zählt als eigene Quelle', !stuetztSichNurAufJustWatch({ dub: true, note: 'Crunchyroll-Schnittstelle (13.10.2026); JustWatch ebenso' }))
pruefe('ohne JustWatch in der Notiz greift die Regel nicht', !stuetztSichNurAufJustWatch({ dub: true, note: 'Seite gesehen' }))

const treffer = loadDubChecks().filter(stuetztSichNurAufJustWatch)
pruefe(
  'kein Handbeleg „deutsch“ stützt sich allein auf JustWatch',
  treffer.length === 0,
  treffer.map((c) => `${c.anilistId} ${c.platform}`),
)

if (verletzt) process.exit(1)
console.log('✓ Handbelege stützen sich nicht allein auf JustWatch.')
