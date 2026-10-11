/**
 * Zusicherungen zu den Reihen aus aniSearch-Beziehungen (Stufe C der AniList-Ablösung, 10.10.2026): Parser, Regel, Vergleich, Zähler der Abweichungsliste.
 * Die Liste `data/anisearch-reihen-abweichungen.json` schreibt der Bau; fehlt sie noch, entfällt der Teil „Bestand". Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseRelationen, parseTitel } from './lib/anisearch-relationen.ts'
import { ART_MAL, type Kante, REGEL, komponenten, malKanten, reihenWurzel, zaehlt } from './bau/anisearch-reihen.ts'
import { type Einheit, vergleicheReihen } from './bau/anisearch-reihen-vergleich.ts'
import { REIHEN_DATEI, type ReihenDatei } from './bau/anisearch-reihen-abweichungen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const html = `<section id="information"><div class="title" lang="ja"><strong class="f16">Hagane no Renkinjutsushi</strong></div><div class="title" lang="en"><strong class="f16">Fullmetal Alchemist</strong></div></section>
<section id="relations"><ul>
<li class="swiper-slide x"><div class="header">Sequel</div><a href="anime/7,fma-2" class="anime-item"><span class="title">FMA: Brotherhood</span><span class="date">TV</span></a></li>
<li class="swiper-slide x"><div class="header">Originalwerk</div><a href="manga/9,fma" class="manga-item"><span class="title">Fullmetal Alchemist</span></a></li>
<li class="swiper-slide x"><div class="header">?</div><a href="anime/8" class="anime-item"><span class="title">Tom &amp; Jerry</span></a></li>
</ul></section>`
const rel = parseRelationen(html)
pruefe('Parser: Art, Medium, Kennung und Name je Beziehung', rel.length === 3 && rel[0]!.art === 'Sequel' && rel[0]!.id === 7 && rel[1]!.medium === 'manga' && rel[2]!.art === '?' && rel[2]!.name === 'Tom & Jerry')
pruefe('Parser: Titel je Sprache aus dem Informationsblock', JSON.stringify(parseTitel(html)) === '["Hagane no Renkinjutsushi","Fullmetal Alchemist"]')
pruefe('Parser: Seite ohne Relationen-Kasten liefert nichts', parseRelationen('<section id="information"></section>').length === 0)

const namen = new Map([[1, ['Mobile Suit Gundam']], [2, ['Mobile Suit Zeta Gundam']], [3, ['Tamako Market']], [4, ['Mobile Suit Gundam Wing']]])
const k = (a: number, b: number, art: string): Kante => ({ a, b, art })
pruefe('Regel: Kernart zählt ohne Namen, Art ohne Eintrag (Originalwerk) nie', zaehlt(k(1, 3, 'Sequel'), REGEL, namen) && !zaehlt(k(1, 2, 'Originalwerk'), REGEL, namen))
pruefe('Regel: „?" zählt immer, MAL-Kanten ebenso', zaehlt(k(1, 3, '?'), REGEL, namen) && zaehlt(k(1, 3, ART_MAL), REGEL, namen))
pruefe('Regel: „Anderes" nur bei gemeinsamem Namensanfang (Gundam/Zeta ja, Gundam/Tamako Market nein)', zaehlt(k(1, 2, 'Anderes'), REGEL, namen) && !zaehlt(k(1, 3, 'Anderes'), REGEL, namen))
pruefe('Regel: „Crossover" braucht einen längeren Namensanfang als „Anderes" (Gundam/Zeta: 11 Zeichen, Gundam/Wing: 18)', !zaehlt(k(1, 2, 'Crossover'), REGEL, namen) && zaehlt(k(1, 4, 'Crossover'), REGEL, namen))

const wurzel = komponenten([[5, 3], [3, 9], [20, 21]])
pruefe('Komponenten: Wurzel ist die kleinste Kennung, Unbekanntes bleibt es selbst', wurzel(9) === 3 && wurzel(5) === 3 && wurzel(21) === 20 && wurzel(77) === 77)
pruefe('MAL-Kanten: gleiche MAL-Kennung verbindet, andere und fehlende nicht',
  JSON.stringify(malKanten([{ anisearchId: 1, mal: 5 }, { anisearchId: 2, mal: 5 }, { anisearchId: 3, mal: 6 }, { anisearchId: 4 }])) === JSON.stringify([k(1, 2, ART_MAL)]))
pruefe('Wurzel der Regel: nur zählende Kanten verbinden', reihenWurzel([k(1, 2, 'Sequel'), k(2, 3, 'Originalwerk')], REGEL, namen)(3) === 3)

const e = (id: number, anisearchId: number): Einheit => ({ id, name: `T${id}`, anisearchId, haupt: id < 10 })
/* Referenz-Reihen a={2,4} b={6,8} c={10,12} d={14} e={16,18} f={20}, 22 allein; aniSearch: 2+4 | 6 | 8 | 10+12+14 | 16+20 | 18 | 22. */
const einheiten = [e(2, 1), e(4, 1), e(6, 2), e(8, 3), e(10, 4), e(12, 4), e(14, 4), e(16, 5), e(18, 6), e(20, 5), e(22, 7)]
const referenz = new Map([[2, 'a'], [4, 'a'], [6, 'b'], [8, 'b'], [10, 'c'], [12, 'c'], [14, 'd'], [16, 'e'], [18, 'e'], [20, 'f']])
const v = vergleicheReihen(einheiten, referenz, (id) => id)
pruefe('Vergleich: Urteil je Titel — gleich, fehlen, zusätzlich, gemischt',
  v.gesamt.gleich === 3 && v.gesamt.fehlen === 3 && v.gesamt.zusaetzlich === 4 && v.gesamt.gemischt === 1 && v.gesamt.titel === 11, JSON.stringify(v.gesamt))
