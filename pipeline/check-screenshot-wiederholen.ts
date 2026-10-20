import assert from 'node:assert/strict'
import { einmalWiederholen, faelleDurchlaufen } from './lib/screenshot-wiederholen.ts'

const FEHLER = 'Page.captureScreenshot: Unable to capture screenshot'

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
  assert.equal(await einmalWiederholen(l.fn, (z) => zeilen.push(z)), 'ok')
  assert.equal(l.aufrufe(), 1)
  assert.equal(zeilen.length, 0)
}
{
  const zeilen: string[] = []
  const l = lauf([FEHLER])
  assert.equal(await einmalWiederholen(l.fn, (z) => zeilen.push(z)), 'ok')
  assert.equal(l.aufrufe(), 2)
  assert.equal(zeilen.length, 1)
  assert.match(zeilen[0]!, /einmal wiederholt/)
}
{
  const l = lauf([FEHLER, FEHLER, FEHLER])
  await assert.rejects(
    einmalWiederholen(l.fn, () => {}),
    /Unable to capture screenshot/,
  )
  assert.equal(l.aufrufe(), 2)
}
{
  const l = lauf(['Timeout 30000ms exceeded'])
  await assert.rejects(
    einmalWiederholen(l.fn, () => {}),
    /Timeout/,
  )
  assert.equal(l.aufrufe(), 1)
}
{
  const l = lauf([FEHLER, 'Timeout 30000ms exceeded'])
  await assert.rejects(
    einmalWiederholen(l.fn, () => {}),
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
  assert.equal(await faelleDurchlaufen(['a', 'b', 'c'], pruefe, (z) => zeilen.push(z)), 1)
  assert.deepEqual(versuche, { a: 1, b: 2, c: 1 })
  assert.equal(zeilen.length, 1)
}
{
  const pruefe = async (name: string) => {
    if (name === 'b') throw new Error(FEHLER)
    return true
  }
  await assert.rejects(faelleDurchlaufen(['a', 'b', 'c'], pruefe, () => {}), /Unable to capture screenshot/)
}
console.log('screenshot-wiederholen: 7 Fälle in Ordnung (einmal wiederholt, zweiter Fehler rot, anderer Fehler rot, Durchlauf)')
