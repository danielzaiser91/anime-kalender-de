/**
 * Zusicherungen zu den Reihen nach der Einzelauflistung (14.10.2026): Ein Sammeltitel, der in seine aniSearch-Seiten zerfällt (`katalogWeg`), gibt seine AniList-Beziehungen
 * an seine Zeile ab; was nur über ihn in einer Reihe hing (Aware! Meisaku-kun Ryuuguuchuu-hen, Fanren Xiu Xian Zhuan Movie), erbt die Reihe der Zeile. Alle Titel sind
 * erfunden (`lib/reihen-traeger-testdaten.ts`), die Prüfung hängt nicht vom Katalog-Cache ab. Die Aufrufer prüft `check-reihen-traeger-aufrufer.ts`. Läuft in `check:logic`.
 */
import { type Anker, erbeReihe } from './bau/anisearch-reihen-katalog.ts'
import { anilistKantenOhneKennung, reineKatalogReihen } from './bau/anisearch-reihen-rein-bau.ts'
import { EINZEL, ERSTE, KIND, MIT_KENNUNG, PAAR_A, PAAR_B, SAMMEL, WAISE, ZEILE, anker, eintraege, katalogWeg, kennung } from './lib/reihen-traeger-testdaten.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const ohneHand = { verbinden: [], trennen: [] }

console.log('Rein: AniList-Kanten des Sammeltitels gehen auf seine Zeile über')
{
  const e = reineKatalogReihen(eintraege, kennung, anker, katalogWeg, [], new Map(), ohneHand)
  const r = (id: number): number | undefined => e.reihe.get(id)
  pruefe('Ein Titel, dessen Kante auf den Sammeltitel zeigt, erbt die Reihe der Zeile', r(KIND) === ERSTE, String(r(KIND)))
  pruefe('Ein Titel, den nur der Sammeltitel nennt (Kante in seine Richtung), erbt sie ebenso', r(WAISE) === ERSTE, String(r(WAISE)))
  pruefe('Der Sammeltitel selbst ist kein Titel mehr', !e.reihe.has(SAMMEL))
  pruefe('Hat der Titel eine aniSearch-Kennung, entscheidet aniSearch, nicht die AniList-Kante zum Sammeltitel', r(MIT_KENNUNG) === MIT_KENNUNG, String(r(MIT_KENNUNG)))
  pruefe('Gegenprobe: ein Titel ohne Träger-Fall bleibt allein', r(EINZEL) === EINZEL)
  pruefe('Gegenprobe: zwei Titel ohne Träger-Fall bilden ihre Reihe wie bisher', r(PAAR_A) === PAAR_A && r(PAAR_B) === PAAR_A)
}

console.log('Rein: Kanten im Einzelnen')
{
  const kanten = anilistKantenOhneKennung(eintraege, new Set([ZEILE, ERSTE, MIT_KENNUNG]), katalogWeg)
  const hat = (a: number, b: number): boolean => kanten.some(([x, y]) => x === a && y === b)
  pruefe('Kante eines Titels zum Sammeltitel zeigt auf die Zeile', hat(KIND, ZEILE))
  pruefe('Kante des Sammeltitels geht von der Zeile aus', hat(ZEILE, KIND) && hat(ZEILE, WAISE))
  pruefe('Mit Kennung auf beiden Seiten gibt es keine Zusatzkante', !kanten.some(([x, y]) => x === MIT_KENNUNG || y === MIT_KENNUNG))
}

console.log('Rückweg: erbeReihe')
{
  const reihe = new Map([[SAMMEL, SAMMEL], [KIND, SAMMEL], [WAISE, SAMMEL], [EINZEL, EINZEL]])
  const geerbt = erbeReihe(reihe, katalogWeg, anker)
  pruefe('Wer unter dem Sammeltitel hing, hängt an der Reihe der Zeile', geerbt.get(KIND) === ERSTE && geerbt.get(WAISE) === ERSTE)
  pruefe('Gegenprobe: ein Titel in einer anderen Reihe bleibt', geerbt.get(EINZEL) === EINZEL)
  pruefe('Ist die Zeile kein Anker, bleibt die Reihe, wie sie ist', erbeReihe(reihe, katalogWeg, []).get(KIND) === SAMMEL)
  pruefe('Ohne ausgeschiedenen Sammeltitel bleibt alles', erbeReihe(reihe, new Map(), anker).get(KIND) === SAMMEL)
  const gruppeMitWurzel = new Map([[SAMMEL, WAISE], [KIND, WAISE], [WAISE, WAISE]])
  const mitWurzel = erbeReihe(gruppeMitWurzel, katalogWeg, anker)
  pruefe('Auch wenn die Wurzel der Gruppe ein anderer Titel ist, erbt die ganze Gruppe', mitWurzel.get(KIND) === ERSTE && mitWurzel.get(WAISE) === ERSTE)
  const festeGruppe = new Map([[SAMMEL, 5000], [KIND, 5000]])
  const mitFremdemAnker: Anker[] = [...anker, { id: 5000, name: 'Fremd', reihe: 5000 }]
  pruefe('Gehört die Gruppe schon zu einer ausgelieferten Reihe, verschmilzt sie nicht mit der Zeile', erbeReihe(festeGruppe, katalogWeg, mitFremdemAnker).get(KIND) === 5000)
}

console.log(fehler ? `\nReihen nach der Einzelauflistung: ${fehler} Zusicherung(en) verletzt.` : 'Reihen nach der Einzelauflistung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
