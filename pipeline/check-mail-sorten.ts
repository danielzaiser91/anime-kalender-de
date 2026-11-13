/**
 * Zusicherungen zu `worker/src/mail-sorten.ts`: Rubrik je Termin (TV-Premiere, TV ohne Aussage = weitere Sendungen), Rang innerhalb
 * der Favoriten, Abzeichen und die Reihenfolge der Abschnitte. Läuft in `check:logic`.
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { abzeichen, SORTEN, sorteVon, wichtigkeit } from '../worker/src/mail-sorten.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const ev = (teil: Record<string, unknown>) => ({ platform: 'crunchyroll', releaseType: 'weekly', ...teil }) as unknown as ReleaseEvent

pruefe('TV-Premiere', sorteVon(ev({ platform: 'tv', tvPremiere: true })), 'tv-premiere')
pruefe('TV-Wiederholung', sorteVon(ev({ platform: 'tv', tvPremiere: false })), 'tv-wiederholung')
pruefe('TV ohne Aussage: nicht als Premiere', sorteVon(ev({ platform: 'tv' })), 'tv-wiederholung')
pruefe('Kino', sorteVon(ev({ platform: 'kino', releaseType: 'disc' })), 'kino')
pruefe('Disc über den Termintyp', sorteVon(ev({ platform: 'amazon', releaseType: 'disc' })), 'disc')
pruefe('Disc über die Plattform', sorteVon(ev({ platform: 'disc', releaseType: 'single' })), 'disc')
pruefe('alles andere: Stream', sorteVon(ev({})), 'stream')

pruefe('Finale vor Start', wichtigkeit(ev({ staffelfinale: true, staffelstart: true })), 0)
pruefe('Start', wichtigkeit(ev({ staffelstart: true, platform: 'tv', tvPremiere: true })), 1)
pruefe('TV-Premiere', wichtigkeit(ev({ platform: 'tv', tvPremiere: true })), 2)
pruefe('Premiere-Marke außerhalb des TV zählt nicht', wichtigkeit(ev({ tvPremiere: true })), 3)
pruefe('sonst', wichtigkeit(ev({ platform: 'tv' })), 3)

pruefe('Abzeichen Finale', abzeichen(ev({ staffelfinale: true, staffelstart: true })), 'Finale')
pruefe('Abzeichen Start', abzeichen(ev({ staffelstart: true })), 'Start')
pruefe('Abzeichen TV-Premiere', abzeichen(ev({ platform: 'tv', tvPremiere: true })), 'Premiere')
pruefe('Abzeichen TV-Premiere mit Vorgeschichte', abzeichen(ev({ platform: 'tv', tvPremiere: true, premiereVorher: 'disc' })), 'Premiere*')
pruefe('kein Abzeichen', [abzeichen(ev({})), abzeichen(ev({ platform: 'tv', tvPremiere: false }))], [undefined, undefined])

pruefe('Reihenfolge der Abschnitte; Wiederholungen ohne eigenen Abschnitt hier', SORTEN.map((s) => s.sorte), ['kino', 'stream', 'disc', 'tv-premiere'])
pruefe('Hinweis nur beim Handel', SORTEN.filter((s) => s.hinweis).map((s) => s.sorte), ['disc'])

if (fehler) process.exit(1)
console.log('check-mail-sorten: ok')
