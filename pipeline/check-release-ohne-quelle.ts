/** Fixture-Test des Wächters „jedes Release trägt mindestens eine Quelle“ (`check-angebot-bestand.ts`). */
import assert from 'node:assert/strict'
import type { Release } from '../shared/types.ts'
import { releasesOhneQuelle } from './lib/release-ohne-quelle.ts'

const r = (slug: string, sources?: unknown): Release => ({ slug, ...(sources === undefined ? {} : { sources }) }) as unknown as Release
const quelle = [{ name: 'x', url: 'https://example.org/a' }]

assert.deepEqual(releasesOhneQuelle([r('gut-1', quelle), r('fehlt-1'), r('gut-2', quelle), r('leer-1', [])]), ['fehlt-1', 'leer-1'])
assert.deepEqual(releasesOhneQuelle([r('fehlt-2')]), ['fehlt-2'])
assert.deepEqual(releasesOhneQuelle([r('leer-2', [])]), ['leer-2'])
assert.deepEqual(releasesOhneQuelle([r('kein-array', 'x')]), ['kein-array'])
assert.deepEqual(releasesOhneQuelle([r('eine', quelle)]), [])
assert.deepEqual(releasesOhneQuelle([]), [])
console.log('Release ohne Quelle: 6 Fälle ok')
