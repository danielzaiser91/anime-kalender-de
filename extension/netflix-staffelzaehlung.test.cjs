/**
 * **Staffelzählung des Tooltips: ein Titel, den `fertig()` erledigt nennt, zählt nicht; lokal abgehakte Kürzel auch nicht.**
 *
 * Ruft die echte `akNetflixOffeneStaffeln` aus `netflix-staffelzaehlung.js` auf (Dateiname aus der
 * Manifest-Reihenfolge, nicht von Hand). Den Aufruf in `uebersichtZeigen` sichert `netflix-tot-vermerk-melder.test.cjs`.
 */
const vm = require('node:vm')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

const kontext = vm.createContext({ globalThis: null })
kontext.globalThis = kontext
ladeSkripte(kontext, skripteBis('netflix-staffelzaehlung.js', { nur: ['netflix-staffelzaehlung.js'] }))
const zaehle = kontext.akNetflixOffeneStaffeln

const titel = { 111: { name: 'a' }, 222: { name: 'b' } }
const bau = (fertigIds = [], abgehakt = []) =>
  zaehle(
    titel,
    (id) => fertigIds.includes(id),
    (id, e) => [`${id}-${e.name}-S1`, `${id}-${e.name}-S2`],
    (e) => e.staffeln,
    (id, k) => abgehakt.includes(k),
  )

console.log('Staffelzählung: fertig() und lokal Abgehaktes')
pruefe('nichts fertig, nichts abgehakt: 4 offene Staffeln', bau() === 4, bau())
pruefe('fertig() nimmt den ersten Titel heraus: 2', bau(['111']) === 2, bau(['111']))
pruefe('fertig() nimmt den zweiten Titel heraus: 2', bau(['222']) === 2, bau(['222']))
pruefe('beide fertig: 0', bau(['111', '222']) === 0, bau(['111', '222']))
pruefe('ein Kürzel lokal abgehakt (kuerzelErledigt ≠ immer false): 3', bau([], ['222-b-S2']) === 3, bau([], ['222-b-S2']))
pruefe('alle Kürzel abgehakt: 0', bau([], ['111-a-S1', '111-a-S2', '222-b-S1', '222-b-S2']) === 0, bau())
pruefe('die Staffeln kommen aus staffelnVon(id, eintrag) (Kürzel tragen Kennung und Name)', bau([], ['111-a-S1']) === 3, bau([], ['111-a-S1']))

const fehlt = faelle.filter((ok) => !ok).length
console.log(`netflix-staffelzaehlung.test.cjs — ${faelle.length} Zusicherungen`)
if (fehlt) process.exit(1)
