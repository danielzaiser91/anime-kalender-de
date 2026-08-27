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
import { beurteile, beurteileNachFolgennummern, type CrSerie, type CrDubData, beurteileJeBlock } from './lib/crunchyroll-dub.ts'
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

console.log('\nZuordnung über durchgezählte Folgennummern\n')

/** Wie `serie()`, aber mit echten Folgennummern je Block. */
const serieMitNummern = (bloecke: [string, number[], number][], extra: Partial<CrSerie> = {}): CrSerie =>
  ({
    url: 'https://example.test/serie',
    seriesId: 'X',
    quelle: 'api',
    katalog: 'de',
    geprueftAm: '2026-08-23',
    deutschImAngebot: bloecke.some(([, nummern]) => nummern.length > 0),
    staffeln: bloecke.map(([name, nummern, folgen]) => ({
      name, staffelId: name, folgen, kacheln: folgen,
      deutsch: nummern.length, fremd: folgen - nummern.length,
      deutscheFassung: nummern.length === folgen,
      deutscheFolgen: nummern.map((nummer) => ({ nummer, guid: `G${nummer}` })),
    })),
    ...extra,
  }) as unknown as CrSerie

const nummernUrteil = (s: CrSerie, ts: Title[]) => {
  const m = new Map<number, boolean>()
  for (const u of beurteileNachFolgennummern(s, ts)) m.set(u.titleId, u.dub)
  return m
}

const reihe = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
const von = (start: number, n: number) => Array.from({ length: n }, (_, i) => start + i)

/**
 * Fall A — Golden Kamuy (23.08.2026, Daniels Fall).
 *
 * Ein Block mit 49 durchgezählten Folgen deckt unsere Staffeln 1–4; der zweite
 * beginnt bei 50. Über Blockgrößen ist hier nichts zuzuordnen, über Nummern
 * schon.
 */
{
  const s = serieMitNummern([['Golden Kamuy', reihe(49), 49], ['Final Season', von(50, 13), 13]])
  const u = nummernUrteil(s, [titel(1, 12, 2018), titel(2, 12, 2018), titel(3, 12, 2020), titel(4, 13, 2022), titel(5, 13, 2024)])
  pruefe('Golden Kamuy: alle fünf Staffeln über die Nummern belegt',
    [1, 2, 3, 4, 5].every((id) => u.get(id) === true), [...u])
}

/**
 * Fall B — KONOSUBA: jeder Block beginnt wieder bei 1.
 *
 * Dann sagt eine Nummer nichts über die Staffel, und dieser Weg muss schweigen.
 */
{
  const s = serieMitNummern([['S1', reihe(10), 10], ['S2', reihe(10), 10]])
  const u = nummernUrteil(s, [titel(1, 10), titel(2, 10)])
  pruefe('überlappende Nummern erzeugen kein Urteil', u.size === 0, [...u])
}

/**
 * Fall C — Fruits Basket: uns fehlt eine Staffel.
 *
 * Crunchyroll zählt 1–63, unsere Einträge summieren sich auf 39. Ginge die
 * Zuordnung trotzdem los, läge alles um 25 Folgen verschoben — genau der
 * Fehler, der schon einmal ein falsches `dub: false` erzeugt hat.
 */
{
  const s = serieMitNummern([['Staffel 2', von(26, 25), 25], ['The Final', von(51, 13), 13]])
  const u = nummernUrteil(s, [titel(1, 25, 2020), titel(2, 13, 2021), titel(3, 1, 2022)])
  pruefe('unvollständige Reihe erzeugt kein Urteil', u.size === 0, [...u])
}

