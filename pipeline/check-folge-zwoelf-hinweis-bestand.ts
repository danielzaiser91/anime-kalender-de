/**
 * Bestandsteil von `check-folge-zwoelf-hinweis.ts`: Jeder Besucherhinweis (`hinweis`) und jede Notiz (`note`) der kuratierten Einträge unter `data/curated/`
 * ist Text, kein Objekt und keine Liste; der Kasten im Panel zeigt den Hinweis als Satz. Ein `hinweis` wird ausgeliefert und nennt deshalb keine Person der Pflege
 * (`PFLEGE`, 26.10.2026: „laut Daniels Sichtung“ im Panel). Der Hinweis selbst wird nicht verlangt. Liest die echte Handdatei (oder die Kulisse unter `AK_ROOT`), deshalb in `check:bestand`.
 */
import { loadCurated } from './lib/curated.ts'
import { PFLEGE } from './lib/interne-angaben.ts'

const kuratiert = loadCurated() as { slug?: string; note?: unknown; hinweis?: unknown }[]
const name = (e: { slug?: string }) => e.slug ?? '(ohne slug)'
const keinText = kuratiert.filter((e) => [e.note, e.hinweis].some((w) => w !== undefined && typeof w !== 'string')).map(name)
const mitPerson = kuratiert.filter((e) => typeof e.hinweis === 'string' && PFLEGE.test(e.hinweis)).map(name)
if (keinText.length) console.error(`✖ kuratierte Notiz oder Hinweis ist kein Text: ${JSON.stringify(keinText)}`)
if (mitPerson.length) console.error(`✖ kuratierter Hinweis nennt eine Person der Pflege: ${JSON.stringify(mitPerson)}`)
if (keinText.length + mitPerson.length) {
  console.log(`VERSTÖSSE: ${keinText.length + mitPerson.length}`)
  process.exit(1)
}
const mitHinweis = kuratiert.filter((e) => typeof e.hinweis === 'string').length
console.log(`  ✓ ${kuratiert.length} kuratierte Einträge, ${mitHinweis} mit Besucherhinweis, jeder Text ohne Person der Pflege`)
console.log('VERSTÖSSE: 0')
