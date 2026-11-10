import { test, expect } from 'claude-code/testing'

import { rolleOf } from './rolle'

const a = (type: string, description: string) => ({ type, description })

test('rolleOf: Typ bauer, analyst, pruefer (auch mit Plugin-Präfix)', () => {
  expect(rolleOf(a('bauer', 'x'))).toBe('bauer')
  expect(rolleOf(a('analyst', 'x'))).toBe('analyst')
  expect(rolleOf(a('pruefer', 'x'))).toBe('pruefer')
  expect(rolleOf(a('anime:Bauer', 'x'))).toBe('bauer')
})

test('rolleOf: Beschreibungs-Präfix für general-purpose, auch der Rechercheur', () => {
  expect(rolleOf(a('general-purpose', 'Rechercheur Quellen 3'))).toBe('rechercheur')
  expect(rolleOf(a('general-purpose', ' Bauer PR 3'))).toBe('bauer')
  expect(rolleOf(a('general-purpose', 'Analyst: Lücken'))).toBe('analyst')
  expect(rolleOf(a('general-purpose', 'Prüfer PR 3'))).toBe('pruefer')
  expect(rolleOf(a('savvy-medium', 'Bauer PR 3'))).toBe('bauer')
})

test('rolleOf: keine Rolle bei anderen Typen und Beschreibungen', () => {
  expect(rolleOf(a('general-purpose', 'Der Bauer'))).toBeNull()
  expect(rolleOf(a('general-purpose', 'Bauernhof'))).toBeNull()
  expect(rolleOf(a('savvy-fable', 'Entwurf'))).toBeNull()
  expect(rolleOf(a('Explore', ''))).toBeNull()
})
