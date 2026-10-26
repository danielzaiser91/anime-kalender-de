/**
 * Zusicherungen zur Duell-Animation von „Entdecken“: Sperre der Eingabe (Doppelklick wählt einmal), Zeitplan mit Attrappe-Uhr,
 * Wechsel der Paarung erst nach den dekodierten Bildern, Vorladen, und dass im Wartezustand kein altes Cover steht.
 * Läuft über die echten Funktionen (`empfehlung-duell-steuerung.ts`, `empfehlung-duell-bilder.ts`, `DuellKarten.tsx`). Aufruf: `npm run check:logic`.
 */
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Antwort } from '../shared/empfehlung-kern.ts'
import { antworteSitzung, naechstesPaar, neueSitzung, neuerZustand } from '../shared/empfehlung-kern.ts'
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import { DuellKarten } from '../web/src/components/empfehlung/DuellKarten.tsx'
import { browserLader, kartenQuelle, ladeUndDekodiere, paarNachAntwort, type Lader } from '../web/src/lib/empfehlung-duell-bilder.ts'
import { baueDuellAnbindung } from '../web/src/lib/empfehlung-duell-anbindung.ts'
import { baueDuellSteuerung, type DuellSchritt } from '../web/src/lib/empfehlung-duell-steuerung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const mikro = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** Attrappe-Uhr: Zeitgeber laufen nur, wenn `schiebe` die Zeit voranstellt. */
function uhr() {
  let jetzt = 0
  let nr = 0
  const timer = new Map<number, { f: () => void; ab: number }>()
  return {
    plane: (f: () => void, ms: number): number => {
      timer.set(++nr, { f, ab: jetzt + ms })
      return nr
    },
    loesche: (h: number): void => void timer.delete(h),
    async schiebe(ms: number): Promise<void> {
      const ziel = jetzt + ms
      for (;;) {
        const faellig = [...timer.entries()].filter(([, t]) => t.ab <= ziel).sort((a, b) => a[1].ab - b[1].ab)[0]
        if (!faellig) break
        jetzt = faellig[1].ab
        timer.delete(faellig[0])
        faellig[1].f()
        await mikro()
      }
      jetzt = ziel
    },
    offen: (): number => timer.size,
  }
}

function aufbau(reduziert = false) {
  const u = uhr()
  const schritte: DuellSchritt[] = []
  const gewechselt: Antwort[] = []
  const st = baueDuellSteuerung({
    plane: u.plane,
    loesche: u.loesche,
    meldeSchritt: (s) => schritte.push(s),
    wechsle: (a) => gewechselt.push(a),
    reduziert: () => reduziert,
  })
  return { u, st, schritte, gewechselt }
}
const sofort = (): Promise<void> => Promise.resolve()
function aufschub() {
  let los!: () => void
  let fehl!: () => void
  const p = new Promise<void>((ok, nein) => {
    los = ok
    fehl = nein
  })
  return { p, los, fehl }
}

console.log('Sperre und Zeitplan')
{
  const { u, st, schritte, gewechselt } = aufbau()
  pruefe('erste Wahl wird angenommen', st.waehle('A', sofort) === true)
  pruefe('Doppelklick: zweite Wahl im Stoß wirkungslos', st.waehle('B', sofort) === false && st.schritt() === 'stoss')
  await u.schiebe(150)
  pruefe('nach 150 ms: Abgang, zweite Wahl wirkungslos', st.schritt() === 'abgang' && st.waehle('B', sofort) === false)
  await u.schiebe(349)
  pruefe('349 ms vor dem Ende des Abgangs: noch kein Wechsel', gewechselt.length === 0 && st.schritt() === 'abgang', gewechselt)
  await u.schiebe(1)
  pruefe('nach 500 ms: Wechsel, Bilder waren da', gleich(gewechselt, ['A']) && st.schritt() === 'herein', { gewechselt, s: st.schritt() })
  pruefe('im Hereingleiten ist die Eingabe noch gesperrt', st.waehle('N', sofort) === false)
  await u.schiebe(349)
  pruefe('349 ms Hereingleiten: noch gesperrt', st.schritt() === 'herein')
  await u.schiebe(1)
  pruefe('danach wieder bereit', st.schritt() === 'bereit')
  pruefe('nächste Wahl möglich (zweiter Durchlauf)', st.waehle('B', sofort) === true)
  await u.schiebe(500)
  pruefe('zweiter Durchlauf wechselt genau einmal mehr', gleich(gewechselt, ['A', 'B']), gewechselt)
  pruefe('Schrittfolge des ersten Duells', gleich(schritte.slice(0, 4), ['stoss', 'abgang', 'herein', 'bereit']), schritte)
}

