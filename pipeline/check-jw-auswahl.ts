/**
 * Auswahlstellen der JustWatch-Seitenregel mit mehreren Kandidaten (Treffer vorn, in der Mitte, hinten) und der Parser der
 * unbedingten Aufrufe mit seinen Negativfällen. Läuft in `check:logic`.
 */
import type { StreamLink, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import type { JwBefund } from './lib/jw-vertrauen.ts'
import { jwTonAnSeite } from './lib/jw-seite.ts'
import { unbedingteAufrufe } from './lib/unbedingte-aufrufe.ts'
import { kennzeichneJwSeiten, type Messung } from './bau/jw-seite-ton.ts'
import { messungAusBelegen, type MeldungRoh } from './bau/jw-seite-messung.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const HEUTE = '2026-10-16'
const gti = (n: number) => `amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const amazon = (n: number) => `https://watch.amazon.de/detail?gti=${gti(n)}`
const angebot = (url: string, audio: string[]) => ({ anbieter: 'Amazon Prime Video', art: 'FLATRATE', audio, url })
const befund = (angebote: JwBefund['angebote']): JwBefund => ({
  geprueftAm: '2026-10-10',
  jwId: 'ts1',
  jwPfad: '/de/Serie/erfunden',
  staffeln: [{ nr: 1, angebote: [] }],
  angebote,
})
const weg = (platform: string, url: string): StreamLink => ({ platform, url }) as StreamLink
const titel = (id: number, streams: StreamLink[]): Title => ({ id, titleRomaji: `Erfunden ${id}`, streams }) as unknown as Title

// Parser: nur eine eigene Anweisung mit dem Aufruf als Wert zählt (Grenze: ein frühes `return` davor wird nicht erkannt)
const rumpf = (zeilen: string): string => `function f() {\n${zeilen}\n}`
const namen = (zeilen: string): string[] => unbedingteAufrufe(rumpf(zeilen), 'f').map((a) => a.name)
{
  const ok = unbedingteAufrufe(rumpf('vorher()\nconst x = g(a, b)'), 'f')
  pruefe('Parser: Aufruf und Zuweisung zählen mit Argumenten und Stelle', ok.map((a) => `${a.stelle}:${a.name}(${a.args.join(',')})`).join('|') === '0:vorher()|1:g(a,b)', ok)
  pruefe('Parser: rechte Seite von && zählt nicht', namen('0 && g()').length === 0, namen('0 && g()'))
  pruefe('Parser: rechte Seite von && in einer Zuweisung zählt nicht', namen('const x = c && g()').length === 0)
  pruefe('Parser: if-Rumpf ohne Klammern zählt nicht', namen('if (c) g()').length === 0)
  pruefe('Parser: if-Rumpf mit Klammern zählt nicht', namen('if (c) {\ng()\n}').length === 0)
  pruefe('Parser: else-Zweig zählt nicht', namen('if (c) {\n} else {\ng()\n}').length === 0)
  pruefe('Parser: Ternär-Zweige zählen nicht', namen('c ? g() : h()').length === 0)
  pruefe('Parser: Ternär in einer Zuweisung zählt nicht', namen('const x = c ? g() : h()').length === 0)
  const drei = `function a() {\n  x1()\n}\nfunction f() {\n  const p = y1(1), q = y2(2)\n}\nfunction z() {\n  x2()\n}`
  pruefe('Parser: die genannte Funktion in der Mitte von dreien, nur der erste Deklarator zählt', unbedingteAufrufe(drei, 'f').map((a) => a.name).join() === 'y1', unbedingteAufrufe(drei, 'f'))
  pruefe('Parser: Aufruf neben einem bedingten zählt allein', namen('0 && g()\nh()\nif (c) k()').join() === 'h', namen('0 && g()\nh()\nif (c) k()'))
}

// jw-seite.ts: „de“ nur beim mittleren von drei Angeboten derselben Seite
{
  const drei = befund([angebot(amazon(1), ['ja']), angebot(amazon(1), ['de', 'ja']), angebot(amazon(1), ['en'])])
  pruefe('Ton an der Seite: „de“ beim mittleren Angebot reicht', jwTonAnSeite(drei, amazon(1), HEUTE)?.deutsch === true)
  const ohne = befund([angebot(amazon(1), ['ja']), angebot(amazon(1), ['en']), angebot(amazon(1), ['fr'])])
  pruefe('Ton an der Seite: ohne „de“ bei allen dreien heißt nein', jwTonAnSeite(ohne, amazon(1), HEUTE)?.deutsch === false)
}

// jw-seite-messung.ts: Handbelege, Meldungen und Messurteile mit mehreren Kandidaten
{
  const s = weg('primevideo', amazon(1))
  const beleg = (id: number, extra: Partial<DubCheck>): DubCheck => ({ anilistId: id, platform: 'primevideo', checkedAt: '2026-10-01', ...extra }) as DubCheck
  const checks = [
    beleg(1, { dub: false }),
    beleg(1, { dub: true, checkedAt: '2026-10-02' }),
    beleg(1, { dub: false, checkedAt: '2026-10-03' }),
    beleg(2, { available: false }),
    beleg(2, { dub: false, checkedAt: '2026-10-04' }),
    beleg(2, { dub: false, checkedAt: '2026-10-05' }),
    beleg(3, { dub: false, url: amazon(9) }),
    beleg(3, { dub: true, checkedAt: '2026-10-06' }),
    beleg(9, { dub: true, platform: 'netflix' }),
  ]
  const urteile = {
    '4|netflix|1': { urteil: 'deutsch' },
    '4|primevideo|1': { urteil: 'kein deutsch' },
    '5|netflix|1': { urteil: 'deutsch' },
  }
  const meldungen = {
    [amazon(9)]: { titleId: 6, plattform: 'primevideo', folgen: [{ sprachen: ['Japanisch'] }] },
    [`${amazon(1)}&x=1`]: { titleId: 6, plattform: 'primevideo', folgen: [{ sprachen: ['Deutsch'] }] },
    [`${amazon(1)}&x=2`]: { titleId: 6, plattform: 'netflix', folgen: [{ sprachen: ['Japanisch'] }] },
    [`${amazon(1)}&x=3`]: { titleId: 8, plattform: 'netflix', folgen: [{ sprachen: ['Deutsch'] }] },
    [`${amazon(1)}&x=4`]: { titleId: 8, plattform: 'primevideo', folgen: [{ sprachen: ['Japanisch'] }] },
  }
  const m = messungAusBelegen(checks, urteile, meldungen)
  pruefe('mehrere Handbelege: das „ja“ in der Mitte schlägt das „nein“ davor', m(titel(1, []), s)?.urteil === 'ja', m(titel(1, []), s))
  pruefe('mehrere Handbelege: „nein“ nach einem „nicht verfügbar“', m(titel(2, []), s)?.quelle === 'Handbeleg 2026-10-04', m(titel(2, []), s))
  pruefe('mehrere Handbelege: „ja“ vorn mit Adresse eines anderen Wegs davor', m(titel(3, []), s)?.urteil === 'ja', m(titel(3, []), s))
  pruefe('Messurteil: „deutsch“ einer anderen Plattform zählt nicht', m(titel(4, []), s)?.urteil === 'nein', m(titel(4, []), s))
  pruefe('Messurteil: nur eine andere Plattform sagt nichts', m(titel(5, []), s) === undefined, m(titel(5, []), s))
  pruefe('Handbeleg: „ja“ einer anderen Plattform zählt nicht', m(titel(9, []), s) === undefined, m(titel(9, []), s))
  pruefe('Meldung: „Deutsch“ einer anderen Plattform zählt nicht', m(titel(8, []), s)?.urteil === 'nein', m(titel(8, []), s))
  pruefe('Meldung: Adresse eines anderen Wegs davor, Deutsch an unserer Seite', m(titel(6, []), s)?.urteil === 'ja', m(titel(6, []), s))
}

// jw-seite-messung.ts: drei Meldungen an derselben Seite, Deutsch nur bei der mittleren (Treffer weder vorn noch hinten)
{
  const s = weg('primevideo', amazon(1))
  const meldung = (nr: number, sprache: string): [string, MeldungRoh] => [`${amazon(1)}&y=${nr}`, { titleId: 11, plattform: 'primevideo', folgen: [{ sprachen: [sprache] }] }]
  const mitte = Object.fromEntries([meldung(1, 'Japanisch'), meldung(2, 'Deutsch'), meldung(3, 'Japanisch')])
  const m = messungAusBelegen([], {}, mitte)
  pruefe('Meldungen: Deutsch nur bei der mittleren von dreien an unserer Seite', m(titel(11, []), s)?.urteil === 'ja', m(titel(11, []), s))
  pruefe('Meldungen: Quelle ist die erste Meldung mit Ton', m(titel(11, []), s)?.quelle === `Meldung der Erweiterung ${amazon(1)}&y=1`, m(titel(11, []), s))
  const leer = (nr: number, sprachen: string[]): [string, MeldungRoh] => [`${amazon(1)}&z=${nr}`, { titleId: 13, plattform: 'primevideo', folgen: [{ sprachen }] }]
  const ohneTon = messungAusBelegen([], {}, Object.fromEntries([leer(1, []), leer(2, ['Japanisch']), leer(3, [])]))
  pruefe('Meldungen: nur die mittlere von dreien nennt einen Ton, ohne Deutsch heißt nein', ohneTon(titel(13, []), s)?.urteil === 'nein', ohneTon(titel(13, []), s))
  const folgen3 = { [`${amazon(1)}&z=9`]: { titleId: 14, plattform: 'primevideo', folgen: [{ sprachen: [] }, { sprachen: ['Japanisch'] }, { sprachen: [] }] } }
  const mf = messungAusBelegen([], {}, folgen3)
  pruefe('Meldung: nur die mittlere von drei Folgen nennt einen Ton', mf(titel(14, []), s)?.urteil === 'nein', mf(titel(14, []), s))
  const bereiche = [{ dub: false }, { dub: true }, { dub: false }]
  const rb = messungAusBelegen([{ anilistId: 12, platform: 'primevideo', checkedAt: '2026-10-07', dubRanges: bereiche } as unknown as DubCheck], {}, {})
  pruefe('Handbeleg: Deutsch nur im mittleren von drei Bereichen', rb(titel(12, []), s)?.urteil === 'ja', rb(titel(12, []), s))
  const keine = Object.fromEntries([meldung(1, 'Japanisch'), meldung(2, 'Englisch'), meldung(3, 'Japanisch')])
  const n = messungAusBelegen([], {}, keine)
  pruefe('Meldungen: ohne Deutsch bei allen dreien heißt nein', n(titel(11, []), s)?.urteil === 'nein', n(titel(11, []), s))
  const folgen = { [`${amazon(1)}&y=1`]: { titleId: 11, plattform: 'primevideo', folgen: [{ sprachen: ['Japanisch'] }, { sprachen: ['Deutsch'] }, { sprachen: ['Japanisch'] }] } }
  const f = messungAusBelegen([], {}, folgen)
  pruefe('Meldung: Deutsch nur bei der mittleren von drei Folgen', f(titel(11, []), s)?.urteil === 'ja', f(titel(11, []), s))
}

// jw-seite-ton.ts: Ein Nein, dessen Weg noch besteht, zählt als Widerspruch des Wegs, nicht noch einmal als entfernter
{
  const nein = (): Messung => ({ urteil: 'nein', quelle: 'Handbeleg 2026-10-01' })
  const da = weg('primevideo', amazon(1))
  const b = befund([angebot(amazon(1), ['de'])])
  const adressen = [
    { id: 2, platform: 'primevideo', url: amazon(1), quelle: 'Handbeleg 2026-10-01' },
    { id: 1, platform: 'primevideo', url: amazon(1), quelle: 'Handbeleg 2026-10-01' },
    { id: 7, platform: 'primevideo', url: amazon(1), quelle: 'Handbeleg 2026-10-01' },
  ]
  const e = kennzeichneJwSeiten({ titel: [titel(1, [da])], befunde: { '1': b }, heute: HEUTE, messung: nein, neinAdressen: adressen, hinweisNurSerie: true })
  pruefe('Nein-Adresse bei bestehendem Weg: ein Widerspruch', e.widersprueche.length === 1, e.widersprueche)
  pruefe('Nein-Adresse bei bestehendem Weg: einmal gezählt', e.zaehlung.get('primevideo')?.gemessen === 1 && e.zaehlung.get('primevideo')?.widerspruch === 1, [...e.zaehlung])
  const weg2 = titel(1, [weg('primevideo', amazon(2))])
  const f = kennzeichneJwSeiten({ titel: [weg2], befunde: { '1': b }, heute: HEUTE, messung: () => undefined, neinAdressen: adressen, hinweisNurSerie: true })
  pruefe('Nein-Adresse bei entferntem Weg: ein Widerspruch', f.widersprueche.length === 1 && f.widersprueche[0]!.id === 1, f.widersprueche)
  // drei Wege, der verneinte in der Mitte: er besteht noch, also kein zweiter, „entfernter“ Widerspruch
  const drei = titel(1, [weg('primevideo', amazon(2)), da, weg('primevideo', amazon(3))])
  const nur = [adressen[1]!]
  const g = kennzeichneJwSeiten({ titel: [drei], befunde: { '1': b }, heute: HEUTE, messung: nein, neinAdressen: nur, hinweisNurSerie: true })
  pruefe('Nein-Adresse beim mittleren von drei Wegen: ein Widerspruch', g.widersprueche.length === 1, g.widersprueche)
  // Kandidat an einer Seite ohne unseren Weg: „Weg ohne Kennung“ nur, wenn ein Weg des Anbieters (hier der mittlere) keine hat
  const fremd = befund([angebot(amazon(5), ['de'])])
  const kand = (wege: StreamLink[]) => kennzeichneJwSeiten({ titel: [titel(1, wege)], befunde: { '1': fremd }, heute: HEUTE, messung: () => undefined, hinweisNurSerie: true }).kandidaten
  const ohneKennung = kand([weg('primevideo', amazon(2)), weg('primevideo', 'https://www.amazon.de/dp/B0X'), weg('primevideo', amazon(3))])
  pruefe('Kandidat: mittlerer von drei Wegen ohne Kennung', ohneKennung.length === 1 && ohneKennung[0]!.wegOhneKennung === true, ohneKennung)
  const alleMit = kand([weg('primevideo', amazon(2)), weg('primevideo', amazon(4)), weg('primevideo', amazon(3))])
  pruefe('Kandidat: alle drei Wege mit Kennung', alleMit.length === 1 && alleMit[0]!.wegOhneKennung === false, alleMit)
  pruefe('Nein-Adresse beim mittleren von drei Wegen: einmal gezählt', g.zaehlung.get('primevideo')?.widerspruch === 1, [...g.zaehlung])
}

// jw-seite-messung.ts: Netflix-Meldungen tragen eine Staffelmarke (`#s1`, `#0`); sie gilt der Seite ohne Marke
{
  const seite = 'https://www.netflix.com/title/70302573'
  const s = weg('netflix', seite)
  const meldung = (marke: string, id: number, sprache: string): [string, MeldungRoh] => [`${seite}${marke}`, { titleId: id, plattform: 'netflix', folgen: [{ sprachen: [sprache] }] }]
  const m = messungAusBelegen([], {}, Object.fromEntries([meldung('', 21, 'Japanisch'), meldung('#s1', 22, 'Deutsch'), meldung('#0', 23, 'Japanisch'), meldung('#s12', 24, 'Deutsch')]))
  pruefe('Netflix: Meldung ohne Marke trifft', m(titel(21, []), s)?.urteil === 'nein', m(titel(21, []), s))
  pruefe('Netflix: Meldung mit #s1 trifft die Seite', m(titel(22, []), s)?.urteil === 'ja', m(titel(22, []), s))
  pruefe('Netflix: Meldung mit #0 trifft die Seite', m(titel(23, []), s)?.urteil === 'nein', m(titel(23, []), s))
  pruefe('Netflix: Meldung mit #s12 trifft die Seite', m(titel(24, []), s)?.urteil === 'ja', m(titel(24, []), s))
  const andere = messungAusBelegen([], {}, { 'https://www.netflix.com/title/999#s1': { titleId: 25, plattform: 'netflix', folgen: [{ sprachen: ['Deutsch'] }] } })
  pruefe('Netflix: Meldung einer anderen Seite mit Marke trifft nicht', andere(titel(25, []), s) === undefined, andere(titel(25, []), s))
  const prime = weg('primevideo', 'https://www.amazon.de/dp/B0D188KVH4')
  const pm = messungAusBelegen([], {}, { 'https://www.amazon.de/dp/B0D188KVH4#4': { titleId: 26, plattform: 'primevideo', folgen: [{ sprachen: ['Deutsch'] }] } })
  const detail = 'https://www.amazon.de/gp/video/detail/B0FW2J99HL'
  const dm = messungAusBelegen([], {}, { [`${detail}#3`]: { titleId: 27, plattform: 'primevideo', folgen: [{ sprachen: ['Deutsch'] }] } })
  pruefe('Prime: Teilmarke #3 an einer Detailseite gilt der Teilseite, nicht der Seite (unverändert)', dm(titel(27, []), weg('primevideo', detail)) === undefined, dm(titel(27, []), weg('primevideo', detail)))
  pruefe('Prime: Teilmarke #4 an einer dp-Seite bleibt unverändert (gilt der Teilseite, kein Treffer)', pm(titel(26, []), prime) === undefined, pm(titel(26, []), prime))
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-auswahl: ok')
