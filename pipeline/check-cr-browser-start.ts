/**
 * Test von `lib/cr-browser-start.ts`: Chromium startet einmal je Lauf, und die erste Anforderung schreibt genau eine Logzeile mit ihrem Grund.
 * Ohne Netz und ohne Browser: der Starter ist eine Attrappe, die nur zählt.
 */
import type { Browser } from 'playwright'
import { browserHolerMit } from './lib/cr-browser-start.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const browser = { close: async () => undefined } as unknown as Browser

console.log('\nBrowserstart')
{
  const zeilen: string[] = []
  let starts = 0
  const starte = async () => {
    starts++
    return browser
  }
  const halter = browserHolerMit(starte, (z) => zeilen.push(z))
  pruefe('vor dem ersten Aufruf läuft kein Browser', halter.aktuell() === undefined)
  const erster = await halter.holen('kein Zugangspaket')
  pruefe('erster Aufruf startet genau einmal', starts === 1, starts)
  pruefe('erster Aufruf schreibt genau eine Zeile mit Grund', zeilen.length === 1 && zeilen[0] === '[cr-dub] Browser gestartet: kein Zugangspaket', zeilen)
  const zweiter = await halter.holen('Adresse ohne Serienkennung')
  pruefe('zweiter Aufruf startet nicht erneut', starts === 1, starts)
  pruefe('zweiter Aufruf schreibt keine zweite Zeile', zeilen.length === 1, zeilen)
  pruefe('zweiter Aufruf gibt denselben Browser', erster === zweiter && halter.aktuell() === erster)
}

console.log('\nFehlerfall')
{
  const zeilen: string[] = []
  let versuche = 0
  const starte = async () => {
    versuche++
    if (versuche === 1) throw new Error('startet nicht')
    return browser
  }
  const halter = browserHolerMit(starte, (z) => zeilen.push(z))
  let fehler = ''
  try {
    await halter.holen('--seitenanzeige')
  } catch (err) {
    fehler = (err as Error).message
  }
  pruefe('ein gescheiterter Start wird weitergereicht', fehler === 'startet nicht', fehler)
  pruefe('ein gescheiterter Start schreibt keine Zeile', zeilen.length === 0, zeilen)
  pruefe('ein gescheiterter Start merkt sich keinen Browser', halter.aktuell() === undefined)
  await halter.holen('--seitenanzeige')
  pruefe(
    'der nächste Aufruf versucht es erneut und schreibt dann genau eine Zeile',
    versuche === 2 && zeilen.length === 1 && zeilen[0] === '[cr-dub] Browser gestartet: --seitenanzeige',
    zeilen,
  )
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