console.log('Nächste Bilder noch nicht dekodiert')
{
  const { u, st, schritte, gewechselt } = aufbau()
  const bilder = aufschub()
  st.waehle('A', () => bilder.p)
  await u.schiebe(2000)
  pruefe('nach 2 s: Animation fertig, aber noch kein Wechsel, Schritt „warten“', gewechselt.length === 0 && st.schritt() === 'warten', { gewechselt, s: st.schritt() })
  pruefe('im Warten ist die Eingabe gesperrt', st.waehle('B', sofort) === false)
  bilder.los()
  await mikro()
  pruefe('sobald die Bilder da sind: sofort Wechsel', gleich(gewechselt, ['A']) && st.schritt() === 'herein', { gewechselt, s: st.schritt() })
  pruefe('Schritte: stoss, abgang, warten, herein', gleich(schritte, ['stoss', 'abgang', 'warten', 'herein']), schritte)
}
{
  const { u, st, gewechselt } = aufbau()
  st.waehle('B', () => new Promise<void>(() => undefined))
  await u.schiebe(4999)
  pruefe('Bilder kommen nie: bis 4999 ms kein Wechsel', gewechselt.length === 0)
  await u.schiebe(1)
  pruefe('Bilder kommen nie: nach 5000 ms Wechsel (Karten laden sichtbar nach)', gleich(gewechselt, ['B']), gewechselt)
}
{
  const { u, st, gewechselt } = aufbau()
  const bilder = aufschub()
  st.waehle('A', () => bilder.p)
  bilder.fehl()
  await u.schiebe(500)
  pruefe('Ladefehler hält das Duell nicht auf', gleich(gewechselt, ['A']), gewechselt)
}
{
  const { u, st, gewechselt } = aufbau()
  const bilder = aufschub()
  st.waehle('A', () => bilder.p)
  bilder.los()
  await u.schiebe(499)
  pruefe('Bilder früh fertig: trotzdem kein Wechsel vor Ende der Animation (499 ms)', gewechselt.length === 0, gewechselt)
}

console.log('Andere Vorschläge, reduzierte Bewegung, Abbruch')
{
  const { u, st, schritte, gewechselt } = aufbau()
  st.waehle('N', sofort)
  await u.schiebe(349)
  pruefe('„Andere Vorschläge“: Fall, nach 349 ms noch kein Wechsel', st.schritt() === 'fall' && gewechselt.length === 0)
  await u.schiebe(1)
  pruefe('„Andere Vorschläge“: nach 350 ms Wechsel', gleich(gewechselt, ['N']) && gleich(schritte, ['fall', 'herein']), schritte)
}
{
  const { u, st, schritte, gewechselt } = aufbau(true)
  st.waehle('A', sofort)
  pruefe('reduziert: Überblendung statt Stoß', st.schritt() === 'blende')
  pruefe('reduziert: gleiche Sperre', st.waehle('B', sofort) === false)
  await u.schiebe(149)
  pruefe('reduziert: 149 ms noch kein Wechsel', gewechselt.length === 0)
  await u.schiebe(1)
  pruefe('reduziert: nach 150 ms Wechsel', gleich(gewechselt, ['A']), gewechselt)
  await u.schiebe(150)
  pruefe('reduziert: Hereinblenden 150 ms, dann bereit', st.schritt() === 'bereit' && gleich(schritte, ['blende', 'herein', 'bereit']), schritte)
}
{
  const { u, st, gewechselt } = aufbau()
  const bilder = aufschub()
  st.waehle('A', () => bilder.p)
  await u.schiebe(100)
  st.abbrechen()
  pruefe('Abbruch gibt die Eingabe frei und räumt alle Zeitgeber', st.schritt() === 'bereit' && u.offen() === 0, u.offen())
  bilder.los()
  await u.schiebe(6000)
  pruefe('Abbruch: späte Bilder lösen keinen Wechsel mehr aus', gewechselt.length === 0, gewechselt)
  pruefe('nach Abbruch ist eine neue Wahl möglich', st.waehle('B', sofort) === true)
  await u.schiebe(500)
  pruefe('nach Abbruch: die neue Wahl wechselt genau einmal', gleich(gewechselt, ['B']), gewechselt)
}

