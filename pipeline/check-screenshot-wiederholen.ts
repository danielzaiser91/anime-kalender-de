import assert from 'node:assert/strict'
import type { Browser, Page } from 'playwright'
import { einmalWiederholen, mitNeuerSeite, mitRuecksetzung, mitWiederholung, faelleDurchlaufen, faelleMitFrischemBrowser, mitFrischemBrowser } from './lib/screenshot-wiederholen.ts'

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
/* Verdrahtung: Fall wirft bei Versuch 1 den Screenshot-Fehler, Versuch 2 muss den frischen Browser sehen (nicht den alten). */
{
  const gesehen: string[] = []
  const b = mitFrischemBrowser('alt', async () => 'neu', async () => {})
  const pruefe = async (br: string, f: string) => {
    gesehen.push(`${f}:${br}`)
    if (br === 'alt' && f === 'b') throw new Error(FEHLER)
    return true
  }
  assert.equal(await faelleMitFrischemBrowser(['a', 'b', 'c'], b, pruefe, () => {}, keinWarten), 0)
  assert.deepEqual(gesehen, ['a:alt', 'b:alt', 'b:neu', 'c:neu'])
}

/* mitWiederholung: bis 3 Versuche mit Pause 1500 ms dazwischen, neue Seite je Versuch. */
{
  const zeilen: string[] = []
  const l = lauf([FEHLER, FEHLER])
  const pausen: number[] = []
  assert.equal(await mitWiederholung(l.fn, (z) => zeilen.push(z), async (ms) => void pausen.push(ms)), 'ok')
  assert.equal(l.aufrufe(), 3)
  assert.deepEqual(pausen, [1500, 1500])
  assert.match(zeilen[0]!, /Versuch 1 von 3/)
}
{
  const l = lauf([FEHLER, FEHLER, FEHLER, FEHLER])
  await assert.rejects(mitWiederholung(l.fn, () => {}, keinWarten), /Screenshot-Fehler auch im 3\. Versuch.*Unable to capture screenshot/)
  assert.equal(l.aufrufe(), 3)
}
{
  const l = lauf([FEHLER, 'Timeout 30000ms exceeded'])
  await assert.rejects(mitWiederholung(l.fn, () => {}, keinWarten), /Timeout/)
  assert.equal(l.aufrufe(), 2)
}
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
  assert.equal(await mitNeuerSeite(k.browser, { viewport: { width: 5, height: 6 } }, k.fn, () => {}, keinWarten), 'ok')
  assert.equal(k.seiten.length, 3)
  assert.ok(k.seiten.every((s) => s.zu))
  assert.deepEqual(k.seiten[2]!.optionen, { viewport: { width: 5, height: 6 } })
}
{
  const k = browserMit(['Timeout 30000ms exceeded'])
  await assert.rejects(mitNeuerSeite(k.browser, {}, k.fn, () => {}, keinWarten), /Timeout/)
  assert.equal(k.seiten.length, 1)
  assert.ok(k.seiten[0]!.zu)
}
{
  const k = browserMit([FEHLER, FEHLER, FEHLER])
  await assert.rejects(mitNeuerSeite(k.browser, {}, k.fn, () => {}, keinWarten), /3\. Versuch/)
  assert.equal(k.seiten.length, 3)
  assert.ok(k.seiten.every((s) => s.zu))
}

/* Rücksetzung je Versuch: Fehler nach dem Ersetzen von fetch und Setzen des Tokens (Kulisse wie in check-woche-bild). */
{
  delete process.env.LAUF_TOKEN
  const echt = globalThis.fetch
  let zaehler = 0
  const anfang: number[] = []
  const fetchBeiStart: unknown[] = []
  const tokenBeiStart: (string | undefined)[] = []
  let n = 0
  const versuch = mitRuecksetzung(async (s: string) => {
    n++
    anfang.push(zaehler)
    fetchBeiStart.push(globalThis.fetch)
    tokenBeiStart.push(process.env.LAUF_TOKEN)
    zaehler += 5
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch
    process.env.LAUF_TOKEN = `t${n}`
    if (n <= 2) throw new Error(FEHLER)
    assert.equal(s, 'seite')
  }, () => { zaehler = 0 })
  await mitWiederholung(() => versuch('seite'), () => {}, keinWarten)
  assert.equal(n, 3)
  assert.deepEqual(anfang, [0, 0, 0], 'der Zähler beginnt je Versuch bei 0')
  assert.ok(fetchBeiStart.every((f) => f === echt), 'fetch ist je Versuch wieder die echte Funktion')
  assert.deepEqual(tokenBeiStart, [undefined, undefined, undefined], 'kein Token aus dem Vorversuch')
  assert.equal(globalThis.fetch, echt)
  assert.equal(process.env.LAUF_TOKEN, undefined)
  assert.equal(zaehler, 5, 'nach dem letzten Versuch zählt nur dieser')
  const hart = mitRuecksetzung(async () => {
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch
    process.env.LAUF_TOKEN = 'x'
    throw new Error('Timeout')
  }, () => {})
  await assert.rejects(hart(1), /Timeout/)
  assert.equal(globalThis.fetch, echt)
  assert.equal(process.env.LAUF_TOKEN, undefined)
}
console.log('screenshot-wiederholen: alle Fälle in Ordnung (Browser-Wechsel, einmal wiederholt mit Pause, bis 3 Versuche mit Pause 1500 ms, 3. Fehler rot, anderer Fehler sofort rot, neue Seite je Versuch, Durchlauf, Rücksetzung je Versuch)')
