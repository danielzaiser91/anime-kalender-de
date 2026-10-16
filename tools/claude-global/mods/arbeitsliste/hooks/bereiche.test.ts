import { test, expect } from 'claude-code/testing'

import { bereichOffen, bereichsKennung, zaehleTopPrios } from './bereiche'

test('bereichOffen: Standard zu, nur „jetzt“ offen; ein Schalter kehrt den Standard um', () => {
  expect(bereichOffen('jetzt', [])).toBe(true)
  expect(bereichOffen('arbeit', [])).toBe(false)
  expect(bereichOffen('arbeit', [bereichsKennung('arbeit')])).toBe(true)
  expect(bereichOffen('jetzt', [bereichsKennung('jetzt')])).toBe(false)
  // „weitere“-Kennungen der Listen (ohne Präfix) beeinflussen den Bereich nicht.
  expect(bereichOffen('arbeit', ['arbeit', 'jetzt'])).toBe(false)
})

test('zaehleTopPrios: fetter Kurztitel auch unter 20 Zeichen, Rest, Links; nur dieser Abschnitt', () => {
  const t = '# Stand\n\n## Top-Prios\n- **D1** — Grundlast [Plan](https://x.org/a)\n- **Speed** — Ladezeit\nText\n\n## Anderes\n- **Nein** — nicht\n'
  const v = zaehleTopPrios(t)
  expect(v.map(e => [e.titel, e.rest])).toEqual([['D1', 'Grundlast Plan'], ['Speed', 'Ladezeit']])
  expect(v[0]!.links.map(l => l.href)).toEqual(['https://x.org/a'])
})

test('zaehleTopPrios: ohne Abschnitt leer', () => {
  expect(zaehleTopPrios('# Stand\n## In Arbeit\n- **x** — y\n')).toEqual([])
  expect(zaehleTopPrios('')).toEqual([])
})
