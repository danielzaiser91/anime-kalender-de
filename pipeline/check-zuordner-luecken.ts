/**
 * Lücken des Zuordners (Bericht `daniel-zum-abarbeiten/berichte/d1-rest-ursachen-2026-10-16.md`).
 * Unzugeordnete Rohfolgen werden nie abgehakt und bei jedem Lauf neu aus D1 gelesen; hier steht je
 * Ursache ein Fall im Format der Erzeuger (aniSearch `{nr,de,en,datum}`, TMDB `{s,e,titel,datum}`,
 * Prime-Rohfolge nach `AnbieterFolge`). Läuft in `check:logic`.
 */
import { ausAnisearch, englischeSchreibweisen, folgenKern, ordneZu, type AnbieterFolge, type AsFolgeRoh, type TmdbFolge } from '../shared/folgen-zuordnung.ts'
import { entscheideZuordnung, ordneUeberAnker, passendeStaffel, probeGeschwister, sammleAnker, type AnkerTitel } from '../shared/folgen-anker.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, detail = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${detail}`)
}

/** n aniSearch-Folgen mit eindeutigen deutschen Titeln und wöchentlichem Datum. */
function asFolgen(n: number, stamm: string, suffix = ''): AsFolgeRoh[] {
  return Array.from({ length: n }, (_, i) => ({
    nr: i + 1,
    datum: `2019-07-${String(i + 1).padStart(2, '0')}`,
    minuten: 24,
    de: `${stamm} Titel ${i + 1} ${'x'.repeat(i + 1)}${suffix}`,
    en: `${stamm} Title ${i + 1}`,
  }))
}

/** Die Prime-Sicht auf dieselben Folgen: nur der Titel (Datum ist dort die Plattform-Aufnahme). */
function primeSicht(folgen: AsFolgeRoh[], schmuck: (t: string, i: number) => string = (t) => t): AnbieterFolge[] {
  return folgen.map((f, i) => ({ nummer: i + 1, titel: schmuck(f.de!.replace(/ BD$/, ''), i), datum: '2024-01-01', minuten: 24 }))
}

const treffer = (p: { unsere: number | null }[]): number => p.filter((x) => x.unsere !== null).length

/* Ursache VI: „E<n> - “ (Lupin III. Part 6, 25 Prime-Folgen gegen 24 bei aniSearch) */
pruefe('E0 - Zeiten = Zeiten', folgenKern('E0 - Zeiten') === folgenKern('Zeiten'))
pruefe('E12 – Titel = Titel', folgenKern('E12 – Titel') === folgenKern('Titel'))
pruefe('ein Titel, der mit E anfängt, bleibt', folgenKern('Eden of the East') !== folgenKern('den of the East'))
{
  const as = asFolgen(24, 'Lupin')
  const prime = [{ nummer: 0, titel: 'E0 - Zeiten', datum: '2024-01-01', minuten: 24 }, ...primeSicht(as, (t, i) => `E${i + 1} - ${t}`)]
  const z = ordneZu(prime, ausAnisearch(as))
  pruefe('Lupin: E-Präfix, 24 von 25 zugeordnet', treffer(z) === 24, String(treffer(z)))
}

/* Ursache IIb: aniSearch-Titel mit „ BD“ (Hensuki, 12 Folgen) */
{
  const echt: AsFolgeRoh = { nr: 1, datum: '2019-07-08', minuten: 24, de: 'Cinderellas verlorener Slip?! BD', en: 'Cinderella Dropped Her Panties?!' }
  pruefe('BD-Suffix wird entfernt', ausAnisearch([echt])[0]!.titel === 'Cinderellas verlorener Slip?!')
  pruefe('englischer Titel ohne BD bleibt unverändert', englischeSchreibweisen([echt])[0]!.titel === 'Cinderella Dropped Her Panties?!')
  pruefe('BD mitten im Wort bleibt', ausAnisearch([{ nr: 1, de: 'BDSM im Park' }])[0]!.titel === 'BDSM im Park')
  const as = asFolgen(12, 'Hensuki', ' BD')
  const z = ordneZu(primeSicht(as), ausAnisearch(as))
  pruefe('Hensuki: alle 12 über den Titel', treffer(z) === 12, String(treffer(z)))
}

