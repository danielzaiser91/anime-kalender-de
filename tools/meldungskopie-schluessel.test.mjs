/**
 * Prüft die Verschlüsselung der Meldungskopie (`tools/meldungskopie-schluessel.mjs`) an ihrer Ausgabe:
 * Hin und zurück ergibt dieselben Bytes, ein falscher Schlüssel oder ein verändertes Byte bricht ab, und das Format
 * (HKDF-SHA256 mit Info „meldungskopie“, AES-256-GCM, Nonce vor Etikett vor Geheimtext) ist an einem unabhängig gebauten Wert festgenagelt.
 * Aufruf: node tools/meldungskopie-schluessel.test.mjs
 */
import assert from 'node:assert/strict'
import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { entschluessle, tokenOderAbbruch, verschluessle } from './meldungskopie-schluessel.mjs'

const TOKEN = 'ein-geheimer-lauf-token'
const klar = Buffer.concat([Buffer.from('SQLite format 3\0'), randomBytes(5000), Buffer.from('Ende')])

/* ---- Hin und zurück ---- */
const geheim = verschluessle(klar, TOKEN)
assert.deepEqual(entschluessle(geheim, TOKEN), klar)
assert.equal(geheim.length, 12 + 16 + klar.length)
assert.equal(geheim.includes('SQLite format 3'), false)
assert.deepEqual(entschluessle(verschluessle(Buffer.alloc(0), TOKEN), TOKEN), Buffer.alloc(0))
// Jede Verschlüsselung hat eine eigene Nonce: dieselben Bytes ergeben nie denselben Geheimtext.
assert.notDeepEqual(verschluessle(klar, TOKEN), geheim)

/* ---- Falscher Schlüssel, verändertes Byte, abgeschnittene Datei ---- */
assert.throws(() => entschluessle(geheim, 'anderer-token'), /nicht entschlüsseln/)
for (const stelle of [0, 12, 28, geheim.length - 1]) {
  const kaputt = Buffer.from(geheim)
  kaputt[stelle] ^= 1
  assert.throws(() => entschluessle(kaputt, TOKEN), /nicht entschlüsseln/, `Byte ${stelle} verändert`)
}
assert.throws(() => entschluessle(geheim.subarray(0, geheim.length - 1), TOKEN), /nicht entschlüsseln/)

/* ---- Format: ein unabhängig gebauter Geheimtext muss sich öffnen lassen ---- */
const nonce = randomBytes(12)
const chiffre = createCipheriv('aes-256-gcm', Buffer.from(hkdfSync('sha256', TOKEN, '', 'meldungskopie', 32)), nonce)
const geheimText = Buffer.concat([chiffre.update(klar), chiffre.final()])
assert.deepEqual(entschluessle(Buffer.concat([nonce, chiffre.getAuthTag(), geheimText]), TOKEN), klar)

/* ---- Ohne Token kein Schlüssel ---- */
assert.equal(tokenOderAbbruch({ LAUF_TOKEN: TOKEN }), TOKEN)
for (const umgebung of [{}, { LAUF_TOKEN: '' }]) assert.throws(() => tokenOderAbbruch(umgebung), /LAUF_TOKEN fehlt/)

console.log('meldungskopie-schluessel.test: ok')
