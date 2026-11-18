/**
 * **Staffelzählung des Knopfes: mit Worker-Stand urteilt `fertig`, ohne Stand zählt der Tot-Vermerk als Rückfall.**
 *
 * Ruft die echte `akNetflixOffeneStaffeln` aus `netflix-staffelzaehlung.js` auf (Dateiname aus der
 * Manifest-Reihenfolge, nicht von Hand). Zwei Titel mit je zwei offenen Staffeln: einer mit Tot-Vermerk,
 * einer ohne; `fertig` urteilt nur über den zweiten.
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

const titel = { 111: { name: 'tot' }, 222: { name: 'offen' } }
const bau = (mitStand, fertigIds = []) =>
  zaehle(titel, {
    mitStand,
    fertig: (id) => fertigIds.includes(id),
    erledigtTot: (id) => id === '111',
    staffelnVon: () => ['S1', 'S2'],
    empfohleneFolgen: (e) => e.staffeln,
    kuerzelErledigt: () => false,
  })

console.log('Staffelzählung: Stand gegen Tot-Vermerk')
pruefe('ohne Stand: der Tot-Vermerk nimmt seine Staffeln aus der Zählung', bau(false) === 2, bau(false))
pruefe('mit Stand: der Tot-Vermerk zählt nicht, `fertig` entscheidet (beide offen)', bau(true) === 4, bau(true))
pruefe('mit Stand: `fertig` nimmt den zweiten Titel heraus, der tote bleibt offen', bau(true, ['222']) === 2, bau(true, ['222']))
pruefe('mit Stand: beide fertig, nichts offen', bau(true, ['111', '222']) === 0, bau(true, ['111', '222']))
pruefe('ohne Stand: `fertig` wird nicht gefragt', bau(false, ['222']) === 2, bau(false, ['222']))

const fehlt = faelle.filter((ok) => !ok).length
console.log(`netflix-staffelzaehlung.test.cjs — ${faelle.length} Zusicherungen`)
if (fehlt) process.exit(1)
