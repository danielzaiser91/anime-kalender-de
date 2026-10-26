/**
 * Test des Starts der Bühne (`web/buehne/start-ablauf.ts`): in einer Zelle liegt der flüchtige Speicher schon, wenn die
 * App-Module geladen werden, und jede Zelle hat ihren eigenen; Rahmen und Leiste behalten den echten. Der Ablauf läuft
 * wirklich (Attrappen für Laden, Uhr, `fetch`, Zelle, Rahmen), nicht nur die Hilfsfunktion.
 */
import assert from 'node:assert/strict'
import type { FaelleDatei, Fall } from '../web/buehne/faelle.ts'
import { startAblauf, type StartUmgebung } from '../web/buehne/start-ablauf.ts'

const fallA = { name: 'A', titleId: 1 } as unknown as Fall
const fallB = { name: 'B', titleId: 2 } as unknown as Fall
const faelle = { heute: '2026-10-16T12:00:00+02:00', meta: {}, faelle: { a: fallA, b: fallB } } as unknown as FaelleDatei

interface Lauf {
  ereignisse: string[]
  fenster: Record<string, unknown>
  /** Was `localStorage` war, als die App-Module geladen wurden (Zelle bzw. Rahmen). */
  beimLaden: unknown
  fall?: Fall
  zeit?: string
}

async function starte(hash: string): Promise<Lauf> {
  const lauf: Lauf = { ereignisse: [], fenster: { localStorage: 'echt', sessionStorage: 'echt' }, beimLaden: undefined }
  const umgebung: StartUmgebung = {
    hash: () => hash,
    fenster: lauf.fenster,
    wurzel: () => ({}) as HTMLElement,
    ladeFaelle: async () => {
      lauf.ereignisse.push('laden')
      return faelle
    },
    friereZeitEin: (iso) => {
      lauf.ereignisse.push('zeit')
      lauf.zeit = iso
    },
    biegeFetchUm: (_f, fall) => {
      lauf.ereignisse.push('fetch')
      lauf.fall = fall
    },
    zeigeZelle: async () => {
      await Promise.resolve()
      lauf.ereignisse.push('zelle')
      lauf.beimLaden = lauf.fenster.localStorage
    },
    zeigeRahmen: async () => {
      await Promise.resolve()
      lauf.ereignisse.push('rahmen')
      lauf.beimLaden = lauf.fenster.localStorage
    },
  }
  await startAblauf(umgebung)
  return lauf
}

// Eine Zelle: der Speicher ist ersetzt, bevor die App-Module laden, und die Reihenfolge bleibt.
const zelle = await starte('#zelle?mockup=m&v=A&fall=b&thema=hell')
assert.deepEqual(zelle.ereignisse, ['laden', 'zeit', 'fetch', 'zelle'])
assert.notEqual(zelle.beimLaden, 'echt', 'beim Laden der App steht schon der flüchtige Speicher')
assert.equal(typeof (zelle.beimLaden as Storage).setItem, 'function')
assert.notEqual(zelle.fenster.sessionStorage, 'echt', 'auch der Sitzungsspeicher')
assert.equal(zelle.fall, fallB)
assert.equal(zelle.zeit, faelle.heute)

// Zwei Zellen (zwei Fenster): was in der einen gewählt wird, steht in der anderen nicht.
const erste = await starte('#zelle?mockup=m&v=A&fall=a')
const zweite = await starte('#zelle?mockup=m&v=B&fall=a')
const ersteSpeicher = erste.fenster.localStorage as Storage
ersteSpeicher.setItem('vorlieben', '{"confirmedOnly":true}')
assert.equal((zweite.fenster.localStorage as Storage).getItem('vorlieben'), null)
assert.equal(ersteSpeicher.getItem('vorlieben'), '{"confirmedOnly":true}')

// Rahmen (Leiste): der echte Speicher bleibt; weder Zelle noch fremde Namen lösen die Ersetzung aus.
for (const hash of ['', '#', '#relative-uhrzeit?v=A&fall=b', '#zellen?x=1']) {
  const rahmen = await starte(hash)
  assert.deepEqual(rahmen.ereignisse, ['laden', 'zeit', 'fetch', 'rahmen'], `Hash „${hash}“`)
  assert.equal(rahmen.beimLaden, 'echt', `Hash „${hash}“: echter Speicher`)
  assert.equal(rahmen.fenster.sessionStorage, 'echt')
}

// Unbekannter oder fehlender Fall: der erste; eine Zeit im Link gilt statt „heute“.
assert.equal((await starte('#zelle?mockup=m&fall=gibt-es-nicht')).fall, fallA)
assert.equal((await starte('#zelle?mockup=m')).fall, fallA)
assert.equal((await starte('#zelle?mockup=m&zeit=2026-10-16T16:20:00%2B02:00')).zeit, '2026-10-16T16:20:00+02:00')

console.log('buehne-start.test: ok (Speicher vor dem Laden der App, je Zelle getrennt, Rahmen unberührt, Reihenfolge)')
