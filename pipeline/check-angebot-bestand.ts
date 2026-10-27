/**
 * Zusicherung am gebauten Bestand (`public/data`): jedes „Im Angebot seit“-Release (`dateMeaning: 'available-from'`) hat seinen Termin, der Termin trägt die Marke
 * `imAngebot` (oder `erstausgabe`, wo es laut aniSearch der erste Tag der deutschen Fassung ist), und der Titel steht im Kern (`titles-core.json`), den der Kalender lädt. Bis 13.10.2026 fehlten alle 108 späten Releases (`motn-*`, `anisearch-*`):
 * ihre Termine entstanden vor dem Anhängen der Releases (`pipeline/bau/13-7-angebot-termine.ts`).
 * Läuft in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück).
 */
import { readFileSync } from 'node:fs'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { STICHTAG_AB } from './bau/angebot-stichtag.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = <T>(datei: string): T => JSON.parse(readFileSync(new URL(`../public/data/${datei}`, import.meta.url), 'utf8')) as T

console.log('\n„Im Angebot seit“ im Bestand:')
{
  const releases = lies<Release[]>('releases.json').filter((r) => r.dateMeaning === 'available-from' && !r.widerlegt && r.schedule?.firstEpisodeDate)
  const termine = new Map(lies<ReleaseEvent[]>('events.json').map((e) => [e.releaseSlug, e]))
  const kern = new Set(lies<Title[]>('titles-core.json').map((t) => t.id))
  const ohneTermin = releases.filter((r) => !termine.has(r.slug)).map((r) => r.slug)
  pruefe(`alle ${releases.length} Katalog-Releases haben einen Termin`, releases.length > 0 && !ohneTermin.length, ohneTermin.slice(0, 5))
  const ohneMarke = releases.filter((r) => termine.has(r.slug) && !termine.get(r.slug)!.imAngebot && !termine.get(r.slug)!.erstausgabe).map((r) => r.slug)
  pruefe('jeder dieser Termine trägt „imAngebot“ oder „erstausgabe“', !ohneMarke.length, ohneMarke.slice(0, 5))
  const beides = [...termine.values()].filter((e) => e.imAngebot && e.erstausgabe).map((e) => e.id)
  pruefe('kein Termin trägt beide Marken', !beides.length, beides.slice(0, 5))
  const titel = new Map(lies<Title[]>('titles.json').map((t) => [t.id, t]))
  const falsch = [...termine.values()].filter((e) => e.erstausgabe && titel.get(e.titleId)?.deErstausgabe?.von !== e.date).map((e) => e.id)
  pruefe('jede Erstveröffentlichung liegt auf dem aniSearch-Erstausgabetag des Titels', !falsch.length, falsch.slice(0, 5))
  /* Alle Releases des Titels, auch Disc und Fernsehen: ein früherer Termin heißt, die Synchro war nicht „zuerst“ hier (Bleach, Snowball Earth). */
  const alle = lies<Release[]>('releases.json').filter((r) => !r.widerlegt && r.schedule?.firstEpisodeDate)
  const fruehesterTag = new Map<number, string>()
  for (const r of alle) {
    const tag = r.schedule.firstEpisodeDate
    if (tag < (fruehesterTag.get(r.titleId) ?? '9999')) fruehesterTag.set(r.titleId, tag)
  }
  const nichtErst = [...termine.values()].filter((e) => e.erstausgabe && (fruehesterTag.get(e.titleId) ?? e.date) < e.date).map((e) => e.id)
  pruefe('keine Erstveröffentlichung, wenn der Titel einen früheren Termin hat (Disc eingeschlossen)', !nichtErst.length, nichtErst.slice(0, 5))
  const ohneKern = releases.filter((r) => termine.has(r.slug) && !kern.has(r.titleId)).map((r) => `${r.slug}:${r.titleId}`)
  pruefe('jeder Titel mit solchem Termin steht im Kern (Cover und Name für die Karte)', !ohneKern.length, ohneKern.slice(0, 5))
  const jeTag = new Map<string, number>()
  for (const r of releases.filter((x) => x.slug.startsWith('motn-'))) jeTag.set(`${r.platform} ${r.schedule.firstEpisodeDate}`, (jeTag.get(`${r.platform} ${r.schedule.firstEpisodeDate}`) ?? 0) + 1)
  const wellen = [...jeTag].filter(([, n]) => n >= STICHTAG_AB)
  pruefe('kein Erfassungsstichtag als Termin (Anbieter, Tag, Zahl)', !wellen.length, wellen)
  const frueh = releases.filter((r) => /^(motn|anisearch)-/.test(r.slug) && r.schedule.firstEpisodeDate < '2026-01-01').map((r) => r.slug)
  pruefe('die späten Angebots-Releases beginnen alle ab 2026 (Daniels Grenze vom 27.08.2026)', !frueh.length, frueh.slice(0, 5))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nOK')
console.log('VERSTÖSSE: 0')
