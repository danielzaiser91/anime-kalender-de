/** Zusicherungen für die News im Panel (`meldungenImPanel`): vorbeigegangene Termin-Meldung fällt weg, außer die Serie läuft noch. */
import { laeuftFuerSlug, meldungenImPanel } from '../web/src/components/detail/neuigkeiten-regeln.ts'
import type { NewsEintrag, Release } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-11'
const TITEL = 7

function release(slug: string, lastEpisodeDate?: string): [string, Release] {
  return [slug, { slug, schedule: { lastEpisodeDate } } as unknown as Release]
}

/** Eine Start-Meldung (Art `angekuendigt`, Datum vor heute), wie sie ein Cartoon-Termin erzeugt. */
function startMeldung(releaseSlug: string | undefined): NewsEintrag[] {
  return [{ am: '2026-10-01', titelId: TITEL, meldungen: [{ art: 'angekuendigt', datum: '2026-10-05', release: releaseSlug }] }] as unknown as NewsEintrag[]
}

const releases = new Map<string, Release>([
  release('laeuft', '2026-12-31'),
  release('endet-heute', HEUTE),
  release('beendet', '2026-10-10'),
  release('ohne-ende'),
])
const laeuft = laeuftFuerSlug(releases, HEUTE)
const zeigt = (slug: string | undefined, titelId = TITEL) => meldungenImPanel(startMeldung(slug), titelId, HEUTE, laeuft).length

pruefe('läuft noch (letzte Folge nach heute): Start-Meldung bleibt', zeigt('laeuft') === 1)
pruefe('letzte Folge heute: Start-Meldung bleibt', zeigt('endet-heute') === 1)
pruefe('beendet (letzte Folge vor heute): Start-Meldung fällt weg', zeigt('beendet') === 0)
pruefe('ohne belegtes Ende: Start-Meldung fällt weg', zeigt('ohne-ende') === 0)
pruefe('unbekannter Slug: Start-Meldung fällt weg', zeigt('gibt-es-nicht') === 0)
pruefe('Meldung ohne Release: fällt weg', zeigt(undefined) === 0)
pruefe('fremder Titel: nie im Panel, auch wenn die Serie läuft', zeigt('laeuft', TITEL + 1) === 0)
pruefe(
  'ohne Laufend-Auskunft bleibt das alte Verhalten (vorbei = weg)',
  meldungenImPanel(startMeldung('laeuft'), TITEL, HEUTE).length === 0,
)
pruefe(
  'kommender Termin bleibt ohnehin',
  meldungenImPanel(
    [{ am: '2026-10-01', titelId: TITEL, meldungen: [{ art: 'angekuendigt', datum: '2026-11-01' }] }] as unknown as NewsEintrag[],
    TITEL,
    HEUTE,
    laeuft,
  ).length === 1,
)

if (fehler) {
  console.error(`check-neuigkeiten-panel: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-neuigkeiten-panel: alles grün')
