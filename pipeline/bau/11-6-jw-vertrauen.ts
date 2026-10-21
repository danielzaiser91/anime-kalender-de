import { readJson, log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { primeHakenOhneBeleg, primeTitelMitBeleg, type MeldungEintrag, type UrteilEintrag } from '../lib/haken-beleg.ts'
import { leseZugeordnet } from '../lib/prime-meldung-riegel.ts'
import { type JwBefund } from '../lib/jw-vertrauen.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'
import { kennzeichneJwSeiten, type JwSeitenErgebnis } from './jw-seite-ton.ts'
import { messungAusBelegen, neinAdressenAus } from './jw-seite-messung.ts'
import { nurSerieText, schreibeJwWidersprueche } from './jw-widerspruchs-liste.ts'

/**
 * **Wege ohne Urteil bekommen „Deutsch laut JustWatch“, wo JustWatch an genau ihrer Seite deutschen Ton nennt** (alle Anbieter,
 * Regel in `lib/jw-seite.ts`, Ablauf in `jw-seite-ton.ts`). `dub` bleibt offen; Handbeleg, Messurteil, Meldung und Anbieter-API
 * gehen vor. TMDB-mehrdeutige Titel bleiben außen vor, weil ihr JustWatch-Treffer nicht sicher derselbe Titel ist.
 */
export function kennzeichneDeutschLautJustwatch({ titles, tmdbMehrdeutig, alleChecks }: {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
  alleChecks: DubCheck[]
}) {
  const urteile = readJson<Record<string, UrteilEintrag>>('data/urteile.json', {})
  const meldungen = leseZugeordnet<MeldungEintrag>()
  const ergebnis = kennzeichneJwSeiten({
    titel: [...titles.values()],
    befunde: readJson<Record<string, JwBefund>>('data/justwatch-audio.json', {}),
    heute: todayIso(),
    messung: messungAusBelegen(alleChecks, urteile, meldungen),
    neinAdressen: neinAdressenAus(alleChecks),
    ausgenommen: tmdbMehrdeutig,
    hinweisNurSerie: true,
  })
  logJwSeiten('Anime', ergebnis)
  schreibeJwWidersprueche('Anime', ergebnis)
  bestehePrimeHakenNurMitBeleg({ titles, alleChecks, urteile, meldungen })
}

/** Baulog: Flaggen, Hinweise, Widersprüche und je abgeschaltetem Anbieter der Wächter-Anteil. */
export function logJwSeiten(art: string, e: JwSeitenErgebnis): void {
  log(`${art}: ${e.flaggen} Wege „Deutsch laut JustWatch“, ${e.hinweise} nur Hinweis, ${e.widersprueche.length} Widersprüche, ${e.kandidaten.length} Kandidaten ohne Weg`)
  log(`${art}: JustWatch-„de“ nur als Serienangabe, keine Flagge: ${nurSerieText(e)}`)
  for (const anbieter of e.abgeschaltet) {
    const z = e.zaehlung.get(anbieter)!
    log(`WÄCHTER ${art}: ${anbieter} ${z.widerspruch}/${z.gemessen} Widersprüche gegen JustWatch „de“ — in diesem Bau nur Hinweis`)
  }
}

/** Zusicherung: kein Prime-Weg trägt ein volles Häkchen ohne Handbeleg, Messurteil oder Meldung — sonst bricht der Bau ab. */
function bestehePrimeHakenNurMitBeleg({ titles, alleChecks, urteile, meldungen }: {
  titles: Map<number, Title>
  alleChecks: DubCheck[]
  urteile: Record<string, UrteilEintrag>
  meldungen: Record<string, MeldungEintrag>
}) {
  const fehler = primeHakenOhneBeleg(titles.values(), primeTitelMitBeleg(alleChecks, urteile, meldungen))
  brichAbBeiWiderspruch(fehler, 'Prime-Wege mit vollem Häkchen ohne Beleg — nichts geschrieben.')
}
