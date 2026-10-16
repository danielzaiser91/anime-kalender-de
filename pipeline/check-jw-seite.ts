/**
 * Zusicherungen zur Regel „Deutsch laut JustWatch“ je Seite (`lib/jw-seite.ts`, `bau/jw-seite-ton.ts`), mit erfundenen Titeln:
 * Seitenschlüssel, Frist, Zugangsarten auf derselben Seite, eindeutige Serienangabe (Film, eine Staffel, kein Mehrteiler),
 * eigene Messung vor JustWatch, Wächter, Kandidaten, Kanal-Erbe, Widerspruchs-Liste und Hover. Läuft in `check:logic`.
 */
import type { StreamLink, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import type { JwBefund } from './lib/jw-vertrauen.ts'
import { abgeschalteteAnbieter, befundGilt, deutscheSeiten, jwKennzeichnungFehler, jwTonAnSeite, nurSerie, seitenSchluessel } from './lib/jw-seite.ts'
import { kennzeichneJwSeiten, type Messung } from './bau/jw-seite-ton.ts'
import { messungAusBelegen, neinAdressenAus } from './bau/jw-seite-messung.ts'
import { abschnitt, ersetzeAbschnitt, WIDERSPRUCHS_LISTE, widerspruchsZiel } from './bau/jw-widerspruchs-liste.ts'
import { jwNeinAus, kanalErbtVomAnbieter } from './bau/kanal-erbt-anbieter.ts'
import { dubZeilenVon } from '../web/src/components/detail/dub-zeilen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const HEUTE = '2026-10-16'
const gti = (n: number) => `amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const amazon = (n: number) => `https://watch.amazon.de/detail?gti=${gti(n)}`
const CR = 'https://www.crunchyroll.com/de/series/GABC12345/erfunden'
const CR_FOLGE = 'https://www.crunchyroll.com/de/watch/GABC12345/folge-1'
const angebot = (anbieter: string, url: string, audio = ['de', 'ja']) => ({ anbieter, art: 'FLATRATE', audio, url })
const befund = (angebote: JwBefund['angebote'], zusatz: Partial<JwBefund> = {}): JwBefund => ({
  geprueftAm: '2026-10-10',
  jwId: 'ts1',
  jwPfad: '/de/Serie/erfunden',
  staffeln: [{ nr: 1, angebote: [] }],
  angebote,
  ...zusatz,
})
const weg = (platform: string, url: string, extra: Partial<StreamLink> = {}): StreamLink => ({ platform, url, ...extra }) as StreamLink
const titel = (id: number, streams: StreamLink[], extra: Partial<Title> = {}): Title => ({ id, titleRomaji: `Erfunden ${id}`, streams, ...extra }) as unknown as Title
const ohneMessung = (): Messung => undefined

// Seitenschlüssel
pruefe('gti aus der Amazon-Adresse', seitenSchluessel(amazon(1)) === `amazon:${gti(1)}`)
pruefe('Crunchyroll: Serie und Folge derselben Kennung sind dieselbe Seite', seitenSchluessel(CR) === seitenSchluessel(CR_FOLGE) && seitenSchluessel(CR) === 'crunchyroll:GABC12345')
pruefe('Disney+: entity-Kennung', seitenSchluessel('https://www.disneyplus.com/de-de/browse/entity-12345678-1234-1234-1234-123456789abc') === 'disney:entity-12345678-1234-1234-1234-123456789abc')
pruefe('Disney+: Serie mit Kennung', seitenSchluessel('https://www.disneyplus.com/de-de/series/erfunden/5aBcD') === 'disney:5aBcD')
pruefe('Disney+: Film mit Kennung', seitenSchluessel('https://www.disneyplus.com/de-de/movies/erfunden/7xYz') === 'disney:7xYz')
{
  const zwei = [angebot('Amazon Prime Video', amazon(1)), angebot('Amazon Video', amazon(1)), angebot('Amazon Video', amazon(2), ['ja'])]
  const seiten = deutscheSeiten(befund(zwei), HEUTE)
  pruefe('deutsche Seiten: nur mit „de“, erster Anbieter bleibt', seiten.size === 1 && seiten.get(`amazon:${gti(1)}`) === 'Amazon Prime Video', [...seiten])
  pruefe('deutsche Seiten: alter Befund zählt nicht', deutscheSeiten(befund(zwei, { geprueftAm: '2026-09-01' }), HEUTE).size === 0)
}
pruefe('/dp/-Adresse hat keine Seitenkennung', seitenSchluessel('https://www.amazon.de/gp/video/detail/B09JLN6S1R') === undefined)

// Frist
pruefe('Befund von vor 27 Tagen gilt', befundGilt(befund([], { geprueftAm: '2026-09-19' }), HEUTE))
pruefe('Befund ab 28 Tagen gilt nicht', !befundGilt(befund([], { geprueftAm: '2026-09-18' }), HEUTE))
pruefe('verfehlte Suche gilt nicht', !befundGilt(befund([], { verfehltAm: '2026-10-12' }), HEUTE))
pruefe('ohne Treffer gilt nicht', !befundGilt(befund([], { ohneTreffer: true }), HEUTE))
pruefe('ohne JustWatch-Kennung gilt nicht', !befundGilt(befund([], { jwId: undefined }), HEUTE))

// Ton an der Seite: Zugangsart egal, Seite entscheidend
const nurKauf = befund([angebot('Amazon Video', amazon(1)), angebot('Amazon Prime Video', amazon(1), ['ja'])])
pruefe('Kauf und Abo auf derselben gti: ein „de“ reicht', jwTonAnSeite(nurKauf, amazon(1), HEUTE)?.deutsch === true)
pruefe('Kanal auf derselben gti zählt', jwTonAnSeite(befund([angebot('Aniverse Amazon Channel', amazon(1))]), amazon(1), HEUTE)?.deutsch === true)
pruefe('andere gti zählt nicht', jwTonAnSeite(befund([angebot('Amazon Prime Video', amazon(2))]), amazon(1), HEUTE) === undefined)
pruefe('Angebot ohne Tonangabe sagt nichts', jwTonAnSeite(befund([angebot('Amazon Prime Video', amazon(1), [])]), amazon(1), HEUTE) === undefined)
pruefe('Ton ohne „de“ heißt nein', jwTonAnSeite(befund([angebot('Amazon Prime Video', amazon(1), ['ja'])]), amazon(1), HEUTE)?.deutsch === false)
pruefe('Staffel-Angebot an der Seite zählt', jwTonAnSeite(befund([], { staffeln: [{ nr: 1, angebote: [angebot('Crunchyroll', CR_FOLGE)] }] }), CR, HEUTE)?.deutsch === true)

// Eindeutige Serienangabe (Fruits Basket 2019: Crunchyroll „de“ an der Serie, Staffel 1 nur Englisch)
pruefe('Film ist eindeutig, auch bei geteilter Kennung', nurSerie(befund([], { jwPfad: '/de/Film/x', staffeln: undefined }), 3) === undefined)
pruefe('Serie mit einer Staffel ist eindeutig', nurSerie(befund([]), 1) === undefined)
pruefe('Mehrteiler (Kennung bei mehreren unserer Titel)', nurSerie(befund([]), 2) === 'Mehrteiler')
pruefe('mehrere Staffeln bei JustWatch', nurSerie(befund([], { staffeln: [{ nr: 1, angebote: [] }, { nr: 2, angebote: [] }] }), 1) === 'mehrere Staffeln')
pruefe('mehrere Staffeln in unserem Bestand', nurSerie(befund([]), 1, 2) === 'mehrere Staffeln')
pruefe('Staffeln unbekannt (älterer Befund)', nurSerie(befund([], { staffeln: undefined }), 1) === 'Staffeln unbekannt')
pruefe('Staffeln unbekannt (leere Liste, JustWatch meldet Staffeln ohne Nummer)', nurSerie(befund([], { staffeln: [] }), 1) === 'Staffeln unbekannt')

// Wächter: mehr als 2 % Widersprüche
pruefe('Wächter: 1 von 50 (2 %) bleibt Flagge', !abgeschalteteAnbieter(new Map([['primevideo', { gemessen: 50, widerspruch: 1 }]])).has('primevideo'))
pruefe('Wächter: 1 von 49 schaltet ab', abgeschalteteAnbieter(new Map([['primevideo', { gemessen: 49, widerspruch: 1 }]])).has('primevideo'))

function lauf(titelListe: Title[], befunde: Record<string, JwBefund>, zusatz: Partial<Parameters<typeof kennzeichneJwSeiten>[0]> = {}) {
  return kennzeichneJwSeiten({ titel: titelListe, befunde, heute: HEUTE, messung: ohneMessung, hinweisNurSerie: true, ...zusatz })
}

{
  const prime = weg('primevideo', amazon(1))
  const cr = weg('crunchyroll', CR)
  const fremd = weg('primevideo', amazon(2))
  const urteil = weg('netflix', amazon(1), { dub: false })
  const alt = weg('primevideo', amazon(1), { entferntAm: '2026-10-01' })
  const e = lauf([titel(1, [prime, cr, fremd, urteil, alt])], { '1': befund([angebot('Amazon Video', amazon(1)), angebot('Crunchyroll', CR_FOLGE)]) })
  pruefe('Flagge am Prime-Weg (JustWatch nennt „de“ nur beim Kauf derselben gti)', prime.dubQuelle === 'justwatch' && prime.dubStand === '2026-10-10' && !prime.dubHintOnly && prime.dub === undefined)
  pruefe('Flagge am Crunchyroll-Weg (Serie, JustWatch verlinkt eine Folge)', cr.dubQuelle === 'justwatch' && !cr.dubHintOnly)
  pruefe('andere gti bekommt nichts', fremd.dubQuelle === undefined)
  pruefe('eigenes Urteil bleibt, zählt aber als Widerspruch', urteil.dub === false && urteil.dubQuelle === undefined && e.widersprueche.length === 1)
  pruefe('entfernter Weg bleibt unberührt', alt.dubQuelle === undefined)
  pruefe('Zählung Flaggen', e.flaggen === 2 && e.hinweise === 0, e)
  pruefe('eigene Seiten sind keine Kandidaten', e.kandidaten.length === 0, e.kandidaten)
}

{
  const ja = weg('primevideo', amazon(1), { dub: true })
  const ohneDe = weg('crunchyroll', CR)
  const e = lauf([titel(1, [ja, ohneDe])], { '1': befund([angebot('Amazon Prime Video', amazon(1)), angebot('Crunchyroll', CR, ['ja'])]) })
  pruefe('belegtes Ja zählt für den Wächter, bekommt aber keine Kennzeichnung', ja.dubQuelle === undefined && e.zaehlung.get('primevideo')?.gemessen === 1 && !e.zaehlung.get('primevideo')?.widerspruch, e)
  pruefe('JustWatch ohne „de“ an der Seite: keine Flagge', ohneDe.dubQuelle === undefined)
}

{
  const ab = weg('primevideo', amazon(1))
  const ac = weg('primevideo', amazon(1))
  const e = lauf([titel(1, [ab]), titel(2, [ac])], { '1': befund([angebot('Amazon Prime Video', amazon(1))]), '2': befund([angebot('Amazon Prime Video', amazon(1))]) })
  pruefe('Mehrteiler: weder Flagge noch Hinweis', ab.dubQuelle === undefined && ac.dubQuelle === undefined && e.nurSerie.get('Mehrteiler') === 2)
}

{
  const staffeln = [{ nr: 1, angebote: [] }, { nr: 2, angebote: [] }, { nr: 3, angebote: [] }]
  const anime = weg('crunchyroll', CR)
  const cartoon = weg('crunchyroll', CR)
  const b = { '1': befund([angebot('Crunchyroll', CR)], { staffeln }) }
  const e = lauf([titel(1, [anime])], b)
  pruefe('Fruits Basket: mehrere Staffeln, Anime behält nur den Hinweis', anime.dubQuelle === 'justwatch' && anime.dubHintOnly === true && e.flaggen === 0 && e.nurSerie.get('mehrere Staffeln') === 1)
  lauf([titel(1, [cartoon])], b, { hinweisNurSerie: false })
  pruefe('Cartoon mit mehreren Staffeln: kein Hinweis am Weg (er steht am Titel)', cartoon.dubQuelle === undefined)
  const ohneStaffeln = weg('primevideo', amazon(1))
  lauf([titel(1, [ohneStaffeln])], { '1': befund([angebot('Amazon Prime Video', amazon(1))], { staffeln: undefined }) })
  pruefe('Staffeln unbekannt: nur Hinweis', ohneStaffeln.dubHintOnly === true)
  const film = weg('primevideo', amazon(1))
  lauf([titel(1, [film])], { '1': befund([angebot('Amazon Prime Video', amazon(1))], { jwPfad: '/de/Film/x', staffeln: undefined }) })
  pruefe('Film bekommt die Flagge', film.dubQuelle === 'justwatch' && !film.dubHintOnly)
  const eigene = weg('primevideo', amazon(1))
  lauf([titel(-5, [eigene], { staffeln: [{ nr: 1, folgen: 10 }, { nr: 2, folgen: 10 }] } as Partial<Title>)], { '-5': befund([angebot('Amazon Prime Video', amazon(1))]) }, { hinweisNurSerie: false })
  pruefe('Cartoon mit zwei eigenen Staffeln: keine Flagge', eigene.dubQuelle === undefined)
  const gemessen = weg('crunchyroll', CR)
  const nein = (): Messung => ({ urteil: 'nein', quelle: 'Handbeleg' })
  const mehr = { '1': befund([angebot('Crunchyroll', CR), angebot('Amazon Prime Video', amazon(4))], { staffeln }) }
  const e2 = lauf([titel(1, [gemessen])], mehr, { messung: nein, neinAdressen: [{ id: 1, platform: 'primevideo', url: amazon(4), quelle: 'Handbeleg' }] })
  pruefe('mehrere Staffeln mit eigener Messung: kein Hinweis, kein Widerspruch', gemessen.dubQuelle === undefined && e2.widersprueche.length === 0 && e2.zaehlung.size === 0, e2)
  const e3 = lauf([titel(1, [weg('crunchyroll', CR)])], mehr)
  pruefe('mehrere Staffeln: keine Kandidaten aus der Serienangabe', e3.kandidaten.length === 0, e3.kandidaten)
}

{
  const t = titel(1, [weg('primevideo', amazon(3)), weg('netflix', 'https://www.netflix.com/title/1')])
  const e = lauf([t], { '1': befund([angebot('Amazon Prime Video', amazon(1)), angebot('Amazon Prime Video', amazon(3), ['ja'])]) })
  pruefe('Kandidat: Weg desselben Anbieters mit Seitenkennung ist kein „Weg ohne Kennung“', e.kandidaten.length === 1 && e.kandidaten[0]!.wegOhneKennung === false, e.kandidaten)
  const ohneDe = lauf([titel(1, [])], { '1': befund([angebot('Amazon Prime Video', amazon(5), ['ja'])]) }, { neinAdressen: [{ id: 1, platform: 'primevideo', url: amazon(5), quelle: 'Handbeleg' }] })
  pruefe('Handbeleg-Nein an einer Seite ohne JustWatch-„de“ ist kein Widerspruch', ohneDe.widersprueche.length === 0)
}

{
  const gemessen = weg('primevideo', amazon(1))
  const offen = weg('primevideo', amazon(1))
  const b = befund([angebot('Amazon Prime Video', amazon(1))])
  const nein = (t: Title): Messung => (t.id === 1 ? { urteil: 'nein', quelle: 'Handbeleg 2026-10-01' } : undefined)
  const e = lauf([titel(1, [gemessen]), titel(2, [offen])], { '1': b, '2': { ...b, jwId: 'ts2' } }, { messung: nein })
  pruefe('eigene Messung „nein“ schlägt JustWatch', gemessen.dubQuelle === undefined && e.widersprueche[0]?.gemessen === 'Handbeleg 2026-10-01')
  pruefe('Wächter: 1 von 1 gemessen widerspricht, Anbieter nur Hinweis', e.abgeschaltet.has('primevideo') && offen.dubHintOnly === true && e.hinweise === 1, e)
}

{
  const t = titel(1, [weg('primevideo', 'https://www.amazon.de/gp/video/detail/B09JLN6S1R')])
  const b = { '1': befund([angebot('Amazon Prime Video', amazon(1)), angebot('Amazon Prime Video', amazon(3))]) }
  const nein = [{ id: 1, platform: 'primevideo', url: amazon(3), quelle: 'Handbeleg 2026-10-02' }]
  const e = lauf([t], b, { neinAdressen: nein })
  pruefe('Kandidat: JustWatch-„de“ an einer Seite ohne unseren Weg', e.kandidaten.length === 1 && e.kandidaten[0]!.seite === `amazon:${gti(1)}` && e.kandidaten[0]!.wegOhneKennung, e.kandidaten)
  pruefe('entfernter Weg mit Handbeleg-Nein: Widerspruch statt Kandidat', e.widersprueche.length === 1 && e.zaehlung.get('primevideo')?.widerspruch === 1)
  pruefe('kein neuer Weg', t.streams.length === 1)
  const aus = lauf([titel(1, [weg('primevideo', amazon(1))])], b, { ausgenommen: new Set(['1']) })
  pruefe('ausgenommener Titel (TMDB mehrdeutig) bleibt unberührt', aus.flaggen === 0 && aus.kandidaten.length === 0)
}

// Eigene Messung aus Belegen: Handbeleg vor Meldung vor Messurteil
{
  const s = weg('primevideo', amazon(1))
  const checks = [
    { anilistId: 1, platform: 'primevideo', dub: true, checkedAt: '2026-10-01' },
    { anilistId: 2, platform: 'primevideo', available: false, checkedAt: '2026-10-01' },
    { anilistId: 3, platform: 'primevideo', dub: false, url: amazon(9), checkedAt: '2026-10-01' },
    { anilistId: 7, platform: 'primevideo', dubRanges: [{ from: 1, to: 3, dub: true }], checkedAt: '2026-10-01' },
    { anilistId: 9, platform: 'primevideo', dub: false, checkedAt: '2026-10-01' },
  ] as DubCheck[]
  const urteile = { '1|primevideo|1': { urteil: 'kein deutsch' }, '4|primevideo|1': { urteil: 'kein deutsch' }, '4|primevideo|2': { urteil: 'deutsch' }, '5|primevideo|1': { urteil: 'kein deutsch' } }
  const meldungen = {
    [amazon(1)]: { titleId: 6, plattform: 'primevideo', folgen: [{ sprachen: ['Japanisch'] }] },
    [`${amazon(1)}&x=1`]: { titleId: 8, plattform: 'primevideo', folgen: [{ sprachen: ['Japanisch'] }, { sprachen: ['Deutsch'] }] },
  }
  const m = messungAusBelegen(checks, urteile, meldungen)
  pruefe('Handbeleg „deutsch“ schlägt Messurteil', m(titel(1, []), s)?.urteil === 'ja')
  pruefe('„nicht verfügbar“ sagt nichts über den Ton', m(titel(2, []), s) === undefined)
  pruefe('Handbeleg an anderer Adresse gilt nicht für diesen Weg', m(titel(3, []), s) === undefined)
  pruefe('ein „deutsch“ unter den Messurteilen reicht', m(titel(4, []), s)?.urteil === 'ja')
  pruefe('nur „kein deutsch“ heißt nein', m(titel(5, []), s)?.urteil === 'nein')
  pruefe('Meldung ohne Deutsch an derselben Seite heißt nein', m(titel(6, []), s)?.urteil === 'nein')
  pruefe('Meldung mit Deutsch an derselben Seite heißt ja', m(titel(8, []), s)?.urteil === 'ja')
  pruefe('Handbeleg nur mit deutschen Folgenbereichen heißt ja', m(titel(7, []), s)?.urteil === 'ja')
  pruefe('Nein-Adressen aus Handbelegen', neinAdressenAus(checks).length === 1 && neinAdressenAus(checks)[0]!.url === amazon(9))
}

// Kanal-Erbe: JustWatch an der Kanal-Seite schlägt die Annahme
{
  const anbieter = () => weg('crunchyroll', CR, { dub: true })
  const kanal = (extra: Partial<StreamLink> = {}) => weg('primevideo', amazon(1), { kanal: 'crunchyroll', ...extra } as Partial<StreamLink>)
  const k1 = kanal()
  kanalErbtVomAnbieter([titel(1, [anbieter(), k1])], () => true)
  pruefe('JustWatch „ohne Deutsch“ an der Kanal-Seite: kein Erbe', k1.dub === undefined)
  const k2 = kanal({ dubQuelle: 'justwatch', dubStand: '2026-10-10' })
  kanalErbtVomAnbieter([titel(1, [anbieter(), k2])])
  pruefe('Kanal mit JustWatch-Flagge: kein Erbe, Flagge bleibt', k2.dub === undefined && k2.dubQuelle === 'justwatch')
  const k3 = kanal({ dubQuelle: 'justwatch', dubStand: '2026-10-10', dubHintOnly: true })
  kanalErbtVomAnbieter([titel(1, [anbieter(), k3])])
  pruefe('Kanal mit bloßem Hinweis erbt, der Hinweis entfällt', k3.dub === true && k3.dubQuelle === undefined && k3.dubHintOnly === undefined && k3.dubStand === undefined)
  const nein = jwNeinAus({ '1': befund([angebot('Amazon Prime Video', amazon(1), ['ja']), angebot('Amazon Prime Video', amazon(2), [])]) }, HEUTE)
  pruefe('JustWatch-Ton ohne „de“ an der Kanal-Seite ist ein Nein', nein(titel(1, []), kanal()))
  pruefe('ohne Tonangabe an der Seite kein Nein', !nein(titel(1, []), weg('primevideo', amazon(2))) && !nein(titel(2, []), kanal()))
}

// Widerspruchs-Liste: jede Phase ersetzt nur ihren Abschnitt, Anime vor Cartoons
{
  const leer = lauf([], {})
  const cartoons = ersetzeAbschnitt('', 'Cartoons', abschnitt('Cartoons', leer))
  const beide = ersetzeAbschnitt(cartoons, 'Anime', abschnitt('Anime', leer))
  pruefe('Anime-Abschnitt steht vor Cartoons', beide.indexOf('## Anime') > 0 && beide.indexOf('## Anime') < beide.indexOf('## Cartoons'))
  const neu = ersetzeAbschnitt(beide, 'Anime', abschnitt('Anime', { ...leer, flaggen: 7 }))
  pruefe('erneuter Bau ersetzt nur den eigenen Abschnitt', neu.includes('Flagge „Deutsch“: 7 Wege') && neu.split('## Cartoons').length === 2 && neu.split('## Anime').length === 2)
  pruefe('neue Liste beginnt mit dem Kopf', cartoons.startsWith('# JustWatch-Widersprüche'))
  pruefe('ohne Serienangaben steht „keine“', abschnitt('Anime', leer).includes('Serienangabe (Mehrteiler oder mehrere Staffeln, keine Flagge): keine.'))
  const voll = abschnitt('Anime', {
    ...leer,
    zaehlung: new Map([['primevideo', { gemessen: 2, widerspruch: 1 }]]),
    abgeschaltet: new Set(['primevideo']),
    kandidaten: [{ id: 1, titel: 'Erfunden', anbieter: 'Amazon Video', seite: 'amazon:x', wegOhneKennung: true }],
  })
  pruefe('Wächter-Zeile nennt „nur Hinweis“', voll.includes('| primevideo | 2 | 1 | 50.0 % | nur Hinweis |'), voll)
  pruefe('Kandidat mit Weg ohne Kennung', voll.includes('| amazon:x | ja |'), voll)
}

// Hover: Herkunft nur an der Flagge
{
  const t = ((k: string, p?: Record<string, unknown>) => `${k}${p ? JSON.stringify(p) : ''}`) as Parameters<typeof dubZeilenVon>[0]['t']
  const zeilen = dubZeilenVon({ title: undefined, t, releases: [], today: HEUTE })
  pruefe('Hover nennt JustWatch an der Flagge', zeilen({ dubQuelle: 'justwatch', dubStand: '2026-10-10' })[0]?.startsWith('detail.pilleJustwatch') === true)
  pruefe('Hover schweigt beim Hinweis (Stand steht in der Pille)', zeilen({ dubQuelle: 'justwatch', dubStand: '2026-10-10', dubHintOnly: true }).length === 0)
  pruefe('Hover schweigt ohne JustWatch-Quelle', zeilen({ dubStand: '2026-10-10' }).length === 0)
}

// Bestandsprüfung der Kennzeichnung: Flagge an der Seite, Staffel-Hinweis nur bei JustWatch-Staffeln
{
  const disney = 'https://www.disneyplus.com/de-de/movies/x/AbC123'
  const flagge = { platform: 'disneyplus', url: disney, dubQuelle: 'justwatch', dubStand: '2026-10-10' } as StreamLink
  const staffel = { platform: 'disneyplus', url: disney, dubQuelle: 'justwatch', dubStand: '2026-10-10', dubHintOnly: true, teilBereich: { von: 1, bis: 3 } } as StreamLink
  pruefe('Film-Flagge ohne JustWatch-Staffeln ist richtig', jwKennzeichnungFehler('tmdb', flagge) === undefined)
  pruefe('Flagge ohne Seitenkennung ist falsch', jwKennzeichnungFehler(undefined, { ...flagge, url: 'https://www.disneyplus.com/' }) !== undefined)
  pruefe('Hinweis ohne Seitenkennung ist richtig', jwKennzeichnungFehler(undefined, { ...flagge, url: 'https://www.disneyplus.com/', dubHintOnly: true }) === undefined)
  pruefe('Staffel-Hinweis bei JustWatch-Staffeln ist richtig', jwKennzeichnungFehler('justwatch', staffel) === undefined)
  pruefe('Staffel-Hinweis bei TMDB-Staffeln ist falsch', jwKennzeichnungFehler('tmdb', staffel) !== undefined)
  pruefe('Staffel-Teilweg mit Flagge ist falsch', jwKennzeichnungFehler('justwatch', { ...staffel, dubHintOnly: undefined }) !== undefined)
  pruefe('Kennzeichnung mit Urteil ist falsch', jwKennzeichnungFehler('tmdb', { ...flagge, dub: true }) !== undefined)
  pruefe('Kennzeichnung ohne Datum ist falsch', jwKennzeichnungFehler('tmdb', { ...flagge, dubStand: undefined }) !== undefined)
  pruefe('Weg ohne Kennzeichnung ist richtig', jwKennzeichnungFehler(undefined, { platform: 'netflix', url: 'n' } as StreamLink) === undefined)
}

// Prüfungen schreiben die Liste nicht ins Repo
{
  const vorher = process.env.SUCHADRESSEN_ORDNER
  process.env.SUCHADRESSEN_ORDNER = '/tmp/x'
  pruefe('Liste folgt SUCHADRESSEN_ORDNER', widerspruchsZiel() === '/tmp/x/justwatch-widersprueche.md', widerspruchsZiel())
  delete process.env.SUCHADRESSEN_ORDNER
  pruefe('Liste ohne Umlenkung im Repo', widerspruchsZiel() === WIDERSPRUCHS_LISTE, widerspruchsZiel())
  if (vorher !== undefined) process.env.SUCHADRESSEN_ORDNER = vorher
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-seite: ok')
