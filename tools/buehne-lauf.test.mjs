/**
 * Verdrahtungstest der Bühnen-Läufe `buehne-messen` und `buehne-bilder` mit Attrappe-Browser: Ein zweimal abgestürzter Einheit
 * erscheint als Befund (Messen: Zeile in der Rot-Liste, Exit 1; Bilder: Zeile, Exit 1), und nach einer Wiederholung stehen die
 * Befunde bzw. Bilder der halb gemessenen ersten Runde nicht doppelt da.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { lauf as messe, schreibeBasis } from './buehne-messen.mjs'
import { deckung } from './buehne-basis-warnung.mjs'
import { readFileSync } from 'node:fs'
import { lauf as bilder } from './buehne-bilder.mjs'
import { kontrastImRahmen } from './buehne-messung.mjs'

const crash = () => new Error('locator.evaluate: Page crashed')

/**
 * Attrappe-Browser: ein Mockup `m1`, ein Fall `f1`, Varianten A und B. Zellen je Ansicht: vorher-375-hell (nur bei teil=beide),
 * nachher-375-hell, nachher-375-dunkel. Nachher-Zellen haben einen Kontrastbefund. `bricht(seitenName, variante, schluessel)`
 * sagt, ob die Messung bzw. das Bild dieser Zelle abstürzt.
 */
function browser({ bricht, fremde = [], appBefund = false, appTipp = false, besucht = [], flackert = false }) {
  const plan = { nr: 0 }
  const neueSeite = (name) => {
    const seite = { name, variante: '', teil: '', geschlossen: false }
    const pruefe = () => { if (seite.geschlossen) throw new Error('Target closed') }
    let aufrufe = 0
    const frameVon = (schluessel) => ({
      waitForLoadState: async () => {},
      waitForFunction: async () => {},
      waitForTimeout: async () => {},
      evaluate: async (fn) => {
        if (fn === kontrastImRahmen) {
          if (bricht(seite.name, seite.variante, schluessel)) throw crash()
          /* `appBefund`: App-Code bringt denselben Befund in Vorher und Nachher — Vorher-gegen-Nachher bleibt still. */
          /* `flackert`: der Befund steht nur in der ersten Messung der Zelle (Animationszustand) — die Nachmessung muss ihn verwerfen. */
          aufrufe++
          if (appBefund) return schluessel.endsWith('hell') && !(flackert && aufrufe > 1) ? [{ schluessel: 'kopf', verhaeltnis: '2.5', soll: '4.5' }] : []
          return schluessel.startsWith('nachher') ? [{ schluessel: 'text', verhaeltnis: '2.5', soll: '4.5' }] : []
        }
        return fn.name === 'tippzieleImRahmen' ? (appTipp ? [{ schluessel: 'knopf', w: 30, h: 30 }] : []) : undefined
      },
    })
    const handle = (schluessel) => ({
      contentFrame: async () => frameVon(schluessel),
      getAttribute: async () => schluessel,
      evaluateHandle: async () => ({
        asElement: () => ({
          screenshot: async ({ path: ziel }) => {
            if (bricht(seite.name, seite.variante, schluessel)) throw crash()
            await writeFile(ziel, 'png')
          },
        }),
      }),
    })
    Object.assign(seite, {
      goto: async (url) => {
        pruefe()
        if (url === 'about:blank') return
        const [, hash] = url.split('#')
        const [, abfrage] = decodeURIComponent(hash).split('?')
        const w = new URLSearchParams(abfrage ?? '')
        seite.variante = w.get('v') ?? ''
        if (w.has('v')) besucht.push(seite.variante)
        seite.teil = w.get('teil') ?? ''
      },
      locator: () => ({
        first: () => ({ waitFor: async () => {} }),
        waitFor: async () => {},
        elementHandles: async () => (seite.teil === 'beide' ? ['vorher-375-hell'] : []).concat(['nachher-375-hell', 'nachher-375-dunkel']).map(handle),
      }),
      $$eval: async (sel) => (sel.includes('uebersicht') ? ['m1'] : sel.includes('"Variante"') ? ['A', 'B'] : sel.includes('"Fall"') ? ['f1'] : []),
      close: async () => { seite.geschlossen = true },
      context: () => ({ newPage: async () => neueSeite(`S${++plan.nr}`) }),
    })
    return seite
  }
  return async () => ({ browser: { close: async () => {} }, seite: neueSeite('S0'), fremde })
}

async function messeMit({ basis = null, schreibe = null, nurVorher = false, zusammenfassung = '', ...optionen }) {
  const aus = []
  process.exitCode = undefined
  await messe({ starte: browser(optionen), filter: '', ausgabe: (z) => aus.push(z), liste: false, basis, schreibe, nurVorher, zusammenfassung })
  const exit = process.exitCode
  process.exitCode = undefined
  return { aus, exit }
}

