/**
 * Lückenlisten: der Kontext trägt `data/tmdb-staffel0.json` als `staffel0` (`mitStaffel0`).
 * Ohne public/data, damit die Prüfung in `check:logic` (vor-commit, PR-CI, Deploy) läuft.
 */
import { mitStaffel0 } from './lib/luecken-kontext.ts'
import { readJson } from './lib/util.ts'

const datei = readJson<Record<string, unknown>>('data/tmdb-staffel0.json', {})
const geladen = mitStaffel0({ heute: '2026-10-14', stimmen: new Map(), tage: new Map(), synopsen: {}, belege: new Map(), hqGrund: new Map(), banner: {}, zuordnung: {}, ak: new Map(), alle: [] }).staffel0
if (!Object.keys(datei).length) {
  console.error('  ✖ data/tmdb-staffel0.json ist leer')
  process.exit(1)
}
if (JSON.stringify(Object.keys(geladen)) !== JSON.stringify(Object.keys(datei))) {
  console.error('  ✖ mitStaffel0 reicht data/tmdb-staffel0.json nicht als staffel0 durch')
  process.exit(1)
}
console.log(`  ✓ Kontext trägt ${Object.keys(datei).length} Staffel-0-Zuordnungen`)