{
  const { u, st, gewechselt } = aufbau()
  const bilder = aufschub()
  st.waehle('A', () => bilder.p)
  await u.schiebe(600)
  st.abbrechen()
  bilder.los()
  await mikro()
  pruefe('Abbruch im Warten: spät eintreffende Bilder wechseln nichts mehr', gewechselt.length === 0 && st.schritt() === 'bereit', { gewechselt, s: st.schritt() })
}
{
  const { u, st, gewechselt } = aufbau()
  st.waehle('A', sofort)
  await u.schiebe(500)
  await u.schiebe(6000)
  pruefe('der Höchstwart-Zeitgeber wechselt nach dem Wechsel nicht ein zweites Mal', gleich(gewechselt, ['A']), gewechselt)
}

console.log('Bilder vorladen')
const quelle = (n: number) => ({ src: `https://bild.test/${n}.jpg` })
{
  const log: string[] = []
  const offen: Array<() => void> = []
  const neu = (): Lader => {
    const l = { src: '', srcset: '', sizes: '', decode: () => new Promise<void>((ok) => offen.push(() => { log.push(`fertig ${l.src}`); ok() })) }
    return l
  }
  let fertig = false
  const lauf = ladeUndDekodiere([quelle(1), quelle(2)], neu).then(() => (fertig = true))
  await mikro()
  pruefe('beide Bilder werden angefordert, noch nicht fertig', offen.length === 2 && !fertig)
  offen[0]()
  await mikro()
  pruefe('ein Bild fertig reicht nicht', !fertig)
  offen[1]()
  await lauf
  pruefe('erst wenn beide dekodiert sind, ist das Vorladen fertig', fertig && gleich(log, ['fertig https://bild.test/1.jpg', 'fertig https://bild.test/2.jpg']), log)
}
{
  const gesetzt: Array<{ src: string; srcset: string; sizes: string }> = []
  const neu = (): Lader => {
    const l = { src: '', srcset: '', sizes: '', decode: () => (gesetzt.push({ src: l.src, srcset: l.srcset, sizes: l.sizes }), Promise.reject(new Error('kaputt'))) }
    return l
  }
  await ladeUndDekodiere([{ src: 'a.jpg', srcSet: 'a.jpg 300w', sizes: '300px' }, {}], neu)
  pruefe('Vorladen setzt src, srcset und sizes wie die Karte; kaputtes Bild und Karte ohne Bild stören nicht', gleich(gesetzt, [{ src: 'a.jpg', srcset: 'a.jpg 300w', sizes: '300px' }]), gesetzt)
  pruefe('browserLader liefert ein Bildobjekt mit decode', typeof browserLader === 'function')
}

console.log('Bildquelle der Karte')
{
  const cover = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg'
  const breit = kartenQuelle('https://image.tmdb.org/t/p/w780/b.jpg', cover, true)
  pruefe('breit: Cover mit srcset und sizes', !!breit.src && !!breit.srcSet && breit.sizes === '300px', breit)
  pruefe('schmal: das Banner', gleich(kartenQuelle('https://image.tmdb.org/t/p/w780/b.jpg', cover, false), { src: 'https://image.tmdb.org/t/p/w780/b.jpg' }))
  pruefe('schmal ohne Banner: das Cover', kartenQuelle(undefined, cover, false).src === breit.src)
  pruefe('breit ohne Cover: das Banner', gleich(kartenQuelle('https://image.tmdb.org/t/p/w780/b.jpg', undefined, true), { src: 'https://image.tmdb.org/t/p/w780/b.jpg' }))
  pruefe('weder noch: leer', gleich(kartenQuelle(undefined, undefined, true), { src: undefined }))
}

