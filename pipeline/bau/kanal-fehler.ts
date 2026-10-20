import { todayIso } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'
import { adressGleich, adressKern, type DubCheck } from '../lib/dub-confirmed.ts'
import { ladeKanalWissen } from '../lib/kanal-wissen.ts'
import { bestandVorher } from '../lib/bestand-vorher.ts'
import { kanalTitelOhneBeleg, kanalWegEntfernt, kanalWegVerloren } from '../lib/invarianten-kanal.ts'
import { kanalAdressenOhneAussage, kanalAdressenOhneBeleg } from '../lib/kanal-titel.ts'
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
 * D-25, D-26 und D-27 (`lib/invarianten-kanal.ts`) an der Auslieferung. Als andere Quelle für D-25 gelten ein Termin bei Prime, der etwas belegt,
 * und aniSearch „deutsch“. D-26 liest `data/verweise-entfernt.json`, die der Bau vor dieser Prüfung geschrieben hat (13-2 vor 13-5).
 * D-27 vergleicht mit dem Bestand, der beim Start des Prozesses lag (`lib/bestand-vorher.ts`).
 */
export function kanalFehler(titles: Iterable<Title>, releases: Release[]): string[] {
  const heute = todayIso()
  const alle = [...titles]
  const mitTermin = new Set(releases.filter((r) => r.platform === 'primevideo' && !terminBelegtNichts(r, heute)).map((r) => r.titleId))
  const checks = ladeKanalWissen()
  const entfernt = readJson<{ verweise?: Entfernt[] }>('data/verweise-entfernt.json', {}).verweise ?? []
  return [
    ...kanalTitelOhneBeleg(alle, kanalAdressenOhneBeleg(checks), (t) => mitTermin.has(t.id) || deutschLautAnisearch(t)),
    ...kanalWegEntfernt(entfernt, kanalAdressenOhneAussage(checks)),
    ...kanalWegVerloren(bestandVorher(), alle, kanalAdressenOhneBeleg(checks), primeWegBegruendet(entfernt, checks)),
  ]
}
