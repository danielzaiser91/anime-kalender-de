/**
 * Verdrahtungstest der Bühnen-Läufe `buehne-messen` und `buehne-bilder` mit Attrappe-Browser: Ein zweimal abgestürzter Einheit
 * erscheint als Befund (Messen: Zeile in der Rot-Liste, Exit 1; Bilder: Zeile, Exit 1), und nach einer Wiederholung stehen die
 * Befunde bzw. Bilder der halb gemessenen ersten Runde nicht doppelt da.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { lauf as messe } from './buehne-messen.mjs'
import { lauf as bilder } from './buehne-bilder.mjs'
import { kontrastImRahmen } from './buehne-messung.mjs'

const crash = () => new Error('locator.evaluate: Page crashed')

/**
 * Attrappe-Browser: ein Mockup `m1`, ein Fall `f1`, Varianten A und B. Zellen je Ansicht: vorher-375-hell (nur bei teil=beide),
 * nachher-375-hell, nachher-375-dunkel. Nachher-Zellen haben einen Kontrastbefund. `bricht(seitenName, variante, schluessel)`
 * sagt, ob die Messung bzw. das Bild dieser Zelle abstürzt.
 */
function browser({ bricht, fremde = [], appBefund = false, appTipp = false, besucht = [] }) {
  const plan = { nr: 0 }
  const neueSeite = (name) => {
    const seite = { name, variante: '', teil: '', geschlossen: false }
    const pruefe = () => { if (seite.geschlossen) throw new Error('Target closed') }
    const frameVon = (schluessel) => ({
      waitForLoadState: async () => {},
      waitForFunction: async () => {},
      waitForTimeout: async () => {},
      evaluate: async (fn) => {
        if (fn === kontrastImRahmen) {
          if (bricht(seite.name, seite.variante, schluessel)) throw crash()
          /* `appBefund`: App-Code bringt denselben Befund in Vorher und Nachher — Vorher-gegen-Nachher bleibt still. */
          if (appBefund) return schluessel.endsWith('hell') ? [{ schluessel: 'kopf', verhaeltnis: '2.5', soll: '4.5' }] : []
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

async function messeMit({ basis = null, schreibe = null, nurVorher = false, ...optionen }) {
  const aus = []
  process.exitCode = undefined
  await messe({ starte: browser(optionen), filter: '', ausgabe: (z) => aus.push(z), liste: false, basis, schreibe, nurVorher })
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

console.log('ok  buehne-lauf: 3 Fälle Messen (Kontrolle, Wiederholung ohne Doppelung, zweimal Absturz), 6 Fälle Basis (App-Befund gegen main rot/grün, nur Vorher, erste Variante, Tippziel themenunabhängig, Basis schreiben), 3 Fälle Bilder (Kontrolle, zweimal Absturz, fremde Anfrage)')