/* Ursache III: aniSearch ohne deutsche Titel, TMDB hat sie (Pac-Man) */
{
  const asOhneDe: AsFolgeRoh[] = asFolgen(26, 'Pac').map((f) => ({ nr: f.nr, en: `Pac Episode ${f.nr}` }))
  const tmdb: TmdbFolge[] = asFolgen(26, 'Pac').map((f) => ({ s: 1, e: f.nr, titel: f.de!, datum: '2016-07-01', minuten: 24 }))
  const titel: AnkerTitel = { id: 1, episodes: 26, jpYear: 2016 }
  const prime = primeSicht(asFolgen(26, 'Pac'))
  const ak = sammleAnker(asOhneDe, { folgen: tmdb }, titel)
  pruefe('beide Anker sind da', ak.listen.map((l) => l.quelle).join() === 'aniSearch,TMDB')
  const r = ordneUeberAnker(prime, ak.listen)
  pruefe('TMDB trägt, wo aniSearch nichts trifft', r.quelle === 'TMDB' && treffer(r.paare) === 26, `${r.quelle} ${treffer(r.paare)}`)
  const mitAs = ordneUeberAnker(primeSicht(asFolgen(26, 'Pac')), sammleAnker(asFolgen(26, 'Pac'), { folgen: tmdb }, titel).listen)
  pruefe('trifft aniSearch, wird TMDB nicht befragt', mitAs.quelle === 'aniSearch')
  const ohneAs = sammleAnker(undefined, undefined, titel)
  pruefe('ohne jeden Anker: Grund statt Raten', ohneAs.listen.length === 0 && ohneAs.grund.startsWith('keine Folgentitel'))
  const keineStaffel = sammleAnker(undefined, { folgen: tmdb }, { ...titel, episodes: 52 })
  pruefe('TMDB ohne passende Staffel: Grund', keineStaffel.listen.length === 0 && keineStaffel.grund.includes('52'))
}

/* Staffelwahl: ein einziger Längentreffer im falschen Jahr ist keine Staffel (Spy x Family: 12 Folgen 2022, TMDB-Staffel 2 von 2023) */
{
  const staffel = (s: number, n: number, jahr: number, minuten = 24): TmdbFolge[] =>
    Array.from({ length: n }, (_, i) => ({ s, e: i + 1, titel: `S${s} Titel ${i + 1}`, datum: `${jahr}-04-${String(i + 1).padStart(2, '0')}`, minuten }))
  /* Drei Kandidaten, die zwölfte-Folgen-Staffel steht in der Mitte */
  const folgen = [...staffel(1, 10, 2018), ...staffel(2, 12, 2022), ...staffel(3, 13, 2025)]
  const titel: AnkerTitel = { id: 1, episodes: 12, jpYear: 2022, runtimeMin: 24 }
  pruefe('Jahr, Folgenzahl und Laufzeit passen: die mittlere Staffel', passendeStaffel(folgen, titel) === 2)
  pruefe('einziger Längentreffer im Vorjahr: keine Staffel', passendeStaffel(folgen, { ...titel, jpYear: 2021 }) === null)
  pruefe('einziger Längentreffer im Folgejahr: keine Staffel', passendeStaffel(folgen, { ...titel, jpYear: 2023 }) === null)
  pruefe('ohne Titeljahr wird nicht geraten', passendeStaffel(folgen, { ...titel, jpYear: null }) === null)
  pruefe('Laufzeit weicht ab: beim eigenen TMDB-Eintrag zählt nur das Jahr', passendeStaffel(folgen, { ...titel, runtimeMin: 63 }) === 2)
  const ohneDatum = [...staffel(1, 10, 2018), ...staffel(2, 12, 2022).map((f) => ({ ...f, datum: null })), ...staffel(3, 13, 2025)]
  pruefe('Staffel ohne Sendedatum: keine Staffel', passendeStaffel(ohneDatum, titel) === null)
  /* Staffel über den Jahreswechsel: Es zählt die erste Ausstrahlung (Dezember 2021), nicht die letzte (Januar 2022). Die Folgen stehen absteigend, damit auch „erste Zeile“ statt „frühestes Datum“ rot wird. */
  const ueberJahr = (Array.from({ length: 12 }, (_, i) => ({
    s: 2,
    e: i + 1,
    titel: `J Titel ${i + 1}`,
    minuten: 24,
    datum: i < 4 ? `2021-12-${String(20 + i).padStart(2, '0')}` : `2022-01-${String(i).padStart(2, '0')}`,
  })) as TmdbFolge[]).reverse()
  const jahreswechsel = [...staffel(1, 10, 2018), ...ueberJahr, ...staffel(3, 13, 2025)]
  pruefe('Staffel Dez. 2021 bis Jan. 2022, Titeljahr 2021: Treffer', passendeStaffel(jahreswechsel, { ...titel, jpYear: 2021 }) === 2)
  pruefe('Staffel Dez. 2021 bis Jan. 2022, Titeljahr 2022: keine Staffel', passendeStaffel(jahreswechsel, { ...titel, jpYear: 2022 }) === null)
  const falsch = sammleAnker(undefined, { folgen }, { ...titel, jpYear: 2021 })
  pruefe('sammleAnker: falsches Jahr liefert keinen Anker', falsch.listen.length === 0 && falsch.grund.includes('12'))
  const richtig = sammleAnker(undefined, { folgen }, titel)
  pruefe('sammleAnker: passende Staffel liefert 12 Folgen', richtig.listen[0]?.folgen.length === 12 && richtig.listen[0].folgen.every((f) => f.s === 2))
}

