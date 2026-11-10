import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { berichte, pruefeBucket, urteilVonStatus } from './cover-bucket-pruefen.mjs'

const manifest = {
  1: { datei: 'anisearch/1.webp' },
  2: { datei: 'anisearch/2.webp' },
  3: { datei: 'anisearch/3.webp' },
  4: { datei: 'anisearch/4.webp' },
  5: { datei: 'anisearch/5.webp' },
  6: { quelle: 'ohne Datei' },
}
const antworten = { 'anisearch/1.webp': 200, 'anisearch/2.webp': 404, 'anisearch/3.webp': 429, 'anisearch/4.webp': 410, 'anisearch/5.webp': 'wirft' }
const kopf = async (d) => {
  if (antworten[d] === 'wirft') throw new Error('Zeitüberschreitung')
  return antworten[d]
}

assert.deepEqual(['200', '204', '404', '410', '429', '403', '500', '301'].map((s) => urteilVonStatus(Number(s))), ['da', 'da', 'fehlt', 'fehlt', 'unklar', 'unklar', 'unklar', 'unklar'])

for (const breite of [1, 3]) {
  const e = await pruefeBucket(manifest, kopf, breite)
  assert.equal(e.gesamt, 5)
  assert.deepEqual(e.fehlt, ['anisearch/2.webp', 'anisearch/4.webp'])
  assert.deepEqual(e.unklar, ['anisearch/3.webp', 'anisearch/5.webp'])
}

const alleDa = await pruefeBucket({ 1: { datei: 'a.webp' } }, async () => 200)
assert.deepEqual(berichte(alleDa), { zeile: 'Cover-Bucket: 1 Dateien, 0 fehlen, 0 ohne Auskunft', liste: [], code: 0 })
assert.equal(berichte({ gesamt: 3, fehlt: [], unklar: ['x'] }).code, 2)
assert.equal(berichte({ gesamt: 3, fehlt: ['y'], unklar: ['x'] }).code, 1)

// Prozess: echter Aufruf gegen einen lokalen Server, der die 16-Dateien-Lücke nachstellt (Manifest = echte Datei, nur 2 von N fehlen).
const server = createServer((req, res) => {
  res.statusCode = req.url.endsWith('/anisearch/16008.webp') || req.url.endsWith('/anisearch/21510.webp') ? 404 : 200
  res.end()
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const basis = `http://127.0.0.1:${server.address().port}/`
// Asynchron, sonst blockiert der Prozess den Server im selben Thread.
const lauf = (b) => new Promise((ok) => {
  execFile(process.execPath, ['tools/cover-bucket-pruefen.mjs', '--basis', b, '--parallel', '8'], { encoding: 'utf8', timeout: 120000 }, (e, stdout, stderr) => ok({ status: e ? e.code : 0, stdout, stderr }))
})
const rot = await lauf(basis)
server.close()
assert.equal(rot.status, 1, rot.stderr)
assert.match(rot.stdout, /^Cover-Bucket: \d+ Dateien, \d+ fehlen, 0 ohne Auskunft/m)
assert.match(rot.stderr, /fehlt — anisearch\/16008\.webp/)
const blind = await lauf('http://127.0.0.1:1/')
assert.equal(blind.status, 2, blind.stderr)
console.log('cover-bucket-pruefen: alle Fälle grün (Urteil je Status, Nichtauskunft, Prozess rot/blind)')
