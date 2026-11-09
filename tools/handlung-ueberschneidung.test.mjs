/** Prüfsatz für tools/handlung-ueberschneidung.mjs: feste Texte, kein Netz. */
import assert from 'node:assert/strict'
import { findeUeberschneidungen, htmlZuText, istAniSearch, pruefeEintrag } from './handlung-ueberschneidung.mjs'

let fehler = 0
async function fall(name, fn) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (e) {
    fehler++
    console.log(`  FEHL ${name}: ${e.message}`)
  }
}

const QUELLE = { name: 'Q', text: 'Der junge Held, Ren, zieht aus; um die Welt zu retten und alle Freunde wiederzufinden.' }

await fall('genau 5 gemeinsame Wörter werden gemeldet', () => {
  const f = findeUeberschneidungen('Er muss um die Welt zu retten kämpfen', [QUELLE])
  assert.equal(f.length, 1)
  assert.equal(f[0].laenge, 5)
  assert.equal(f[0].folge, 'um die welt zu retten')
})

await fall('4 gemeinsame Wörter sind erlaubt (Fenster 5, nicht 4)', () => {
  assert.deepEqual(findeUeberschneidungen('Sie will die Welt zu retten', [QUELLE]), [])
})

await fall('Groß-/Kleinschreibung und Satzzeichen zählen nicht (Normalisierung)', () => {
  const f = findeUeberschneidungen('DER JUNGE HELD — „Ren“ — zieht aus', [QUELLE])
  assert.equal(f.length, 1)
  assert.equal(f[0].folge, 'der junge held ren zieht aus')
  assert.equal(f[0].laenge, 6)
})

await fall('Fund nennt die richtige Quelle bei mehreren Quellen', () => {
  const f = findeUeberschneidungen('der junge held ren zieht aus', [{ name: 'A', text: 'ganz anderer Text' }, QUELLE, { name: 'C', text: 'noch einer' }])
  assert.deepEqual(f.map((x) => x.quelle), ['Q'])
})

await fall('aniSearch-Adressen erkannt, andere nicht', () => {
  assert.equal(istAniSearch('https://www.anisearch.de/anime/13491'), true)
  assert.equal(istAniSearch('https://anisearch.com/anime/1'), true)
  assert.equal(istAniSearch('https://de.wikipedia.org/wiki/Anisearch'), false)
})

await fall('HTML ohne Tags, Skripte entfallen', () => {
  const t = htmlZuText('<p>Eins <b>zwei</b></p><script>var x = "drei vier"</script>')
  assert.match(t, /Eins\s+zwei/)
  assert.doesNotMatch(t, /drei/)
})

await fall('pruefeEintrag: aniSearch nie abgerufen, Fehler übersprungen, Pause je Quelle', async () => {
  const abgerufen = []
  const pausen = []
  const holeText = async (url) => {
    abgerufen.push(url)
    if (url.includes('kaputt')) throw new Error('HTTP 429')
    return QUELLE.text
  }
  const eintrag = {
    id: 1,
    text: 'der junge held ren zieht aus',
    quellen: [
      { name: 'aniSearch', url: 'https://www.anisearch.de/anime/1' },
      { name: 'Kaputt', url: 'https://example.org/kaputt' },
      { name: 'Gut', url: 'https://example.org/gut' },
    ],
  }
  const r = await pruefeEintrag(eintrag, holeText, async (ms) => pausen.push(ms))
  assert.deepEqual(abgerufen, ['https://example.org/kaputt', 'https://example.org/gut'])
  assert.equal(r.funde.length, 1)
  assert.equal(r.uebersprungen.length, 2)
  assert.deepEqual(pausen, [1000, 1000])
})

console.log(fehler ? `${fehler} Fall/Fälle fehlgeschlagen` : 'handlung-ueberschneidung: alle Fälle ok')
process.exit(fehler ? 1 : 0)