/* L3: der Anker mit den meisten Treffern gewinnt, nicht der erste mit einem (Dorohedoro Staffel 2: aniSearch 1 von 11, TMDB 8) */
{
  const prime = primeSicht(asFolgen(10, 'Wahl'))
  const liste = (quelle: 'aniSearch' | 'TMDB', trifft: number) => ({
    quelle,
    folgen: asFolgen(10, 'Wahl').map((f, i) => ({ s: 1, e: f.nr, titel: i < trifft ? f.de!.replace(/ BD$/, '') : `Andere ${quelle} ${i}`, datum: null, minuten: 24 })),
  })
  const gewinner = (...l: ReturnType<typeof liste>[]) => ordneUeberAnker(prime, l).quelle
  pruefe('mehr Treffer schlagen den früheren Anker', gewinner(liste('aniSearch', 1), liste('TMDB', 8)) === 'TMDB')
  pruefe('mittlere Liste mit den meisten Treffern gewinnt', gewinner(liste('aniSearch', 1), liste('TMDB', 6), liste('aniSearch', 3)) === 'TMDB')
  pruefe('Gleichstand: der frühere bleibt', gewinner(liste('aniSearch', 4), liste('TMDB', 4)) === 'aniSearch')
  pruefe('ohne Treffer gilt der erste', gewinner(liste('aniSearch', 0), liste('TMDB', 0)) === 'aniSearch')
}

