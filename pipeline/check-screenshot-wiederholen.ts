import assert from 'node:assert/strict'
import { einmalWiederholen, faelleDurchlaufen, mitFrischemBrowser } from './lib/screenshot-wiederholen.ts'

const FEHLER = 'Page.captureScreenshot: Unable to capture screenshot'
const keinWarten = async () => {}

function lauf(fehlschlaege: string[]) {
  let n = 0
  return {
    aufrufe: () => n,
    fn: async () => {
      n++
      const f = fehlschlaege[n - 1]
      if (f) throw new Error(f)
      return 'ok'
    },
  }
}

{
  const zeilen: string[] = []
  const l = lauf([])
  assert.equal(await einmalWiederholen(l.fn, (z) => zeilen.push(z), keinWarten), 'ok')
  assert.equal(l.aufrufe(), 1)
  assert.equal(zeilen.length, 0)
}
{
  const zeilen: string[] = []
  const l = lauf([FEHLER])
  assert.equal(await einmalWiederholen(l.fn, (z) => zeilen.push(z), keinWarten), 'ok')
  assert.equal(l.aufrufe(), 2)
  assert.deepEqual(zeilen.map((z) => z.replace(/:.*/, '')), ['Screenshot-Fehler, einmal wiederholt', 'Screenshot-Wiederholung ok'])
}
{
  const l = lauf([FEHLER, FEHLER, FEHLER])
  await assert.rejects(
    einmalWiederholen(l.fn, () => {}, keinWarten),
    /Unable to capture screenshot/,
  )
  assert.equal(l.aufrufe(), 2)
}
{
  const l = lauf(['Timeout 30000ms exceeded'])
  await assert.rejects(
    einmalWiederholen(l.fn, () => {}, keinWarten),
    /Timeout/,
  )
  assert.equal(l.aufrufe(), 1)
}
{
  const l = lauf([FEHLER, 'Timeout 30000ms exceeded'])
  await assert.rejects(
    einmalWiederholen(l.fn, () => {}, keinWarten),
    /Timeout/,
  )
  assert.equal(l.aufrufe(), 2)
}
/* Durchlauf wie in check-beleg-wand: drei Fälle, der mittlere scheitert einmal am Screenshot, der dritte ist inhaltlich rot. */
{
  const zeilen: string[] = []
  const versuche: Record<string, number> = {}
  const pruefe = async (name: string) => {
    versuche[name] = (versuche[name] ?? 0) + 1
    if (name === 'b' && versuche[name] === 1) throw new Error(FEHLER)
    return name !== 'c'
  }
  assert.equal(await faelleDurchlaufen(['a', 'b', 'c'], pruefe, (z) => zeilen.push(z), keinWarten), 1)
  assert.deepEqual(versuche, { a: 1, b: 2, c: 1 })
  assert.equal(zeilen.length, 2)
}
{
  const pruefe = async (name: string) => {
    if (name === 'b') throw new Error(FEHLER)
    return true
  }
  await assert.rejects(faelleDurchlaufen(['a', 'b', 'c'], pruefe, () => {}, keinWarten), /Unable to capture screenshot/)
}
/* Reihenfolge: Versuch 1, Meldung, Pause von 1500 ms, Versuch 2 (frischer Kontext); ohne Fehler keine Pause. */
{
  const spur: string[] = []
  const lauf2 = async (v: 1 | 2) => {
    spur.push(`versuch${v}`)
    if (v === 1) throw new Error(FEHLER)
    return 'ok'
  }
  assert.equal(await einmalWiederholen(lauf2, () => spur.push('meldung'), async (ms) => void spur.push(`pause${ms}`)), 'ok')
  assert.deepEqual(spur, ['versuch1', 'meldung', 'pause1500', 'versuch2', 'meldung'])
}
{
  const pausen: number[] = []
  await einmalWiederholen(async () => 'ok', () => {}, async (ms) => void pausen.push(ms))
  assert.deepEqual(pausen, [])
}
/* Wiederholung scheitert wieder am Screenshot: weiter rot, nie stilles Grün. */
{
  const versuche: number[] = []
  const lauf3 = async (v: 1 | 2) => {
    versuche.push(v)
    throw new Error(FEHLER)
  }
  const zeilen: string[] = []
  await assert.rejects(einmalWiederholen(lauf3, (z) => zeilen.push(z), keinWarten), /Unable to capture screenshot/)
  assert.deepEqual(versuche, [1, 2])
  assert.equal(zeilen.at(-1), 'Screenshot-Wiederholung gescheitert')
  assert.equal(zeilen.filter((z) => z === 'Screenshot-Wiederholung ok').length, 0)
}
/* Browser: Versuch 1 startet nichts, Versuch 2 schließt zuerst den alten, dann startet er einen neuen; ein Fehler beim Schließen stoppt nicht. */
{
  const spur: string[] = []
  const starte = async () => {
    spur.push('launch')
    return 'neu'
  }
  const b = mitFrischemBrowser('alt', starte, async (x) => void spur.push(`close:${x}`))
  assert.equal(await b.fuer(1), 'alt')
  assert.deepEqual(spur, [])
  assert.equal(await b.fuer(2), 'neu')
  assert.deepEqual(spur, ['close:alt', 'launch'])
  assert.equal(b.browser(), 'neu')
}
{
  const b = mitFrischemBrowser('alt', async () => 'neu', async () => {
    throw new Error('tot')
  })
  assert.equal(await b.fuer(2), 'neu')
}
console.log('screenshot-wiederholen: 13 Fälle in Ordnung (Browser-Wechsel nur bei Versuch 2, Wiederholung ok/gescheitert gemeldet, einmal wiederholt mit Pause 1500 ms und Versuch 2, zweiter Fehler rot, anderer Fehler rot, Durchlauf)')
