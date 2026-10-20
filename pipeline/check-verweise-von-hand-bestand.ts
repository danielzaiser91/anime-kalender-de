/**
 * Bestandsteil von `check-verweise-von-hand.ts`: Jeder Eintrag der echten `data/verweise-von-hand.yaml` hat Kennung, Anbieter und https-Adresse;
 * `ergaenzeVerweiseVonHand` überspringt unvollständige Einträge still, ein Tippfehler bliebe sonst ohne Wirkung. Läuft in `check:bestand`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './lib/util.ts'

const datei = resolve(ROOT, 'data/verweise-von-hand.yaml')
const roh = existsSync(datei) ? yaml.load(readFileSync(datei, 'utf8')) : []
const eintraege = (Array.isArray(roh) ? roh : []) as { anilistId?: unknown; platform?: unknown; url?: unknown }[]
const unvollstaendig = eintraege
  .map((e, i) => ({ nr: i + 1, e }))
  .filter(({ e }) => !Number.isInteger(e.anilistId) || typeof e.platform !== 'string' || typeof e.url !== 'string' || !e.url.startsWith('https://'))
  .map(({ nr }) => nr)
if (unvollstaendig.length) {
  console.error(`✖ data/verweise-von-hand.yaml: Eintrag Nr. ${unvollstaendig.join(', ')} ohne Kennung, Anbieter oder https-Adresse`)
  process.exit(1)
}
console.log(`  ✓ ${eintraege.length} Handverweis(e), jeder mit Kennung, Anbieter und https-Adresse`)
