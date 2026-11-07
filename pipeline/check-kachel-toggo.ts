/**
 * Zusicherungen zur Kachel-Form der Toggo-Fenster (`shared/toggo-fenster.ts`, `shared/kachel-toggo.ts`): `woche-kacheln.json` trägt statt bis zu
 * 100 Blöcken je Titel die offenen Fenster; der Filter „kostenlos“ muss zu jeder Zeit dasselbe sagen wie mit den vollen Blöcken.
 * Erwartete Werte stehen fest hier. Aufruf: `npm run check:logic`.
 */
import type { Title, WatchLink } from '../shared/types.ts'
import type { WochenDatei } from '../shared/wochen-datei.ts'
import { kostenloseFolgen } from '../shared/kostenlos.ts'
import { offeneFenster } from '../shared/toggo-fenster.ts'
import { baueKachelDatei, pruefeKachelDatei } from '../shared/wochen-kacheln.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Block = NonNullable<WatchLink['toggo']>[number]
const JETZT = '2026-11-07T10:00'
const block = (von: number, ab: string, ende: string, bis = von): Block => ({ staffel: 1, von, bis, ab, ende })

console.log('\nToggo-Fenster der Kachel:')
pruefe('leere Liste: keine Fenster', offeneFenster([], JETZT).length === 0)
pruefe('geschlossenes Fenster fällt weg', offeneFenster([block(1, '2026-01-01T00:00', '2026-11-07T10:00')], JETZT).length === 0)
pruefe('Fenster, das genau jetzt endet, fällt weg; eine Minute später bleibt es', offeneFenster([block(1, '2026-01-01T00:00', '2026-11-07T10:01')], JETZT).length === 1)
pruefe('Folgen ohne Bereich (bis < von) zählen nicht', offeneFenster([block(5, '2026-01-01T00:00', '2027-01-01T00:00', 4)], JETZT).length === 0)
const wochen = [1, 2, 3, 4].map((i) => block(i, `2026-11-0${i}T00:00`, '2027-12-31T23:59'))
pruefe('Wöchentlich öffnende Folgen mit gleichem Ende: ein Fenster', JSON.stringify(offeneFenster(wochen, JETZT)) === '[["2026-11-01T00:00","2027-12-31T23:59"]]', offeneFenster(wochen, JETZT))
pruefe('Reihenfolge der Blöcke ist gleich', JSON.stringify(offeneFenster([...wochen].reverse(), JETZT)) === JSON.stringify(offeneFenster(wochen, JETZT)))
const luecke = [block(1, '2026-11-01T00:00', '2026-11-10T00:00'), block(2, '2026-11-20T00:00', '2026-11-30T00:00')]
pruefe('Lücke zwischen zwei Fenstern bleibt', JSON.stringify(offeneFenster(luecke, JETZT)) === '[["2026-11-01T00:00","2026-11-10T00:00"],["2026-11-20T00:00","2026-11-30T00:00"]]')
const anstoss = [block(1, '2026-11-01T00:00', '2026-11-10T00:00'), block(2, '2026-11-10T00:00', '2026-11-30T00:00')]
pruefe('anstoßende Fenster werden eins', JSON.stringify(offeneFenster(anstoss, JETZT)) === '[["2026-11-01T00:00","2026-11-30T00:00"]]')
const innen = [block(1, '2026-11-01T00:00', '2026-12-31T00:00'), block(2, '2026-11-05T00:00', '2026-11-06T00:00')]
pruefe('Fenster im Fenster ändert das Ende nicht', JSON.stringify(offeneFenster(innen, JETZT)) === '[["2026-11-01T00:00","2026-12-31T00:00"]]')

/* Äquivalenz: der Filter sagt mit Blöcken und mit Fenstern zu jeder Zeit dasselbe (jede Grenze, eine Minute davor und danach). */
const minute = (iso: string, d: number): string => new Date(Date.parse(`${iso}:00Z`) + d * 60000).toISOString().slice(0, 16)
function gleich(titel: Title, bloecke: Block[]): string | undefined {
  const kachel = baueKachelDatei({ von: 'a', bis: 'b', titles: [titel], releases: [], events: [] }, JETZT).titles[0]!
  const zeiten = [JETZT, ...bloecke.flatMap((b) => [b.ab, b.ende]).flatMap((z) => [minute(z, -1), z, minute(z, 1)])].filter((z) => z >= JETZT)
  return zeiten.find((z) => !!kostenloseFolgen(titel, z) !== !!kostenloseFolgen(kachel, z))
}
const mitWeg = (id: number, bloecke: Block[], extra: object = {}): Title =>
  ({ id, slug: `t${id}`, watchLinks: [{ name: 'TOGGO', kind: 'stream', zugang: 'kostenlos', url: 'https://t', toggo: bloecke }], ...extra }) as unknown as Title

