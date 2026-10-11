/**
 * Zusicherungen zu den Reihen aus aniSearch-Beziehungen (Stufe C der AniList-Ablösung, 10.10.2026): Parser, Regel, Vergleich, Zähler der Abweichungsliste.
 * Die Liste `data/anisearch-reihen-abweichungen.json` schreibt der Bau; fehlt sie noch, entfällt der Teil „Bestand". Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseRelationen, parseTitel } from './lib/anisearch-relationen.ts'
import { ART_MAL, type Kante, REGEL, komponenten, malKanten, reihenWurzel, zaehlt } from './bau/anisearch-reihen.ts'
import { type Einheit, vergleicheReihen } from './bau/anisearch-reihen-vergleich.ts'
import { REIHEN_DATEI, type ReihenDatei, ohneReferenzReihe } from './bau/anisearch-reihen-abweichungen.ts'
import { ANISEARCH_ID_BASIS } from './bau/anisearch-titel.ts'
import { uebernimmReihen } from './bau/anisearch-reihen-uebernahme.ts'

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

const basis = ANISEARCH_ID_BASIS
const ohneRef = ohneReferenzReihe([{ id: 5 }, { id: basis + 1 }, { id: basis + 2, franchiseId: 7 }, { id: basis + 3, franchiseId: 7 }, { id: 9, franchiseId: 8 }])
pruefe('Ohne Referenz: nur ein aniSearch-Titel (ab 10 Mio.), den kein zweiter Titel seiner franchiseId teilt', ohneRef.size === 1 && ohneRef.has(basis + 1), JSON.stringify([...ohneRef]))

/* Übernahme: Reihen A={1,2}, B={3,4}, Alleinstehende 5–9; aniSearch-Kennung = Titelnummer.
 * 5 –Sequel→ 1 (hängt an A); 6 –Sequel→ 7 (neue Reihe); 2 –Sequel→ 3 (zwei Reihen: Prüfliste, keine Kante); 8 –Sequel→ 1 und 8 –Sequel→ 3 (mehrdeutig); 9 –Originalwerk→ 1 (zählt nicht). */
const titelU = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({ id, name: `T${id}`, anisearchId: id }))
const reiheU = (id: number): number => ({ 2: 1, 4: 3 })[id as 2 | 4] ?? id
const kantenU = [k(5, 1, 'Sequel'), k(6, 7, 'Sequel'), k(2, 3, 'Sequel'), k(8, 1, 'Sequel'), k(8, 3, 'Sequel'), k(9, 1, 'Originalwerk')]
const u = uebernimmReihen(titelU, kantenU, new Map(), reiheU)
pruefe('Übernahme: ein Alleinstehender hängt an die Reihe, die er berührt', u.kanten.some((x) => x.ids[0] === 1 && x.ids.includes(5)) && u.angehaengt === 1, JSON.stringify(u.kanten))
pruefe('Übernahme: zwei verbundene Alleinstehende bilden eine neue Reihe', u.kanten.some((x) => x.ids.length === 2 && x.ids.includes(6) && x.ids.includes(7)) && u.neueReihen === 1)
pruefe('Übernahme: zwei Reihen mit mehreren Titeln werden nie verbunden, sie stehen auf der Prüfliste', !u.kanten.some((x) => x.ids.includes(2) || x.ids.includes(3)) && u.pruefliste.filter((p) => p.art === 'verschmilzt').length === 1)
pruefe('Übernahme: ein Alleinstehender zwischen zwei Reihen wandert nirgends hin (mehrdeutig)', !u.kanten.some((x) => x.ids.includes(8)) && u.pruefliste.filter((p) => p.art === 'mehrdeutig').length === 1)
pruefe('Übernahme: Art ohne Regel (Originalwerk) bindet nichts', !u.kanten.some((x) => x.ids.includes(9)))
pruefe('Übernahme: ausgenommene Titel (Crossover) wandern nicht', !uebernimmReihen(titelU, kantenU, new Map(), reiheU, new Set([5])).kanten.some((x) => x.ids.includes(5)))
const getrenntU = uebernimmReihen(titelU, kantenU, new Map(), reiheU, new Set(), undefined, [[5, 1], [2, 3]])
pruefe('Übernahme: eine Handtrennung hält den Alleinstehenden aus der Reihe', !getrenntU.kanten.some((x) => x.ids.includes(5)))
pruefe('Übernahme: eine Handtrennung zweier Reihen leert ihren Prüflisten-Fall (ein Titel je Reihe genügt)', getrenntU.pruefliste.filter((p) => p.art === 'verschmilzt').length === 0)
pruefe('Übernahme: eine Handtrennung berührt andere Kanten nicht', getrenntU.kanten.some((x) => x.ids.includes(6) && x.ids.includes(7)))
const universum = [{ id: 1, name: 'Marvel Iron Man', anisearchId: 1 }, { id: 2, name: 'Marvel Iron Man 2', anisearchId: 2 }, { id: 3, name: 'Marvel Blade', anisearchId: 3 }]
const uni = uebernimmReihen(universum, [k(3, 1, 'Gemeinsames Universum')], new Map([[1, ['Marvel Iron Man']], [3, ['Marvel Blade']]]), (id) => (id === 2 ? 1 : id))
pruefe('Übernahme: „Gemeinsames Universum“ lässt nichts wandern, der Fall steht als „universum“ auf der Prüfliste', uni.kanten.length === 0 && uni.pruefliste.length === 1 && uni.pruefliste[0]!.art === 'universum', JSON.stringify(uni))

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
  pruefe('Bestand: Hauptbestand — mindestens 65 % gleiche Reihen (gemessen 72,9 % am 11.10.2026)', b.hauptbestand.gleich >= 0.65 * b.hauptbestand.titel, `${b.hauptbestand.gleich} von ${b.hauptbestand.titel}`)
  // 11.10.2026: 2.409 von 20.717 Titeln (11,6 %) ohne Referenz-Reihe; die Grenze liegt weit darüber und schlägt nur an, wenn die Zuordnung bricht.
  pruefe('Bestand: höchstens 25 % der Titel ohne Referenz-Reihe', b.deckung.ohneReferenz <= 0.25 * b.deckung.titel, `${b.deckung.ohneReferenz} von ${b.deckung.titel}`)
  pruefe('Bestand: Cluster zählen zusammen mindestens die Reihen mit ≥ 2 Titeln', b.cluster.gleich + b.cluster.zerlegt + b.cluster.verschmilzt + b.cluster.gemischt >= 1500)
  for (const art of ['zerlegt', 'verschmilzt', 'gemischt'] as const) pruefe(`Bestand: höchstens 20 Beispiele „${art}"`, b.beispiele[art].length <= 20)
}

console.log(fehler ? `\naniSearch-Reihen: ${fehler} Zusicherung(en) verletzt.` : 'aniSearch-Reihen: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
