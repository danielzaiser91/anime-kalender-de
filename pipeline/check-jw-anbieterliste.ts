/**
 * Anbieter-Listen bei JustWatch (`lib/jw-anbieterliste.ts`): Seiten holen mit Riegel, Vorrang nach der Vier-Felder-Tabelle (in der Liste / Anbieter im Befund),
 * Altersgrenze, Fehler lässt die Liste aus, Reihenfolge in der Schlange und die Antwort-Form des Abrufs. Die Verdrahtung im Skript prüft `check-jw-frisch-lauf.ts`.
 * Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { warteschlange } from './lib/jw-schlange.ts'
import {
  ANBIETERLISTEN,
  LISTE_ALTER_TAGE,
  LISTE_SEITEN_MAX,
  holeListe,
  listenVorrang,
  listenVorrangAbrufen,
  seiteVonJustWatch,
  type AnbieterListe,
  type SeiteHolen,
} from './lib/jw-anbieterliste.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const HEUTE = '2026-11-04'
const joyn: AnbieterListe = { anbieter: 'Joyn', paket: 'jyn', genre: 'ani', aktiv: true }
const keine = async (): Promise<void> => {}
const titel = (id: number, tmdbId?: number) => ({ id, tmdbId, streams: [], watchLinks: [] }) as unknown as Title
const tmdbVon = (t: Title) => (t as Title & { tmdbId?: number }).tmdbId
const befund = (geprueftAm: string, anbieter: string[]) => ({ geprueftAm, angebote: anbieter.map((a) => ({ anbieter: a })) })

/* Konfiguration: nur Joyn ist aktiv. */
pruefe('genau eine aktive Liste: Joyn (jyn, ani)', ANBIETERLISTEN.filter((l) => l.aktiv).map((l) => `${l.anbieter}/${l.paket}/${l.genre}`).join() === 'Joyn/jyn/ani')

/* Vier-Felder-Tabelle: in der Liste × Anbieter im Befund (Befund immer 10 Tage alt). */
const titles = [titel(1, 101), titel(2, 102), titel(3, 103), titel(4, 104)]
const bestand = {
  '1': befund('2026-10-25', ['Netflix']), // in Liste, ohne Joyn -> Vorrang
  '2': befund('2026-10-25', ['Joyn']), // in Liste, mit Joyn -> nichts zu erwarten
  '3': befund('2026-10-25', ['Netflix']), // nicht in Liste, ohne Joyn
  '4': befund('2026-10-25', ['Joyn Plus']), // in Liste, Joyn Plus zählt als Joyn
}
const ids = (s: Set<number>) => [...s].sort().join()
const liste = new Set(['101', '102', '104'])
pruefe('in Liste ohne Joyn: Vorrang; mit Joyn / Joyn Plus oder nicht in Liste: kein Vorrang', ids(listenVorrang(joyn, liste, titles, bestand, tmdbVon, HEUTE)) === '1', ids(listenVorrang(joyn, liste, titles, bestand, tmdbVon, HEUTE)))
pruefe('Kennung als Zahl und Zeichenkette gleich: Liste mit "101" trifft tmdbId 101', listenVorrang(joyn, new Set(['101']), titles, bestand, tmdbVon, HEUTE).has(1))

/* Alter: genau LISTE_ALTER_TAGE Tage ist fällig, einen Tag weniger nicht. */
const grenzTitel = [titel(5, 105)]
const heuteMinus = (tage: number) => new Date(Date.parse(HEUTE) - tage * 86_400_000).toISOString().slice(0, 10)
const mitAlter = (tage: number) => listenVorrang(joyn, new Set(['105']), grenzTitel, { '5': befund(heuteMinus(tage), ['Netflix']) }, tmdbVon, HEUTE).size
pruefe(`Befund genau ${LISTE_ALTER_TAGE} Tage alt: fällig`, mitAlter(LISTE_ALTER_TAGE) === 1)
pruefe(`Befund ${LISTE_ALTER_TAGE - 1} Tage alt: noch nicht`, mitAlter(LISTE_ALTER_TAGE - 1) === 0)
pruefe('Befund über der Grenze (30 Tage): fällig', mitAlter(30) === 1)
pruefe('Ohne Befund: kein Vorrang (die übliche Schlange fragt ihn ohnehin)', listenVorrang(joyn, new Set(['105']), grenzTitel, {}, tmdbVon, HEUTE).size === 0)
pruefe('Titel ohne TMDB-Kennung: kein Vorrang', listenVorrang(joyn, new Set(['105']), [titel(5)], { '5': befund('2026-09-01', []) }, tmdbVon, HEUTE).size === 0)
pruefe('Befund ohne `angebote`: gilt als ohne Anbieter', listenVorrang(joyn, new Set(['105']), grenzTitel, { '5': { geprueftAm: '2026-09-01' } }, tmdbVon, HEUTE).size === 1)
const andere: AnbieterListe = { anbieter: 'Netflix', paket: 'nfx', genre: 'ani', aktiv: true }
pruefe('Anbieter-Name aus der Konfiguration: Liste "Netflix" lässt Titel mit Netflix-Angebot aus, Joyn-Liste nimmt ihn', listenVorrang(andere, new Set(['101']), titles, bestand, tmdbVon, HEUTE).size === 0 && listenVorrang(joyn, new Set(['101']), titles, bestand, tmdbVon, HEUTE).size === 1)

