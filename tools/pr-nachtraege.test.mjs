/** Tests für tools/pr-nachtraege.mjs: nur Nachträge des Autors, nur am Textanfang, Reihenfolge bleibt. */
import { ergaenzeBeschreibung, waehleNachtraege } from './pr-nachtraege.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}
const k = (login, body) => ({ user: { login }, body })
const treffer = (body) => waehleNachtraege([k('autor', body)], 'autor').length === 1

pruefe('Fremdautor ausgeschlossen', waehleNachtraege([k('fremd', '**Nachtrag Runde 1**')], 'autor').length === 0)
pruefe('**Nachtrag getroffen', treffer('**Nachtrag Runde 2 (Kopf abc):**'))
pruefe('## Nachtrag getroffen', treffer('## Nachtrag Runde 2'))
pruefe('# Nachtrag getroffen', treffer('# Nachtrag Runde 2'))
pruefe('führender Leerraum bei **', treffer('  \n**Nachtrag'))
pruefe('führender Leerraum bei ##', treffer(' \t## Nachtrag'))
pruefe('Nachtrag mitten im Text nicht getroffen', !treffer('Siehe Nachtrag oben'))
pruefe('* Nachtrag nicht getroffen', !treffer('* Nachtrag'))
pruefe('Text vor **Nachtrag in neuer Zeile nicht getroffen', !treffer('Text\n**Nachtrag'))
const drei = [k('autor', '**Nachtrag A'), k('fremd', '**Nachtrag X'), k('autor', 'Plauderei'), k('autor', '## Nachtrag B')]
pruefe('Reihenfolge erhalten', waehleNachtraege(drei, 'autor').join('|') === '**Nachtrag A|## Nachtrag B')
const text = 'Titel: x\n\nBeschreibung'
pruefe('ohne Treffer bleibt der Text unverändert', ergaenzeBeschreibung(text, [k('autor', 'ok'), k('autor', null), k('fremd', '**Nachtrag')], 'autor') === text)
const mit = ergaenzeBeschreibung(text, drei, 'autor')
pruefe('mit Treffern: Text vorn, Nachträge in Reihenfolge angehängt', mit.startsWith(text + '\n\n## Nachträge') && mit.endsWith('**Nachtrag A\n\n## Nachtrag B'))

if (fehler.length) {
  console.error(`pr-nachtraege.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-nachtraege.test: grün')
