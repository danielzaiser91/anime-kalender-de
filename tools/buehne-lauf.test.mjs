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
function browser({ bricht, fremde = [] }) {
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
          return schluessel.startsWith('nachher') ? [{ schluessel: 'text', verhaeltnis: '2.5', soll: '4.5' }] : []
        }
        return fn.name === 'tippzieleImRahmen' ? [] : undefined
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

async function messeMit(optionen) {
  const aus = []
  process.exitCode = undefined
  await messe({ starte: browser(optionen), filter: '', ausgabe: (z) => aus.push(z), liste: false })
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

console.log('ok  buehne-lauf: 3 Fälle Messen (Kontrolle, Wiederholung ohne Doppelung, zweimal Absturz), 3 Fälle Bilder (Kontrolle, zweimal Absturz, fremde Anfrage)')
