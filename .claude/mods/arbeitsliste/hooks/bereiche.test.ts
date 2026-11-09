import { test, expect } from 'claude-code/testing'

import { bereichOffen, bereichsKennung } from './bereiche'

test('bereichOffen: Standard zu, nur „jetzt“ und „gerade“ offen; ein Schalter kehrt den Standard um', () => {
  expect(bereichOffen('jetzt', [])).toBe(true)
  expect(bereichOffen('gerade', [])).toBe(true)
  expect(bereichOffen('pipe', [])).toBe(false)
  expect(bereichOffen('pipe', [bereichsKennung('pipe')])).toBe(true)
  expect(bereichOffen('jetzt', [bereichsKennung('jetzt')])).toBe(false)
  expect(bereichOffen('gerade', [bereichsKennung('gerade')])).toBe(false)
  // „weitere“-Kennungen der Listen (ohne Präfix) beeinflussen den Bereich nicht.
  expect(bereichOffen('pipe', ['pipe', 'jetzt'])).toBe(false)
})

