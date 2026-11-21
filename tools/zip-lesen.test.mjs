/** Tests für tools/zip-lesen.mjs: Einträge lesen, Ordner überspringen, kaputte Archive werfen. */
import assert from 'node:assert/strict'
import { leseZip } from './zip-lesen.mjs'
import { baueZip } from './zip-testhilfe.mjs'

const zip = baueZip({ '0_Prüfer-Review.txt': 'Zeile ä\nZwei', 'Prüfer-Review/1_Set up job.txt': 'x'.repeat(5000) })
const m = leseZip(zip)
assert.deepEqual([...m.keys()], ['0_Prüfer-Review.txt', 'Prüfer-Review/1_Set up job.txt'])
assert.equal(m.get('0_Prüfer-Review.txt').toString('utf8'), 'Zeile ä\nZwei')
assert.equal(m.get('Prüfer-Review/1_Set up job.txt').length, 5000)
assert.equal(leseZip(baueZip({})).size, 0)
assert.throws(() => leseZip(Buffer.from('kein zip')), /Ende des Zentralverzeichnisses/)
assert.throws(() => leseZip(zip.subarray(0, 40)), /ZIP/)
console.log('zip-lesen.test: ok')