pruefe('Vergleich: Hauptbestand zählt nur Titel mit Kennzeichen (hier 2, 4, 6, 8: 2 gleich, 2 fehlen)', v.hauptbestand.titel === 4 && v.hauptbestand.gleich === 2 && v.hauptbestand.fehlen === 2, JSON.stringify(v.hauptbestand))
pruefe('Vergleich: Hälften zählen zusammen das Ganze', v.haelfteA.titel + v.haelfteB.titel === v.gesamt.titel && v.haelfteA.gleich + v.haelfteB.gleich === v.gesamt.gleich)
pruefe('Vergleich: Cluster — je einer: Einzeltitel, gleiche Reihe, zerlegt, verschmilzt, gemischt', v.cluster.einzel === 1 && v.cluster.gleich === 1 && v.cluster.zerlegt === 1 && v.cluster.gemischt === 1 && v.cluster.verschmilzt === 1, JSON.stringify(v.cluster))
pruefe('Vergleich: Beispiel nennt den kleinsten Titel des Clusters', v.beispiele.zerlegt[0]?.id === 6 && v.beispiele.zerlegt[0]?.anisearch === 2, JSON.stringify(v.beispiele.zerlegt))
const verschmolzen = vergleicheReihen([e(2, 1), e(4, 1)], new Map([[2, 'a'], [4, 'b']]), (id) => id)
pruefe('Vergleich: zwei Referenz-Reihen in einer aniSearch-Komponente = verschmilzt', verschmolzen.cluster.verschmilzt === 1 && verschmolzen.gesamt.zusaetzlich === 2)

/* Bestand: gemessen am 11.10.2026 mit 15.091 Titeln mit Seite, 77,1 % gleich (Hälfte A 75,9 %, Hälfte B 78,2 %); die Grenzen liegen rund 6 Punkte darunter und schlagen nur bei einem Bruch an.
 * Titel ohne Referenz-Reihe (aniSearch-Titel, die AniList nicht kennt: 2.409) zählen nicht mit — mit ihnen fiel der Wert nach dem Katalog-Lauf vom 10.10. auf 68,1 %, ohne dass ein Parser oder eine Seite kaputt war. */
if (existsSync(REIHEN_DATEI)) {
  const b = JSON.parse(readFileSync(REIHEN_DATEI, 'utf8')) as ReihenDatei
  const summe = (z: ReihenDatei['gesamt']): number => z.gleich + z.fehlen + z.zusaetzlich + z.gemischt
  pruefe('Bestand: die Urteile zählen alle Titel mit Seite', summe(b.gesamt) === b.gesamt.titel && b.gesamt.titel === b.deckung.mitSeite, `${summe(b.gesamt)} von ${b.gesamt.titel}`)
  pruefe('Bestand: mindestens 12.000 Titel haben eine Seite im Archiv', b.deckung.mitSeite >= 12000, `${b.deckung.mitSeite}`)
  for (const [name, z] of [['gesamt', b.gesamt], ['Hälfte A', b.haelfteA], ['Hälfte B', b.haelfteB]] as const) {
    pruefe(`Bestand: ${name} — mindestens 70 % gleiche Reihen`, z.gleich >= 0.7 * z.titel, `${z.gleich} von ${z.titel}`)
  }
  pruefe('Bestand: Hauptbestand — mindestens 65 % gleiche Reihen (gemessen 72,8 %)', b.hauptbestand.gleich >= 0.65 * b.hauptbestand.titel, `${b.hauptbestand.gleich} von ${b.hauptbestand.titel}`)
  pruefe('Bestand: Cluster zählen zusammen mindestens die Reihen mit ≥ 2 Titeln', b.cluster.gleich + b.cluster.zerlegt + b.cluster.verschmilzt + b.cluster.gemischt >= 1500)
  for (const art of ['zerlegt', 'verschmilzt', 'gemischt'] as const) pruefe(`Bestand: höchstens 20 Beispiele „${art}"`, b.beispiele[art].length <= 20)
}

console.log(fehler ? `\naniSearch-Reihen: ${fehler} Zusicherung(en) verletzt.` : 'aniSearch-Reihen: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
