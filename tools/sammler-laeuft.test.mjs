import assert from 'node:assert/strict'
import { laufendeSammler } from './sammler-laeuft.mjs'

// Grenzen: Prüfkette, Prüfer, Deploy zählen nicht; Bestandsbau und Sammler zählen.
assert.deepEqual(laufendeSammler([]), [])
assert.deepEqual(laufendeSammler(['PR-Prüfkette', 'PR-Prüfer', 'Aussehen prüfen']), [])
assert.deepEqual(laufendeSammler(['Deploy auf GitHub Pages']), [])
assert.deepEqual(laufendeSammler(['Deploy auf GitHub Pages (Vorschau)']), ['Deploy auf GitHub Pages (Vorschau)'])
assert.deepEqual(laufendeSammler(['Bestand — zusammenführen und bauen']), ['Bestand — zusammenführen und bauen'])
assert.deepEqual(laufendeSammler(['Stündlich — Sendezeiten']), ['Stündlich — Sendezeiten'])
assert.deepEqual(laufendeSammler(['Täglich — alle Quellen', 'PR-Prüfkette', 'Täglich — alle Quellen', '']), ['Täglich — alle Quellen'])
assert.deepEqual(laufendeSammler(['Mutationsprobe']), [])
assert.deepEqual(laufendeSammler(['b-Lauf', 'a-Lauf']), ['a-Lauf', 'b-Lauf'])
console.log('sammler-laeuft: 9 Fälle grün')
