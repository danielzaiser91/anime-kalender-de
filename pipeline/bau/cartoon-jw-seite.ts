/**
 * „Deutsch laut JustWatch“ je Seite für Cartoons (Regel in `lib/jw-seite.ts`, Ablauf in `jw-seite-ton.ts`). Läuft nach
 * `setzeStaffeln`, weil die Zahl unserer Staffeln mitentscheidet: Ein Cartoon ist die ganze Serie, das Serien-„de“ gilt nur bei
 * einer Staffel. Mehrere Staffeln behalten den Hinweis am Titel (`dubHinweis`) und je Staffel (`cartoon-wege.ts`).
 */
import { readJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import type { DubCheck } from '../lib/dub-confirmed.ts'
import type { MeldungEintrag, UrteilEintrag } from '../lib/haken-beleg.ts'
import { leseZugeordnet } from '../lib/prime-meldung-riegel.ts'
import type { JwBefund } from '../lib/jw-vertrauen.ts'
import { kennzeichneJwSeiten } from './jw-seite-ton.ts'
import { messungAusBelegen, neinAdressenAus } from './jw-seite-messung.ts'
import { schreibeJwWidersprueche } from './jw-widerspruchs-liste.ts'
import { logJwSeiten } from './11-6-jw-vertrauen.ts'

export function kennzeichneCartoonJwSeiten(titel: Title[], belege: DubCheck[]): void {
  const urteile = readJson<Record<string, UrteilEintrag>>('data/urteile.json', {})
  const meldungen = leseZugeordnet<MeldungEintrag>()
  const ergebnis = kennzeichneJwSeiten({
    titel,
    befunde: readJson<Record<string, JwBefund>>('data/justwatch-audio.json', {}),
    heute: todayIso(),
    messung: messungAusBelegen(belege, urteile, meldungen),
    neinAdressen: neinAdressenAus(belege),
    hinweisNurSerie: false,
  })
  logJwSeiten('Cartoons', ergebnis)
  schreibeJwWidersprueche('Cartoons', ergebnis)
}
