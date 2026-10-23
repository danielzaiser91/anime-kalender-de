/**
 * Prime-Kauf/Leihe als Stream-Pille (23.10.2026, All You Need Is Kill): Der Bau legt den Weg auch bei Titeln mit anderen Wegen an
 * (`bau/11-2-4-kauf-wege.ts`, über den Aufrufer `ergaenzeWegeAusJustwatch`), und der JustWatch-Abruf fragt frische Kino-/Disc-Titel dicht
 * (`lib/jw-frische.ts`, Warteschlange `lib/jw-schlange.ts`). Läuft in `check:logic`.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StreamLink, Title } from '../shared/types.ts'
import { ergaenzeKaufWege, type JwKauf } from './bau/11-2-4-kauf-wege.ts'
import { ergaenzeWegeAusJustwatch } from './bau/11-2-justwatch.ts'
import { frischFaellig, frischeTitel, ladeFrische } from './lib/jw-frische.ts'
import { warteschlange } from './lib/jw-schlange.ts'
import { dubKey } from './lib/dub-confirmed.ts'
import { readJson } from './lib/util.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const URL_A = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.aaaa'
const URL_B = 'https://www.amazon.de/dp/B0HJ5TX1WY?tag=movie0c6-21&linkCode=osi&th=1&psc=1'
const titel = (id: number, extra: object = {}) => ({ id, streams: [], keywords: [], genres: [], ...extra }) as unknown as Title
const angebot = (anbieter: string, art: string, audio: string[] | undefined, url: string | undefined = URL_A) => ({ anbieter, art, audio, url })
const aniSearchBlu = { name: 'aniSearch', url: 'https://www.anisearch.de/article/1,x', kind: 'buy', zugang: 'kauf' }

/** Ein Lauf der Kauf-Runde über einen Titel; Rückgabe: seine Streams. */
function lauf(angebote: JwKauf['angebote'], t: Title = titel(900001), extra: { handNein?: Set<string>; mehrdeutig?: string[]; tot?: string[]; ohneTreffer?: boolean } = {}): StreamLink[] {
  ergaenzeKaufWege({
    titles: new Map([[t.id, t]]),
    jw: { [String(t.id)]: { angebote, ...(extra.ohneTreffer ? { ohneTreffer: true } : {}) } },
    handNein: extra.handNein ?? new Set(),
    tmdbMehrdeutig: new Set(extra.mehrdeutig ?? []),
    toteAdressen: new Set(extra.tot ?? []),
  })
  return t.streams as StreamLink[]
}
const urls = (s: StreamLink[]) => s.map((x) => `${x.platform}|${x.zugang}|${x.url}`).join()

