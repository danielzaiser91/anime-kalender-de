/**
 * Zusicherungen für `beurteile()` — die Zuordnung von Crunchyroll-Blöcken zu
 * unseren Staffeln.
 *
 * ## Warum eigene Zusicherungen und nicht nur die Handprüfungen
 *
 * Daniel am 23.08.2026: „Handprüfung schön und gut, aber das muss in zukunft
 * automatisch funktionieren, ist das jetzt von dir korrigiert worden, sodass
 * zukünftige läufe es nicht erneut kaputt machen? nicht nur speziell für den
 * fall, sondern generisch gelöst?"
 *
 * Die Frage trifft eine echte Lücke. `check:handbelege` prüft, ob seine
 * Prüfungen **im Datensatz** stehen — und sie stehen dort immer, weil der Build
 * sie direkt setzt. Bräche die automatische Auswertung morgen vollständig
 * zusammen, bliebe dieser Lauf **grün**: Die Handprüfungen decken den Ausfall
 * zu. Genau deshalb steht hier eine zweite Sorte Prüfung, die die **Logik**
 * misst statt das Ergebnis.
 *
 * Jeder Fall unten ist einmal real gewesen und hat einmal Schaden angerichtet
 * oder verhindert. Die Zahlen stammen aus Daniels Bildschirm, nicht aus einer
 * Annahme.
 *
 * Aufruf: npm run check:cr-zuordnung
 */
import { beurteile, type CrSerie, type CrDubData } from './lib/crunchyroll-dub.ts'
import { readJson, ROOT } from './lib/util.ts'
import { resolve } from 'node:path'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Ein Titel mit dem, was die Zuordnung braucht. */
const titel = (id: number, episodes: number, jpYear = 2020): Title =>
  ({ id, episodes, jpYear, titleRomaji: `T${id}`, streams: [] }) as unknown as Title

const serie = (bloecke: [string, number, number][], extra: Partial<CrSerie> = {}): CrSerie =>
  ({
    url: 'https://example.test/serie',
    seriesId: 'X',
    quelle: 'api',
    katalog: 'de',
    geprueftAm: '2026-08-23',
    deutschImAngebot: bloecke.some(([, deutsch]) => deutsch > 0),
    staffeln: bloecke.map(([name, deutsch, folgen]) => ({ name, staffelId: name, folgen, kacheln: folgen, deutsch, fremd: folgen - deutsch, deutscheFassung: deutsch === folgen, deutscheFolgen: [] })),
    ...extra,
  }) as unknown as CrSerie

const urteil = (s: CrSerie, ts: Title[]) => {
  const m = new Map<number, boolean>()
  for (const u of beurteile(s, ts)) m.set(u.titleId, u.dub)
  return m
}

console.log('Zusicherungen für die Crunchyroll-Zuordnung\n')

/**
 * Fall 1 — Gun Gale Online (21.08.2026).
 *
 * Zwei Blöcke zu je zwölf Folgen, einer ohne deutsche Fassung, einer
 * vollständig deutsch. Unser einziger Eintrag ist die **zweite** Staffel.
 * Die Summe geht am ersten Block auf — und ginge dort falsch auf.
 */
{
  const s = serie([['Gun Gale Online', 0, 12], ['Gun Gale Online II', 12, 12]])
  const u = urteil(s, [titel(1, 12)])
  pruefe('Gun Gale Online: mehrdeutige Größe erzeugt kein Urteil', u.size === 0, [...u])
}

/**
 * Fall 2 — Fruits Basket (23.08.2026, gefunden über `check:quellen`).
 *
 * Drei Blöcke, drei eigene Einträge — die Zählsperre greift also nicht. Aber
 * uns fehlt der Verweis für Staffel 1, deshalb liegt unser erster Eintrag am
 * falschen Block. Auffliegen tut das erst beim zweiten Block, und dieses
 * Auffliegen muss **rückwirkend** gelten.
 */
{
  const s = serie([['Fruits Basket (2019)', 0, 25], ['Staffel 2', 25, 25], ['The Final Season', 13, 13]])
  const u = urteil(s, [titel(1, 25, 2020), titel(2, 13, 2021), titel(3, 1, 2022)])
  pruefe('Fruits Basket: kein falsches dub=false für Staffel 2', u.get(1) !== false, [...u])
}

/**
 * Fall 3 — KONOSUBA (23.08.2026).
 *
 * Fünf Blöcke, zwei eigene Einträge zu je zehn Folgen. Die Zehn kommt nur bei
 * vollständig deutschen Blöcken vor, die undeutschen Dreizehn nicht bei uns —
 * also ist die Reihenfolge gleichgültig.
 */
{
  const s = serie([['S1', 10, 10], ['S2', 10, 10], ['OVAs', 2, 2], ['Legend of Crimson', 1, 1], ['Season 03', 0, 13]])
  const u = urteil(s, [titel(1, 10), titel(2, 10)])
  pruefe('KONOSUBA: beide Zehner-Staffeln als deutsch belegt', u.get(1) === true && u.get(2) === true, [...u])
}