/** Kontrolle: nichts bricht, jede Nachher-Zelle (4) hat einen Befund → Rot-Liste mit genau 4 Zeilen, Exit 1. */
{
  const { aus, exit } = await messeMit({ bricht: () => false })
  assert.equal(exit, 1)
  const zeilen = aus.filter((z) => z.startsWith('    '))
  assert.deepEqual(zeilen, [
    '    m1/f1 A 375-hell: text 2.5:1 (soll 4.5:1)',
    '    m1/f1 A 375-dunkel: text 2.5:1 (soll 4.5:1)',
    '    m1/f1 B 375-hell: text 2.5:1 (soll 4.5:1)',
    '    m1/f1 B 375-dunkel: text 2.5:1 (soll 4.5:1)',
  ])
  assert.ok(aus.includes('\n  ✕ 4 neue Befunde:'))
}

/** Absturz mitten in der Einheit A (nach dem Hell-Befund): Wiederholung auf S1, jeder Befund genau einmal. */
{
  const { aus, exit } = await messeMit({ bricht: (s, v, z) => s === 'S0' && v === 'A' && z === 'nachher-375-dunkel' })
  assert.equal(exit, 1)
  const zeilen = aus.filter((z) => z.startsWith('    '))
  assert.deepEqual(zeilen, [
    '    m1/f1 A 375-hell: text 2.5:1 (soll 4.5:1)',
    '    m1/f1 A 375-dunkel: text 2.5:1 (soll 4.5:1)',
    '    m1/f1 B 375-hell: text 2.5:1 (soll 4.5:1)',
    '    m1/f1 B 375-dunkel: text 2.5:1 (soll 4.5:1)',
  ])
}