console.log('Welches Paar nach einer Antwort kommt')
const einstiege: Kandidat[] = []
for (let i = 0; i < 60; i++) {
  einstiege.push({ id: 900500 + i, n: `Titel ${i}`, f: 'TV', y: 2000 + ((i * 7) % 25), e: 1 + ((i * 5) % 40), g: [i % 8, (i * 3 + 1) % 8], k: [(i * 5) % 8, (i + 2) % 8], fsk: [0, 6, 12, 16][i % 4], v: 70, p: [['netflix']], duell: true })
}
const datei: EmpfehlungsDatei = {
  pool: 70,
  genres: ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport'],
  keywords: ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik'],
  einstiege,
  reihe: {},
}
const kontext = baueKontext(datei)
{
  const s = neueSitzung(neuerZustand(kontext, 5, []))
  const a = paarNachAntwort(kontext, s, 'A', 6)
  const b = paarNachAntwort(kontext, s, 'B', 6)
  pruefe('nach A kommt ein anderes Paar als nach B', a !== null && b !== null && !gleich(a, b), { a, b })
  pruefe('das Paar nach A ist ein Paar zweier verschiedener Titel', a !== null && a[0] !== a[1])
  pruefe('Ziel schon nach dieser Antwort erreicht: kein Paar (Reise geht zu den Vorschlägen)', paarNachAntwort(kontext, s, 'A', 1) === null)
}

console.log('Anbindung: was ein Klick im Duell auslöst (die Logik, die der React-Hook nur aufruft)')
{
  const s = neueSitzung(neuerZustand(kontext, 5, []))
  const jetzt = naechstesPaar(kontext, s.zustand)!
  const nachA = naechstesPaar(kontext, antworteSitzung(kontext, s, 'A').zustand)!
  const url = (i: number) => `https://bild.test/${einstiege[i].id}.jpg`
  const baue = (ziel: number, reduziert = false) => {
    const u = uhr()
    const log: string[] = []
    const angefordert: string[] = []
    const offen: Array<() => void> = []
    const schritte: DuellSchritt[] = []
    const a = baueDuellAnbindung({
      plane: u.plane,
      loesche: u.loesche,
      meldeSchritt: (st) => schritte.push(st),
      setzeGewaehlt: (x) => log.push(`gewaehlt ${x}`),
      aktuell: () => ({
        kontext,
        sitzung: s,
        ziel,
        quelle: (id: number) => ({ src: `https://bild.test/${id}.jpg` }),
        antworte: (x) => log.push(`antworte ${x}`),
        zurueck: () => log.push('zurueck'),
      }),
      lader: () => {
        const l = { src: '', srcset: '', sizes: '', decode: () => new Promise<void>((ok) => offen.push(() => (angefordert.push(l.src), ok()))) }
        return l
      },
      reduziert: () => reduziert,
    })
    return { u, log, angefordert, offen, schritte, ...a }
  }
  const t = baue(6)
  pruefe('Wahl wird angenommen und gemerkt', t.waehle('A') === true && gleich(t.log, ['gewaehlt A']), t.log)
  pruefe('Doppelklick: zweite Wahl wirkungslos, nichts wird gemerkt', t.waehle('B') === false && gleich(t.log, ['gewaehlt A']), t.log)
  await mikro()
  pruefe('geladen wird genau das Paar nach der Antwort, nicht das gezeigte', t.offen.length === 2, t.offen.length)
  await t.u.schiebe(1000)
  pruefe('Bilder noch nicht dekodiert: die Antwort geht nicht durch', gleich(t.log, ['gewaehlt A']), t.log)
  t.offen.forEach((f) => f())
  await mikro()
  pruefe('nach dem Dekodieren: Wahl gelöscht, dann Antwort, genau einmal', gleich(t.log, ['gewaehlt A', 'gewaehlt undefined', 'antworte A']), t.log)
  pruefe('angefordert: die zwei Bilder des nächsten Paars', gleich([...t.angefordert].sort(), [url(nachA[0]), url(nachA[1])].sort()), t.angefordert)
  pruefe('das nächste Paar ist ein anderes als das gezeigte', !gleich([...nachA].sort(), [...jetzt].sort()), { jetzt, nachA })

  const ende = baue(1)
  ende.waehle('A')
  await ende.u.schiebe(500)
  pruefe('Ziel erreicht: nichts vorzuladen, Wechsel nach der Animation', ende.offen.length === 0 && gleich(ende.log, ['gewaehlt A', 'gewaehlt undefined', 'antworte A']), ende.log)

  const weg = baue(6)
  weg.waehle('B')
  await weg.u.schiebe(100)
  weg.zurueckGehen()
  pruefe('Zurück im Duell: alle Zeitgeber geräumt', weg.u.offen() === 0, weg.u.offen())
  pruefe('Zurück im Duell: Wahl gelöscht, eine Antwort zurück, Eingabe frei', gleich(weg.log, ['gewaehlt B', 'gewaehlt undefined', 'zurueck']) && weg.waehle('A') === true, weg.log)
  weg.offen.forEach((f) => f())
  await weg.u.schiebe(6000)
  pruefe('Zurück: die abgebrochene Wahl B geht nie durch, die neue A schon einmal', weg.log.filter((x) => x.startsWith('antworte')).join() === 'antworte A', weg.log)

  const still = baue(6, true)
  still.waehle('N')
  pruefe('reduzierte Bewegung wird an die Steuerung gereicht (Überblendung)', still.schritte[0] === 'blende', still.schritte)
  const n = baue(6)
  n.waehle('N')
  pruefe('„Andere Vorschläge“ meldet den Fall-Schritt', n.schritte[0] === 'fall', n.schritte)
  await mikro()
  n.offen.forEach((f) => f())
  await mikro()
  const nachN = naechstesPaar(kontext, antworteSitzung(kontext, s, 'N').zustand)!
  pruefe('„Andere Vorschläge“ lädt das Paar nach N', gleich([...n.angefordert].sort(), [url(nachN[0]), url(nachN[1])].sort()), n.angefordert)
}

