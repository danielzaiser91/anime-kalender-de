/**
 * Zusicherungen zu „Je Aussage und Anbieter nur der stärkste Beleg" (Daniel, 10.10.2026, Fall YAIBA).
 * Läuft hinter `check:logic`; prüft Typ-Ableitung, Stärke-Reihenfolge und die Bau-Zusicherung an Beispielen.
 */
import type { NewsBeleg, NewsEintrag, NewsMeldung } from '../shared/types.ts'
import { belegTyp } from '../shared/beleg-anbieter.ts'
import { belegFehler, entdoppeleBelege } from './lib/beleg-anbieter.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const A2Y = 'https://www.anime2you.de/news'
const YAIBA = `${A2Y}/1059480/yaiba-samurai-legend-prosieben-maxx-termin/`
const NEBENSATZ = `${A2Y}/1059541/`
const beleg = (url: string, extra: Partial<NewsBeleg> = {}): NewsBeleg => ({ url, name: 'x', ...extra })
const eintrag = (...belege: NewsBeleg[]): NewsEintrag => ({
  am: '2026-10-10',
  titelId: 1,
  titel: 'YAIBA: Samurai Legend',
  slug: 'yaiba-samurai-legend-177476',
  meldungen: [{ art: 'angekuendigt', belege } as NewsMeldung],
})
const urls = (es: NewsEintrag[]) => es[0]!.meldungen[0]!.belege!.map((b) => b.url)

console.log('\nBelege je Anbieter: Typ aus dem Pfad')
pruefe('anime2you-Artikel', belegTyp(YAIBA) === 'artikel')
pruefe('Crunchyroll-News', belegTyp('https://www.crunchyroll.com/de/news/latest/2026/10/1/x') === 'artikel')
pruefe('Crunchyroll-Kalender', belegTyp('https://www.crunchyroll.com/simulcastcalendar') === 'kalender')
pruefe('Crunchyroll-Serie', belegTyp('https://www.crunchyroll.com/series/GXXX/x') === 'katalog')
pruefe('ADN-Kalender-Endpunkt', belegTyp('https://gw.api.animationdigitalnetwork.com/video/calendar?date=2026-10-10') === 'kalender')
pruefe('Feed', belegTyp('https://www.anime2you.de/feed/') === 'feed')
pruefe('Netflix-Titelseite', belegTyp('https://www.netflix.com/title/82647303') === 'katalog')
const SIMULCAST_ARTIKEL = [
  `${A2Y}/1047200/seven-knights-of-marronnier-kingdom-prime-video-simulcast/`,
  `${A2Y}/1056092/dragon-ball-super-beerus-simulcast/`,
  `${A2Y}/1056867/disney-plus-tokyo-revengers-simulcast-und-mehr/`,
]
pruefe('„simulcast" im Artikelpfad macht keinen Kalender', SIMULCAST_ARTIKEL.every((u) => belegTyp(u) === 'artikel'), SIMULCAST_ARTIKEL.map(belegTyp))

