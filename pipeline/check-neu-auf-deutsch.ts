/**
 * Zusicherungen: „Neu auf Deutsch“ erscheint erst, wenn Deutsch an dem Tag zu sehen ist (Witch on the Holy Night, 19.09.2026),
 * und ein noch ausstehender Termin desselben Anbieters macht daraus eine Ankündigung (Apothekerin S3, 02.10.2026).
 * Läuft `baueNews` auf einer Kulisse (erfundene Titel, kein Netz) und liest die Art `neu` aus der Ausgabe.
 * Ersetzt zwei Textprüfungen in `check-logic.ts`.
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { addDays, todayIso } from '../shared/time.ts'
import { baueNews } from './lib/news.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const heute = todayIso()
const cr = (extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/Y', dub: true, ...extra }) as StreamLink
const titel = (streams: StreamLink[]): Title =>
  ({ id: 7, franchiseId: 7, slug: 't-7', titleEn: 'Neutitel', streams, keywords: [], genres: [] }) as unknown as Title
const rel = (platform: string, tag: string): Release =>
  ({ slug: `r-${platform}`, titleId: 7, name: 'Neutitel', platform, releaseType: 'weekly', schedule: { firstEpisodeDate: tag }, sources: ['https://quelle.example/beleg'] }) as unknown as Release

/** Arten aller Meldungen, die `baueNews` für den Titel baut; `seit` ist der Tag, an dem die Synchro bekannt wurde. */
function arten(streams: StreamLink[], releases: Release[], seit: string): string[] {
  return baueNews([titel(streams)], releases, [{ id: 7, seit }], [], { zuerst: {} }).flatMap((e) => e.meldungen).map((m) => m.art)
}

pruefe('Stream mit deutscher Tonspur: „Neu auf Deutsch“', arten([cr()], [], heute).includes('neu'))
pruefe('weder Stream noch erreichter Termin: keine Meldung', !arten([], [], heute).includes('neu'))
pruefe('kein Stream, Kinostart erst morgen: keine Meldung', !arten([], [rel('kino', addDays(heute, 1))], heute).includes('neu'))
pruefe('kein Stream, Kinostart erreicht: „Neu auf Deutsch“ mit dem Termin', arten([], [rel('kino', heute)], heute).includes('neu'))
pruefe('Ja aus JustWatch zählt nicht als Stream', !arten([cr({ herkunft: 'justwatch' })], [], heute).includes('neu'))
pruefe('Ja aus Handbeleg zählt nicht als Stream', !arten([cr({ herkunft: 'handbeleg' })], [], heute).includes('neu'))

/* Ausstehender Termin desselben Anbieters: angekündigt, nicht neu. */
const morgen = arten([cr()], [rel('crunchyroll', addDays(heute, 1))], heute)
pruefe('Anbieter-Termin morgen: keine „Neu“-Meldung', !morgen.includes('neu'), morgen)
pruefe('Anbieter-Termin morgen: eine Ankündigung', morgen.includes('angekuendigt'), morgen)
/* Gemessen am Tag der Meldung (`seit`), nicht an heute: Termin heute, Synchro seit fünf Tagen bekannt. */
const frueher = arten([cr()], [rel('crunchyroll', heute)], addDays(heute, -5))
pruefe('Termin heute, Meldung von vor fünf Tagen: keine „Neu“-Meldung', !frueher.includes('neu'), frueher)
/* Gemessen am Anbieter, nicht am Titel: ein erreichter Disc-Termin hebt die Ankündigung nicht auf. */
const disc = arten([cr()], [rel('crunchyroll', addDays(heute, 1)), rel('disc', addDays(heute, -3))], heute)
pruefe('erreichter Disc-Termin hebt den ausstehenden Anbieter-Termin nicht auf', !disc.includes('neu'), disc)
pruefe('Termin eines anderen Anbieters (Netflix morgen) ändert nichts', arten([cr()], [rel('netflix', addDays(heute, 1))], heute).includes('neu'))
pruefe('erreichter Anbieter-Termin: „Neu auf Deutsch“', arten([cr()], [rel('crunchyroll', addDays(heute, -2))], addDays(heute, -1)).includes('neu'))

console.log(`check-neu-auf-deutsch: ${faelle} Fälle, ${fehler} Fehler.`)
process.exit(fehler ? 1 : 0)