console.log('Kauf-Runde:')
pruefe('Kauf mit deutschem Ton → Prime-Stream kauf', urls(lauf([angebot('Amazon Video', 'BUY', ['de', 'en'])])) === `primevideo|kauf|${URL_A}`)
pruefe('Leihe → Prime-Stream kauf', urls(lauf([angebot('Amazon Video', 'RENT', ['de'])])) === `primevideo|kauf|${URL_A}`)
pruefe('„Amazon Prime Video“ Kauf zählt', urls(lauf([angebot('Amazon Prime Video', 'BUY', ['de'])])) === `primevideo|kauf|${URL_A}`)
pruefe('ohne deutschen Ton kein Weg', lauf([angebot('Amazon Video', 'BUY', ['ja', 'en'])]).length === 0)
pruefe('ohne Tonangabe kein Weg', lauf([angebot('Amazon Video', 'BUY', undefined)]).length === 0)
pruefe('leere Tonliste kein Weg', lauf([angebot('Amazon Video', 'BUY', [])]).length === 0)
pruefe('Flatrate ist Sache der Abo-Runde', lauf([angebot('Amazon Video', 'FLATRATE', ['de'])]).length === 0)
pruefe('Disc-Händler kein Weg', lauf([angebot('Amazon DVD / Blu-ray', 'BUY', ['de'])]).length === 0)
pruefe('Amazon-Kanal kein Weg', lauf([angebot('Crunchyroll Amazon Channel', 'BUY', ['de'])]).length === 0)
pruefe('anderer Shop kein Weg', lauf([angebot('Apple TV', 'BUY', ['de'])]).length === 0)
pruefe('ohne Adresse kein Weg', lauf([angebot('Amazon Video', 'BUY', ['de'], '')]).length === 0)
pruefe('tote Adresse kein Weg', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001), { tot: [URL_A] }).length === 0)
pruefe('mehrdeutige TMDB-Kennung kein Weg', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001), { mehrdeutig: ['900001'] }).length === 0)
pruefe('Befund ohne Treffer kein Weg', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001), { ohneTreffer: true }).length === 0)
pruefe('Nein-Handbeleg an Prime hält ihn zurück', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001), { handNein: new Set([dubKey(900001, 'primevideo')]) }).length === 0)
pruefe('Nein-Handbeleg eines anderen Titels nicht', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001), { handNein: new Set([dubKey(900002, 'primevideo')]) }).length === 1)
pruefe('Nein-Handbeleg einer anderen Plattform nicht', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001), { handNein: new Set([dubKey(900001, 'netflix')]) }).length === 1)
pruefe('vorhandener Prime-Weg (Abo) genügt', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001, { streams: [{ platform: 'primevideo', url: 'https://x/abo', zugang: 'abo' }] })).length === 1)
pruefe('Netflix-Weg hält den Prime-Kauf nicht auf', lauf([angebot('Amazon Video', 'BUY', ['de'])], titel(900001, { streams: [{ platform: 'netflix', url: 'https://x/n' }] })).length === 2)
pruefe('Blu-ray-Zeile (watchLinks) hält ihn nicht auf, bleibt aber stehen', (() => {
  const t = titel(900001, { watchLinks: [aniSearchBlu] })
  return urls(lauf([angebot('Amazon Video', 'BUY', ['de'])], t)) === `primevideo|kauf|${URL_A}` && (t.watchLinks ?? []).length === 1
})())
pruefe('Partnerkennung fällt weg', !urls(lauf([angebot('Amazon Video', 'BUY', ['de'], URL_B)])).includes('tag='))
pruefe('unter drei Angeboten gewinnt das passende in der Mitte', urls(lauf([angebot('Amazon Video', 'BUY', ['ja']), angebot('Amazon Video', 'RENT', ['de'], 'https://x/mitte'), angebot('Amazon Video', 'BUY', ['de'], 'https://x/ende')])) === 'primevideo|kauf|https://x/mitte')
pruefe('nur ein Weg je Titel, auch bei Kauf und Leihe', lauf([angebot('Amazon Video', 'BUY', ['de']), angebot('Amazon Video', 'RENT', ['de'])]).length === 1)
{
  const fremd = titel(900009, { streams: [{ platform: 'netflix', url: 'https://x/n' }] })
  const vorher = JSON.stringify(fremd)
  ergaenzeKaufWege({ titles: new Map([[900009, fremd]]), jw: {}, handNein: new Set(), tmdbMehrdeutig: new Set(), toteAdressen: new Set() })
  pruefe('Titel ohne JustWatch-Befund bleibt byte-gleich', JSON.stringify(fremd) === vorher)
}

console.log('Aufrufer mit der echten JustWatch-Datei:')
{
  const jw = readJson<Record<string, { angebote?: { anbieter: string; art: string; audio?: string[] }[] }>>('data/justwatch-audio.json', {})
  const treffer = Object.entries(jw).filter(([, e]) => (e.angebote ?? []).some((a) => a.anbieter === 'Amazon Video' && a.art === 'BUY' && (a.audio ?? []).includes('de')))
  pruefe('Vorbedingung: die JustWatch-Datei kennt Prime-Kauf mit deutschem Ton', treffer.length > 10, treffer.length)
  const ids = treffer.map(([id]) => Number(id))
  const titles = new Map(ids.map((id) => [id, titel(id, { watchLinks: [aniSearchBlu] })] as [number, Title]))
  ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig: new Set(), toteAdressen: new Set() })
  const mit = [...titles.values()].filter((t) => (t.streams ?? []).some((s) => s.platform === 'primevideo' && s.zugang === 'kauf'))
  pruefe('ergaenzeWegeAusJustwatch legt bei Titeln mit Blu-ray-Zeile Prime-Kauf an (Aufrufer verdrahtet)', mit.length > ids.length / 2, { mit: mit.length, von: ids.length })
}

