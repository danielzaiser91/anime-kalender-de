/**
 * Test des Zellen-Speichers der Bühne (`web/buehne/speicher-je-zelle.ts`): eine Wahl in einer Zelle (Variante, Fall)
 * steht in keiner anderen, und nur Zellen bekommen den flüchtigen Speicher, nicht Rahmen und Leiste.
 */
import assert from 'node:assert/strict'
import { bereiteSpeicherVor } from '../web/buehne/speicher-je-zelle.ts'

const echt = () => ({ localStorage: 'echt-lokal', sessionStorage: 'echt-sitzung' })

// Zwei Zellen (zwei Fenster) mit demselben „echten“ Speicher darunter: die Wahl aus A erreicht B nicht.
const a = echt() as Record<string, unknown>
const b = echt() as Record<string, unknown>
bereiteSpeicherVor('zelle', a)
bereiteSpeicherVor('zelle', b)
const la = a.localStorage as Storage
const lb = b.localStorage as Storage
la.setItem('vorlieben', '{"confirmedOnly":true}')
assert.equal(la.getItem('vorlieben'), '{"confirmedOnly":true}', 'die Zelle sieht ihre eigene Wahl')
assert.equal(lb.getItem('vorlieben'), null, 'die andere Zelle sieht sie nicht')
const sa = a.sessionStorage as Storage
sa.setItem('s', '1')
assert.equal((b.sessionStorage as Storage).getItem('s'), null, 'auch der Sitzungsspeicher ist je Zelle')

// Eine neu geladene Zelle beginnt leer (frisch beim Wechsel von Variante oder Fall).
const c = echt() as Record<string, unknown>
bereiteSpeicherVor('zelle', c)
assert.equal((c.localStorage as Storage).getItem('vorlieben'), null)
assert.equal((c.localStorage as Storage).length, 0)

// Speicher-Verhalten wie der Browser: Zeichenketten, null für Fehlendes, Schlüssel in Reihenfolge, Löschen.
la.setItem('n', 5 as unknown as string)
assert.equal(la.getItem('n'), '5')
assert.equal(la.length, 2)
assert.equal(la.key(0), 'vorlieben')
assert.equal(la.key(1), 'n')
assert.equal(la.key(2), null)
la.removeItem('n')
assert.equal(la.getItem('n'), null)
la.clear()
assert.equal(la.length, 0)

// Rahmen (Leiste) und jeder andere Modus behalten den echten Speicher.
for (const modus of ['', 'relative-uhrzeit', 'zellex']) {
  const d = echt() as Record<string, unknown>
  bereiteSpeicherVor(modus, d)
  assert.equal(d.localStorage, 'echt-lokal', `Modus „${modus}“ bleibt unberührt`)
  assert.equal(d.sessionStorage, 'echt-sitzung')
}

console.log('buehne-speicher.test: ok (Zellen getrennt, frisch, Rahmen unberührt)')
