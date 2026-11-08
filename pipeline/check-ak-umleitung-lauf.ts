/**
 * Lauftest für `akUmleitung()` (web/src/lib/ak-umleitung.ts) mit Attrappen für location, history, localStorage und fetch:
 * die alte Titeladresse `/t/<ak>/` bzw. `#/…?t=<ak>` wird auf den Nachfolger umgeschrieben, `search` bleibt unverändert.
 */
import assert from 'node:assert/strict'

type Aufruf = { state: unknown; titel: string; adresse: string }
const g = globalThis as Record<string, unknown>
const PAARE: [number, number][] = [[5, 9], [-3, -7]]

/** Setzt die Attrappen, lässt `akUmleitung()` laufen und liefert die replaceState-Aufrufe und die fetch-Adressen. */
async function lauf(pfad: string, search: string, hash: string, gemerkt: Record<string, string> = {}) {
  const aufrufe: Aufruf[] = []
  const abrufe: string[] = []
  const speicher = new Map(Object.entries(gemerkt))
  g.location = { pathname: pfad, search, hash }
  g.history = { state: { marke: 'x' }, replaceState: (state: unknown, titel: string, adresse: string) => aufrufe.push({ state, titel, adresse }) }
  g.localStorage = {
    getItem: (k: string) => speicher.get(k) ?? null,
    setItem: (k: string, v: string) => void speicher.set(k, v),
    removeItem: (k: string) => void speicher.delete(k),
  }
  g.fetch = async (u: string) => {
    abrufe.push(String(u))
    return { ok: true, status: 200, json: async () => PAARE }
  }
  const { akUmleitung } = await import('../web/src/lib/ak-umleitung.ts')
  await akUmleitung()
  return { aufrufe, abrufe }
}

const pfad = await lauf('/t/5/', '?x=1&y=2', '')
assert.equal(pfad.aufrufe.length, 1, 'Pfad /t/5/: genau ein replaceState')
assert.equal(pfad.aufrufe[0].adresse, '/t/9/?x=1&y=2', 'Pfad: Nachfolger 9, search unverändert')
assert.deepEqual(pfad.aufrufe[0].state, { marke: 'x' }, 'Pfad: history.state bleibt')
assert.equal(pfad.abrufe.length, 1, 'Pfad: ak-umleitung.json wird abgerufen')

const mitBasis = await lauf('/anime/t/5', '?q=a', '')
assert.equal(mitBasis.aufrufe[0].adresse, '/anime/t/9?q=a', 'BASE_URL-Präfix bleibt, Schrägstrich-Form bleibt')

const hash = await lauf('/', '?s=2', '#/liste?t=5&f=1')
assert.equal(hash.aufrufe[0].adresse, '/?s=2#/liste?t=9&f=1', 'Hash ?t=5 -> 9, search und Rest des Hashs bleiben')

const cartoon = await lauf('/', '', '#/liste?t=-3')
assert.equal(cartoon.aufrufe[0].adresse, '/#/liste?t=-7', 'Cartoon mit negativer Kennung wird umgeleitet')

const unbekannt = await lauf('/t/6/', '?x=1', '')
assert.equal(unbekannt.aufrufe.length, 0, 'Kennung ohne Nachfolger: kein replaceState')
assert.equal(unbekannt.abrufe.length, 1, 'unbekannte Kennung: Datei wird trotzdem gelesen')

const fremd = await lauf('/quellen', '?x=1', '')
assert.equal(fremd.aufrufe.length, 0, 'fremder Pfad: kein replaceState')
assert.equal(fremd.abrufe.length, 0, 'fremder Pfad ohne gemerkte Titel: kein Abruf')

const liste = await lauf('/', '', '', { favorites: '[5]' })
assert.equal(liste.aufrufe.length, 0, 'gemerkte Liste: Adresse bleibt')
assert.equal(liste.abrufe.length, 1, 'gemerkte Liste: Datei wird gelesen')

console.log('check-ak-umleitung-lauf: 7 Fälle grün (Pfad, Basis-Präfix, Hash, Cartoon, unbekannt, fremd, Liste)')
process.exit(0)
