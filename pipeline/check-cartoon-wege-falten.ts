/**
 * Zusicherungen zum Falten der Cartoon-Wege im Panel (`web/src/components/detail/wege-falten.ts`): anschließende Teilwege mit
 * gleicher Aussage sind eine Pille, jede Abweichung (Hinweis, Haken, Anbieter, Lücke) trennt, „Staffel" steht nur, wo der
 * Ausschnitt genau Staffeln trifft, TMDB-Staffeln heißen „laut TMDB". Läuft in `check:logic`.
 */
import { falteTeilwege, staffelSpanne, teilAngaben } from '../web/src/components/detail/wege-falten.ts'
import type { StreamLink } from '../shared/types.ts'
import type { Translate } from '../web/src/lib/i18n.tsx'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const url = 'https://watch.amazon.de/detail?gti=x'
const weg = (von: number, bis: number, extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'primevideo', url, teilBereich: { von, bis }, ...extra }) as StreamLink
const bereiche = (ws: StreamLink[]) => ws.map((w) => `${w.teilBereich?.von}-${w.teilBereich?.bis}`).join()
const hinweis = { dubQuelle: 'justwatch', dubStand: '2026-10-11' } as const

// Om Nom: Reihen ohne eigene Aussage und Reihen mit JustWatch-Hinweis werden je eine Pille.
const om = falteTeilwege([weg(1, 11), weg(12, 21), weg(22, 29), weg(30, 39, hinweis), weg(40, 50, hinweis), weg(51, 61)])
pruefe('gleiche Aussage, anschließend: eine Pille', bereiche(om) === '1-29,30-50,51-61', bereiche(om))
pruefe('Hinweis trennt von Teilwegen ohne Hinweis', om.length === 3 && om[1].dubQuelle === 'justwatch' && !om[0].dubQuelle)

// Jack: je Buch ein eigener Beleg bleibt getrennt (andere Haken-Bereiche).
const jack = falteTeilwege([1, 2, 12].map((von, i) => weg(von, [1, 11, 21][i], { dub: true, dubRanges: [{ from: von, to: [1, 11, 21][i], dub: true }] })))
pruefe('verschiedene Haken-Bereiche bleiben getrennt', jack.length === 3, bereiche(jack))
pruefe('Haken ohne Hinweis und mit Hinweis trennen', falteTeilwege([weg(1, 5, { dub: true, dubRanges: [{ from: 1, to: 5, dub: true }] }), weg(6, 9)]).length === 2)

// Lücke, anderer Anbieter, andere Adresse, Weg ohne Ausschnitt.
pruefe('Lücke im Ausschnitt trennt', falteTeilwege([weg(1, 5), weg(7, 9)]).length === 2)
pruefe('andere Adresse trennt', falteTeilwege([weg(1, 5), { ...weg(6, 9), url: `${url}2` }]).length === 2)
pruefe('anderer Anbieter trennt', falteTeilwege([weg(1, 5), { ...weg(6, 9), platform: 'disneyplus' }]).length === 2)
pruefe('Zugangsart trennt', falteTeilwege([weg(1, 5, { zugang: 'abo' }), weg(6, 9, { zugang: 'kauf' })]).length === 2)
const ganz: StreamLink = { platform: 'primevideo', url }
pruefe('Weg ohne Ausschnitt bleibt unberührt', falteTeilwege([ganz, ganz]).length === 2 && falteTeilwege([ganz])[0] === ganz)

// Reihenfolge der Anbieter bleibt, auch wenn ihre Teilwege abwechselnd stehen.
const gemischt = falteTeilwege([weg(1, 5), { ...weg(1, 5), platform: 'disneyplus', url: 'd' }, weg(6, 9), { ...weg(6, 9), platform: 'disneyplus', url: 'd' }])
pruefe('abwechselnde Anbieter werden je Anbieter gefaltet', gemischt.map((w) => `${w.platform}:${bereiche([w])}`).join() === 'primevideo:1-9,disneyplus:1-9')
pruefe('Stand: der älteste gilt', falteTeilwege([weg(1, 5, { ...hinweis, dubStand: '2026-10-12' }), weg(6, 9, hinweis)])[0].dubStand === '2026-10-11')
pruefe('Eingabe bleibt unverändert', (() => { const e = weg(1, 5); falteTeilwege([e, weg(6, 9)]); return e.teilBereich?.bis === 5 })())

// Staffelangabe: nur, wo der Ausschnitt Staffelgrenzen trifft.
const rubble = { staffeln: [{ nr: 1, folgen: 49 }, { nr: 2, folgen: 49 }, { nr: 3, folgen: 19 }], staffelnQuelle: 'justwatch' as const }
pruefe('Staffelspanne 1–2', JSON.stringify(staffelSpanne(rubble, { von: 1, bis: 98 })) === '{"von":1,"bis":2}')
pruefe('Staffelspanne eine Staffel', staffelSpanne(rubble, { von: 99, bis: 117 })?.von === 3)
pruefe('Ausschnitt mitten in einer Staffel: keine Staffelangabe', staffelSpanne(rubble, { von: 1, bis: 50 }) === undefined && staffelSpanne(rubble, { von: 2, bis: 49 }) === undefined)
pruefe('Ende vor Anfang: keine Staffelangabe', staffelSpanne(rubble, { von: 50, bis: 49 }) === undefined)
pruefe('Titel ohne Staffeln: keine Staffelangabe', staffelSpanne({}, { von: 1, bis: 5 }) === undefined)
pruefe('TMDB-Staffeln sind „laut TMDB"', staffelSpanne({ ...rubble, staffelnQuelle: 'tmdb' }, { von: 1, bis: 49 })?.laut === 'tmdb')
pruefe('JustWatch- und Handbeleg-Staffeln tragen kein „laut"', !staffelSpanne(rubble, { von: 1, bis: 49 })?.laut && !staffelSpanne({ ...rubble, staffelnQuelle: 'handbeleg' }, { von: 1, bis: 49 })?.laut)

// Texte: ein Stub, der Schlüssel und Werte zeigt.
const t = ((k: string, p?: Record<string, string | number>) => `${k}${p ? JSON.stringify(Object.values(p)) : ''}`) as unknown as Translate
const text = (titel: Parameters<typeof teilAngaben>[0], von: number, bis: number) => teilAngaben(titel, { von, bis }, t).unten
pruefe('Text: Staffeln und Folgen', text(rubble, 1, 98) === 'detail.teilStaffel[1,2] · detail.teilBereich[1,98]', text(rubble, 1, 98))
pruefe('Text: eine Staffel', text(rubble, 99, 117).startsWith('detail.teilStaffelEine[3]'))
pruefe('Text: TMDB heißt laut TMDB', text({ ...rubble, staffelnQuelle: 'tmdb' }, 1, 49).includes('(detail.teilLautTmdb)'))
pruefe('Text: JustWatch-Staffeln ohne „laut TMDB"', !text(rubble, 1, 49).includes('detail.teilLautTmdb'))
pruefe('Text: ohne Staffelgrenze nur die Folgen', text(rubble, 1, 50) === 'detail.teilBereich[1,50]', text(rubble, 1, 50))
pruefe('Text: Tooltip nennt die Folgen', teilAngaben(rubble, { von: 1, bis: 98 }, t).titel === 'detail.teilBereichTitel[1,98]')

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zum Falten der Cartoon-Wege verletzt`)
  process.exit(1)
}
console.log('Cartoon-Wege falten: Zusicherungen erfüllt')
