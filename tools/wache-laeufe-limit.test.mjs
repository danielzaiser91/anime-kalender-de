#!/usr/bin/env node
// Prüft, dass das Wachen-Dossier die Lauf-Abfrage mit 700 Läufen und der Stapelfrist (30 s) stellt;
// ohne die Frist fiele sie auf 15 s zurück und bräche bei 700 Läufen (gemessen ~17 s) dauerhaft ab.
import assert from 'node:assert/strict'
import { laeufe } from './wache-urteil-dossier.mjs'

assert.equal(process.env.WACHE_LIMIT_MS, undefined, 'Testumgebung ohne Fristüberschreibung')

const aufrufe = []
const fake = (limitMs, ...args) => {
  aufrufe.push({ limitMs, args })
  return '[]'
}

const text = laeufe(fake)
assert.equal(aufrufe.length, 1, 'genau ein gh-Aufruf')
const [{ limitMs, args }] = aufrufe
assert.equal(limitMs, 30000, 'Stapelfrist 30 s')
assert.deepEqual(args.slice(0, 2), ['run', 'list'])
assert.equal(args[args.indexOf('--limit') + 1], '700', '--limit 700')
assert.ok(text.startsWith('Läufe der letzten 48 Stunden (0;'), 'Kopf des Berichts')

console.log('wache-laeufe-limit: ok (--limit 700, Frist 30000 ms)')
