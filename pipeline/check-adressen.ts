/**
 * Zusicherungen zur Titel-Adresse: Steht die Kennung im Pfad `/t/<id>/`, steht sie nicht noch einmal als `t=` im Hash
 * (vorher `/t/15957/#/woche?t=15957`). Alte Links mit `#/…?t=<id>` bleiben lesbar und werden umgeschrieben.
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { adressHash, hashOhneTitel, mitPfad, parseHash, seitenAdresseFuer, titelAusPfad } from '../web/src/lib/router.ts'
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'
import { todayIso } from '../shared/time.ts'
import { titelAdresse, titelHash } from '../shared/teilen.ts'
import { titelInhalt, titelKopf } from './lib/titel-seite.ts'
import { calendarUrl } from '../worker/src/mail-abschnitte.ts'
import type { Release, Title } from '../shared/types.ts'
import { body, head } from './lib/termin-seite.ts'
import type { Umfeld } from './lib/titel-umfeld.ts'
import type { ReleaseEvent } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nErzeuger: Kennung im Pfad, nicht im Hash:')
pruefe('Titelhash ohne Termin: #/woche', titelHash(15957, '15957') === '#/woche', titelHash(15957, '15957'))
pruefe('Titelhash mit Termin: nur d=', titelHash(15957, '15957', '2026-10-20') === '#/woche?d=2026-10-20', titelHash(15957, '15957', '2026-10-20'))
pruefe('Namens-Pfad (Cartoon) trägt die Kennung nicht und behält t=', titelHash(-284833, 'avatar-die-sieben-haefen-284833') === '#/woche?t=-284833')
pruefe('Adresse = Pfad + Hash', titelAdresse(15957, '15957', '2026-10-20') === 't/15957/#/woche?d=2026-10-20')

const umfeld = { aehnlichHtml: '', krumenJsonLd: '' } as unknown as Umfeld
function seite(id: number, slug: string): string {
  const t = { id, slug, titleRomaji: 'Test', titleDe: 'Test', streams: [] } as unknown as Title
  return titelKopf(t, umfeld, 'x') + titelInhalt(t, undefined, [], umfeld)
}
const anime = seite(15957, '15957')
pruefe('Titelseite (Anime): Skript setzt #/woche ohne t=', anime.includes('location.hash = "#/woche"') && !/[?&]t=/.test(anime))
pruefe('Titelseite (Anime): „Im Kalender ansehen“ führt über den Pfad', anime.includes('/t/15957/#/woche"'))
const cartoon = seite(-284833, 'avatar-284833')
pruefe('Titelseite (Cartoon, Namens-Pfad): t= bleibt, sonst fehlt der Titel', cartoon.includes('location.hash = "#/woche?t=-284833"'))

const ev = { titleId: 15957, date: '2026-10-20' } as unknown as ReleaseEvent
const mail = calendarUrl({ siteUrl: 'https://anime-kalender.de/' } as never, ev)
pruefe('Mail-Link: Pfad plus Tag, kein t=', mail === 'https://anime-kalender.de/t/15957/#/woche?d=2026-10-20', mail)

console.log('\nRouter: Pfad zuerst, alte Links bleiben lesbar:')
pruefe('Titel aus dem Pfad', titelAusPfad('/t/15957/') === 15957 && parseHash('#/woche').title === undefined)
pruefe('Route unter /t/15957/ ohne t= im Hash trägt den Titel', mitPfad(parseHash('#/woche'), '/t/15957/').title === 15957)
pruefe('… der Hash gewinnt, wenn er einen anderen Titel nennt', mitPfad(parseHash('#/woche?t=7'), '/t/15957/').title === 7)
pruefe('Alter Hash #/woche?t=15957 liefert weiter den Titel', parseHash('#/woche?t=15957').title === 15957)
const ort = (pathname: string, hash: string) => ({ pathname, search: '', hash })
pruefe('… und wird beim Öffnen auf /t/15957/#/woche umgeschrieben (Seite mit altem Doppel)', seitenAdresseFuer('', ort('/t/15957/', '#/woche?t=15957'), '15957') === '/t/15957/#/woche')
pruefe('… ebenso aus dem Wurzel-Link /#/datenbank?kw=Cartoon&t=15957', seitenAdresseFuer('', ort('/', '#/datenbank?kw=Cartoon&t=15957'), '15957') === '/t/15957/#/datenbank?kw=Cartoon')
pruefe('… das Doppel verliert t= und behält d=', seitenAdresseFuer('', ort('/t/15957/', '#/woche?d=2026-10-20&t=15957'), '15957') === '/t/15957/#/woche?d=2026-10-20')
pruefe('… eine schon saubere Adresse bleibt, kein Schreiben', seitenAdresseFuer('', ort('/t/15957/', '#/woche'), '15957') === undefined)
pruefe('Namens-Pfad behält t= (Cartoons, späterer Umbau)', seitenAdresseFuer('', ort('/', '#/woche?t=-284833'), 'avatar-284833') === '/t/avatar-284833/#/woche?t=-284833')
pruefe('Ohne Titel (Panel zu) bleibt der Hash unangetastet', seitenAdresseFuer('', ort('/t/15957/', '#/woche?t=15957'), undefined) === '/#/woche?t=15957')
const route = { view: 'woche', date: todayIso(), title: 15957, filters: { ...EMPTY_FILTERS } } as const
pruefe('Navigation unter /t/15957/: der Hash bleibt ohne t=', adressHash(route, '/t/15957/') === '#/woche', adressHash(route, '/t/15957/'))
pruefe('Navigation von der Wurzel: t= bleibt, bis der Pfad den Titel trägt', adressHash(route, '/') === '#/woche?t=15957', adressHash(route, '/'))
pruefe('Navigation zu einem anderen Titel als im Pfad: t= bleibt', adressHash({ ...route, title: 7 }, '/t/15957/') === '#/woche?t=7')
pruefe('hashOhneTitel ohne Query ändert nichts', hashOhneTitel('#/woche') === '#/woche' && hashOhneTitel('') === '')

console.log('\nWächter: kein Erzeuger schreibt t= in einen Hash hinter einen Titel-Pfad:')
/* Titelseiten tragen den Titel im Pfad: dort darf nirgends `t=` in einen Hash. Die Mail setzt Pfad und Hash in eine Zeile. */
const ERZEUGER: Array<[string, RegExp]> = [
  ['pipeline/build-share-pages.ts', /[?&]t=/],
  ['pipeline/lib/termin-seite.ts', /[?&]t=/],
  ['pipeline/lib/titel-seite.ts', /[?&]t=/],
  ['worker/src/mail-abschnitte.ts', /\/t\/.*#\/.*[?&]t=/],
]
for (const [datei, muster] of ERZEUGER) {
  const zeilen = readFileSync(datei, 'utf8').split('\n')
  const treffer = zeilen.filter((z) => !/^\s*(\/?\*|\/\/)/.test(z) && muster.test(z))
  pruefe(`${datei}: kein t= im Hash hinter einem Titel-Pfad`, treffer.length === 0, treffer)
}

console.log('\nNegative Kennung (Cartoon) behält t=, sonst liest der Router den Titel nicht:')
pruefe('Titelhash: Kennung als Pfad, aber negativ → t=', titelHash(-284833, '-284833') === '#/woche?t=-284833', titelHash(-284833, '-284833'))
pruefe('Titelhash: Namens-Pfad mit Termin → d= und t=', titelHash(-284833, 'avatar-284833', '2026-10-20') === '#/woche?d=2026-10-20&t=-284833')
pruefe('Titelseite (Cartoon, Kennung als Adresse): t= im Skript', seite(-284833, '-284833').includes('location.hash = "#/woche?t=-284833"'))
pruefe('Titelseite (Cartoon): „Im Kalender ansehen“ mit Namens-Pfad und t=', cartoon.includes('/t/avatar-284833/#/woche?t=-284833"'))
const cartoonEv = { titleId: -284833, date: '2026-10-20' } as unknown as ReleaseEvent
const mailCartoon = calendarUrl({ siteUrl: 'https://anime-kalender.de/' } as never, cartoonEv)
pruefe('Mail-Link (Cartoon): Umleitungs-Pfad, Tag und t=', mailCartoon === 'https://anime-kalender.de/t/-284833/#/woche?d=2026-10-20&t=-284833', mailCartoon)

pruefe('Titelhash: Namens-Pfad mit positiver Kennung → t=', titelHash(15957, 'cowboy-bebop-15957') === '#/woche?t=15957')
pruefe('Titelseite (Namens-Pfad, positive Kennung): t= im Skript', seite(15957, 'cowboy-bebop-15957').includes('location.hash = "#/woche?t=15957"'))

console.log('\nTermin-Seiten (head/body):')
const release = {
  slug: 'test-1',
  titleId: 1,
  name: 'Test',
  platform: 'netflix',
  releaseType: 'weekly',
  schedule: { firstEpisodeDate: '2099-10-20', estimated: false, episodeCount: 1 },
} as unknown as Release
const titel = { id: 1, slug: 'x', titleRomaji: 'Test', titleDe: 'Test', genres: [], streams: [] } as unknown as Title
function terminSeite(ak: number, adresse: string, rel: Release = release, heute = '2026-10-16'): string {
  return head(rel, titel, heute, ak, adresse, umfeld) + body(rel, titel, undefined, heute, [], ak, adresse, umfeld)
}
const terminAnime = terminSeite(15957, '15957')
pruefe('Termin-Seite (Anime): Skript mit Tag, ohne t=', terminAnime.includes('location.hash = "#/woche?d=2099-10-20"') && !/[?&]t=/.test(terminAnime))
pruefe('Termin-Seite (Anime): „Im Kalender ansehen“ über den Pfad mit Tag', terminAnime.includes('/t/15957/#/woche?d=2099-10-20"'))
const terminName = terminSeite(15957, 'cowboy-bebop-15957')
pruefe('Termin-Seite (Namens-Pfad, positive Kennung): t= in Skript und Link', terminName.includes('location.hash = "#/woche?d=2099-10-20&amp;t=15957"') || terminName.includes('location.hash = "#/woche?d=2099-10-20&t=15957"'))
const terminCartoon = terminSeite(-284833, 'avatar-284833')
pruefe('Termin-Seite (Cartoon): Skript mit Tag und t=', terminCartoon.includes('location.hash = "#/woche?d=2099-10-20&amp;t=-284833"') || terminCartoon.includes('location.hash = "#/woche?d=2099-10-20&t=-284833"'))
pruefe('Termin-Seite (Cartoon): „Im Kalender ansehen“ über den Namens-Pfad mit Tag und t=', /\/t\/avatar-284833\/#\/woche\?d=2099-10-20&(amp;)?t=-284833"/.test(terminCartoon))

const mehrere = { ...release, schedule: { firstEpisodeDate: '2026-10-01', estimated: false, episodeCount: 4 } } as unknown as Release
const jahreswechsel = { ...release, schedule: { firstEpisodeDate: '2026-12-18', estimated: false, episodeCount: 4 } } as unknown as Release
const tagImSkript = (seite: string) => /location\.hash = "#\/woche\?d=([0-9-]+)"/.exec(seite)?.[1]
const tagImLink = (seite: string) => /\/t\/15957\/#\/woche\?d=([0-9-]+)"/.exec(seite)?.[1]
for (const [heute, erwartet, was, rel] of [
  ['2026-10-16', '2026-10-22', 'nächster künftiger Termin (Folgen davor und danach)'],
  ['2026-10-22', '2026-10-22', 'Termin heute zählt noch (>=)'],
  ['2026-11-30', '2026-10-01', 'alle Termine vorbei: der erste'],
  ['2026-10-09', '2026-10-15', 'der richtige Termin liegt in der Mitte'],
  ['2026-12-30', '2027-01-01', 'über den Jahreswechsel', jahreswechsel],
] as const) {
  const seite = terminSeite(15957, '15957', rel ?? mehrere, heute)
  pruefe(`Termin-Seite, ${was}: Skript zeigt ${erwartet}`, tagImSkript(seite) === erwartet, tagImSkript(seite))
  pruefe(`Termin-Seite, ${was}: „Im Kalender ansehen“ zeigt ${erwartet}`, tagImLink(seite) === erwartet, tagImLink(seite))
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nTitel-Adressen: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
