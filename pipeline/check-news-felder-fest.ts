/**
 * Zusicherungen: Eine bestehende Meldung behält Anbieter, Kanal, Einordnung und Sicherheit vom Bau, der sie auslieferte (20.10.2026,
 * `lib/news-felder-fest.ts`). Läuft in `check:logic`. Erfundene Titel mit festen Daten (2099), kein Netz, keine Uhr.
 */
import type { NewsEintrag, NewsMeldung, Release, Title } from '../shared/types.ts'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { vergissAlte } from './lib/news-einfrieren.ts'
import { felderAenderungen, festSchluessel, haltFelderFest, type FesteFelder } from './lib/news-felder-fest.ts'
import type { DatiertNews } from './lib/news-verlauf.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const FELDER = ['hinweis', 'anbieter', 'kanal', 'geschaetzt', 'jahre', 'discSeitText'] as const
const historie = (felder?: Record<string, FesteFelder>): NewsHistorie => ({ zuerst: {}, ...(felder ? { felder } : {}) })
const titelOb = { id: 1 } as Title
const lebend = (extra: Partial<NewsMeldung> = {}, schluessel = 'angekuendigt:r-1:2099-01-01'): DatiertNews =>
  ({ art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', am: '2026-10-01', titel: titelOb, schluessel, ...extra }) as DatiertNews
const K = 'angekuendigt:r-1:2099-01-01'
const voll: Partial<NewsMeldung> = { hinweis: 'H1', anbieter: 'A1', kanal: 'K1', geschaetzt: true, jahre: 14, discSeitText: '4 Monaten' }
const anders: Partial<NewsMeldung> = { hinweis: 'H2', anbieter: 'A2', kanal: 'K2', geschaetzt: false, jahre: 15, discSeitText: '5 Monaten' }

/* 1. Die Weiche: erster Stand wird festgehalten; jedes Feld einzeln gekippt (anderer Wert, weg, neu) bleibt beim ersten Stand. */
const h1 = historie()
const erst = haltFelderFest(h1, [lebend(voll)], [])
pruefe('Erster Bau: alle sechs Felder werden festgehalten', JSON.stringify(h1.felder?.[K]) === JSON.stringify(voll) && erst[0]!.hinweis === 'H1', h1.felder)
for (const f of FELDER) {
  const kippt = haltFelderFest(historie({ [K]: { ...voll } }), [lebend({ ...voll, [f]: anders[f] })], [])[0]!
  pruefe(`${f}: anderer Wert wird auf den ersten Stand zurückgesetzt`, kippt[f] === voll[f] && FELDER.every((g) => kippt[g] === voll[g]), kippt)
  const { [f]: _weg, ...ohne } = voll
  const fehltJetzt = haltFelderFest(historie({ [K]: { ...voll } }), [lebend(ohne)], [])[0]!
  pruefe(`${f}: später abgeleitet fehlend, die Meldung behält das Feld`, fehltJetzt[f] === voll[f], fehltJetzt)
  const nurDas = haltFelderFest(historie({ [K]: {} }), [lebend({ [f]: anders[f] })], [])[0]!
  pruefe(`${f}: später neu abgeleitet, die Meldung bleibt ohne`, !(f in nurDas), nurDas)
}
const gleich = lebend(voll)
pruefe('Gleiche Werte: dasselbe Objekt, Feldreihenfolge unberührt', haltFelderFest(historie({ [K]: { ...voll } }), [gleich], [])[0] === gleich)
const hz = historie({ [K]: { hinweis: 'H1' }, 'angekuendigt:r-2:2099-01-01': { hinweis: 'ZWEI' } })
const zwei = haltFelderFest(hz, [lebend({ hinweis: 'x' }, 'angekuendigt:r-2:2099-01-01')], [])[0]!
pruefe('Zwei Schlüssel ohne Verwechslung', zwei.hinweis === 'ZWEI', zwei)

/* 2. Arten: nur neu, angekuendigt, disc, kino tragen die Felder; nachgetragen (Handtext), folgen und takt bleiben unberührt und ohne Eintrag. */
for (const art of ['neu', 'angekuendigt', 'disc', 'kino'] as const) {
  const hh = historie()
  haltFelderFest(hh, [lebend({ art, ...voll }, `${art}:x`)], [])
  pruefe(`Art ${art}: wird festgehalten`, `${art}:x` in (hh.felder ?? {}), hh.felder)
}
for (const art of ['nachgetragen', 'folgen', 'takt', 'verspaetet', 'offiziell'] as const) {
  const hh = historie({ [`${art}:x`]: { hinweis: 'ALT' } })
  const m = lebend({ art, hinweis: 'NEU' }, `${art}:x`)
  const r = haltFelderFest(hh, [m], [])[0]!
  const h0 = historie()
  haltFelderFest(h0, [m], [])
  pruefe(`Art ${art}: bleibt unberührt, es entsteht kein Eintrag`, r === m && r.hinweis === 'NEU' && Object.keys(h0.felder ?? {}).length === 0, { r, f: h0.felder })
}

/* 3. Abgelöste Meldungen (Terminverlauf): tragen den Eintrag unter art:release:datum, legen aber keinen an. */
const verlauf = { ersetzt: { datum: '2099-02-01', release: 'r-1' }, schluessel: 'verlauf:r-1:angekuendigt:2099-01-01:0' } as Partial<NewsMeldung> & { schluessel: string }
const ersetzt = haltFelderFest(historie({ [K]: { ...voll } }), [lebend({ ...verlauf, geschaetzt: false })], [])[0]!
pruefe('Abgelöst: festgehaltene Felder kommen zurück (auch geschaetzt true gegen false)', FELDER.every((f) => ersetzt[f] === voll[f]) && ersetzt.ersetzt !== undefined, ersetzt)
const zurueck = haltFelderFest(historie({ [K]: { ...voll } }), [lebend({ zurueckgezogen: { grund: 'g' }, schluessel: 'verlauf:x' } as Partial<NewsMeldung>)], [])[0]!
pruefe('Zurückgezogen: ebenso', FELDER.every((f) => zurueck[f] === voll[f]) && zurueck.zurueckgezogen !== undefined, zurueck)
const hl = historie()
const ohneEintrag = haltFelderFest(hl, [lebend(verlauf)], [])[0]!
pruefe('Abgelöst ohne Eintrag: unverändert, kein neuer Eintrag', ohneEintrag.hinweis === undefined && Object.keys(hl.felder ?? {}).length === 0, hl.felder)
pruefe('festSchluessel: abgelöst aus Art, Release, Termin; lebend der Schlüssel', festSchluessel(lebend(verlauf)) === K && festSchluessel(lebend({}, 'neu:5')) === 'neu:5')

/* 4. Übernahme aus dem ausgelieferten Stand: eine Meldung in news.json hält fest, was dort stand, nicht den neu abgeleiteten Wert. */
const eintragVor = (m: NewsMeldung, extra: Partial<NewsEintrag> = {}): NewsEintrag => ({ am: '2026-10-01', titelId: 1, titel: 'T', slug: 't', meldungen: [m], ...extra })
const ausgeliefert = { art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', ...voll } as NewsMeldung
const hm = historie()
const uebernommen = haltFelderFest(hm, [lebend(anders)], [eintragVor(ausgeliefert)])[0]!
pruefe('Übernahme: der ausgelieferte Stand gilt, nicht der heutige', FELDER.every((f) => uebernommen[f] === voll[f]) && JSON.stringify(hm.felder?.[K]) === JSON.stringify(voll), { uebernommen, f: hm.felder })
const teilVor = eintragVor(ausgeliefert, { titelId: 99 })
teilVor.meldungen[0] = { ...ausgeliefert, teilId: 1 }
pruefe('Übernahme: Teil-Meldung wird über teilId zugeordnet, nicht über den Kopf', haltFelderFest(historie(), [lebend(anders)], [teilVor])[0]!.hinweis === 'H1')
pruefe('Übernahme: anderer Tag, andere Art, anderer Termin, anderer Titel treffen nicht', [
  eintragVor(ausgeliefert, { am: '2026-10-02' }),
  eintragVor({ ...ausgeliefert, art: 'disc' }),
  eintragVor({ ...ausgeliefert, datum: '2099-01-02' }),
  eintragVor(ausgeliefert, { titelId: 2 }),
  eintragVor({ ...ausgeliefert, platform: 'adn' }),
  eintragVor({ ...ausgeliefert, release: 'r-9' }),
].every((e) => haltFelderFest(historie(), [lebend(anders)], [e])[0]!.hinweis === 'H2'))
const doppelt = haltFelderFest(historie(), [lebend(anders)], [eintragVor({ ...ausgeliefert, hinweis: 'ERSTE' }), eintragVor({ ...ausgeliefert, hinweis: 'ZWEITE' })])[0]!
pruefe('Übernahme: bei doppelter Kennung in news.json gilt die erste Zeile', doppelt.hinweis === 'ERSTE', doppelt)
const hf = historie()
haltFelderFest(hf, [lebend({ geschaetzt: false, jahre: 0, hinweis: '' })], [])
pruefe('Festhalten: falsche Werte (false, 0, leer) zählen als Wert, nicht als fehlend', JSON.stringify(hf.felder?.[K]) === JSON.stringify({ hinweis: '', geschaetzt: false, jahre: 0 }), hf.felder)
pruefe('Übernahme: ein vorhandener Eintrag geht vor dem ausgelieferten Stand', haltFelderFest(historie({ [K]: { hinweis: 'EINTRAG' } }), [lebend(anders)], [eintragVor(ausgeliefert)])[0]!.hinweis === 'EINTRAG')

/* 5. Altern: 400-Tage-Grenze genau an, einen Tag drüber, deutlich drüber; Felder fallen mit ihrem Schlüssel heraus, Verwaiste ebenso. */
const alt = historie({ 'a:1': {}, 'b:1': {}, 'c:1': {}, 'd:1': {} })
alt.zuerst = { 'a:1': '2025-12-31', 'b:1': '2026-01-01', 'c:1': '2026-10-01' }
vergissAlte(alt, '2026-01-01')
pruefe('Alt: einen Tag vor der Grenze fällt weg, genau an der Grenze und jünger bleiben, Verwaiste fallen weg', JSON.stringify(Object.keys(alt.felder!)) === JSON.stringify(['b:1', 'c:1']) && JSON.stringify(Object.keys(alt.zuerst)) === JSON.stringify(['b:1', 'c:1']), alt)
const ohneFelder = historie()
ohneFelder.zuerst = { x: '2026-10-01' }
vergissAlte(ohneFelder, '2026-01-01')
pruefe('Alt: Gedächtnis ohne Felder bleibt ohne Felder', ohneFelder.felder === undefined)

/* 6. Echte Bauten mit demselben Gedächtnis (baueNews): die Felder bleiben, auch im Terminverlauf; neue Meldungen nehmen den heutigen Stand. */
interface Stand {
  estimated?: boolean
  kanal?: string
  note?: string
  jpYear?: number
  von?: string
  sender?: string
  datum?: string
}
const titel = (id: number, s: Stand): Title =>
  ({ id, franchiseId: id, slug: `t-${id}`, titleEn: `T${id}`, keywords: [], genres: [], streams: [], jpYear: s.jpYear, ...(s.von ? { deErstausgabe: { synchro: true, von: s.von } } : {}) }) as unknown as Title
const release = (id: number, s: Stand, tv = false): Release =>
  ({
    titleId: id,
    slug: `r-${id}`,
    platform: tv ? 'tv' : 'netflix',
    ...(tv ? { sender: s.sender } : {}),
    ...(s.kanal ? { kanal: s.kanal } : {}),
    ...(s.note ? { automatisch: true, note: s.note } : {}),
    releaseType: 'series',
    schedule: { firstEpisodeDate: s.datum ?? '2099-01-01', ...(s.estimated ? { estimated: true } : {}) },
    sources: [`https://example.org/${id}`],
  }) as unknown as Release
type Welt = { eins?: Stand; zwei?: Stand; drei?: Stand; tv?: Stand; neu?: Stand }
const bau = (h: NewsHistorie, w: Welt, vorherige: NewsEintrag[] = []): NewsMeldung[] => {
  const ids: [number, Stand | undefined, boolean][] = [[1, w.eins, false], [2, w.zwei, false], [3, w.drei, false], [4, w.tv, true], [5, w.neu, false]]
  const da = ids.filter(([, s]) => s)
  return baueNews(da.map(([i, s]) => titel(i, s!)), da.map(([i, s, tv]) => release(i, s!, tv)), [], [], h, vorherige).flatMap((e) => e.meldungen.filter((m) => m.art === 'angekuendigt'))
}
const von = (ms: NewsMeldung[], r: string, datum?: string): NewsMeldung | undefined => ms.find((m) => m.release === r && (!datum || m.datum === datum))
const alles: Stand = { estimated: true, kanal: 'Aniverse', note: 'N1', jpYear: 2010, von: '2090-01-01' }
const spaeter: Stand = { kanal: 'Anderer', note: 'N2', jpYear: 2012, von: '2095-01-01' }
const hb = historie()
const b1 = bau(hb, { eins: alles, zwei: {}, drei: alles, tv: { sender: 'Sender A' } })
const e1 = von(b1, 'r-1')!
pruefe('Bau 1: alle Felder vom heutigen Stand', e1.geschaetzt === true && e1.kanal === 'Aniverse' && e1.hinweis === 'N1' && e1.jahre === 2099 - 2010 && e1.discSeitText === '9 Jahren' && von(b1, 'r-4')!.anbieter === 'Sender A', b1)
const b2 = bau(hb, { eins: spaeter, zwei: alles, drei: { ...alles, estimated: false }, tv: { sender: 'Sender B' }, neu: spaeter })
const e2 = von(b2, 'r-1')!
pruefe('Bau 2: Titel 1 behält alle Felder (kein Umsprung)', FELDER.every((f) => e2[f] === e1[f]), e2)
pruefe('Bau 2: Titel 2 (anfangs ohne Felder) bekommt keine nachträglich', FELDER.every((f) => !(f in von(b2, 'r-2')!)), von(b2, 'r-2'))
pruefe('Bau 2: geschaetzt true bleibt trotz belegtem Termin; Anbieter A bleibt', von(b2, 'r-3')!.geschaetzt === true && von(b2, 'r-4')!.anbieter === 'Sender A', b2)
pruefe('Bau 2: eine neue Meldung nimmt den Stand von heute', von(b2, 'r-5')!.kanal === 'Anderer' && von(b2, 'r-5')!.hinweis === 'N2' && von(b2, 'r-5')!.jahre === 2099 - 2012, von(b2, 'r-5'))
const b3 = bau(hb, { eins: alles, zwei: alles, drei: alles, tv: { sender: 'Sender A' }, neu: alles })
pruefe('Bau 3 (zurück): Titel 1 und 5 weiter unverändert', FELDER.every((f) => von(b3, 'r-1')![f] === e1[f]) && von(b3, 'r-5')!.kanal === 'Anderer', b3)

const hq = historie()
const ohneQuelle = baueNews([titel(6, alles)], [{ ...release(6, alles), sources: [] } as Release], [], [], hq, [])
pruefe('Eine Meldung ohne Quelle fällt weg und hinterlässt keinen Eintrag im Gedächtnis', ohneQuelle.length === 0 && Object.keys(hq.felder ?? {}).length === 0, { ohneQuelle, f: hq.felder })

/* 6b. Terminverlauf: abgelöst (neuer Termin) und zurückgezogen (Release weg) behalten die Felder des Tages. */
const hv = historie()
bau(hv, { eins: alles })
const abgeloest = bau(hv, { eins: { ...spaeter, datum: '2099-02-01' } })
const altStand = von(abgeloest, 'r-1', '2099-01-01')!
pruefe('Terminverlauf: abgelöste Meldung trägt die Felder vom Tag der Meldung', altStand.ersetzt !== undefined && FELDER.every((f) => altStand[f] === e1[f]), altStand)
pruefe('Terminverlauf: die neue Meldung nimmt ihren Stand', von(abgeloest, 'r-1', '2099-02-01')!.kanal === 'Anderer' && von(abgeloest, 'r-1', '2099-02-01')!.geschaetzt === undefined)
const weg = bau(hv, {})
const wegAlt = von(weg, 'r-1', '2099-01-01')
const wegNeu = von(weg, 'r-1', '2099-02-01')
pruefe('Terminverlauf: zurückgezogene Meldungen behalten die Felder', weg.length === 2 && weg.some((m) => m.zurueckgezogen !== undefined) && FELDER.every((f) => wegAlt![f] === e1[f]) && wegNeu!.kanal === 'Anderer' && wegNeu!.hinweis === 'N2', weg)

/* 6c. Übernahme im echten Bau: das Gedächtnis ist neu (kein `felder`), `news.json` trägt den Stand von Bau 1. */
const hn = historie()
const eintraegeEins = baueNews([titel(1, alles)], [release(1, alles)], [], [], hn, [])
delete hn.felder
const nachMigration = baueNews([titel(1, spaeter)], [release(1, spaeter)], [], [], hn, eintraegeEins).flatMap((e) => e.meldungen)[0]!
pruefe('Erster Bau mit neuem Gedächtnis: der ausgelieferte Stand bleibt, nicht der heutige', FELDER.every((f) => nachMigration[f] === e1[f]), nachMigration)

/* 7. Wächter: jedes Feld und weiterer einzeln, neue Meldung, Handtext, abgelöst, leer, Teil-Zuordnung, unveränderter Bestand. */
const mit = (m: Partial<NewsMeldung>, extra: Partial<NewsEintrag> = {}): NewsEintrag[] => [eintragVor({ art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', ...m } as NewsMeldung, extra)]
const vorstand = mit({ ...voll, weiterer: true })
pruefe('Wächter: unveränderter Bestand ist grün', felderAenderungen(vorstand, mit({ ...voll, weiterer: true })).length === 0)
for (const f of [...FELDER, 'weiterer'] as const) {
  const jetzt = { ...voll, weiterer: true, [f]: f === 'weiterer' ? undefined : anders[f] }
  const z = felderAenderungen(vorstand, mit(jetzt))
  pruefe(`Wächter: Wechsel von ${f} ist ein Fehler, nur dieser`, z.length === 1 && z[0]!.includes(` ${f}: `), z)
  const { [f]: _weg, ...ohne } = { ...voll, weiterer: true } as Record<string, unknown>
  pruefe(`Wächter: Wegfall von ${f} ist ein Fehler`, felderAenderungen(vorstand, mit(ohne as Partial<NewsMeldung>)).length === 1)
  pruefe(`Wächter: neu hinzugekommenes ${f} ist ein Fehler`, felderAenderungen(mit({}), mit({ [f]: f === 'weiterer' ? true : anders[f] })).length === 1)
}
pruefe('Wächter: eine neue Meldung (nicht im Vorstand) zählt nicht', felderAenderungen(mit({ release: 'r-9' }), mit({ ...voll })).length === 0)
pruefe('Wächter: nachgetragen darf sich ändern', felderAenderungen(mit({ art: 'nachgetragen', hinweis: 'a' }), mit({ art: 'nachgetragen', hinweis: 'b' })).length === 0)
pruefe('Wächter: Verlauf-Zeile (ersetzt) zählt wie jede andere', felderAenderungen(vorstand, mit({ ...voll, weiterer: true, kanal: undefined, ersetzt: { datum: '2099-03-01', release: 'r-1' } })).length === 1)
pruefe('Wächter: leer gegen leer', felderAenderungen([], []).length === 0 && felderAenderungen(vorstand, []).length === 0 && felderAenderungen([], vorstand).length === 0)
pruefe(
  'Wächter: Teil-Meldung wird über teilId verglichen, nicht über den Kopf',
  felderAenderungen(mit({ ...voll, teilId: 7 }, { titelId: 1 }), mit({ ...voll, hinweis: 'X', teilId: 7 }, { titelId: 99 })).length === 1 &&
    felderAenderungen(mit({ ...voll, teilId: 7 }, { titelId: 1 }), mit({ ...voll, hinweis: 'X', teilId: 8 }, { titelId: 1 })).length === 0,
)

console.log(`check-news-felder-fest: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