/* Seiten: Zählung, Fortsetzung, Riegel. */
const seiten = (n: number): SeiteHolen => async (_l, nach) => {
  const i = nach ? Number(nach) : 0
  return { tmdbIds: [`${i * 10 + 1}`, `${i * 10 + 2}`], weiter: i + 1 < n ? String(i + 1) : undefined }
}
const zwei = await holeListe(joyn, seiten(2), keine)
pruefe('zwei Seiten: 2 Abrufe, 4 Kennungen (Fortsetzungsmarke wird weitergereicht)', zwei.abrufe === 2 && [...zwei.tmdbIds].sort().join() === '1,11,12,2', [...zwei.tmdbIds])
const endlos = await holeListe(joyn, seiten(1000), keine)
pruefe(`Riegel: nie mehr als ${LISTE_SEITEN_MAX} Seiten`, endlos.abrufe === LISTE_SEITEN_MAX, endlos.abrufe)
let pausen = 0
await holeListe(joyn, seiten(3), async () => { pausen++ })
pruefe('Pause zwischen den Seiten, nicht davor: 3 Seiten, 2 Pausen', pausen === 2, pausen)

/* Ganze Abfolge: Fehler lässt aus, inaktive Liste wird nicht gefragt, Zählung. */
const gefragt: string[] = []
const gemischt: SeiteHolen = async (l) => {
  gefragt.push(l.anbieter)
  if (l.anbieter === 'Kaputt') throw new Error('429 Sperre')
  return { tmdbIds: ['101'] }
}
const r = await listenVorrangAbrufen(
  [joyn, { ...andere, anbieter: 'Kaputt' }, { ...andere, anbieter: 'Aus', aktiv: false }, { ...joyn, anbieter: 'Netflix' }],
  gemischt, keine, titles, bestand, tmdbVon, HEUTE,
)
pruefe('Fehler einer Liste lässt sie aus, die anderen laufen weiter; inaktive wird nicht gefragt', gefragt.join() === 'Joyn,Kaputt,Netflix', gefragt)
pruefe('Vorrang aus Joyn (Titel 1 ohne Joyn); Netflix-Liste: Titel 1 hat Netflix -> nichts', ids(r.vorrang) === '1', ids(r.vorrang))
pruefe('Abrufe zählen auch den fehlgeschlagenen: 3', r.abrufe === 3, r.abrufe)
const nurFehler = await listenVorrangAbrufen([joyn], async () => { throw new Error('Netz') }, keine, titles, bestand, tmdbVon, HEUTE)
pruefe('Netzfehler: leerer Vorrang, kein Abbruch', nurFehler.vorrang.size === 0 && nurFehler.abrufe === 1)

/* Abruf: Antwortform, Marke, Fehler. */
const aufrufe: { body: { variables: { after: string | null; f: unknown } } }[] = []
const kante = (content: unknown) => ({ node: { content } })
const antwort = (weiter: boolean) => {
  const pageInfo = { hasNextPage: weiter, endCursor: weiter ? 'M1' : null }
  const edges = [kante({ externalIds: { tmdbId: '101' } }), kante({ externalIds: { tmdbId: 202 } }), kante({ externalIds: { tmdbId: null } }), kante(null)]
  return { data: { popularTitles: { pageInfo, edges } } }
}
const holer = seiteVonJustWatch('https://example.org/graphql', 'ua', (async (_u: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body))
  aufrufe.push({ body })
  return antwort(body.variables.after === null) as never
}) as never)
const s1 = await holer(joyn)
const s2 = await holer(joyn, s1.weiter)
pruefe('Seite 1: Kennungen als Zeichenketten, leere ausgelassen, Marke M1', s1.tmdbIds.join() === '101,202' && s1.weiter === 'M1', s1)
pruefe('Seite 2 trägt die Marke als `after`, letzte Seite ohne Marke', aufrufe[1].body.variables.after === 'M1' && s2.weiter === undefined, aufrufe[1])
pruefe('Filter trägt Paket und Gattung der Liste', JSON.stringify(aufrufe[0].body.variables.f) === '{"packages":["jyn"],"genres":["ani"]}', aufrufe[0].body.variables.f)
let wirft = false
await seiteVonJustWatch('x', 'ua', (async () => ({ errors: [{ message: 'kaputt' }] })) as never)(joyn).catch(() => { wirft = true })
pruefe('GraphQL-Fehler wird zur Ausnahme', wirft)

/* Schlange: der Vorrang holt einen Titel innerhalb der Frist herein und stellt ihn vor ältere. */
const q = [titel(1, 101), titel(2, 102), titel(3, 103)]
const qb = { '1': befund('2026-10-25', ['Netflix']), '2': befund('2026-09-01', ['Netflix']), '3': befund('2026-10-25', ['Netflix']) }
const sql = (v?: Set<number>) => warteschlange({ titles: q, bestand: qb as never, tmdb: {}, grenze: '2026-10-07', heute: HEUTE, listenVorrang: v, cartoonIds: new Set() }).map((t) => t.id).join()
pruefe('ohne Vorrang: nur der alte Titel 2 ist fällig', sql() === '2', sql())
pruefe('mit Vorrang für 1: Titel 1 steht vor dem älteren 2, Titel 3 bleibt draußen', sql(new Set([1])) === '1,2', sql(new Set([1])))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log(`check-jw-anbieterliste: ok (${faelle} Prüfungen)`)
