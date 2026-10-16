import { test, expect } from 'claude-code/testing'

import { bereichOffen, bereichsKennung } from './bereiche'

test('bereichOffen: Standard zu, nur „jetzt“ offen; ein Schalter kehrt den Standard um', () => {
  expect(bereichOffen('jetzt', [])).toBe(true)
  expect(bereichOffen('arbeit', [])).toBe(false)
  expect(bereichOffen('arbeit', [bereichsKennung('arbeit')])).toBe(true)
  expect(bereichOffen('jetzt', [bereichsKennung('jetzt')])).toBe(false)
  // „weitere“-Kennungen der Listen (ohne Präfix) beeinflussen den Bereich nicht.
  expect(bereichOffen('arbeit', ['arbeit', 'jetzt'])).toBe(false)
})

