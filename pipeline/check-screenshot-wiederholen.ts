import assert from 'node:assert/strict'
import type { Browser, Page } from 'playwright'
import { mitNeuerSeite, mitWiederholung, faelleDurchlaufen } from './lib/screenshot-wiederholen.ts'

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
  assert.equal(await mitWiederholung(l.fn, (z) => zeilen.push(z)), 'ok')
  assert.equal(l.aufrufe(), 1)
  assert.equal(zeilen.length, 0)
}
{
  const zeilen: string[] = []
  const l = lauf([FEHLER])
  assert.equal(await mitWiederholung(l.fn, (z) => zeilen.push(z)), 'ok')
  assert.equal(l.aufrufe(), 2)
  assert.equal(zeilen.length, 1)
  assert.match(zeilen[0]!, /Versuch 1 von 3/)
}
{
  const zeilen: string[] = []
  const l = lauf([FEHLER, FEHLER])
  assert.equal(await mitWiederholung(l.fn, (z) => zeilen.push(z)), 'ok')
  assert.equal(l.aufrufe(), 3)
  assert.equal(zeilen.length, 2)
}
{
  const zeilen: string[] = []
  const l = lauf([FEHLER, FEHLER, FEHLER, FEHLER])
  await assert.rejects(
    mitWiederholung(l.fn, (z) => zeilen.push(z)),
    /Screenshot-Fehler auch im 3\. Versuch.*Unable to capture screenshot/,
  )
  assert.equal(l.aufrufe(), 3)
  assert.equal(zeilen.length, 2)
}
{
  const l = lauf(['Timeout 30000ms exceeded'])
  await assert.rejects(
    mitWiederholung(l.fn, () => {}),
    /Timeout/,
  )
  assert.equal(l.aufrufe(), 1)
}
{
  const l = lauf([FEHLER, 'Timeout 30000ms exceeded'])
  await assert.rejects(
    mitWiederholung(l.fn, () => {}),
    /Timeout/,
  )
  assert.equal(l.aufrufe(), 2)
}

/* Seiten-Kulisse: jeder Versuch bekommt eine neue Seite, jede wird geschlossen. */
function browserMit(fehlschlaege: string[]) {
  const seiten: { zu: boolean; optionen: unknown }[] = []
  const browser = {
    newPage: async (optionen: unknown) => {
      const eintrag = { zu: false, optionen }
      seiten.push(eintrag)
      return { id: seiten.length, close: async () => void (eintrag.zu = true) } as unknown as Page
    },
  } as unknown as Browser
  const fn = async (s: Page) => {
    const f = fehlschlaege[(s as unknown as { id: number }).id - 1]
    if (f) throw new Error(f)
    return 'ok'
  }
  return { browser, seiten, fn }
}
{
  const k = browserMit([FEHLER, FEHLER])
  assert.equal(await mitNeuerSeite(k.browser, { viewport: { width: 5, height: 6 } }, k.fn, () => {}), 'ok')
  assert.equal(k.seiten.length, 3)
  assert.ok(k.seiten.every((s) => s.zu))
  assert.deepEqual(k.seiten[2]!.optionen, { viewport: { width: 5, height: 6 } })
}
{
  const k = browserMit(['Timeout 30000ms exceeded'])
  await assert.rejects(mitNeuerSeite(k.browser, {}, k.fn, () => {}), /Timeout/)
  assert.equal(k.seiten.length, 1)
  assert.ok(k.seiten[0]!.zu)
}
{
  const k = browserMit([FEHLER, FEHLER, FEHLER])
  await assert.rejects(mitNeuerSeite(k.browser, {}, k.fn, () => {}), /3\. Versuch/)
  assert.equal(k.seiten.length, 3)
  assert.ok(k.seiten.every((s) => s.zu))
}

/* Durchlauf wie in check-beleg-wand: drei Fälle, der mittlere scheitert zweimal am Screenshot, der dritte ist inhaltlich rot. */
{
  const zeilen: string[] = []
  const versuche: Record<string, number> = {}
  const pruefe = async (name: string) => {
    versuche[name] = (versuche[name] ?? 0) + 1
    if (name === 'b' && versuche[name] <= 2) throw new Error(FEHLER)
    return name !== 'c'
  }
  assert.equal(await faelleDurchlaufen(['a', 'b', 'c'], pruefe, (z) => zeilen.push(z)), 1)
  assert.deepEqual(versuche, { a: 1, b: 3, c: 1 })
  assert.equal(zeilen.length, 2)
}
{
  const pruefe = async (name: string) => {
    if (name === 'b') throw new Error(FEHLER)
    return true
  }
  await assert.rejects(faelleDurchlaufen(['a', 'b', 'c'], pruefe, () => {}), /Unable to capture screenshot/)
}
console.log('screenshot-wiederholen: 12 Fälle in Ordnung (bis 3 Versuche, 3. Fehler rot mit Meldung, anderer Fehler sofort rot, neue Seite je Versuch, Durchlauf)')
