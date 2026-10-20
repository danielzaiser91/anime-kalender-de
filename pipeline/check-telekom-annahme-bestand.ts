/**
 * Zusicherungen zur Telekom-Annahme am gebauten Bestand (13.10.2026): Jeder Videoload-Weg und jeder MagentaTV-Kaufweg mit
 * Deutsch-`dubRanges` ist entweder gekennzeichnet (Annahme) oder trägt einen Beleg; die Annahme steht nur an Telekom-Wegen;
 * kein Titel hängt mit seiner Antwort allein an der Annahme (der Kasten zählt sie ohnehin nicht, `belegteBereiche`).
 * Läuft in `check:bestand` (nach dem Bau). Die Regel selbst prüft `check-telekom-annahme.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { telekomFehler, zwillingFehler } from './lib/telekom-annahme.ts'
import { schwesterFehler } from './lib/schwester-shop.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const OUT = 'public/data/titles.json'
if (!existsSync(OUT)) {
  console.error(`FEHLER: ${OUT} fehlt — erst bauen`)
  process.exit(1)
}
const titel = readJson<Title[]>(OUT, [])
const angenommen = (t: Title) => (t.watchLinks ?? []).filter((w) => w.dubAbgeleitet === 'telekom-annahme')
const anderswoDeutsch = (t: Title): boolean =>
  (t.streams ?? []).some((s) => s.dub === true) ||
  Boolean(t.hasVoices) ||
  Boolean(t.deErstausgabe?.synchro) ||
  (t.watchLinks ?? []).some((w) => w.dubAbgeleitet !== 'telekom-annahme' && w.dubRanges?.some((r) => r.dub))
const telekomRot = meldeVerletzte(titel, 'telekom-annahme', 'Annahme an fremdem Weg oder ohne reine Deutsch-Bereiche', (t) => telekomFehler([t]).length > 0)
pruefe('Bestand: Annahme nur an Telekom-Wegen, nur mit reinen Deutsch-Bereichen', telekomRot.length === 0, telekomFehler(titel)[0])
const schwesterRot = meldeVerletzte(titel, 'telekom-annahme', 'freenet-Kennzeichnung unzulässig', (t) => schwesterFehler([t]).length > 0)
pruefe('Bestand: freenet-Kennzeichnung weiter zulässig', schwesterRot.length === 0, schwesterFehler(titel)[0])
const nurAnnahme = meldeVerletzte(titel, 'telekom-annahme', 'Deutsch-Antwort hängt allein an der Annahme', (t) => angenommen(t).length > 0 && !anderswoDeutsch(t))
pruefe('Bestand: kein Titel hängt mit seiner Deutsch-Antwort allein an der Annahme', nurAnnahme.length === 0, nurAnnahme.map((t) => t.id).slice(0, 5).join(','))
const ersetzbar = meldeVerletzte(titel, 'telekom-annahme', 'Annahme, obwohl der MagentaTV-Zwilling gemessen hat', (t) => zwillingFehler([t]).length > 0)
pruefe('Bestand: keine Annahme, wo der MagentaTV-Zwilling (gleiche Gracenote-Kennung) gemessenes Deutsch hat', ersetzbar.length === 0, zwillingFehler(titel)[0])
console.log(`  ${titel.filter((t) => angenommen(t).length).length} Titel mit Telekom-Annahme`)
if (fehler) process.exit(1)
