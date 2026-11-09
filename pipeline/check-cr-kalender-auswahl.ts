/**
 * Zwei Kalendereinträge derselben Crunchyroll-Serienkennung (`german`, verschiedene Namen): `crBySeriesId` im Bau (Phase 04)
 * nimmt den mit dem jüngsten Termin, dann den mit mehr Beobachtungen, bei Gleichstand den zuletzt gelesenen – nicht
 * blind den letzten. Kulisse in einem Wegwerf-Ordner (`AK_ROOT`), kein Netz. Aufruf: `tsx pipeline/check-cr-kalender-auswahl.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ordner = mkdtempSync(join(tmpdir(), 'cr-kalender-auswahl-'))
process.env.AK_ROOT = ordner

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Roh = { rawTitle: string, dates: string[], obs: number }
function kalender(eintraege: Roh[]): object {
  const german: Record<string, object> = {}
  for (const e of eintraege) {
    german[e.rawTitle] = {
      time: '18:00',
      weekday: 5,
      rawTitle: e.rawTitle,
      seriesId: 'KAUSWAHL1',
      dates: e.dates,
      observations: Array.from({ length: e.obs }, (_, i) => ({ date: e.dates[0], episode: i + 1 })),
    }
  }
  return { scrapedAt: '2026-11-08T00:00:00Z', german, slots: [] }
}

const { indiziereCrSendeplaetze } = await import('./bau/04-cr-sendeplaetze.ts')
function gewaehlt(eintraege: Roh[]): string | undefined {
  mkdirSync(join(ordner, 'data'), { recursive: true })
  writeFileSync(join(ordner, 'data', 'crunchyroll.json'), JSON.stringify(kalender(eintraege)))
  return indiziereCrSendeplaetze({ titles: new Map() }).crBySeriesId.get('KAUSWAHL1')?.rawTitle
}

const alt: Roh = { rawTitle: 'alt', dates: ['2026-08-01'], obs: 4 }
const frisch: Roh = { rawTitle: 'frisch', dates: ['2026-09-12'], obs: 1 }
pruefe('jüngster Termin gewinnt, steht er vorn', gewaehlt([frisch, alt]) === 'frisch')
pruefe('jüngster Termin gewinnt, steht er hinten', gewaehlt([alt, frisch]) === 'frisch')
const wenig: Roh = { rawTitle: 'wenig', dates: ['2026-09-12'], obs: 1 }
const viel: Roh = { rawTitle: 'viel', dates: ['2026-09-12'], obs: 3 }
pruefe('gleicher Termin: mehr Beobachtungen gewinnen, stehen sie vorn', gewaehlt([viel, wenig]) === 'viel')
pruefe('gleicher Termin: mehr Beobachtungen gewinnen, stehen sie hinten', gewaehlt([wenig, viel]) === 'viel')
const zwilling: Roh = { rawTitle: 'zwilling', dates: ['2026-09-12'], obs: 1 }
pruefe('Gleichstand: der zuletzt gelesene gewinnt', gewaehlt([wenig, zwilling]) === 'zwilling')
pruefe('Einzeleintrag bleibt', gewaehlt([alt]) === 'alt')
const drei = gewaehlt([{ rawTitle: 'a', dates: ['2026-08-01'], obs: 5 }, frisch, { rawTitle: 'c', dates: ['2026-07-01'], obs: 9 }])
pruefe('drei Einträge, der mittlere ist der jüngste', drei === 'frisch', drei)
const lang: Roh = { rawTitle: 'lang', dates: ['2026-10-01', '2026-08-01'], obs: 1 }
pruefe('mehrere Termine: der jüngste zählt, nicht der erste', gewaehlt([lang, frisch]) === 'lang')

rmSync(ordner, { recursive: true, force: true })
if (verletzt) {
  console.error(`FEHL check-cr-kalender-auswahl: ${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('check-cr-kalender-auswahl: 8 Prüfungen ok.')
