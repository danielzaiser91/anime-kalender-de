import { todayIso } from '../shared/time.ts'
import { gibFrei, leseVorrat, VORRAT_MAX_TAGE, veralteterVorrat } from './lib/patchnotes-vorrat.ts'

/**
 * Vorrat der Patch Notes („Patch Notes: vertagt“, Ablauf in docs/wissen/betrieb.md):
 *   npx tsx pipeline/patchnotes-vorrat.ts liste        was liegt im Vorrat, worauf wartet es
 *   npx tsx pipeline/patchnotes-vorrat.ts frei <name>  verschiebt den Eintrag in den Hauptordner; committen setzt den Tag
 */
const [befehl, name] = process.argv.slice(2)
if (befehl === 'liste') {
  const vorrat = leseVorrat()
  for (const d of vorrat) console.log(`${d.name}  seit ${String(d.eintrag.seit)}  wartet auf: ${String(d.eintrag.wartetAuf)}`)
  const alt = veralteterVorrat(vorrat, todayIso())
  console.log(`${vorrat.length} im Vorrat, ${alt.length} länger als ${VORRAT_MAX_TAGE} Tage`)
} else if (befehl === 'frei' && name) {
  console.log(`freigegeben: ${gibFrei(name)} (jetzt committen: der Commit-Tag ist der Tag des Eintrags)`)
} else {
  console.error('Aufruf: npx tsx pipeline/patchnotes-vorrat.ts liste | frei <name>')
  process.exit(1)
}
