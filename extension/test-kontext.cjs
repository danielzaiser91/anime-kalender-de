/*
  Testgerüst (per `node --require` vom Läufer `tools/extension-tests.mjs` geladen, kein Test): Die Content-Scripts
  lesen `chrome.*` nur über `akKontext` (`kontext.js`, im Manifest als Erstes geladen). Die Tests laden einzelne
  Dateien in eigene Sandkästen — dieses Gerüst lädt `kontext.js` zuerst in jeden Sandkasten, dessen Code
  `akKontext` braucht und der es nicht selbst mitbringt.
*/
const vm = require('node:vm')
const { readFileSync } = require('node:fs')

const KONTEXT = readFileSync(`${__dirname}/kontext.js`, 'utf8')

function brauchtKontext(code, kontext) {
  if (code === KONTEXT || !String(code).includes('akKontext')) return false
  try {
    return vm.runInContext('typeof globalThis.akKontext', kontext) !== 'object'
  } catch {
    return false
  }
}

for (const name of ['runInContext', 'runInNewContext']) {
  const original = vm[name]
  vm[name] = function (code, kontext, ...rest) {
    if (name === 'runInNewContext') kontext = vm.createContext(kontext ?? {})
    if (brauchtKontext(code, kontext)) {
      try {
        /* Eine Test-Kulisse ohne `runtime.id` stellt einen lebenden Kontext dar. */
        original.call(vm, "if (typeof chrome === 'object' && chrome) { chrome.runtime ??= {}; chrome.runtime.id ??= 'test' }", kontext)
        original.call(vm, KONTEXT, kontext, { filename: 'kontext.js' })
      } catch {
        /* Sandkasten ohne `globalThis`: dort braucht der Code `akKontext` ohnehin nicht. */
      }
    }
    return original.call(vm, code, kontext, ...rest)
  }
}
