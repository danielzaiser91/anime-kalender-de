/**
 * Zusicherung (Wochenprogramm am Sendetag, 15.10.2026): Die Ankündigung bleibt am Termin, bis der Sendetag vorbei ist.
 * Tomb Raider King F12 stand für den 14.10. um 19:20 im Wochenprogramm; der Lauf um 00:06 am 14.10. verwarf die Zeile
 * („Datum nach heute"), der Termin fiel auf `estimated` zurück, und die Prüfung kannte die Ankündigung nicht mehr.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-wochenprogramm-sendetag.ts`
 */
import { readFileSync } from 'node:fs'
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { wocheAnhaengen, type CrunchyrollEntry } from './lib/crunchyroll.ts'
import { terminPruefen } from './lib/ausgeblieben.ts'
import { entscheiden, type WochenEintrag } from './scrape-crunchyroll-woche.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const SERIE = 'GT00378123'
const zeile: WochenEintrag = { seriesId: SERIE, titel: 'Tomb Raider King', sprache: 'de', von: 12, bis: 12, datum: '2026-10-14', zeit: '19:20', abweichend: false }
const kalender = () => ({
  'tomb raider king': {
    time: '19:25',
    weekday: 2,
    rawTitle: '',
    seriesId: SERIE,
    dates: ['2026-09-30', '2026-10-07'],
    observations: [{ episode: 10, date: '2026-09-30' }, { episode: 11, date: '2026-10-07' }],
  },
}) as Record<string, CrunchyrollEntry>

/** Der Plan, wie der Bau ihn aus den Beobachtungen des Kalenders (samt angehängtem Wochenprogramm) ableitet. */
function folge12(lauf: string): { estimated?: boolean } | undefined {
  const k = kalender()
  const r = entscheiden([zeile], k, lauf)
  wocheAnhaengen(k, r.uebernommen)
  const observed = Object.fromEntries((k['tomb raider king']!.observations ?? []).map((o) => [o.episode!, o.date]))
  const release = { slug: 'tomb-raider-king', titleId: 1, name: 'Tomb Raider King', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-29', episodeCount: 12, time: '19:25', observed } } as unknown as Release
  return expandEvents(release).find((e) => e.episode === 12)
}

console.log('\nWochenprogramm am Sendetag:')
{
  const k = kalender()
  pruefe('Lauf am Vortag (13.10.): F12 wird übernommen', entscheiden([zeile], k, '2026-10-13').uebernommen.some((f) => f.episode === 12 && f.date === '2026-10-14'))
  pruefe('Lauf am Sendetag (14.10. 00:06): F12 wird übernommen', entscheiden([zeile], k, '2026-10-14').uebernommen.some((f) => f.episode === 12 && f.date === '2026-10-14'))
  const tags = entscheiden([zeile], k, '2026-10-15')
  pruefe('Lauf am Tag danach (15.10.): die Zeile von gestern bleibt unberührt', !tags.uebernommen.length && !tags.abweichungen.length, tags)
  pruefe('Tomb Raider King am Sendetag: Termin bleibt belegt (estimated fehlt)', folge12('2026-10-14')?.estimated === undefined, folge12('2026-10-14'))
  pruefe('Tomb Raider King am Tag danach: ohne Ankündigung wieder geschätzt', folge12('2026-10-15')?.estimated === true, folge12('2026-10-15'))
}

console.log('\nPrüfung ausgebliebener Termine:')
{
  const k = kalender()
  const { uebernommen } = entscheiden([zeile], k, '2026-10-14')
  const termin = { date: '2026-10-14', episode: 12 }
  pruefe('geschätzter Termin wird geprüft', terminPruefen({ ...termin, estimated: true }, SERIE, []))
  pruefe('angekündigter, belegter Termin wird trotzdem geprüft', terminPruefen(termin, SERIE, uebernommen))
  pruefe('belegter Termin ohne Ankündigung wird nicht geprüft', !terminPruefen(termin, SERIE, []))
  pruefe('anderer Tag: nicht angekündigt', !terminPruefen({ date: '2026-10-21', episode: 12 }, SERIE, uebernommen))
  pruefe('andere Folge: nicht angekündigt', !terminPruefen({ date: '2026-10-14', episode: 11 }, SERIE, uebernommen))
  pruefe('andere Serie: nicht angekündigt', !terminPruefen(termin, 'GANDERE', uebernommen))
  pruefe('ohne Serienkennung: nicht angekündigt', !terminPruefen(termin, '', uebernommen))
  pruefe('Serienkennung der Zeile fehlt: nicht angekündigt', !terminPruefen(termin, undefined, [{ seriesId: null, episode: 12, date: '2026-10-14' }]))
}

{
  /* Das Skript läuft beim Import los (kein Export) — die Anbindung der Weiche wird am Quelltext geprüft. */
  const quelle = readFileSync(new URL('./termine-pruefen.ts', import.meta.url), 'utf8')
  pruefe('termine-pruefen.ts fragt die Weiche mit der Serienkennung und den Folgen des Wochenprogramms', quelle.includes('!terminPruefen(e, kennung, wocheFolgen)'))
  pruefe('termine-pruefen.ts liest die übernommenen Folgen aus data/crunchyroll-woche.json', /const wocheFolgen = readJson<[^\n]*'data\/crunchyroll-woche\.json'[^\n]*\.uebernommen/.test(quelle))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