/* Ursachen I und IIa: Geschwister-Probe */
{
  interface T extends AnkerTitel { franchiseId: number }
  const s1 = asFolgen(13, 'Reihe A')
  const s2 = asFolgen(12, 'Reihe B')
  const gemeldet: T = { id: 3, episodes: 16, jpYear: 2025, franchiseId: 7 }
  const alle: T[] = [
    { id: 1, episodes: 13, jpYear: 2019, franchiseId: 7 },
    { id: 2, episodes: 12, jpYear: 2022, franchiseId: 7 },
    gemeldet,
    { id: 9, episodes: 12, jpYear: 2022, franchiseId: 8 },
  ]
  const liste = (t: T) => ordneListe(t)
  const anker: Record<number, AsFolgeRoh[]> = { 1: s1, 2: s2, 3: asFolgen(16, 'Reihe C'), 9: s2 }
  function ordneListe(t: T) {
    return sammleAnker(anker[t.id], undefined, t).listen
  }
  const keine = () => false
  const gelesen = primeSicht(s2)
  const p = probeGeschwister(gelesen, gemeldet, alle, liste, keine)
  pruefe('Staffel 2 derselben Reihe wird gefunden', p?.titel.id === 2 && p.treffer === 12, JSON.stringify(p?.titel))
  pruefe('eine fremde Reihe zählt nicht', probeGeschwister(gelesen, gemeldet, alle, liste, keine)?.titel.id !== 9)
  pruefe('der Reihenkopf lässt sich ausnehmen', probeGeschwister(primeSicht(s1), gemeldet, alle, liste, (t) => t.id === 1) === null)
  pruefe('ohne Reihe keine Probe', probeGeschwister(gelesen, { ...gemeldet, franchiseId: 0 }, alle, liste, keine) === null)

  /* Der beste Treffer gewinnt, nicht der erste. */
  const teil = asFolgen(12, 'Reihe B').map((f, i) => (i < 8 ? f : { ...f, de: `anderer Text ${i} zzzz` }))
  const mehr: Record<number, AsFolgeRoh[]> = { 1: teil, 2: s2, 3: [] }
  const beste = probeGeschwister(gelesen, gemeldet, alle, (t) => sammleAnker(mehr[t.id], undefined, t).listen, keine)
  pruefe('der beste gewinnt (12 gegen 8)', beste?.titel.id === 2, JSON.stringify(beste?.titel))
  const gleich: Record<number, AsFolgeRoh[]> = { 1: s2, 2: s2, 3: [] }
  pruefe('Gleichstand an der Spitze bleibt offen', probeGeschwister(gelesen, gemeldet, alle, (t) => sammleAnker(gleich[t.id], undefined, t).listen, keine) === null)
  const zwei: Record<number, AsFolgeRoh[]> = { 1: s2.slice(0, 2), 2: [], 3: [] }
  pruefe('zwei Treffer genügen nicht', probeGeschwister(gelesen, gemeldet, alle, (t) => sammleAnker(zwei[t.id], undefined, t).listen, keine) === null)
  const kurz = primeSicht(s2.slice(0, 3))
  const zweiVonDrei: Record<number, AsFolgeRoh[]> = { 1: s2.slice(0, 2), 2: [], 3: [] }
  pruefe('zwei von drei: mehr als die Hälfte, aber unter drei', probeGeschwister(kurz, gemeldet, alle, (t) => sammleAnker(zweiVonDrei[t.id], undefined, t).listen, keine) === null)
  const ohneReihe = { id: 5, episodes: 12 }
  const fremde = [ohneReihe, { id: 6, episodes: 12 }]
  pruefe('ohne Reihenkennung bilden Titel keine Reihe', probeGeschwister(gelesen, ohneReihe, fremde, (t) => sammleAnker(s2, undefined, t).listen, keine) === null)
  const keinTreffer = ordneUeberAnker(primeSicht(asFolgen(3, 'Nichts')), sammleAnker(s2, { folgen: [{ s: 1, e: 1, titel: 'Etwas Fremdes', datum: null, minuten: null }] }, { id: 1, episodes: 1 }).listen)
  pruefe('ohne Treffer nennt das Protokoll den ersten Anker', keinTreffer.quelle === 'aniSearch', keinTreffer.quelle)
  const enBd = ausAnisearch([{ nr: 1, de: 'Deutsch', en: 'English Title BD' }])
  pruefe('„ BD“ am englischen Titel wird in der zweiten Schreibweise entfernt', englischeSchreibweisen([{ nr: 1, de: 'Deutsch', en: 'English Title BD' }])[0]!.titel === 'English Title' && enBd.length === 1)
  /* Oshi no Ko (aniSearch 17452), Folge 5 und 9 wörtlich aus data/anisearch-folgen.json: Kern von de und en gleich; Folge 10 erfunden (Kern verschieden). */
  const oshi: AsFolgeRoh[] = [
    { nr: 5, datum: '2023-05-10', minuten: 24, de: 'Reality-Datingshow', en: 'Reality Dating Show' },
    { nr: 9, datum: '2023-06-14', minuten: 25, de: 'B-Komachi', en: 'B Komachi' },
    { nr: 10, de: 'Deutsch zehn', en: 'English ten' },
  ]
  const oshiPrime: AnbieterFolge[] = [
    { nummer: 5, titel: 'Reality-Datingshow', datum: null, minuten: null },
    { nummer: 9, titel: 'B-Komachi', datum: null, minuten: null },
    { nummer: 10, titel: 'English ten', datum: null, minuten: null },
  ]
  pruefe('gleicher Kern in de und en: keine zweite Zeile', englischeSchreibweisen(oshi.slice(0, 2)).length === 0)
  pruefe('verschiedener Kern bleibt zweiter Versuch', englischeSchreibweisen(oshi).map((f) => f.e).join() === '10')
  pruefe('„ BD“ im deutschen Titel zählt beim Kernvergleich nicht', englischeSchreibweisen([{ nr: 1, de: 'Gleich BD', en: 'Gleich' }]).length === 0)
  const oshiPaare = ordneZu(oshiPrime, [...ausAnisearch(oshi), ...englischeSchreibweisen(oshi)])
  pruefe('Oshi no Ko Folge 5, 9 und englisch geführte 10 werden zugeordnet', oshiPaare.map((p) => p.unsere).join() === '5,9,10', oshiPaare.map((p) => p.unsere).join())
  const knapp: Record<number, AsFolgeRoh[]> = { 1: s2.slice(0, 6), 2: [], 3: [] }
  pruefe('genau die Hälfte (6 von 12) genügt nicht', probeGeschwister(gelesen, gemeldet, alle, (t) => sammleAnker(knapp[t.id], undefined, t).listen, keine) === null)
}

