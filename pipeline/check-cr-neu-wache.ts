/**
 * Test der Wache `check-cr-neu-bestand.ts` / `lib/cr-neu-wache.ts`: Jede neue deutsche Crunchyroll-Folge der letzten 1–10 Tage
 * braucht einen Crunchyroll-Termin am selben Tag (±1, Europe/Berlin) in derselben Franchise.
 *
 * Lehre (25.10.2026): Vier von 38 Folgen fehlten (Last Boss S2, Apothekerin S3, Aristocrat S3), und niemand merkte es, weil der Bau
 * die Serien still verwarf. Die Fälle sind die vier echten Folgen aus `data/crunchyroll-neu.json` (Kennungen, Staffelnamen, Nummern,
 * Zeitstempel wörtlich) gegen Titel mit den Adressen aus `titles.json`; „heute“ ist fest.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Title } from '../shared/types.ts'
import { fehlendeCrFolgen, type NeueFolge } from './lib/cr-neu-wache.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const HEUTE = '2026-10-25'
const crUrl = (kennung: string) => `https://www.crunchyroll.com/de/series/${kennung}/x`
const titel = (id: number, franchiseId: number | undefined, kennung: string, platform = 'crunchyroll'): Title =>
  ({ id, franchiseId, titleEn: `Titel ${id}`, streams: [{ platform, url: crUrl(kennung) }] }) as unknown as Title

const titles = [
  titel(180523, 180523, 'GT00361955'),
  titel(204389, 180523, 'GT00361955'),
  titel(161645, 161645, 'G3KHEVDJ7'),
  titel(195516, 161645, 'G3KHEVDJ7'),
  titel(164702, 164702, 'GG5H5XQMD'),
  titel(185756, 164702, 'GG5H5XQMD'),
  titel(777, 777, 'GFREMD', 'netflix'),
]

const folge = (serieId: string, staffel: string, nummer: number, verfuegbarAb: string): NeueFolge => ({ serieId, serie: 'x', staffel, nummer, verfuegbarAb })
const vier: NeueFolge[] = [
  folge('GT00361955', 'Staffel 2', 1, '2026-10-24T13:30:00.000Z'),
  folge('GT00361955', 'Staffel 2', 2, '2026-10-24T13:30:00.000Z'),
  folge('G3KHEVDJ7', 'Die Tagebücher der Apothekerin Staffel 3', 49, '2026-10-23T15:00:00.000Z'),
  folge('GG5H5XQMD', 'Staffel 3', 1, '2026-10-18T15:00:00.000Z'),
]
const ev = (titleId: number, date: string, platform = 'crunchyroll') => ({ titleId, date, platform }) as never
const fehlt = (f: NeueFolge[], e: ReturnType<typeof ev>[], t = titles, heute = HEUTE) => fehlendeCrFolgen(f, t, e, heute)

const ohne = fehlt(vier, [])
pruefe('ohne jeden Termin: genau die vier Folgen', ohne.length === 4, ohne)
pruefe('der Befund nennt Titel, Folge und Tag', ohne[3]?.tag === '2026-10-18' && ohne[3]?.folge === 'Staffel 3 Folge 1' && ohne[3]?.titel === 'Titel 164702', ohne[3])
pruefe('die Titel-Kennungen der Franchise stehen dabei', JSON.stringify(ohne[2]?.ids) === '[161645,195516]', ohne[2])

const alleDa = [ev(204389, '2026-10-24'), ev(195516, '2026-10-23'), ev(185756, '2026-10-18')]
pruefe('mit einem Termin je Folge: nichts fehlt', fehlt(vier, alleDa).length === 0)
pruefe('ein Termin eines anderen Titels derselben Franchise zählt', fehlt(vier, [ev(180523, '2026-10-24'), ev(161645, '2026-10-23'), ev(164702, '2026-10-18')]).length === 0)
pruefe('fehlt nur Aristocrat: genau diese Folge', fehlt(vier, alleDa.slice(0, 2)).map((f) => f.tag).join() === '2026-10-18')
pruefe('Termin einen Tag später zählt', fehlt(vier.slice(3), [ev(185756, '2026-10-19')]).length === 0)
pruefe('Termin einen Tag früher zählt', fehlt(vier.slice(3), [ev(185756, '2026-10-17')]).length === 0)
pruefe('Termin zwei Tage später zählt nicht', fehlt(vier.slice(3), [ev(185756, '2026-10-20')]).length === 1)
pruefe('Termin zwei Tage früher zählt nicht', fehlt(vier.slice(3), [ev(185756, '2026-10-16')]).length === 1)
pruefe('ein Termin einer anderen Plattform zählt nicht', fehlt(vier.slice(3), [ev(185756, '2026-10-18', 'primevideo')]).length === 1)
pruefe('ein Termin einer fremden Franchise zählt nicht', fehlt(vier.slice(3), [ev(180523, '2026-10-18')]).length === 1)
pruefe('ein Termin eines unbekannten Titels zählt nicht', fehlt(vier.slice(3), [ev(999999, '2026-10-18')]).length === 1)

/* Tagesgrenzen: heute selbst ist noch kein Befund, ab gestern bis 10 Tage schon. */
const amTag = (tag: string) => [folge('GG5H5XQMD', 'Staffel 3', 1, `${tag}T12:00:00.000Z`)]
pruefe('Folge von heute: kein Befund (der Bau kann noch aufholen)', fehlt(amTag('2026-10-25'), []).length === 0)
pruefe('Folge von gestern: Befund', fehlt(amTag('2026-10-24'), []).length === 1)
pruefe('Folge von vor 10 Tagen: Befund', fehlt(amTag('2026-10-15'), []).length === 1)
pruefe('Folge von vor 11 Tagen: Altlast, kein Befund', fehlt(amTag('2026-10-14'), []).length === 0)
pruefe('Folge von morgen: kein Befund', fehlt(amTag('2026-10-26'), []).length === 0)

