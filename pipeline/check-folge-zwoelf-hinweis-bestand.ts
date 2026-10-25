/**
 * Bestandsteil von `check-folge-zwoelf-hinweis.ts`: Jede Notiz (`note`) der kuratierten Einträge unter `data/curated/` ist Text, kein Objekt und keine Liste;
 * der Kasten im Panel zeigt sie als Satz. Die Notiz selbst wird nicht verlangt. Liest die echte Handdatei (oder die Kulisse unter `AK_ROOT`), deshalb in `check:bestand`.
 */
import { loadCurated } from './lib/curated.ts'

const kuratiert = loadCurated() as { slug?: string; note?: unknown }[]
const keinText = kuratiert.filter((e) => e.note !== undefined && typeof e.note !== 'string').map((e) => e.slug ?? '(ohne slug)')
if (keinText.length) {
  console.error(`✖ kuratierte Notiz ist kein Text: ${JSON.stringify(keinText)}`)
  console.log(`VERSTÖSSE: ${keinText.length}`)
  process.exit(1)
}
console.log(`  ✓ ${kuratiert.length} kuratierte Einträge, jede Notiz ist Text`)
console.log('VERSTÖSSE: 0')
