import type { Release, StreamLink, Title } from '@shared/types.ts'
import { anbieterWegMitJa } from '@shared/kanal-anbieter.ts'

type OhneDe = NonNullable<Title['ausgabenOhneDe']>[number]

/**
 * Die Adresse ohne Sprachsegment vor dem Pfad: Crunchyroll führt `/de/series/X` und `/series/X`, Disney+ `/de-de/browse/…`
 * auf dieselbe Seite. Das Segment fällt nur vor einem bekannten Pfadanfang weg — „/dp/B0…“ bei Amazon ist keine Sprache.
 */
export function adresseOhneSprache(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]!
    .replace(/\/$/, '')
    .toLowerCase()
    .replace(/^([^/]+)\/[a-z]{2}(?:-[a-z0-9]{2,3})?(?=\/(?:series|watch|browse|title|video|movies?)\/)/, '$1')
}

/**
 * **Die Ausgabe ohne Deutsch, die ein anderer Chip schon trägt, steht nicht noch einmal da** (Daniel, 14.10.2026, Snowball Earth:
 * durchgestrichenes „Crunchyroll“ neben dem normalen, beide auf dieselbe Serie). Verglichen wird mit jedem Verweis und
 * Bezugsweg des Titels; eine andere Adresse (Digimon, andere Prime-Kennung) bleibt.
 */
export function ausgabenOhneDeSichtbar(title: Pick<Title, 'ausgabenOhneDe' | 'streams' | 'watchLinks'>): OhneDe[] {
  const schon = new Set([...(title.streams ?? []).map((s) => s.url), ...(title.watchLinks ?? []).map((w) => w.url)].map(adresseOhneSprache))
  return (title.ausgabenOhneDe ?? []).filter((a) => !schon.has(adresseOhneSprache(a.url)))
}

/**
 * **Der Anbieter-Weg, dessen deutsches Ja ein Prime-Kanal-Termin erbt** (Daniel, 13.10.2026: „Prime Video (Crunchyroll)“ ist so
 * deutsch wie Crunchyroll — der Bau erbt es für Verweise, `kanalErbtVomAnbieter`). Ein Termin hat keinen Verweis, den der Bau erben
 * lassen könnte; ohne Ja des Anbieters oder bei einer ausdrücklichen Ausgabe ohne Deutsch über diesen Kanal bleibt er ohne Urteil.
 */
export function kanalTerminQuelle(release: Pick<Release, 'platform' | 'kanal'>, title: Pick<Title, 'streams' | 'ausgabenOhneDe'>): StreamLink | undefined {
  if (!release.kanal) return undefined
  const kanalNein = (title.ausgabenOhneDe ?? []).some((a) => a.platform === release.platform && a.kanal?.toLowerCase() === release.kanal!.toLowerCase())
  return kanalNein ? undefined : anbieterWegMitJa(release, title.streams ?? [])
}

/**
 * Der früheste belegte Beginn dieses Anbieters aus den Terminen des Titels; ohne belegten Termin `undefined`. Discs zählen nicht,
 * und ein abgeleitetes Datum (`estimated`) auch nicht: Snowball Earth trug bei Crunchyroll „seit 20.07.2026“, Deutsch gab es erst im Herbst.
 */
export function seitDatumVon(platform: string, releases: Release[]): string | undefined {
  return releases
    .filter((r) => r.platform === platform && r.releaseType !== 'disc' && !r.schedule?.estimated)
    .map((r) => r.schedule?.firstEpisodeDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
}
