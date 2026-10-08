/**
 * Zusicherungen zu `woche.json` (Start der Wochenansicht): Jeder Eintrag steht identisch in den vollen Dateien, nichts, was die
 * Wochenansicht liest, fehlt, und die Übersetzung in eigene Kennungen (`ak`) erhält beides. Aufruf: `npm run check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { baueWochenDatei, pruefeWochenDatei, wocheDeckt, type WochenDatei } from '../shared/wochen-datei.ts'
import { ladeAkVon, uebersetzeDatei } from './lib/ausgabe-kennung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number) => ({ id, titleRomaji: `T${id}` }) as unknown as Title
const release = (slug: string, titleId: number) => ({ slug, titleId, name: slug, platform: 'crunchyroll' }) as unknown as Release
const termin = (id: string, releaseSlug: string, titleId: number, date: string, episode?: number, extra: Partial<ReleaseEvent> = {}) =>
  ({ id, releaseSlug, titleId, date, episode, platform: 'crunchyroll', releaseType: 'weekly', name: releaseSlug, ...extra }) as unknown as ReleaseEvent

console.log('\nWochen-Datei:')
{
  /* Donnerstag, 08.10.2026: Woche Mo 05.10. – So 11.10. */
  const titles = [1, 2, 3].map(titel)
  const releases = [release('a', 1), release('a2', 1), release('b', 2), release('c', 3)]
  const events = [
    termin('a-1', 'a', 1, '2026-09-21', 1), termin('a-5', 'a', 1, '2026-09-28', 5), termin('a-4', 'a', 1, '2026-09-14', 4),
    termin('a-6', 'a', 1, '2026-10-05', 6), termin('a-7', 'a', 1, '2026-10-12', 7),
    termin('b-1', 'b', 2, '2026-10-11', 1), termin('c-9', 'c', 3, '2026-10-19', 9),
  ]
  const w = baueWochenDatei('2026-10-08', titles, releases, events)
  pruefe('Woche ist Montag bis Sonntag in Berlin', w.von === '2026-10-05' && w.bis === '2026-10-11', [w.von, w.bis])
  pruefe('Termine der Woche stehen drin, spätere und fremde nicht', ['a-6', 'b-1'].every((id) => w.events.some((e) => e.id === id)) && !w.events.some((e) => e.id === 'a-7' || e.id === 'c-9'))
  pruefe('je Titel kommt die letzte erschienene Folge vor der Woche mit (für „N neu")', w.events.some((e) => e.id === 'a-5') && !w.events.some((e) => e.id === 'a-1' || e.id === 'a-4'), w.events.map((e) => e.id))
  pruefe('alle Releases der gezeigten Titel stehen drin (Premiere zählt über sie), fremde nicht', w.releases.map((r) => r.slug).join() === 'a,a2,b')
  pruefe('nur Titel mit Termin in der Woche', w.titles.map((t) => t.id).join() === '1,2')
  pruefe('die Reihenfolge der vollen Dateien bleibt', w.events.map((e) => e.id).join() === 'a-5,a-6,b-1')
  pruefe('ein sauberer Schnitt hat keinen Widerspruch', pruefeWochenDatei(w, titles, releases, events).length === 0)

  const geaendert: WochenDatei = { ...w, events: w.events.map((e) => (e.id === 'a-6' ? { ...e, time: '17:00' } : e)) }
  pruefe('ein abweichender Termin wird gemeldet', pruefeWochenDatei(geaendert, titles, releases, events).some((f) => f.includes('a-6')))
  pruefe('ein fehlender Termin der Woche wird gemeldet', pruefeWochenDatei({ ...w, events: w.events.filter((e) => e.id !== 'b-1') }, titles, releases, events).some((f) => f.includes('b-1')))
  pruefe('ein Termin ohne Release wird gemeldet', pruefeWochenDatei({ ...w, releases: w.releases.filter((r) => r.slug !== 'b') }, titles, releases, events).some((f) => f.includes('Release b')))
  pruefe('ein Termin ohne Titel wird gemeldet', pruefeWochenDatei({ ...w, titles: w.titles.filter((t) => t.id !== 2) }, titles, releases, events).some((f) => f.includes('Titel 2')))
  pruefe('ein Eintrag, den es in den vollen Dateien nicht gibt, wird gemeldet', pruefeWochenDatei(w, titles, releases, events.filter((e) => e.id !== 'a-5')).some((f) => f.includes('a-5')))

  pruefe('Anker und heute in der Woche: reicht', wocheDeckt(w, '2026-10-07', '2026-10-08'))
  pruefe('Anker in der Nachbarwoche: reicht nicht', !wocheDeckt(w, '2026-10-12', '2026-10-08') && !wocheDeckt(w, '2026-10-04', '2026-10-08'))
  pruefe('heute hinter der Woche (alter Stand): reicht nicht', !wocheDeckt(w, '2026-10-08', '2026-10-12'))
}

{
  /* Am echten Bestand: roh, und nach der Übersetzung in eigene Kennungen, wie sie ausgeliefert wird. */
  const lies = <T>(name: string): T => JSON.parse(readFileSync(`public/data/${name}`, 'utf8')) as T
  if (!existsSync('public/data/woche.json')) pruefe('public/data/woche.json ist da (npm run data:build)', false)
  else {
    const woche = lies<WochenDatei>('woche.json')
    const [t, r, e] = [lies<Title[]>('titles-core.json'), lies<Release[]>('releases.json'), lies<ReleaseEvent[]>('events.json')]
    const roh = pruefeWochenDatei(woche, t, r, e)
    pruefe('Bestand: Jeder Eintrag von woche.json steht identisch in den vollen Dateien', roh.length === 0, roh)
    pruefe('Bestand: die Woche hat Termine', woche.events.length > 0)
    const { akVon } = ladeAkVon('data/kennungen.json')
    const uebersetzt = (name: string, daten: unknown) => uebersetzeDatei(name, daten, akVon)
    const w2 = uebersetzt('woche.json', woche) as WochenDatei
    const nach = pruefeWochenDatei(w2, uebersetzt('titles-core.json', t) as Title[], uebersetzt('releases.json', r) as Release[], uebersetzt('events.json', e) as ReleaseEvent[])
    pruefe('Bestand: auch nach der Übersetzung in eigene Kennungen', nach.length === 0, nach)
  }
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) zur Wochen-Datei verletzt.` : '\nWochen-Datei: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