console.log('Anzeige im Wartezustand')
{
  const [a, b] = [einstiege[0], einstiege[1]] as [Kandidat, Kandidat]
  const bildVon = (id: number) => ({ src: `https://bild.test/alt-${id}.jpg` })
  const zeige = (schritt: DuellSchritt, status: 'A' | 'B' | '' = '') =>
    renderToStaticMarkup(
      h(DuellKarten, {
        paar: [a, b],
        quelle: bildVon,
        genres: () => [],
        schritt,
        status: (seite: 'A' | 'B') => (status === '' ? '' : status === seite ? 'gewinnt' : 'verliert'),
        oder: 'oder',
        waehle: () => undefined,
      }),
    )
  const warten = zeige('warten')
  pruefe('warten: kein einziges Cover, auch nicht das alte Paar', !warten.includes('<img') && !warten.includes('bild.test') && !warten.includes(a.n) && !warten.includes(b.n), warten.slice(0, 200))
  pruefe('warten: zwei Platzhalter', (warten.match(/empf-platz/g) ?? []).length === 2, warten.match(/empf-platz/g))
  const bereit = zeige('bereit')
  pruefe('bereit: beide Karten mit ihrem Cover', bereit.includes('alt-' + a.id) && bereit.includes('alt-' + b.id) && !bereit.includes('empf-platz'))
  const stoss = zeige('stoss', 'A')
  pruefe('Sieger grün mit Häkchen, Verlierer rot ohne Häkchen', (stoss.match(/gewinnt/g) ?? []).length >= 1 && (stoss.match(/verliert/g) ?? []).length >= 1 && (stoss.match(/empf-haken/g) ?? []).length === 1)
  pruefe('der Schritt steht im Dokument (für das CSS)', stoss.includes('data-schritt="stoss"') && bereit.includes('data-schritt="bereit"'))
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Duell): Sperre, Zeitplan, Vorladen, Wartezustand und Bildquelle in Ordnung')