/* Gegenbeispiel 1: Prime gibt allen Folgen eines Kauftitels dasselbe Datum („My First Girlfriend Is a Gal“) */
{
  interface T extends AnkerTitel { franchiseId: number }
  const tmdb = (n: number, stamm: string, jahr: number): TmdbFolge[] =>
    Array.from({ length: n }, (_, i) => ({ s: 1, e: i + 1, titel: `${stamm} ${i + 1} qqqq`, datum: `${jahr}-07-${String(i + 1).padStart(2, '0')}`, minuten: 24 }))
  const gal: AnbieterFolge[] = Array.from({ length: 11 }, (_, i) => ({ nummer: i + 1, titel: `${i + 1}. Kauftitel-Name ${i}`, datum: '2017-07-01', minuten: 24 }))
  const s2: T = { id: 2, episodes: 12, jpYear: 2017, franchiseId: 4 }
  const s3: T = { id: 3, episodes: 11, jpYear: 2025, franchiseId: 4 }
  const anker: Record<number, TmdbFolge[]> = { 2: tmdb(12, 'Zweite', 2017), 3: tmdb(11, 'Dritte', 2025) }
  const listen = (t: T) => sammleAnker(undefined, { folgen: anker[t.id]! }, t).listen
  const eigen = ordneUeberAnker(gal, listen(s2))
  pruefe('gleiches Datum für alle Folgen belegt keine', treffer(eigen.paare) === 0, String(treffer(eigen.paare)))
  const zweiGleich: AnbieterFolge[] = [1, 2].map((n) => ({ nummer: n, titel: `Kauftitel-Name ${n}`, datum: '2017-07-01', minuten: 24 }))
  pruefe('schon zwei Zeilen mit demselben Datum belegen keine', treffer(ordneUeberAnker(zweiGleich, listen(s2)).paare) === 0)
  pruefe('gleiches Datum: keine Probe auf Staffel 2', probeGeschwister(gal, s3, [s2, s3], listen, () => false) === null)
  /* Dieselbe Zeile zwölfmal auf Folge 1 ist ein Ziel, kein Dutzend: gezählt werden verschiedene Folgen. */
  const doppelt: AnbieterFolge[] = [1, 1, 1, 2, 50].map((e, i) => ({ nummer: i + 1, titel: `Zweite ${e} qqqq`, datum: null, minuten: 24 }))
  pruefe('vier Zeilen auf zwei Folgen tragen die Probe nicht', probeGeschwister(doppelt, s3, [s2, s3], listen, () => false) === null)
}

