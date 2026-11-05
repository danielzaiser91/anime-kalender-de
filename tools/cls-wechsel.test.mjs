import assert from 'node:assert/strict'
import { clsSumme, GRENZE } from './cls-wechsel.mjs'

// Summe der Verschiebungen, Eingaben ausgenommen (Werte wie vom Messlauf auf main: Fuß 0,2491)
assert.equal(clsSumme([]), 0)
assert.equal(clsSumme([{ value: 0.2491, hadRecentInput: false }]), 0.2491)
assert.equal(clsSumme([{ value: 0.1, hadRecentInput: false }, { value: 0.05, hadRecentInput: false }]), 0.15)
assert.equal(clsSumme([{ value: 0.3, hadRecentInput: true }, { value: 0.02, hadRecentInput: false }]), 0.02)
assert.equal(GRENZE, 0.1)
console.log('cls-wechsel: clsSumme in Ordnung (leer, Summe, Eingabe ausgenommen)')