console.log('\nBelege je Anbieter: der stärkste bleibt')
{
  const r = entdoppeleBelege([eintrag(beleg(NEBENSATZ), beleg(YAIBA))])
  pruefe('YAIBA: der dem Titel gewidmete Artikel bleibt, der Nebensatz entfällt', urls(r.eintraege).join() === YAIBA && r.entfallen.length === 1, urls(r.eintraege))
}
{
  const a = beleg(`${A2Y}/1/yaiba-erste-meldung/`, { veroeffentlichtAm: '2026-10-08' })
  const b = beleg(`${A2Y}/2/yaiba-zweite-meldung/`, { veroeffentlichtAm: '2026-10-09' })
  pruefe('Gleichstand: die Erstmeldung bleibt', urls(entdoppeleBelege([eintrag(b, a)]).eintraege).join() === a.url)
}
{
  const ohne = beleg(`${A2Y}/1/yaiba-eins/`, { veroeffentlichtAm: '2026-10-08' })
  const mit = beleg(`${A2Y}/2/yaiba-zwei/`, { veroeffentlichtAm: '2026-10-09', markierung: [0, 0, 1, 1], bild: 'k' })
  pruefe('mehr Nachweisfelder schlagen das ältere Datum', urls(entdoppeleBelege([eintrag(ohne, mit)]).eintraege).join() === mit.url)
}
{
  const artikel = beleg('https://www.crunchyroll.com/de/news/latest/2026/10/1/yaiba')
  const kalender = beleg('https://www.crunchyroll.com/simulcastcalendar')
  const serie = beleg('https://www.crunchyroll.com/series/GXXX/yaiba')
  const r = entdoppeleBelege([eintrag(artikel, kalender, serie)])
  pruefe('verschiedene Typen desselben Anbieters bleiben getrennt', urls(r.eintraege).length === 3 && r.entfallen.length === 0)
}
{
  const r = entdoppeleBelege([eintrag(beleg(YAIBA), beleg('https://www.manime.de/news/yaiba/1/'), beleg(NEBENSATZ))])
  pruefe('verschiedene Anbieter bleiben getrennt', urls(r.eintraege).length === 2 && r.vorher === 3)
}
{
  const [a, b] = [`${A2Y}/1047200/marronnier-prime-video-simulcast/`, `${A2Y}/1057464/prime-video-marronniers-und-mehr/`].map((u) => beleg(u))
  pruefe('zwei anime2you-Artikel, einer mit „simulcast" im Pfad: nur einer bleibt', urls(entdoppeleBelege([eintrag(a!, b!)]).eintraege).length === 1)
}
{
  const CR = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15'
  const lineup = beleg(`${CR}/crunchyroll-anime-lineup-herbst-2026`)
  const synchros = beleg(`${CR}/crunchyroll-deutsche-synchros-herbst-2026`)
  const mitArt = (art: NewsMeldung['art']) => [{ ...eintrag(lineup, synchros), meldungen: [{ art, belege: [lineup, synchros] } as NewsMeldung] }]
  pruefe('Synchro-Aussage: der Artikel mit „synchros" im Pfad bleibt', urls(entdoppeleBelege(mitArt('neu')).eintraege).join() === synchros.url)
  pruefe('andere Aussage: die Reihenfolge entscheidet (kein Synchro-Vorrang)', urls(entdoppeleBelege(mitArt('folgen')).eintraege).join() === lineup.url)
}

console.log('\nBelege je Anbieter: Zusicherung des Baus')
{
  const [weg, bleibt] = [beleg(NEBENSATZ), beleg(YAIBA)]
  const e = { ...eintrag(weg, bleibt), meldungen: [{ art: 'angekuendigt', quelle: NEBENSATZ, belege: [weg, bleibt] } as NewsMeldung] }
  const r = entdoppeleBelege([e])
  pruefe('quelle rückt vom entfallenen auf den behaltenen Beleg', r.eintraege[0]!.meldungen[0]!.quelle === YAIBA, r.eintraege[0]!.meldungen[0]!.quelle)
  pruefe('quelle auf behaltenem Beleg: keine Meldung dazu', !belegFehler([e], r).some((f) => f.includes('Quelle')))
  const alt = { ...r, eintraege: [{ ...r.eintraege[0]!, meldungen: [{ ...r.eintraege[0]!.meldungen[0]!, quelle: NEBENSATZ }] }] }
  pruefe('quelle auf entfallenem Beleg wird gemeldet', belegFehler([e], alt).some((f) => f.includes('Quelle')))
}
{
  const fremd = ['https://www.manime.de/news/yaiba/1/', 'https://www.netflix.com/title/1', 'https://www.joyn.de/serien/yaiba', 'https://www.tv.de/yaiba/']
  const vorher = [eintrag(beleg(NEBENSATZ), beleg(YAIBA), ...fremd.map((u) => beleg(u)))]
  pruefe('stimmige Entdoppelung: kein Fehler', belegFehler(vorher, entdoppeleBelege(vorher)).length === 0)
  const doppelt = { ...entdoppeleBelege(vorher), eintraege: vorher, entfallen: [] }
  pruefe('ein doppelter Anbieter im Ergebnis wird gemeldet', belegFehler(vorher, doppelt).some((f) => f.includes('doppelt')))
  const leer = { ...entdoppeleBelege(vorher), eintraege: [eintrag()] }
  pruefe('eine Meldung ohne Belege wird gemeldet', belegFehler(vorher, leer).some((f) => f.includes('verlor alle')))
  const viele = [eintrag(beleg(`${A2Y}/1/yaiba-a/`), beleg(`${A2Y}/2/yaiba-b/`), beleg(`${A2Y}/3/yaiba-c/`))]
  pruefe('zu hoher Anteil entfallener Belege wird gemeldet', belegFehler(viele, entdoppeleBelege(viele)).some((f) => f.includes('mehr als')))
}

if (fehler) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('\nBelege je Anbieter: alles grün')