/* Berlin statt UTC: 22:30 UTC am 24.10. ist 00:30 am 25.10. in Berlin. */
const spaet = [folge('GG5H5XQMD', 'Staffel 3', 1, '2026-10-24T22:30:00.000Z')]
pruefe('Tag in Berlin: 24.10. 22:30 UTC ist der 25.10., also heute und kein Befund', fehlt(spaet, [], titles, '2026-10-25').length === 0)
pruefe('Tag in Berlin: am 26.10. fehlt die Folge vom 25.10. (nicht vom 24.10.)', fehlt(spaet, [], titles, '2026-10-26')[0]?.tag === '2026-10-25')

pruefe('Serie ohne unseren Titel: kein Befund', fehlt([folge('GUNBEKANNT', 'Staffel 1', 1, '2026-10-24T13:30:00.000Z')], []).length === 0)
pruefe('Titel nur bei Netflix: kein Crunchyroll-Befund', fehlt([folge('GFREMD', 'Staffel 1', 1, '2026-10-24T13:30:00.000Z')], []).length === 0)
pruefe('Folge ohne Zeitstempel: übersprungen', fehlt([{ serieId: 'GG5H5XQMD' }], []).length === 0)
pruefe('Folge mit kaputtem Zeitstempel: übersprungen', fehlt([folge('GG5H5XQMD', 's', 1, 'gestern')], []).length === 0)
const ohneFranchise = [titel(5, undefined, 'GXFR'), titel(6, undefined, 'GXFR')]
pruefe('ohne franchiseId zählt die eigene Kennung: Termin des Nachbarn reicht nicht', fehlt([folge('GXFR', 'Staffel 1', 1, '2026-10-24T13:30:00.000Z')], [ev(7, '2026-10-24')], ohneFranchise).length === 1)
pruefe('ohne franchiseId: Termin des eigenen Titels reicht', fehlt([folge('GXFR', 'Staffel 1', 1, '2026-10-24T13:30:00.000Z')], [ev(5, '2026-10-24')], ohneFranchise).length === 0)

/* Prozess: Exit 0 mit Warnzeile, Exit 1 bei unlesbarer Eingabe. */
const skript = fileURLToPath(new URL('./check-cr-neu-bestand.ts', import.meta.url))
function prozess(name: string, neu: unknown, events: unknown) {
  const wurzel = mkdtempSync(join(tmpdir(), `cr-neu-wache-${name}-`))
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  if (neu !== null) writeFileSync(join(wurzel, 'data', 'crunchyroll-neu.json'), typeof neu === 'string' ? neu : JSON.stringify(neu))
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titles))
  writeFileSync(join(wurzel, 'public', 'data', 'events.json'), typeof events === 'string' ? events : JSON.stringify(events))
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, wurzel, HEUTE], { encoding: 'utf8', windowsHide: true })
  return { status: r.status ?? -1, out: r.stdout, err: r.stderr }
}
const warn = prozess('a', { folgen: vier }, [])
pruefe('Prozess: vier fehlende Folgen enden mit Exit 0 und der Zeile „⚠ WARNUNG Crunchyroll-Folgen ohne Termin“', warn.status === 0 && warn.out.includes('⚠ WARNUNG Crunchyroll-Folgen ohne Termin: 6 Titel:') && warn.out.includes('Staffel 3 Folge 1, 2026-10-18'), warn)
const gut = prozess('b', { folgen: vier }, alleDa)
pruefe('Prozess: nichts fehlt: Exit 0 und Haken, keine Warnung', gut.status === 0 && gut.out.includes('✓ Crunchyroll-Neuheiten') && !gut.out.includes('WARNUNG'), gut)
const keine = prozess('c', null, [])
pruefe('Prozess: ohne Datei nichts zu prüfen, Exit 0', keine.status === 0 && keine.out.includes('keine Datei'), keine)
const kaputt = prozess('d', { folgen: vier }, '{kaputt')
pruefe('Prozess: kaputte events.json: Exit 1, Meldung auf stderr', kaputt.status === 1 && kaputt.err.includes('✖ Crunchyroll-Neuheiten') && kaputt.out === '', kaputt)
const form = prozess('e', { folgen: 'x' }, [])
pruefe('Prozess: folgen keine Liste: Exit 1', form.status === 1, form)
const leer = prozess('f', { folgen: [] }, [])
pruefe('Prozess: leere Liste: Exit 0 und Haken', leer.status === 0 && leer.out.includes('✓'), leer)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
