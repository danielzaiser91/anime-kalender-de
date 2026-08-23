/**
 * Hält jede Handprüfung gegen den gebauten Datensatz.
 *
 * ## Warum es das gibt
 *
 * `data/dub-confirmed.yaml` enthält **1.946 Angaben, die Daniel selbst geprüft
 * hat** — Verweis geöffnet, Tonspur nachgesehen. Das ist die einzige Quelle im
 * Projekt, die weder rät noch schweigt, und mit Abstand die teuerste: Sie
 * kostet seine Zeit, nicht Rechenzeit.
 *
 * Daniel am 23.08.2026: „Die von mir gestern von hand gemeldeten netflix titel
 * per extension, sind aktuelle echte infos. beim nächsten automatischen lauf
 * könnten die mit falschen daten überschrieben werden, wenn die quellen falsche
 * daten haben."
 *
 * Der Schutz dagegen steht in `pipeline/build.ts` an drei Stellen als
 * `if (stream.dub !== undefined) continue` — also in einer **Reihenfolge**, und
 * Reihenfolgen brechen leise. Wer eine Quelle nach oben zieht oder die
 * Bedingung vergisst, bemerkt nichts: Der Datensatz sieht danach genauso
 * vollständig aus, nur steht an einzelnen Stellen die Vermutung einer Quelle,
 * wo eine Messung stand. Diese Prüfung macht daraus eine Zusicherung.
 *
 * ## Was hier absichtlich **nicht** als Fehler gilt
 *
 * Ein Titel kann mehrere Einträge tragen — je Anbieter einen, und je Bereich
 * einen (`dubRanges`, etwa „Folge 1–155 deutsch"). Ein einzelnes `dub: false`
 * heißt dann nicht, dass der Verweis verschwinden muss: Es kann für eine
 * Staffel gelten, während eine andere unter derselben Adresse deutsch läuft.
 * Gemeldet wird deshalb nur, wo **alle** Belege eines Verweises in dieselbe
 * Richtung zeigen und der Datensatz trotzdem etwas anderes sagt.
 *
 * Aufruf: npm run check:handbelege
 */
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { readJson, log, warn, ROOT } from './lib/util.ts'
import { resolve } from 'node:path'
import type { Title } from '../shared/types.ts'

const roh = readJson<Title[] | Record<string, Title>>(resolve(ROOT, 'public/data/titles.json'), [])
const titel = Array.isArray(roh) ? roh : Object.values(roh)
const nachId = new Map(titel.map((t) => [t.id, t]))

const belege = loadDubChecks()

/** Alle Belege eines Verweises zusammen — ein Verweis, nicht ein Eintrag. */
const jeVerweis = new Map<string, typeof belege>()
for (const b of belege) {
  const k = `${b.anilistId}:${b.platform}`
  jeVerweis.set(k, [...(jeVerweis.get(k) ?? []), b])
}

const fehler: string[] = []
let bestaetigt = 0
let entferntWieVorgesehen = 0
let uneindeutig = 0

for (const [k, gruppe] of jeVerweis) {
  const [idRoh, platform] = k.split(':')
  const t = nachId.get(Number(idRoh))
  if (!t) continue
  const stream = (t.streams ?? []).find((s) => s.platform === platform)
  const name = `${idRoh} (${t.titleRomaji ?? '?'}) — ${platform}`

  const sagtJa = gruppe.some((b) => b.dub === true || (b.dubRanges ?? []).some((r) => r.dub))
  const sagtNein = gruppe.some((b) => b.dub === false)
  const sagtWeg = gruppe.some((b) => b.available === false)

  // Widersprüchliche Belege sind kein Pipeline-Fehler, sondern ein Hinweis auf
  // Bereiche. Sie werden gezählt, nicht gemeldet.
  if (sagtJa && (sagtNein || sagtWeg)) {
    uneindeutig++
    continue
  }

  if (sagtWeg || sagtNein) {
    if (stream) fehler.push(`${name}: als „${sagtWeg ? 'nicht verfügbar' : 'ohne deutsche Tonspur'}" geprüft, steht aber noch im Datensatz`)
    else entferntWieVorgesehen++
    continue
  }

  if (!sagtJa) continue
  if (!stream) {
    // Kein Fehler der Rangfolge: Der Verweis kann aus einem anderen Grund
    // fehlen (Anbieter nicht geführt, Titel umsortiert). Trotzdem sichtbar.
    uneindeutig++
    continue
  }
  if (stream.dub !== true) {
    fehler.push(`${name}: von Hand als deutsch geprüft, im Datensatz steht dub=${String(stream.dub)}`)
    continue
  }
  bestaetigt++
}

log(`Handprüfungen: ${belege.length} Einträge auf ${jeVerweis.size} Verweise`)
log(`  im Datensatz bestätigt : ${bestaetigt}`)
log(`  korrekt entfernt       : ${entferntWieVorgesehen}`)
log(`  uneindeutig (Bereiche) : ${uneindeutig} — nicht bewertet`)

if (fehler.length) {
  warn(`${fehler.length} Handprüfungen werden vom Datensatz nicht wiedergegeben:`)
  for (const f of fehler.slice(0, 25)) warn('   ' + f)
  if (fehler.length > 25) warn(`   … und ${fehler.length - 25} weitere`)
  process.exit(1)
}
log('✓ Jede eindeutige Handprüfung steht so im Datensatz, wie sie geprüft wurde.')