/**
 * Fall D — die Grenze bei teilweise deutschen Blöcken.
 *
 * Block B hat zwölf Folgen, aber nur sechs deutsche (Nummern 13–18). Die
 * höchste **deutsche** Nummer ist damit 18, während unsere beiden Staffeln
 * zusammen 24 Folgen haben. Die Summenprüfung schlägt fehl — und das ist
 * richtig so: Ob die Nummern 19–24 zu Block B gehören, ob sie fehlen oder ob
 * die Zählung dort abbricht, ist aus den vorhandenen Angaben nicht zu sehen.
 *
 * **Diese Grenze ist bewusst.** Sie zu überschreiten hieße, die Lage der
 * undeutschen Folgen zu erraten — und aus einem Irrtum entstünde ein
 * `dub: false`, das einen Verweis entfernt.
 */
{
  const s = serieMitNummern([['A', reihe(12), 12], ['B', von(13, 6), 12]])
  const u = nummernUrteil(s, [titel(1, 12), titel(2, 12)])
  pruefe('teilweise deutscher Block: kein Urteil, auch nicht für die volle Staffel daneben',
    u.size === 0, [...u])
}

/**
 * Fall E — die zweite Grenze: ein Block ganz ohne deutsche Folge.
 *
 * Ein solcher Block trägt keine Nummern, also ist nicht zu sehen, welchen
 * Abschnitt der Zählung er belegt. Bei Golden Kamuy liegt genau so ein Block
 * (`OADs`, 0/3) **außerhalb** der Zählung — dort springt die Nummerierung von
 * 49 auf 50. Ob ein undeutscher Block mitzählt oder nicht, entscheidet sich
 * also von Fall zu Fall und ist nicht ableitbar.
 *
 * Deshalb schweigt der Nummernweg hier. Der Fall „Free! Staffel 1 und 2 ohne
 * deutsche Fassung" bleibt damit der Handprüfung überlassen — belegt, aber
 * nicht automatisch.
 */
{
  const s = serieMitNummern([['A', [], 12], ['B', von(13, 12), 12]])
  const u = nummernUrteil(s, [titel(1, 12), titel(2, 12)])
  pruefe('Block ohne deutsche Folge: kein Urteil, weil seine Nummernlage unbekannt ist',
    u.size === 0, [...u])
}

