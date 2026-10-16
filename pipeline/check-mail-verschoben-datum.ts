/**
 * Newsletter, Block „Verschoben oder ausgeblieben" (16.10.2026): `verpasst.*Am` sind ISO-Zeitpunkte in UTC
 * (`termine-pruefen.ts`), `ev.date` nur ein Tag. Das Datum muss der Berliner Kalendertag sein, in HTML und Text.
 */
import { digestMail } from '../worker/src/templates.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { formatDate } from '../shared/time.ts'
import { readdirSync, readFileSync } from 'node:fs'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

function mailMit(verpasst: Record<string, string>, date = '2026-09-20') {
  const ev = {
    id: 'x1',
    titleId: 1,
    name: 'Testserie',
    date,
    platform: 'crunchyroll',
    type: 'episode',
    episode: 3,
    verpasst,
  } as unknown as ReleaseEvent
  return digestMail([ev], 'daily', 'https://anime-kalender.de/', 'https://x/u', {})
}

/* 00:30 Berlin (Sommerzeit, UTC+2) ist noch der Vortag in UTC: 19.09. 22:30Z = 20.09. 00:30. */
const mail = mailMit({
  erwartetAm: '2026-09-19T22:30:00.000Z',
  erschienenAm: '2026-09-23T22:15:00.000Z',
  geprueftAm: '2026-09-21T08:30:00.000Z',
})
for (const [art, inhalt] of [['HTML', mail.html], ['Text', mail.text]] as const) {
  pruefe(`${art}: kein Zeitstempel-Rest im Datum`, !/\dT\d\d:\d\d/.test(inhalt.replace(/https?:\S+/g, '')), inhalt.slice(0, 200))
  pruefe(`${art}: erwartet = Berliner Tag 20.09.2026 (nicht UTC-Tag 19.09.)`, inhalt.includes('angekündigt für 20.09.2026'))
  pruefe(`${art}: nachgeholt am 24.09.2026 (22:15Z = 00:15 Berlin)`, inhalt.includes('nachgeholt am 24.09.2026'))
}
pruefe('HTML: zuletzt geprüft am 21.09.2026', mail.html.includes('zuletzt geprüft am 21.09.2026'))

/* Ein reiner Tag (Rückfall auf ev.date) bleibt unverändert. */
const nurTag = mailMit({ bemerktAm: '2026-09-21T08:30:00.000Z' })
pruefe('ohne erwartetAm gilt ev.date', nurTag.html.includes('angekündigt für 20.09.2026'))

pruefe("formatDate: ISO-Zeitpunkt 00:30 Berlin", formatDate("2026-09-19T22:30:00.000Z") === "20.09.2026")
pruefe("formatDate: reiner Tag unverändert", formatDate("2026-09-20") === "20.09.2026")

/* Wächter: kein Mail-Baustein zerlegt Datumswerte selbst (split/reverse) — alles läuft über formatDate. */
for (const datei of readdirSync("worker/src").filter((n) => n.endsWith(".ts"))) {
  const q = readFileSync(`worker/src/${datei}`, "utf8")
  pruefe(`${datei}: kein split('-').reverse()`, !/split\('-'\)\s*\.reverse\(\)/.test(q))
}

console.log(fehler ? `\nMail verschoben: ${fehler} Zusicherung(en) verletzt.` : 'Mail verschoben: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
