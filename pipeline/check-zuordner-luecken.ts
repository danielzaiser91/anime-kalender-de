/**
 * Lücken des Zuordners (Bericht `daniel-zum-abarbeiten/berichte/d1-rest-ursachen-2026-10-16.md`).
 * Unzugeordnete Rohfolgen werden nie abgehakt und bei jedem Lauf neu aus D1 gelesen; hier steht je
 * Ursache ein Fall im Format der Erzeuger (aniSearch `{nr,de,en,datum}`, TMDB `{s,e,titel,datum}`,
 * Prime-Rohfolge nach `AnbieterFolge`). Läuft in `check:logic`.
 */
import { ausAnisearch, englischeSchreibweisen, folgenKern, ordneZu, type AnbieterFolge, type AsFolgeRoh, type TmdbFolge } from '../shared/folgen-zuordnung.ts'
import { ordneUeberAnker, probeGeschwister, sammleAnker, type AnkerTitel } from '../shared/folgen-anker.ts'

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
  const tmdb: TmdbFolge[] = asFolgen(26, 'Pac').map((f) => ({ s: 1, e: f.nr, titel: f.de!, datum: null, minuten: 24 }))
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
  const knapp: Record<number, AsFolgeRoh[]> = { 1: s2.slice(0, 5), 2: [], 3: [] }
  pruefe('höchstens die Hälfte genügt nicht', probeGeschwister(gelesen, gemeldet, alle, (t) => sammleAnker(knapp[t.id], undefined, t).listen, keine) === null)
}

if (fehler) process.exit(1)
console.log('check-zuordner-luecken: ok')