const beyblade = Array.from({ length: 77 }, (_, i) => block(i + 1, minute('2024-12-06T00:00', i * 7 * 1440), '2027-12-31T23:59'))
const horizons = Array.from({ length: 100 }, (_, i) => block(i + 1, minute('2026-09-01T00:00', i * 1440), minute('2026-09-15T23:59', i * 1440)))
const gemischt = [block(1, '2026-11-01T00:00', '2026-11-08T00:00'), block(2, '2026-11-12T00:00', '2026-11-14T00:00'), block(3, '2026-10-01T00:00', '2026-11-07T10:00')]
for (const [name, bloecke] of [['Beyblade X (77 Blöcke)', beyblade], ['Pokémon-Horizons-Form (100 wandernde Fenster)', horizons], ['Lücken und geschlossenes Fenster', gemischt]] as const) {
  pruefe(`${name}: Filter „kostenlos“ gleich zu jeder Grenze`, gleich(mitWeg(1, [...bloecke]), [...bloecke]) === undefined, gleich(mitWeg(1, [...bloecke]), [...bloecke]))
}
const mitNurFolge = mitWeg(2, gemischt, { streams: [{ platform: 'youtube', url: 'https://www.youtube.com/watch?v=x', zugang: 'kostenlos', dub: true }] })
pruefe('ein zweiter kostenloser Weg (Einzelvideo) bleibt Ja', kostenloseFolgen(baueKachelDatei({ von: 'a', bis: 'b', titles: [mitNurFolge], releases: [], events: [] }, JETZT).titles[0]!, '2026-11-10T00:00') !== undefined)
pruefe('Fenster ändern das Ergebnis: vor dem ersten Fenster Nein, im Fenster Ja', !kostenloseFolgen(mitWeg(3, gemischt), '2026-11-09T00:00') && !!kostenloseFolgen(mitWeg(3, gemischt), '2026-11-02T00:00'))

const g = (t: Title): number => JSON.stringify(t).length
const kleinDatei = baueKachelDatei({ von: 'a', bis: 'b', titles: [mitWeg(4, beyblade), mitWeg(5, horizons)], releases: [], events: [] }, JETZT)
pruefe('Größe: Beyblade X und die 100 Fenster sind unter 1000 Byte', g(kleinDatei.titles[0]!) + g(kleinDatei.titles[1]!) < 1000, g(kleinDatei.titles[0]!) + g(kleinDatei.titles[1]!))
pruefe('Kachel trägt kein toggo mehr', !JSON.stringify(kleinDatei).includes('"toggo"'))

/* Wächter: pruefeKachelDatei meldet falsche und verlorene Fenster. */
const woche: WochenDatei = { von: 'a', bis: 'b', titles: [mitWeg(6, gemischt)], releases: [], events: [] }
const kachel = baueKachelDatei(woche, JETZT)
const mitFenster = (f: unknown): WochenDatei => ({ ...kachel, titles: [{ ...kachel.titles[0]!, watchLinks: [{ ...kachel.titles[0]!.watchLinks![0]!, toggoOffen: f } as unknown as WatchLink] }] })
const meldet = (k: WochenDatei, teil: string) => pruefeKachelDatei(k, woche, JETZT).some((f) => f.includes(teil))
pruefe('saubere Kachel: kein Widerspruch', pruefeKachelDatei(kachel, woche, JETZT).length === 0, pruefeKachelDatei(kachel, woche, JETZT))
pruefe('zu spätes Ende eines Fensters wird gemeldet', meldet(mitFenster([['2026-11-01T00:00', '2026-11-09T00:00'], ['2026-11-12T00:00', '2026-11-14T00:00']]), 'sagt Toggo zu'))
pruefe('zu früher Beginn wird gemeldet', meldet(mitFenster([['2026-11-01T00:00', '2026-11-08T00:00'], ['2026-11-11T00:00', '2026-11-14T00:00']]), 'sagt Toggo zu'))
pruefe('fehlendes Fenster wird gemeldet', meldet(mitFenster([['2026-11-01T00:00', '2026-11-08T00:00']]), 'sagt Toggo zu'))
pruefe('erfundenes Fenster wird gemeldet', meldet(mitFenster([['2026-11-01T00:00', '2026-11-08T00:00'], ['2026-11-12T00:00', '2026-11-14T00:00'], ['2026-12-01T00:00', '2026-12-02T00:00']]), 'sagt Toggo zu'))
const ohneFenster = { ...kachel, titles: [{ ...kachel.titles[0]!, watchLinks: [{ name: 'TOGGO', kind: 'stream', zugang: 'kostenlos', url: 'https://t' } as WatchLink] }] }
pruefe('verlorene Fenster werden gemeldet', meldet(ohneFenster, 'verliert die Toggo-Fenster'))
pruefe('Fenster ohne Blöcke in der Wochen-Datei werden gemeldet', pruefeKachelDatei(mitFenster([]), { ...woche, titles: [mitWeg(6, [])].map((t) => ({ ...t, watchLinks: [{ ...t.watchLinks![0]!, toggo: undefined } as WatchLink] })) }, JETZT).some((f) => f.includes('ohne Blöcke')))
pruefe('anderer Wert im Weg wird weiter gemeldet', meldet({ ...kachel, titles: [{ ...kachel.titles[0]!, watchLinks: [{ ...kachel.titles[0]!.watchLinks![0]!, url: 'https://x' }] }] }, 'weicht von der Wochen-Datei ab'))

console.log(verletzt ? `\n${verletzt} von ${faelle} Zusicherungen zu den Toggo-Fenstern verletzt.` : `\nToggo-Fenster der Kachel: ${faelle} Zusicherungen halten.`)
process.exit(verletzt ? 1 : 0)