console.log('Frische Titel:')
const heute = '2999-12-31'
const tag = (n: number) => new Date(Date.parse(heute) - n * 86_400_000).toISOString().slice(0, 10)
const termin = (titleId: number, platform: string, datum: string | undefined) => ({ titleId, platform, schedule: datum ? { firstEpisodeDate: datum } : {} })
{
  const f = frischeTitel(
    [termin(1, 'disc', tag(90)), termin(2, 'disc', tag(91)), termin(3, 'kino', tag(-3)), termin(4, 'kino', tag(-4)), termin(5, 'netflix', tag(1)), termin(6, 'disc', undefined), termin(7, 'disc', tag(200)), termin(7, 'kino', tag(10))],
    heute,
  )
  pruefe('Disc genau 90 Tage zurück zählt', f.has(1))
  pruefe('Disc 91 Tage zurück nicht', !f.has(2))
  pruefe('Kino 3 Tage voraus zählt', f.has(3))
  pruefe('Kino 4 Tage voraus nicht', !f.has(4))
  pruefe('Streamingtermin zählt nicht', !f.has(5))
  pruefe('Termin ohne Datum zählt nicht', !f.has(6))
  pruefe('ein frischer Termin unter mehreren genügt', f.has(7))
}
{
  const frisch = new Set([1])
  const e = (alt: number, angebote: { anbieter: string; art: string }[] = []) => ({ geprueftAm: tag(alt), angebote })
  pruefe('3 Tage alter Befund ist fällig', frischFaellig(1, e(3), frisch, heute))
  pruefe('2 Tage alter Befund nicht', !frischFaellig(1, e(2), frisch, heute))
  pruefe('nicht frischer Titel nicht', !frischFaellig(2, e(10), frisch, heute))
  pruefe('ohne Befund nicht (das ist Sache der Alterswarteschlange)', !frischFaellig(1, undefined, frisch, heute))
  pruefe('Befund ohne Angebote (Treffer leer, Fehler, Sperre) bleibt fällig', frischFaellig(1, e(5, []), frisch, heute))
  pruefe('Prime-Kauf bekannt → nicht mehr', !frischFaellig(1, e(5, [{ anbieter: 'Amazon Video', art: 'BUY' }]), frisch, heute))
  pruefe('Prime-Leihe bekannt → nicht mehr', !frischFaellig(1, e(5, [{ anbieter: 'Amazon Video', art: 'RENT' }]), frisch, heute))
  pruefe('Blu-ray-Kauf zählt nicht als Prime-Kauf', frischFaellig(1, e(5, [{ anbieter: 'Amazon DVD / Blu-ray', art: 'BUY' }]), frisch, heute))
  pruefe('Prime-Flatrate zählt nicht als Prime-Kauf', frischFaellig(1, e(5, [{ anbieter: 'Amazon Prime Video', art: 'FLATRATE' }]), frisch, heute))
}
{
  const wurzel = mkdtempSync(join(tmpdir(), 'prime-kaufweg-'))
  try {
    const datei = join(wurzel, 'releases.json')
    writeFileSync(datei, JSON.stringify([termin(11, 'disc', tag(5)), termin(12, 'disc', tag(500))]))
    const f = ladeFrische(datei, heute)
    pruefe('ladeFrische liest die übergebene Datei', f.has(11) && !f.has(12) && f.size === 1, [...f])
    pruefe('fehlende Datei: keiner frisch', ladeFrische(join(wurzel, 'gibtsnicht.json'), heute).size === 0)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

console.log('Warteschlange:')
{
  const GRENZE = tag(28)
  const film = (id: number) => titel(id, { tmdbId: 100 + id, streams: [{ platform: 'netflix', url: 'https://x/n', dub: true }], watchLinks: [] })
  const titles = [film(21), film(22), film(23), film(24)]
  const kino = { geprueftAm: tag(5), jwId: 'tm1', altersangabe: '12', angebote: [{ anbieter: 'Filmspiegel', art: 'CINEMA', audio: [], untertitel: [], url: 'https://x/k' }] }
  const bestand = {
    '21': { ...kino },
    '22': { ...kino, angebote: [{ anbieter: 'Amazon Video', art: 'BUY', audio: ['de'], untertitel: [], url: URL_A }] },
    '23': { ...kino, geprueftAm: tag(1) },
    '24': { ...kino, ohneTreffer: true, tmdbId: 124, angebote: [] },
  }
  const ids = (frisch: Set<number> | undefined) =>
    warteschlange({ titles, bestand, tmdb: {}, grenze: GRENZE, heute, ...(frisch ? { frisch } : {}), cartoonIds: new Set() }).map((t) => t.id).sort().join()
  pruefe('ohne frische Titel ist nichts fällig (alle unter 28 Tagen)', ids(undefined) === '')
  pruefe('frische Titel: Kino-Befund (21), leere Antwort (24) fällig; Prime bekannt (22) und gestern geprüft (23) nicht', ids(new Set([21, 22, 23, 24])) === '21,24', ids(new Set([21, 22, 23, 24])))
  pruefe('nicht frischer Titel bleibt draußen', ids(new Set([21])) === '21')
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-prime-kaufweg: ok')
