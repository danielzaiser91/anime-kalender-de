import { todayIso } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'
import { adressGleich, adressKern, loadDubChecks, type DubCheck } from '../lib/dub-confirmed.ts'
import { bestandVorher } from '../lib/bestand-vorher.ts'
import { kanalTitelOhneBeleg, kanalWegEntfernt, kanalWegVerloren } from '../lib/invarianten-kanal.ts'
import { amazonTitelAdresse } from '../lib/amazon-adresse.ts'
import { kanalAdressenOhneAussage, kanalAdressenOhneBeleg, kanalTitelNurKanal, rohDeutsch } from '../lib/kanal-titel.ts'
import { juengsteJeKern, type LinkBefund } from '../lib/link-befund.ts'
import { readJson } from '../lib/util.ts'
import { terminBelegtNichts } from './09-1-belege.ts'
import { deutschLautAnisearch } from './ohne-beleg.ts'

type Entfernt = { titleId: number; plattform: string; url: string; grund?: string }

/** Hat das Fehlen eines Prime-Wegs eine Spur: Abgang am Titel, Eintrag im Gedächtnis, „nicht verfügbar“-Beleg oder gemessen tote Adresse? */
function primeWegBegruendet(entfernt: Entfernt[], checks: DubCheck[]): (t: Title, urls: string[]) => boolean {
  const befunde = juengsteJeKern(readJson<Record<string, LinkBefund>>('data/link-check.json', {}))
  const gleich = (u: string | undefined, urls: string[]): boolean => urls.some((v) => adressGleich(u, v))
  return (t, urls) =>
    (t.entfernteStreams ?? []).some((s) => s.platform === 'primevideo' && gleich(s.url, urls)) ||
    entfernt.some((e) => e.titleId === t.id && e.plattform === 'primevideo' && gleich(e.url, urls)) ||
    checks.some((c) => c.anilistId === t.id && c.platform === 'primevideo' && c.available === false && (!c.url || gleich(c.url, urls))) ||
    urls.some((u) => [404, 'region'].includes(befunde.get(adressKern(u))?.status as number | string))
}

/**
 * Titel mit gemeldeten Folgen, die auf Prime Deutsch nennen und nicht von einer Kanal-Seite stammen (`rohDeutsch()`, wie `09-3-prime.ts`): ein Ja aus
 * eigener Meldung, nicht aus der Kanal-Adresse. Eine Kanal-Meldung desselben Titels zählt nicht, sonst hielte sie jeden Kanal-Titel frei.
 */
function titelMitFreierMeldung(checks: DubCheck[]): Set<number> {
  type Meldung = { titleId: number; plattform: string; asin: string | null; folgen: { sprachen: string[] }[] }
  const frei = new Set<number>()
  for (const [schluessel, m] of Object.entries(readJson<Record<string, Meldung>>('data/prime-zugeordnet.json', {}))) {
    const url = schluessel.split('#')[0] ?? ''
    const seite = /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\//i.test(url) ? url : m.asin ? amazonTitelAdresse(m.asin) : null
    if (m.plattform === 'primevideo' && rohDeutsch(m.folgen, m.titleId, seite, checks) === true) frei.add(m.titleId)
  }
  return frei
}

/**
 * D-25, D-26 und D-27 (`lib/invarianten-kanal.ts`) an der Auslieferung. Als andere Quelle für D-25 gelten ein Termin bei Prime, der etwas belegt,
 * und aniSearch „deutsch“; bei Titeln mit nur Kanal-Belegen zählen nur der Termin und eine freie Meldung (`titelMitFreierMeldung()`). D-26 liest `data/verweise-entfernt.json`, die der Bau vor dieser Prüfung geschrieben hat (13-2 vor 13-5).
 * D-27 vergleicht mit dem Bestand, der beim Start des Prozesses lag (`lib/bestand-vorher.ts`).
 */
export function kanalFehler(titles: Iterable<Title>, releases: Release[]): string[] {
  const heute = todayIso()
  const alle = [...titles]
  const mitTermin = new Set(releases.filter((r) => r.platform === 'primevideo' && !terminBelegtNichts(r, heute)).map((r) => r.titleId))
  const checks = loadDubChecks()
  const freieMeldung = titelMitFreierMeldung(checks)
  const jeTitel = { nurKanal: kanalTitelNurKanal(checks), primeBelegt: (t: Title) => mitTermin.has(t.id) || freieMeldung.has(t.id) }
  const entfernt = readJson<{ verweise?: Entfernt[] }>('data/verweise-entfernt.json', {}).verweise ?? []
  return [
    ...kanalTitelOhneBeleg(alle, kanalAdressenOhneBeleg(checks), (t) => mitTermin.has(t.id) || deutschLautAnisearch(t), jeTitel),
    ...kanalWegEntfernt(entfernt, kanalAdressenOhneAussage(checks)),
    ...kanalWegVerloren(bestandVorher(), alle, kanalAdressenOhneBeleg(checks), primeWegBegruendet(entfernt, checks)),
  ]
}