/**
 * Fall F — und hier entsteht ein `dub: false` zu Recht.
 *
 * Alle Blöcke tragen deutsche Nummern, die Zählung ist lückenlos, die Summe
 * geht auf. Eine Staffel, deren Abschnitt keine einzige deutsche Nummer
 * enthält, ist dann belegt ohne Synchro — anders als im Zusatzweg, wo die
 * Reihenfolge unbekannt bleibt und ein Nein deshalb nie entstehen darf.
 */
{
  const s = serieMitNummern([['A', reihe(12), 12], ['B', von(13, 12), 12], ['C', von(25, 12), 12]])
  const u = nummernUrteil(s, [titel(1, 12), titel(2, 12), titel(3, 12)])
  pruefe('lückenlose Zählung: jede Staffel bekommt ihr Urteil',
    u.get(1) === true && u.get(2) === true && u.get(3) === true, [...u])
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

/**
 * Die Warteschlange enthält nur Adressen, die auch zu Crunchyroll zeigen.
 *
 * aniSearch führt unter `provider: "crunchyroll-(de)"` teils eine
 * **Amazon-Partneradresse** — bei „Attack on Titan" steht dort
 * `https://www.amazon.de/dp/B0C9H2BQWM?tag=anisearch.de-21`. Der Build filtert
 * solche Verweise aus dem Datensatz, die Abruf-Warteschlange tat es bis zum
 * 23.08.2026 nicht: Die Adresse stand seit jeher unter den 86 „keine
 * Serienkennung hinter dieser Adresse" und wurde bei jedem Lauf vergeblich
 * aufgelöst.
 *
 * Geprüft wird der Host, nicht ein Textstück — `url.includes('crunchyroll')`
 * ließe `amazon.de/…?ref=crunchyroll` durch.
 */
{
  const crDub = readJson<CrDubData>(resolve(ROOT, 'data/crunchyroll-dub.json'), { scrapedAt: '', serien: [] })
  const fremd = crDub.serien.filter((s) => {
    try {
      const host = new URL(s.url).hostname
      return host !== 'crunchyroll.com' && !host.endsWith('.crunchyroll.com')
    } catch {
      return true
    }
  })
  pruefe(
    'keine fremde Adresse in der Warteschlange (aniSearch liefert Amazon-Partnerlinks unter provider crunchyroll-(de))',
    fremd.length === 0,
    fremd.map((s) => s.url).slice(0, 3),
  )
}

/**
 * Was als tot erkannt ist, steht nicht mehr im ausgelieferten Datensatz.
 *
 * 127 Crunchyroll-Adressen tragen „Leider sind die Videos dieser Serie nicht
 * mehr verfügbar" oder eine 404. Dass der Build sie entfernt, stand bis zum
 * 23.08.2026 nur in `status.md` als Vermutung — **gemessen ergab es 0 von
 * 127**, also stimmt es. Diese Zusicherung hält es fest: Ein Umbau, der die
 * Filterung verliert, schickt sonst Besucher auf Fehlerseiten, und niemand
 * merkt es, weil der Datensatz genauso vollständig aussieht.
 */
{
  const crDub = readJson<CrDubData>(resolve(ROOT, 'data/crunchyroll-dub.json'), { scrapedAt: '', serien: [] })
  const roh = readJson<Title[] | Record<string, Title>>(resolve(ROOT, 'public/data/titles.json'), [])
  const alle = Array.isArray(roh) ? roh : Object.values(roh)
  const ausgeliefert = new Set<string>()
  for (const t of alle) for (const s of t.streams ?? []) {
    if (s.platform === 'crunchyroll') ausgeliefert.add(s.url)
  }
  const tot = crDub.serien.filter((s) => /nicht mehr verf|404/.test(s.fehler ?? ''))
  const uebrig = tot.filter((s) => ausgeliefert.has(s.url))
  pruefe(
    `keine der ${tot.length} toten Crunchyroll-Adressen steht noch im Datensatz`,
    uebrig.length === 0,
    uebrig.map((s) => s.url).slice(0, 3),
  )
}

/**
 * Die dritte Stufe: je Titel der passende Block.
 *
 * Sie setzt ausschließlich `true` und nur bei Namensgleichheit. Der gefährliche
 * Fehlgriff ist die Vererbung: Ein Special, dessen Name mit dem der Serie
 * beginnt, darf **nicht** deren Urteil bekommen. Genau das tat der erste
 * Anlauf — „Sword Art Online EXTRA EDITION" erbte den Block „Sword Art Online",
 * und aus 23 richtigen Urteilen wurden 33 mit zehn falschen (26.08.2026).
 */
{
  const serie = {
    url: 'https://www.crunchyroll.com/de/series/TEST/sword-art-online',
    seriesId: 'TEST',
    quelle: 'api' as const,
    katalog: 'de' as const,
    geprueftAm: '2026-08-26',
    deutschImAngebot: true,
    staffeln: [
      { name: 'Sword Art Online', folgen: 25, kacheln: 25, deutsch: 25, fremd: 0 },
      { name: 'Sword Art Online II', folgen: 24, kacheln: 24, deutsch: 24, fremd: 0 },
    ],
  }
  const titel = (id: number, name: string, folgen: number) =>
    ({ id, titleRomaji: name, titleEn: name, episodes: folgen, streams: [] }) as never

  const urteile = beurteileJeBlock(serie as never, [
    titel(1, 'Sword Art Online', 25),
    titel(2, 'Sword Art Online EXTRA EDITION', 1),
    titel(3, 'Sword Art Online II', 24),
  ])
  const ids = urteile.map((u) => u.titleId).sort()

  pruefe('die Serie selbst bekommt ihr Urteil', ids.includes(1), ids)
  pruefe('die zweite Staffel auch', ids.includes(3), ids)
  pruefe('ein Special erbt NICHT von der Hauptserie', !ids.includes(2), ids)
  pruefe('nur true, nie false', urteile.every((u) => u.dub === true), urteile)

  /* Ein Block, der zu keinem Titel passt, setzt nichts. */
  const fremd = beurteileJeBlock(serie as never, [titel(9, 'Attack on Titan', 25)])
  pruefe('ein fremder Titel bekommt nichts', fremd.length === 0, fremd)

  /* Zwei gleich benannte Blöcke sind mehrdeutig. */
  const doppelt = {
    ...serie,
    staffeln: [
      { name: 'Durarara', folgen: 24, kacheln: 24, deutsch: 0, fremd: 24 },
      { name: 'Durarara', folgen: 25, kacheln: 25, deutsch: 25, fremd: 0 },
    ],
  }
  pruefe(
    'zwei gleich benannte Blöcke setzen nichts',
    beurteileJeBlock(doppelt as never, [titel(4, 'Durarara!!', 24)]).length === 0,
  )

  /*
    Und der Fall, um den es ging: Der Block hat eine Folge mehr als unser Titel.
    Für die Frage „gibt es das auf Deutsch" ist das ohne Belang.
  */
  const eineMehr = {
    ...serie,
    staffeln: [{ name: 'Durarara (German Dub)', folgen: 25, kacheln: 25, deutsch: 25, fremd: 0 }],
  }
  pruefe(
    'eine abweichende Folgenzahl verhindert kein true',
    beurteileJeBlock(eineMehr as never, [titel(5, 'Durarara!!', 24)]).length === 1,
  )
}

/**
 * Die einzige Serie an der Adresse bekommt den Block — ein Film nicht.
 *
 * Ist genau ein Titel offen und ist er eine Serie, gehören ihm die deutschen
 * Folgen dieser Adresse. Der gefährliche Teil ist die Ausnahme: „Fairy Tail:
 * Phoenix Priestess" ist ein Film an einer Adresse, deren Blöcke 175 deutsche
 * Serienfolgen führen — der Film selbst kann trotzdem untertitelt sein.
 */
{
  const mitBloecken = {
    url: 'https://www.crunchyroll.com/de/series/TEST/fairy-tail',
    seriesId: 'TEST',
    quelle: 'api' as const,
    katalog: 'de' as const,
    geprueftAm: '2026-08-27',
    deutschImAngebot: true,
    staffeln: [{ name: 'Fairy Tail', folgen: 175, kacheln: 175, deutsch: 175, fremd: 0 }],
  }
  const mach = (id: number, name: string, folgen: number, format: string) =>
    ({ id, titleRomaji: name, titleEn: name, episodes: folgen, format, streams: [] }) as never

  const serie = beurteileJeBlock(mitBloecken as never, [mach(1, 'Fairy Tail', 175, 'TV')])
  pruefe('die einzige Serie bekommt den Block', serie.length === 1 && serie[0]!.dub === true, serie)

  const film = beurteileJeBlock(mitBloecken as never, [
    mach(2, 'Fairy Tail: Phoenix Priestess', 1, 'MOVIE'),
  ])
  pruefe('ein Film an derselben Adresse bekommt nichts', film.length === 0, film)

  const special = beurteileJeBlock(mitBloecken as never, [
    mach(3, 'Fairy Tail OVA', 5, 'OVA'),
  ])
  pruefe('ein OVA-Block bekommt nichts', special.length === 0, special)

  /* Zwei offene Titel: dann entscheidet wieder der Name. */
  const zwei = beurteileJeBlock(mitBloecken as never, [
    mach(4, 'Fairy Tail', 175, 'TV'),
    mach(5, 'Fairy Tail Final Season', 51, 'TV'),
  ])
  pruefe(
    'bei zwei offenen Titeln greift nur der Namensvergleich',
    zwei.length === 1 && zwei[0]!.titleId === 4,
    zwei,
  )

  /* Und ohne deutschen Block bleibt es bei nichts. */
  const ohneDeutsch = {
    ...mitBloecken,
    staffeln: [{ name: 'Fairy Tail', folgen: 175, kacheln: 175, deutsch: 0, fremd: 175 }],
  }
  pruefe(
    'ohne deutsche Folgen kein Urteil',
    beurteileJeBlock(ohneDeutsch as never, [mach(6, 'Fairy Tail', 175, 'TV')]).length === 0,
  )
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