/* Gegenbeispiel 2: Platzhalter-Anker „Folge n“ treffen jede Staffel über die Nummer */
{
  interface T extends AnkerTitel { franchiseId: number }
  const platz = (n: number): TmdbFolge[] => Array.from({ length: n }, (_, i) => ({ s: 1, e: i + 1, titel: `Folge ${i + 1}`, datum: null, minuten: 24 }))
  const s1: T = { id: 1, episodes: 12, jpYear: 2019, franchiseId: 5 }
  const s3: T = { id: 3, episodes: 12, jpYear: 2025, franchiseId: 5 }
  const seite: AnbieterFolge[] = platz(12).map((f) => ({ nummer: f.e, titel: f.titel, datum: '2025-04-01', minuten: 24 }))
  const listen = (t: T) => (t.id === 1 ? sammleAnker(undefined, { folgen: platz(12) }, t).listen : [])
  pruefe('Platzhalter-Anker wählen keine Staffel', probeGeschwister(seite, s3, [s1, s3], listen, () => false) === null)
  for (const p of ['Folge 3', 'Episode 3', 'Ep. 3', 'E3', '#3']) {
    pruefe(`Platzhalter „${p}“ ist kein Titelanker`, sammleAnker(undefined, { folgen: [{ s: 1, e: 3, titel: p, datum: '2019-03-01', minuten: null }] }, { id: 1, episodes: 1, jpYear: 2019 }).listen[0]!.folgen[0]!.titel === null)
  }
  const echt = sammleAnker([{ nr: 1, de: 'Folge 3: Der Sturm' }], undefined, { id: 1 }).listen[0]!.folgen[0]!.titel
  pruefe('ein Titel nach der Zählung bleibt', echt === 'Folge 3: Der Sturm', String(echt))
  const asPlatz = sammleAnker([{ nr: 3, en: 'Episode 3' }], undefined, { id: 1 }).listen[0]!.folgen[0]!.titel
  pruefe('aniSearch-Platzhalter ist kein Titelanker', asPlatz === null, String(asPlatz))
}

/* Reihenfolge: Folgen des Titels, dann Beleg ohne Folgennummer, dann Probe (Kennung/Adresse schlägt Probe) */
{
  const as = asFolgen(12, 'Reihe B')
  const gelesen = primeSicht(as)
  const leer = sammleAnker(asFolgen(12, 'Fremd'), undefined, { id: 1 })
  const fund = { titel: { id: 2 }, paare: ordneZu(gelesen, ausAnisearch(as)), quelle: 'aniSearch', treffer: 12 }
  pruefe('trägt der Beleg ohne Folgennummer, überstimmt die Probe ihn nicht', entscheideZuordnung(gelesen, { id: 1 }, leer, true, () => fund).art === 'titel')
  const ohne = entscheideZuordnung(gelesen, { id: 1 }, leer, false, () => fund)
  pruefe('trägt er nicht, greift die Probe', ohne.art === 'folgen' && ohne.ziel.id === 2)
  const keinAnker = sammleAnker(undefined, undefined, { id: 1 })
  const mitProbe = entscheideZuordnung(gelesen, { id: 1 }, keinAnker, true, () => fund)
  pruefe('ohne eigenen Anker darf die Probe ran', mitProbe.art === 'folgen' && mitProbe.ziel.id === 2)
  const nichts = entscheideZuordnung(gelesen, { id: 1 }, keinAnker, true, () => null)
  pruefe('ohne Anker und ohne Probe: Grund des Ankers', nichts.art === 'offen' && nichts.grund === keinAnker.grund)
  const fremd = entscheideZuordnung(gelesen, { id: 1 }, leer, false, () => null)
  pruefe('ohne Treffer: offen mit Ankerquelle', fremd.art === 'offen' && fremd.grund.endsWith('(Anker: aniSearch)'))
  const selbst = entscheideZuordnung(gelesen, { id: 1 }, sammleAnker(as, undefined, { id: 1 }), true, () => fund)
  pruefe('trifft der gemeldete Titel, bleibt er', selbst.art === 'folgen' && selbst.ziel.id === 1)
}

if (fehler) process.exit(1)
console.log('check-zuordner-luecken: ok')
