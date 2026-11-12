/**
 * Mitschnitt-Skript für Netflix (`tools/netflix-netz-mitschnitt.cjs`): private Angaben sind maskiert, Titelkennungen bleiben.
 * Das Skript ist der Weg, ohne Annahmen zu messen, ob Netflix Titeldaten über eine eigene Anfrage holt (E61, 12.11.2026).
 */
const { resolve } = require('node:path')
const { maskiere, maskiereUrl } = require(resolve(__dirname, '..', 'tools', 'netflix-netz-mitschnitt.cjs'))

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Netflix-Mitschnitt: Maskierung')
const LANG = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdEf'
{
  pruefe('Mailadresse', !/@example\.org/.test(maskiere('Konto: max.muster+x@example.org, ok')) && maskiere('a@b.de').includes('***@***'))
  pruefe('JWT', !maskiere('t=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123').includes('eyJ'))
  pruefe('UUID', maskiere('p 123e4567-e89b-12d3-a456-426614174000 x') === 'p ***uuid*** x')
  pruefe('authURL im JSON', maskiere('{"authURL":"1699999999.abcd/xyz=","a":1}') === '{"authURL":"***","a":1}')
  pruefe('Profilname im JSON (Schlüssel egal in Groß/Klein)', maskiere('{"ProfileName":"Daniela"}') === '{"ProfileName":"***"}' && maskiere('{"firstName":"Max","lastName":"M"}') === '{"firstName":"***","lastName":"***"}')
  pruefe('lange Zufallsfolge (≥ 40 Zeichen)', maskiere(`x ${LANG} y`) === 'x ***lang*** y')
  pruefe('39 Zeichen bleiben (Grenze)', maskiere(`x ${LANG.slice(0, 39)} y`).includes(LANG.slice(0, 39)))
  pruefe('Titelname und Titelkennung bleiben', maskiere('{"title":"Mashle","videoId":81686706}') === '{"title":"Mashle","videoId":81686706}')
  pruefe('null und undefined: leerer Text', maskiere(null) === '' && maskiere(undefined) === '')
}
{
  const u = maskiereUrl('https://www.netflix.com/title/81686706?authURL=abc123&jbv=81686706&esn=NFCDCH-02-XYZ')
  pruefe('Titel-Adresse: Kennung und jbv bleiben, authURL und esn maskiert', u === 'https://www.netflix.com/title/81686706?authURL=***&jbv=81686706&esn=***', u)
  pruefe('relative Adresse wird auf netflix.com bezogen', maskiereUrl('/api/shakti/x/pathEvaluator?method=call').startsWith('https://www.netflix.com/api/shakti/x/pathEvaluator'))
  pruefe('Build-Kennung im Pfad (≥ 40 Zeichen) maskiert', !maskiereUrl(`https://www.netflix.com/api/shakti/${LANG}/pathEvaluator`).includes(LANG))
  pruefe('kaputte Adresse: kein Absturz, gekürzt', typeof maskiereUrl('http://%zz') === 'string' && maskiereUrl('x'.repeat(500)).length <= 400)
  pruefe('Mail in einem Parameterwert', !maskiereUrl('https://www.netflix.com/x?q=a@b.de').includes('a@b.de'))
}

/* --- Das ganze Skript im Browser-Ersatz: fetch wird mitgeschnitten, fremde Hosts nicht, Datei enthält nichts Privates --- */
async function lauf() {
  const vm = require('node:vm')
  const quelle = require('node:fs').readFileSync(resolve(__dirname, '..', 'tools', 'netflix-netz-mitschnitt.cjs'), 'utf8')
  const gespeichert = []
  const antwort = (text) => ({ status: 200, clone: () => ({ text: () => Promise.resolve(text) }) })
  const aufrufe = []
  const window = {
    fetch: (url) => { aufrufe.push(url); return Promise.resolve(antwort(url.includes('pathEvaluator') ? '{"value":{"videos":{"81686706":{"title":"Mashle"}}},"authURL":"geheim123"}' : 'x')) },
  }
  class XHR { open() {} send() {} addEventListener() {} }
  const kontext = {
    window,
    XMLHttpRequest: XHR,
    URL,
    Date,
    JSON,
    Math,
    String,
    Boolean,
    Object,
    console: { log() {} },
    location: { pathname: '/title/81686706', href: 'https://www.netflix.com/title/81686706' },
    document: {
      title: 'Startseite – Netflix',
      querySelector: (s) => (s.includes('backDrop') ? {} : null),
      querySelectorAll: () => [],
      createElement: () => ({ click: () => gespeichert.push('klick') }),
    },
    setInterval: () => 1,
    clearInterval() {},
    Blob: class {
      constructor(teile) {
        gespeichert.push(teile.join(''))
      }
    },
  }
  kontext.URL = Object.assign(function (u, b) { return new URL(u, b) }, { createObjectURL: () => 'blob:x' })
  vm.createContext(kontext)
  vm.runInContext(quelle, kontext)
  await window.fetch('https://www.netflix.com/api/shakti/abc/pathEvaluator?authURL=geheim123&jbv=81686706')
  await window.fetch('https://assets.nflxext.com/x/pathEvaluator')
  await window.fetch('https://www.netflix.com/img/logo.png')
  await new Promise((r) => setImmediate(r))
  const r = window.akNetz()
  const datei = JSON.parse(gespeichert.find((g) => g.startsWith('{')))
  pruefe('Mitschnitt: nur die Netflix-Anfrage ohne Bild steht drin', r.anfragen === 1 && datei.anfragen.length === 1, datei.anfragen.length)
  pruefe('Mitschnitt: Adresse maskiert, Titelkennung bleibt', datei.anfragen[0].url.includes('authURL=***') && datei.anfragen[0].url.includes('jbv=81686706'), datei.anfragen[0].url)
  pruefe('Mitschnitt: Auszug maskiert (kein „geheim123“), Titel im Auszug, Seitenkennung genannt', !JSON.stringify(datei).includes('geheim123') && datei.anfragen[0].auszug.includes('Mashle') && datei.anfragen[0].nenntSeitenId === true, datei.anfragen[0])
  pruefe('Mitschnitt: Fensterlage ist eine Liste (leer, der Takt ist hier abgeschaltet)', Array.isArray(datei.fensterlage))
  pruefe('Mitschnitt: der echte fetch bekam beide Netflix-Adressen und die Fremdadresse unverändert', aufrufe.length === 3)
}

lauf().then(
  () => {
    if (fehler.length) {
      console.log(`\n${fehler.length} Fehler`)
      process.exit(1)
    }
    console.log('\nalle Zusicherungen grün')
  },
  (e) => {
    console.log('✗ Mitschnitt-Lauf abgestürzt', e)
    process.exit(1)
  },
)
