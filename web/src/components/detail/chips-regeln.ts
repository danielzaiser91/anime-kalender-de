import type { PlatformId, Release, StreamLink, Title } from '@shared/types.ts'
import { adressKern } from '@shared/adresse-kern.ts'
import { verlagIstAnbieter } from '@shared/verlag-anbieter.ts'
import { anbieterWegMitJa } from '@shared/kanal-anbieter.ts'

type OhneDe = NonNullable<Title['ausgabenOhneDe']>[number]

/**
 * Die Seite hinter einer Adresse: `adressKern` (Bau und Panel vergleichen Adressen gleich — Amazon-Kennung, gti, YouTube-Video)
 * ohne das Sprachsegment vor dem Pfad. Crunchyroll führt `/de/series/X` und `/series/X`, Disney+ `/de-de/browse/…` auf dieselbe Seite.
 * Das Segment fällt nur weg, wenn es eine Sprache ist und ein bekannter Pfadanfang folgt.
 */
export function seitenKern(url: string): string {
  return adressKern(url).replace(/^([^/]+)\/(?:de|en|fr|es|it|pt|ru|ar|pl|tr|ja|ko|hi|nl)(?:-[a-z0-9]{2,3})?(?=\/(?:series|watch|browse|title|video|movies?)\/)/, '$1')
}

/**
 * **Die Ausgabe ohne Deutsch, die ein anderer Chip schon trägt, steht nicht noch einmal da** (Daniel, 14.10.2026, Snowball Earth:
 * durchgestrichenes „Crunchyroll“ neben dem normalen, beide auf dieselbe Serie). Verglichen wird mit jedem Verweis und
 * Bezugsweg des Titels; eine andere Adresse (Digimon, andere Prime-Kennung) bleibt.
 */
export function ausgabenOhneDeSichtbar(title: Pick<Title, 'ausgabenOhneDe' | 'streams' | 'watchLinks'>): OhneDe[] {
  const schon = new Set([...(title.streams ?? []).map((s) => s.url), ...(title.watchLinks ?? []).map((w) => w.url)].map(seitenKern))
  return (title.ausgabenOhneDe ?? []).filter((a) => !schon.has(seitenKern(a.url)))
}

/**
 * **Der Anbieter-Weg, dessen deutsches Ja ein Prime-Kanal-Termin erbt** (Daniel, 13.10.2026: „Prime Video (Crunchyroll)“ ist so
 * deutsch wie Crunchyroll — der Bau erbt es für Verweise, `kanalErbtVomAnbieter`). Ein Termin hat keinen Verweis, den der Bau erben
 * lassen könnte; ohne Ja des Anbieters, bei einer ausdrücklichen Ausgabe ohne Deutsch über diesen Kanal und bei einem Termin, dessen
 * Quelle nur OmU nennt, bleibt er ohne Urteil.
 */
export function kanalTerminQuelle(release: Pick<Release, 'platform' | 'kanal' | 'sprache'>, title: Pick<Title, 'streams' | 'ausgabenOhneDe'>): StreamLink | undefined {
  if (!release.kanal || release.sprache === 'omu') return undefined
  const kanalNein = (title.ausgabenOhneDe ?? []).some((a) => a.platform === release.platform && a.kanal?.toLowerCase() === release.kanal!.toLowerCase())
  return kanalNein ? undefined : anbieterWegMitJa(release, title.streams ?? [])
}

/**
 * Der früheste belegte Beginn dieses Anbieters aus den Terminen des Titels; ohne belegten Termin `undefined`. Discs zählen nicht,
 * ein abgeleitetes Datum (`estimated`) auch nicht (Snowball Earth trug bei Crunchyroll „seit 20.07.2026“, Deutsch gab es erst im
 * Herbst), und ein Termin, dessen Quelle nur OmU nennt, ist kein Beginn auf Deutsch.
 */
export function seitDatumVon(platform: string, releases: Release[]): string | undefined {
  return releases
    .filter((r) => r.platform === platform && r.releaseType !== 'disc' && !r.schedule?.estimated && r.sprache !== 'omu')
    .map((r) => r.schedule?.firstEpisodeDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
}

/**
 * Nennt der Kasten über den Pillen dasselbe Datum für denselben Anbieter schon? „Bei Prime Video im Angebot seit X“ (`angebotSeit`)
 * oder „Auf Deutsch seit X · <Verlag>“ (`deErstausgabe`, der Verlag ist der Anbieter: `verlagIstAnbieter`). Keine Information zweimal.
 */
export function kastenNenntSeit(title: Pick<Title, 'angebotSeit' | 'deErstausgabe'>, platform: string, datum: string): boolean {
  if (title.angebotSeit?.platform === platform && title.angebotSeit.date === datum) return true
  return title.deErstausgabe?.von === datum && verlagIstAnbieter(title.deErstausgabe.publisher, platform as PlatformId)
}

/** Das „seit“ einer Stream-Pille: der belegte Beginn des Anbieters, sofern der Kasten ihn nicht schon nennt. */
export function seitDatumFuerPille(title: Pick<Title, 'angebotSeit' | 'deErstausgabe'>, platform: string, releases: Release[]): string | undefined {
  const datum = seitDatumVon(platform, releases)
  return datum && !kastenNenntSeit(title, platform, datum) ? datum : undefined
}
