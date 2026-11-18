/** Test des kurzlebigen Auslieferers (`dist-http.mjs`): Datei, Ordner-Index, gzip nur bei Text und Annahme, 404, kein Ausbruch aus dem Ordner (auch nicht in einen Geschwister mit gleichem Präfix), kaputtes Escape. */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { distAusliefern } from './dist-http.mjs'

const ordner = mkdtempSync(path.join(tmpdir(), 'dist-http-'))
mkdirSync(path.join(ordner, 't', '21'), { recursive: true })
writeFileSync(path.join(ordner, 'index.html'), '<p>Start</p>')
writeFileSync(path.join(ordner, 't', '21', 'index.html'), '<p>Titel</p>')
writeFileSync(path.join(ordner, 'bild.png'), Buffer.from([1, 2, 3]))
writeFileSync(path.join(tmpdir(), 'dist-http-geheim.txt'), 'geheim')
mkdirSync(`${ordner}-x`)
writeFileSync(path.join(`${ordner}-x`, 'geheim.txt'), 'geheim')

/** GET ohne Netz-Bibliothek; rohe Pfade (`..`) gehen unverändert hinaus. */
function hole(basis, pfad, gzip) {
  return new Promise((fertig, fehler) => {
    const u = new URL(basis)
    const anfrage = request({ host: u.hostname, port: u.port, path: pfad, headers: gzip ? { 'accept-encoding': 'gzip' } : {}, timeout: 10000 }, (antwort) => {
      const teile = []
      antwort.on('data', (d) => teile.push(d))
      antwort.on('end', () => fertig({ status: antwort.statusCode, kopf: antwort.headers, roh: Buffer.concat(teile) }))
    })
    anfrage.on('error', fehler)
    anfrage.end()
  })
}

const { basis, schliessen } = await distAusliefern(ordner)
try {
  assert.match(basis, /^http:\/\/127\.0\.0\.1:\d+\/$/, 'Basis auf 127.0.0.1 mit freiem Port')
  const start = await hole(basis, '/', true)
  assert.equal(start.status, 200, '/ liefert index.html')
  assert.equal(start.kopf['content-encoding'], 'gzip', 'Text gzip, wenn angenommen')
  assert.equal(gunzipSync(start.roh).toString(), '<p>Start</p>')
  const ohneGzip = await hole(basis, '/', false)
  assert.equal(ohneGzip.kopf['content-encoding'], undefined, 'ohne Annahme kein gzip')
  assert.equal(ohneGzip.roh.toString(), '<p>Start</p>')
  const titel = await hole(basis, '/t/21/', false)
  assert.equal(titel.roh.toString(), '<p>Titel</p>', 'Ordner liefert seine index.html (vorgerenderte Seiten)')
  const bild = await hole(basis, '/bild.png', true)
  assert.equal(bild.kopf['content-type'], 'image/png')
  assert.equal(bild.kopf['content-encoding'], undefined, 'Bilder nie gzip')
  assert.equal((await hole(basis, '/fehlt.js', false)).status, 404, 'unbekannte Datei: 404')
  assert.equal((await hole(basis, '/../dist-http-geheim.txt', false)).status, 404, 'kein Ausbruch aus dem Ordner')
  assert.equal((await hole(basis, '/..%2Fdist-http-geheim.txt', false)).status, 404, 'kein Ausbruch über einen kodierten Schrägstrich')
  assert.equal((await hole(basis, `/..%2F${path.basename(ordner)}-x%2Fgeheim.txt`, false)).status, 404, 'kein Ausbruch in einen Geschwisterordner mit gleichem Präfix')
  assert.equal((await hole(basis, '/%zz', false)).status, 404, 'kaputtes Escape: 404')
  assert.equal((await hole(basis, '/', false)).status, 200, 'und der Auslieferer läuft danach weiter')
} finally {
  await schliessen()
  rmSync(ordner, { recursive: true, force: true })
  rmSync(path.join(tmpdir(), 'dist-http-geheim.txt'), { force: true })
  rmSync(`${ordner}-x`, { recursive: true, force: true })
}
console.log('dist-http: 15 Zusicherungen ✓')