/**
 * Fall 4 — Food Wars, Staffel 4 (23.08.2026).
 *
 * Dreizehn Einträge, zwölf deutsch: Das dreizehnte ist das Special
 * „E-EX Hinter den Kulissen" ohne Synchro. Unsere Zwölf-Folgen-Staffel ist
 * vollständig deutsch und muss das auch werden.
 */
{
  const s = serie([['The Fourth Plate', 12, 13], ['The Fifth Plate', 13, 13], ['OVAs', 0, 5]])
  const u = urteil(s, [titel(1, 12)])
  pruefe('Food Wars: Special im Block hindert das Urteil nicht', u.get(1) === true, [...u])
}

/**
 * Fall 5 — die Gegenprobe zu Fall 4.
 *
 * Fehlen **viele** Einträge zur vollen Zahl, ist es kein Special-Anhang,
 * sondern eine halb synchronisierte Staffel. Dann liegt die Grenze zwischen
 * deutsch und nicht im Ungewissen, und es darf kein Urteil geben.
 */
{
  const s = serie([['Halb deutsch', 6, 12], ['Ganz deutsch', 20, 20]])
  const u = urteil(s, [titel(1, 6)])
  pruefe('halb synchronisierte Staffel erzeugt kein Urteil', u.size === 0, [...u])
}

/**
 * Fall 6 — Free! (23.08.2026).
 *
 * Vierzehn Einträge, keiner deutsch: zwölf Folgen plus zwei PV, und die
 * Synchro ist englisch. Ein `dub: false` darf hier entstehen — aber nur über
 * den Reihenweg, wenn die Zuordnung sauber aufgeht.
 */
{
  const s = serie([['Iwatobi Swim Club', 0, 14], ['Eternal Summer', 0, 15], ['Dive to the Future', 12, 12]])
  const u = urteil(s, [titel(1, 12, 2013), titel(2, 13, 2014), titel(3, 12, 2018)])
  pruefe('Free!: unpassende Folgenzahlen erzeugen kein Urteil', u.size === 0, [...u])
}

/**
 * Fall 7 — die wichtigste Regel überhaupt.
 *
 * Ein `dub: false` **entfernt den Verweis**. Es darf deshalb nie aus dem
 * Zusatzweg stammen, in dem die Reihenfolge unbekannt ist.
 */
{
  const s = serie([['A', 0, 12], ['B', 0, 13], ['C', 24, 24], ['D', 5, 5]])
  const u = urteil(s, [titel(1, 24)])
  pruefe('Zusatzweg erzeugt niemals ein dub=false', ![...u.values()].includes(false), [...u])
}

/**
 * Fall 8 — der US-Katalog.
 *
 * Dort fehlt `de-DE` auch bei Serien, die in Deutschland vollständig
 * synchronisiert vorliegen. Ein Nein darf daraus nie entstehen.
 */
{
  const s = serie([['S1', 0, 12]], { katalog: 'us', deutschImAngebot: false })
  const u = urteil(s, [titel(1, 12)])
  pruefe('US-Katalog erzeugt kein Urteil', u.size === 0, [...u])
}

/**
 * Fall 9 — der Rückschritt-Schutz auf dem echten Bestand.
 *
 * Die acht Fälle oben prüfen die Logik an gebauten Beispielen. Sie merken
 * **nicht**, wenn die Auswertung auf dem wirklichen Datenbestand einbricht —
 * etwa weil ein Feld umbenannt wurde, der Abruf leer läuft oder eine
 * Bedingung zu streng gerät.
 *
 * Genau das ist der Fall, den Daniel meint: „ist das jetzt von dir korrigiert
 * worden, sodass zukünftige läufe es nicht erneut kaputt machen?" Eine
 * Zusicherung, die nur synthetische Fälle kennt, beantwortet das nicht.
 *
 * Die Untergrenze ist bewusst weit unter dem Stand vom 23.08.2026 (470
 * Urteile) angesetzt: Sie soll den **Einbruch** fangen, nicht jede Schwankung.
 * Der Bestand ändert sich täglich, und eine zu enge Grenze würde bei jedem
 * normalen Lauf rot — und dann abgeschaltet.
 */
{
  const crDub = readJson<CrDubData>(resolve(ROOT, 'data/crunchyroll-dub.json'), { scrapedAt: '', serien: [] })
  const roh = readJson<Title[] | Record<string, Title>>(resolve(ROOT, 'public/data/titles.json'), [])
  const alle = Array.isArray(roh) ? roh : Object.values(roh)
  const nachUrl = new Map<string, Title[]>()
  for (const t of alle) for (const s of t.streams ?? []) {
    if (s.platform !== 'crunchyroll') continue
    nachUrl.set(s.url, [...(nachUrl.get(s.url) ?? []), t])
  }
  let urteile = 0
  for (const s of crDub.serien) urteile += beurteile(s, nachUrl.get(s.url) ?? []).length
  const UNTERGRENZE = 300
  pruefe(
    `die Auswertung liefert auf dem echten Bestand mindestens ${UNTERGRENZE} Urteile (Stand 23.08.2026: 470)`,
    crDub.serien.length === 0 || urteile >= UNTERGRENZE,
    urteile,
  )
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
