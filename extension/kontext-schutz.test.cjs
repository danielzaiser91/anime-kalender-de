/**
 * Wächter für den toten Erweiterungs-Kontext (Daniel, 13.11.2026; vorher 23.08.2026).
 *
 * (a) Ratsche: Kein Content-Script außer `kontext.js` greift roh auf `chrome.*` zu — sonst wirft der erste
 *     Zugriff nach einem Neuladen der Erweiterung („Extension context invalidated", `chrome.storage` undefined).
 * (b) Verhalten: `protokoll.js` erzeugt bei totem Kontext keinen unbehandelten Fehler und keinen Wurf.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* (a) Rohe Zugriffe in Content-Scripts der isolierten Welt (MAIN-Skripte haben kein `chrome`). */
const manifest = JSON.parse(lies('manifest.json'))
const dateien = new Set()
for (const c of manifest.content_scripts) if (c.world !== 'MAIN') c.js.forEach((j) => dateien.add(j))
const ohneKommentare = (q) => q.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
const roh = []
for (const datei of dateien) {
  if (datei === 'kontext.js') continue
  const treffer = ohneKommentare(lies(datei)).match(/\bchrome\s*\??\./g) ?? []
  if (treffer.length) roh.push(`${datei} (${treffer.length})`)
}
pruefe('kontext.js steht im Manifest', dateien.has('kontext.js'))
pruefe('kein Content-Script greift roh auf chrome.* zu', roh.length === 0, roh)
pruefe(
  'kontext.js steht in jeder Gruppe vor allen Nutzern',
  manifest.content_scripts.every(
    (c) => c.world === 'MAIN' || !c.js.some((j) => ohneKommentare(lies(j)).includes('akKontext')) || c.js[0] === 'kontext.js',
  ),
)

/* (b) protokoll.js gegen einen toten Kontext. */
async function lauf(chrome) {
  const unbehandelt = []
  const merke = (e) => unbehandelt.push(String(e?.message ?? e))
  process.on('unhandledRejection', merke)
  const wartend = []
  const k = vm.createContext({
    chrome,
    Date,
    Promise,
    console,
    setTimeout: (f) => wartend.push(f),
  })
  k.globalThis = k
  let wurf = null
  try {
    vm.runInContext(lies('kontext.js'), k)
    vm.runInContext(lies('protokoll.js'), k)
    k.akProtokoll('start', { n: 1 })
    for (const f of wartend.splice(0)) await f()
  } catch (e) {
    wurf = String(e.message)
  }
  await new Promise((r) => setImmediate(r))
  process.off('unhandledRejection', merke)
  return { unbehandelt, wurf, eintraege: k.akProtokoll?.liste?.().length ?? null }
}

const TOT = 'Extension context invalidated.'
;(async () => {
  const ohneStorage = await lauf({})
  pruefe('chrome.storage undefined: kein Wurf, kein unbehandelter Fehler', !ohneStorage.wurf && !ohneStorage.unbehandelt.length, ohneStorage)

  const wirftSynchron = await lauf({
    runtime: { id: 'x' },
    storage: { local: { get: () => { throw new Error(TOT) }, set: () => { throw new Error(TOT) } } },
  })
  pruefe('storage.set wirft synchron: kein Wurf, kein unbehandelter Fehler', !wirftSynchron.wurf && !wirftSynchron.unbehandelt.length, wirftSynchron)

  const lehntAb = await lauf({
    runtime: { id: 'x' },
    storage: { local: { get: () => Promise.reject(new Error(TOT)), set: () => Promise.reject(new Error(TOT)) } },
  })
  pruefe('storage lehnt ab: kein Wurf, kein unbehandelter Fehler', !lehntAb.wurf && !lehntAb.unbehandelt.length, lehntAb)

  const geschrieben = []
  const lebend = await lauf({
    runtime: { id: 'x' },
    storage: { local: { get: async () => ({ akZustandsprotokoll: [{ art: 'alt' }] }), set: async (w) => geschrieben.push(w) } },
  })
  pruefe(
    'lebende Verbindung: altes und neues Ereignis werden geschrieben',
    !lebend.wurf && geschrieben.length === 1 && geschrieben[0].akZustandsprotokoll.length === 2,
    geschrieben,
  )

  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) rot`)
    process.exit(1)
  }
})()