/** Einheit A stürzt zweimal ab: eine Absturz-Zeile in der Rot-Liste (Verdrahtung), B wird noch gemessen (2 Befunde), A-Befunde der Fehlversuche fehlen. */
{
  const { aus, exit } = await messeMit({ bricht: (s, v, z) => v === 'A' && z === 'nachher-375-dunkel' })
  assert.equal(exit, 1)
  assert.ok(aus.includes('\n  ✕ 3 neue Befunde:'), aus.join('|'))
  const zeilen = aus.filter((z) => z.startsWith('    '))
  assert.equal(zeilen.length, 3)
  assert.match(zeilen[0], /^ {4}Absturz m1\/f1 A \(Seite zweimal abgestürzt: /)
  assert.deepEqual(zeilen.slice(1), ['    m1/f1 B 375-hell: text 2.5:1 (soll 4.5:1)', '    m1/f1 B 375-dunkel: text 2.5:1 (soll 4.5:1)'])
}

/** Basis (main): Der App-Befund ist in Kopf und Mockup gleich, fällt also nur gegen die saubere Basis auf — je Zelle genau einmal. */
{
  const sauber = { 'm1/f1/375-hell': { tipp: [], kontrast: [] } }
  const { aus, exit } = await messeMit({ appBefund: true, basis: sauber, bricht: () => false })
  assert.equal(exit, 1)
  assert.deepEqual(aus.filter((z) => z.startsWith('    ')), ['    m1/f1 App-Basis 375-hell: kopf 2.5:1 (soll 4.5:1)'])
  /* Gegenfälle: Basis kennt den Befund (gleich) bzw. kennt die Zelle nicht (neues Mockup) → grün; ohne Basis wie bisher. */
  const kennt = { 'm1/f1/375-hell': { tipp: [], kontrast: [{ schluessel: 'kopf' }] } }
  assert.equal((await messeMit({ appBefund: true, basis: kennt, bricht: () => false })).exit, undefined)
  assert.equal((await messeMit({ appBefund: true, basis: { 'm9/f1/375-hell': sauber['m1/f1/375-hell'] }, bricht: () => false })).exit, undefined)
  assert.equal((await messeMit({ appBefund: true, bricht: () => false })).exit, undefined)
}

/** Kopf nur gegen die Basis (`--nur-vorher`): eine Vorher-Zelle, nur der App-Befund, keine Nachher-Zeilen; grün zählt die gemessene Zelle. */
{
  const sauber = { 'm1/f1/375-hell': { tipp: [], kontrast: [] } }
  const rot = await messeMit({ appBefund: true, basis: sauber, nurVorher: true, bricht: () => false })
  assert.equal(rot.exit, 1)
  assert.deepEqual(rot.aus.filter((z) => z.startsWith('    ')), ['    m1/f1 App-Basis 375-hell: kopf 2.5:1 (soll 4.5:1)'])
  const gruen = await messeMit({ appBefund: true, basis: { 'm1/f1/375-hell': { tipp: [], kontrast: [{ schluessel: 'kopf' }] } }, nurVorher: true, bricht: () => false })
  assert.equal(gruen.exit, undefined)
  assert.ok(gruen.aus.includes('\n  ok  1 Vorher-Zellen gemessen, nichts gegenüber der Basis (main) verschlechtert'), gruen.aus.join('|'))
}

/** Basis schreiben: nur die Vorher-Zelle der ersten Variante, nichts Nachher, kein Befund-Exit. */
{
  let geschrieben
  const { aus, exit } = await messeMit({ appBefund: true, bricht: () => false, schreibe: (m) => { geschrieben = m } })
  assert.equal(exit, undefined)
  assert.deepEqual(Object.keys(geschrieben), ['m1/f1/375-hell'])
  assert.deepEqual(geschrieben['m1/f1/375-hell'].kontrast, [{ schluessel: 'kopf', verhaeltnis: '2.5', soll: '4.5' }])
  assert.deepEqual(aus, [])
}

/** Nur-Vorher-Läufe öffnen nur die erste Variante (A), der volle Lauf beide: sonst kostet der Basis-Lauf die doppelte Zeit. */
{
  const nur = []
  await messeMit({ bricht: () => false, besucht: nur, schreibe: () => {} })
  assert.deepEqual(nur, ['A'])
  const voll = []
  await messeMit({ bricht: () => false, besucht: voll })
  assert.deepEqual(voll, ['A', 'B'])
}

/** Tippziele hängen nicht vom Thema ab: Kennt die Basis den Knopf nur im dunklen Thema, ist er im hellen kein neuer Befund; fehlt er überall, schon. */
{
  const dunkel = { 'm1/f1/375-hell': { tipp: [], kontrast: [] }, 'm1/f1/375-dunkel': { tipp: [{ schluessel: 'knopf' }], kontrast: [] } }
  assert.equal((await messeMit({ appTipp: true, basis: dunkel, nurVorher: true, bricht: () => false })).exit, undefined)
  const keiner = { 'm1/f1/375-hell': { tipp: [], kontrast: [] }, 'm1/f1/375-dunkel': { tipp: [], kontrast: [] } }
  const rot = await messeMit({ appTipp: true, basis: keiner, nurVorher: true, bricht: () => false })
  assert.equal(rot.exit, 1)
  assert.deepEqual(rot.aus.filter((z) => z.startsWith('    ')), ['    m1/f1 App-Basis 375-hell: knopf 30×30 px'])
}

/** Deckung: leere oder dünne Basis warnt (Log, Annotation, Zusammenfassung) und bleibt grün; volle Basis nur die Zählzeile; neue Mockups allein warnen nicht. */
{
  const ordner = await mkdtemp(path.join(os.tmpdir(), 'buehne-deckung-'))
  const summe = path.join(ordner, 'summe.md')
  const leer = await messeMit({ appBefund: true, basis: {}, nurVorher: true, zusammenfassung: summe, bricht: () => false })
  assert.equal(leer.exit, undefined)
  assert.ok(leer.aus.includes('Basis-Deckung: 1 von 1 Zellen ohne Basis-Gegenstück'), leer.aus.join('|'))
  assert.ok(leer.aus.includes('⚠ WARNUNG Bühne-Basis Basis deckt nur 0 von 1 Zellen — Vergleich gegen main unvollständig'))
  assert.ok(leer.aus.includes('::warning title=Bühne-Basis::Basis deckt nur 0 von 1 Zellen — Vergleich gegen main unvollständig'))
  assert.match(readFileSync(summe, 'utf8'), /Basis deckt nur 0 von 1 Zellen/)
  const voll = await messeMit({ appBefund: true, basis: { 'm1/f1/375-hell': { tipp: [], kontrast: [{ schluessel: 'kopf' }] } }, nurVorher: true, bricht: () => false })
  assert.ok(voll.aus.includes('Basis-Deckung: 0 von 1 Zellen ohne Basis-Gegenstück'))
  assert.ok(!voll.aus.some((z) => z.includes('WARNUNG')))
  /* Grenze 80 %: 4 von 5 gedeckt (ein neues Mockup) genügt, 3 von 5 nicht; 0 von 0 ist kein Fall für die Warnung. */
  const kopf = ['a', 'b', 'c', 'd', 'e']
  assert.equal(deckung(['a', 'b', 'c', 'd'], kopf).warnung, '')
  assert.equal(deckung(['a', 'b', 'c', 'd'], kopf).zeile, 'Basis-Deckung: 1 von 5 Zellen ohne Basis-Gegenstück')
  assert.match(deckung(['a', 'b', 'c'], kopf).warnung, /nur 3 von 5/)
  assert.equal(deckung(['a'], ['a']).warnung, '')
  assert.match(deckung(['a'], ['x']).warnung, /nur 0 von 1/)
  assert.equal(deckung(['a'], []).warnung, '')
  const hundert = Array.from({ length: 100 }, (_, i) => String(i))
  assert.match(deckung(hundert.slice(0, 79), hundert).warnung, /nur 79 von 100/)
  assert.equal(deckung(hundert.slice(0, 80), hundert).warnung, '')
}

/** Basis schreiben: Abstürze und eine leere Messung setzen Exit 1 (der Aufrufer macht daraus „Basis nicht messbar“); eine saubere Messung nicht. */
{
  const ordner = await mkdtemp(path.join(os.tmpdir(), 'buehne-schreibe-'))
  const lauf1 = (m, rot) => {
    process.exitCode = undefined
    const aus = []
    schreibeBasis(path.join(ordner, 'b.json'), m, rot, (z) => aus.push(z))
    const exit = process.exitCode
    process.exitCode = undefined
    return { exit, aus }
  }
  const zelle = { 'm1/f1/375-hell': { tipp: [], kontrast: [] } }
  assert.equal(lauf1(zelle, []).exit, undefined)
  const absturz = lauf1(zelle, ['Absturz m1/f1 A (Seite zweimal abgestürzt: x)'])
  assert.equal(absturz.exit, 1)
  assert.match(absturz.aus[0], /Basis: 1 Zellen nach .*\n {2}✕ Absturz m1\/f1 A/)
  const leer = lauf1({}, [])
  assert.equal(leer.exit, 1)
  assert.match(leer.aus[0], /keine einzige Zelle gemessen/)
  assert.deepEqual(JSON.parse(readFileSync(path.join(ordner, 'b.json'), 'utf8')), {})
}

/** Nachmessung: Ein Befund, der in der zweiten Messung derselben Zelle fehlt (Animationszustand), ist kein App-Befund; steht er in beiden, schon. */
{
  const sauber = { 'm1/f1/375-hell': { tipp: [], kontrast: [] } }
  const flackernd = await messeMit({ appBefund: true, flackert: true, basis: sauber, nurVorher: true, bricht: () => false })
  assert.equal(flackernd.exit, undefined)
  assert.deepEqual(flackernd.aus.filter((z) => z.startsWith('    ')), [])
  const stabil = await messeMit({ appBefund: true, basis: sauber, nurVorher: true, bricht: () => false })
  assert.equal(stabil.exit, 1)
}

async function bilderMit(optionen) {
  const ordner = await mkdtemp(path.join(os.tmpdir(), 'buehne-lauf-'))
  const aus = []
  process.exitCode = undefined
  await bilder({ starte: browser(optionen), filter: '', aus: ordner, ausgabe: (z) => aus.push(z) })
  const exit = process.exitCode
  process.exitCode = undefined
  return { aus, exit, dateien: (await readdir(path.join(ordner, 'm1', 'f1'))).sort() }
}

/** Kontrolle: nichts bricht → 5 Bilder (A: vorher + 2 nachher, B: 2 nachher), kein Exit-Code. */
{
  const { aus, exit, dateien } = await bilderMit({ bricht: () => false })
  assert.equal(exit, undefined)
  assert.equal(dateien.length, 5)
  assert.ok(aus.some((z) => z.startsWith('5 Bilder in ')))
}

/** Einheit A stürzt zweimal ab: Absturz-Zeile, Exit 1, 4 verschiedene Bilder — die zweimal geschriebenen zählen einmal. */
{
  const { aus, exit, dateien } = await bilderMit({ bricht: (s, v, z) => v === 'A' && z === 'nachher-375-dunkel' })
  assert.equal(exit, 1)
  assert.equal(aus.filter((z) => z.startsWith('  ✕ Absturz m1/f1 A (Seite zweimal abgestürzt: ')).length, 1)
  assert.deepEqual(dateien, ['nachher-A-375-hell.png', 'nachher-B-375-dunkel.png', 'nachher-B-375-hell.png', 'vorher-375-hell.png'])
  assert.ok(aus.some((z) => z.startsWith('4 Bilder in ')), aus.join('|'))
}

/** Fremde Anfragen: Exit 1 auch ohne Absturz. */
{
  const { exit } = await bilderMit({ bricht: () => false, fremde: ['http://x.test/a'] })
  assert.equal(exit, 1)
}

console.log('ok  buehne-lauf: 3 Fälle Messen (Kontrolle, Wiederholung ohne Doppelung, zweimal Absturz), 6 Fälle Basis (App-Befund gegen main rot/grün, nur Vorher, erste Variante, Tippziel themenunabhängig, Basis schreiben), Deckung leer/dünn/80-%-Grenze, schreibeBasis Exit 1 bei Absturz und leerer Messung, Nachmessung flackernder Befund, 3 Fälle Bilder (Kontrolle, zweimal Absturz, fremde Anfrage)')
