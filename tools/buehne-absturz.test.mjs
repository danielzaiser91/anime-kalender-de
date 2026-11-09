/**
 * Test der Absturz-Wiederholung der Bühnen-Werkzeuge: die reine Funktion und der echte Aufrufer `durchlaufe` (Attrappe-Seite).
 * Ein abgestürzter Seiten-Prozess wird ersetzt und die Einheit einmal wiederholt; zweimal abgestürzt ergibt eine benannte Zeile.
 */
import assert from 'node:assert/strict'
import { istAbsturz, mitWiederholung } from './buehne-absturz.mjs'
import { durchlaufe } from './buehne-seite.mjs'

assert.equal(istAbsturz(new Error('page.goto: Page crashed')), true)
assert.equal(istAbsturz(new Error('Target crashed ')), true)
assert.equal(istAbsturz(new Error('Timeout 30000ms exceeded')), false)

const crash = () => new Error('page.evaluate: Page crashed\n  at x')

/** Absturz im ersten Versuch: neue Seite, zweiter Versuch läuft mit ihr. */
{
  const benutzt = []
  let ersetzt = 0
  const arbeit = async (s) => {
    benutzt.push(s)
    if (s === 'alt') throw crash()
  }
  const r = await mitWiederholung('alt', arbeit, async () => (ersetzt++, 'neu'))
  assert.deepEqual(benutzt, ['alt', 'neu'])
  assert.deepEqual(r, { seite: 'neu', absturz: null })
  assert.equal(ersetzt, 1)
}

/** Zweimal abgestürzt: genau zwei Versuche, Meldung statt Ausnahme, Seite trotzdem ersetzt. */
{
  let versuche = 0
  const r = await mitWiederholung('a', async () => { versuche++; throw crash() }, async (s) => `${s}+`)
  assert.equal(versuche, 2)
  assert.equal(r.absturz, 'page.evaluate: Page crashed')
  assert.equal(r.seite, 'a++')
}

/** Anderer Fehler: weder Wiederholung noch Ersatz. */
{
  let ersetzt = 0
  await assert.rejects(mitWiederholung('a', async () => { throw new Error('Timeout 30000ms exceeded') }, async () => (ersetzt++, 'b')), /Timeout/)
  assert.equal(ersetzt, 0)
}

/** Kein Fehler: kein Ersatz. */
{
  const r = await mitWiederholung('a', async () => {}, async () => 'b')
  assert.deepEqual(r, { seite: 'a', absturz: null })
}

/** Attrappe einer Bühnen-Seite: `abstuerze` = Liste der Adressen-Nummern (1-basiert), bei denen die Seite abstürzt. */
function attrappe(plan, protokoll, name = 'S0') {
  const seite = {
    name,
    goto: async (url) => {
      if (url === 'about:blank') return
      protokoll.push(`${seite.name} ${decodeURIComponent(url.split('#')[1])}`)
      if (url.includes('?') && plan.stirbt.has(protokoll.filter((p) => p.includes('?')).length)) throw crash()
    },
    locator: () => ({ first: () => ({ waitFor: async () => {} }), waitFor: async () => {}, elementHandles: async () => [] }),
    $$eval: async (sel) => (sel.includes('uebersicht') ? ['m1'] : sel.includes('"Variante"') ? ['A', 'B'] : sel.includes('"Fall"') ? ['f1'] : []),
    close: async () => { protokoll.push(`close ${seite.name}`) },
    context: () => ({ newPage: async () => attrappe(plan, protokoll, `S${++plan.nr}`) }),
  }
  return seite
}

/** Der echte Aufrufer: erste Öffnung stürzt ab → neue Seite, Wiederholung, keine Meldung. */
{
  const protokoll = []
  const plan = { stirbt: new Set([1]), nr: 0 }
  const zellen = []
  const meldungen = await durchlaufe(attrappe(plan, protokoll), '', async (a) => zellen.push(a.variante))
  assert.deepEqual(meldungen, [])
  assert.deepEqual(zellen, ['A', 'B'])
  assert.ok(protokoll.includes('close S0'), 'abgestürzte Seite geschlossen')
  assert.ok(protokoll.some((p) => p.startsWith('S1 m1?')), 'Wiederholung läuft auf der neuen Seite')
}

/** Der echte Aufrufer: eine Einheit stürzt zweimal ab → benannte Zeile, die andere Variante wird noch gemessen. */
{
  const protokoll = []
  const plan = { stirbt: new Set([1, 2]), nr: 0 }
  const zellen = []
  const meldungen = await durchlaufe(attrappe(plan, protokoll), '', async (a) => zellen.push(a.variante))
  assert.equal(meldungen.length, 1)
  assert.match(meldungen[0], /^Absturz m1\/f1 A \(Seite zweimal abgestürzt: /)
  assert.deepEqual(zellen, ['B'])
}

console.log('ok  buehne-absturz: 2 Aufrufer-Fälle (Wiederholung, zweimal Absturz), 4 Fälle der Funktion')
