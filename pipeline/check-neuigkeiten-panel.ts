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
const rhythmus = (slug: string) => meldungenImPanel([{ am: '2026-10-10', titelId: TITEL, meldungen: [{ art: 'rhythmus', datum: '2026-10-05', release: slug }] }] as unknown as NewsEintrag[], TITEL, HEUTE, laeuft).length
pruefe('Rhythmus-Meldung: bleibt, solange die Serie läuft, und fällt danach weg', rhythmus('laeuft') === 1 && rhythmus('beendet') === 0)
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

/* Magic Knight Rayearth (26.10.2026): Meldung wörtlich wie in news.json — Start des Originaltons am 07.10. vorbei, Release hängt nicht dran. */
const rayearth = (omu: string | undefined, datum = '2026-10-07'): NewsEintrag[] =>
  [{ am: '2026-09-15', titelId: 178868, meldungen: [{ art: 'angekuendigt', platform: 'crunchyroll', datum, ...(omu ? { omu } : {}) }] }] as unknown as NewsEintrag[]
const rayearthZeilen = (heute: string, omu: string | undefined = 'synchro-angekuendigt', datum?: string) => meldungenImPanel(rayearth(omu, datum), 178868, heute).length
pruefe('angekündigte Synchro: bleibt nach dem Start des Originaltons', rayearthZeilen('2026-10-26') === 1)
pruefe('angekündigte Synchro: letzter Tag der Frist (60 Tage nach Start) bleibt', rayearthZeilen('2026-12-06') === 1)
pruefe('angekündigte Synchro: 61 Tage nach Start fällt weg', rayearthZeilen('2026-12-07') === 0)
pruefe('angekündigte Synchro mit nur genanntem Monat: bleibt in der Frist, fällt danach weg', rayearthZeilen('2026-11-30', 'synchro-angekuendigt', '2026-10') === 1 && rayearthZeilen('2026-12-01', 'synchro-angekuendigt', '2026-10') === 0)
pruefe('Synchro offen (Start vorbei): fällt weg', rayearthZeilen('2026-10-26', 'synchro-offen') === 0)
pruefe('Termin-Meldung ohne Kennzeichen (Start vorbei): fällt weg', rayearthZeilen('2026-10-26', '') === 0)

if (fehler) {
  console.error(`check-neuigkeiten-panel: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-neuigkeiten-panel: alles grün')
