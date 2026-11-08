/**
 * Test: `--abschnitt=` von panel-bild.mjs (Argument, Selektor, Bild), ohne Browser.
 * Aufruf: node tools/panel-abschnitt.test.mjs  (läuft in check:workflows)
 */
import assert from 'node:assert/strict'
import { abschnittAusArgumenten, abschnittDatei, abschnittSelektor, abschnittsbild, bildeAbschnitt } from './panel-abschnitt.mjs'

assert.equal(abschnittAusArgumenten(['--docs', '161645']), null, 'ohne Argument')
assert.equal(abschnittAusArgumenten(['--abschnitt=Neuigkeiten', '161645']), 'Neuigkeiten')
assert.equal(abschnittAusArgumenten(['x', '--abschnitt= Die Reihe ']), 'Die Reihe', 'Leerraum außen weg')
for (const schlecht of ['--abschnitt=', '--abschnitt=  ', '--abschnitt=a"b', '--abschnitt=a\\b']) {
  assert.throws(() => abschnittAusArgumenten([schlecht]), /--abschnitt=<Überschrift/, schlecht)
}
assert.equal(abschnittSelektor('Reihe'), 'section[aria-label*="Reihe" i]')
assert.equal(abschnittDatei('o', '7', 'Die Reihe!', 'hell'), 'o/panel-7-die-reihe--hell.png')

/** Ein Panel, das nur die Karten kennt, die es hat; merkt sich, was abgebildet wurde. */
function panelMit(karten) {
  const bilder = []
  const panel = {
    bilder,
    locator: (sel) => {
      const treffer = karten.filter((k) => sel === abschnittSelektor(k))
      return {
        first: () => ({ count: async () => treffer.length, screenshot: async ({ path }) => bilder.push(`${treffer[0]}:${path}`) }),
      }
    },
  }
  return panel
}
const mit = panelMit(['Neuigkeiten', 'Reihe'])
assert.equal(await bildeAbschnitt(mit, 'Reihe', 'a.png'), true)
assert.deepEqual(mit.bilder, ['Reihe:a.png'], 'genau die gewählte Karte, nicht die erste')
assert.equal(await bildeAbschnitt(mit, 'Plot', 'b.png'), false, 'Karte fehlt: false, kein Bild')
assert.equal(mit.bilder.length, 1)

// Der Aufruf aus panel-bild: Name aus der Kommandozeile bis zur Datei.
assert.equal(await abschnittsbild(mit, null, 'o', '7', 'hell'), 'aus')
assert.equal(mit.bilder.length, 1, 'ohne Abschnitt kein Bild')
assert.equal(await abschnittsbild(mit, 'Neuigkeiten', 'o', '7', 'dunkel'), 'bild')
assert.equal(mit.bilder[1], 'Neuigkeiten:o/panel-7-neuigkeiten-dunkel.png')
const stumm = console.log
const zeilen = []
console.log = (z) => zeilen.push(z)
assert.equal(await abschnittsbild(mit, 'Plot', 'o', '7', 'hell'), 'fehlt')
console.log = stumm
assert.match(zeilen[0], /7: keine Karte „Plot"/)
console.log('panel-abschnitt.test: grün')
