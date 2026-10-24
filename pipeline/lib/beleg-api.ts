/**
 * **Ein API-Beleg zeigt, was gemessen wurde, nicht die Maschinenadresse** (Daniel, 19.10.2026, Madoka Magica).
 *
 * ADNs Kalender (`gw.api.…/video/calendar`) belegt einen Termin, ist aber keine Seite: ohne `date` antwortet er mit
 * 400 Bad Request, und der Reiter trug nur „Quelle: ADN API.“. Der Beleg bleibt (die Adresse ist sein Schlüssel),
 * bekommt aber die gemessenen Felder des Termins und als „Originalseite“ die öffentliche Serienseite.
 */
import type { NewsBeleg, NewsEintrag, Release } from '../../shared/types.ts'
import { istApiAdresse } from '../../shared/quelle.ts'
import { formatDate } from '../../shared/time.ts'

/** Die Serienseite aus der Folgen-Adresse („…/video/1318-name/29565-folge-1“ → „…/video/1318-name“); sonst keine. */
export function adnSerienseite(release: Release): string | undefined {
  const url = release.platformUrl
  if (release.platform !== 'adn' || !url || !/animationdigitalnetwork\.com\/de\/video\//.test(url)) return undefined
  return url.replace(/(\/video\/[^/]+)\/\d+-[^/]*$/, '$1')
}

/**
 * Die Folgenzeile: Nummern nur, wenn der Termin sie trägt (`firstEpisodeNumber`; ADN-Blöcke beginnen nicht immer bei Folge 1),
 * sonst die gezählten Folgen; eine angenommene Zahl steht nicht da.
 */
function folgenZeile(s: Release['schedule'] | undefined): string[] {
  const anzahl = s?.episodeCountAssumed ? undefined : s?.episodeCount
  const von = s?.firstEpisodeNumber
  if (von !== undefined) return [anzahl && anzahl > 1 ? `Folge ${von} bis ${von + anzahl - 1}` : `Folge ${von}`]
  if (!anzahl) return []
  return [anzahl === 1 ? '1 Folge' : `${anzahl} Folgen`]
}

/** Was ADN zum Termin sagte, Zeile für Zeile — nur, was der Termin trägt: Serie, Folgen, Datum, Sprache (Kalender und Katalog-Lauf führen nur deutsche Folgen). */
export function kalenderZeilen(release: Release): string[] {
  const s = release.schedule
  return [
    `Serie: ${release.name}`,
    ...folgenZeile(s),
    ...(s?.firstEpisodeDate ? [`Datum: ${formatDate(s.firstEpisodeDate)}${s.time && !s.estimated ? `, ${s.time} Uhr` : ''}`] : []),
    'Sprache: Deutsch',
  ]
}

/** Welcher ADN-Endpunkt die Daten des Termins lieferte: der Kalender oder die Folgenliste einer Katalog-Serie (`pipeline/bau/grundlagen.ts`). */
function adnEndpunkt(url: string): string | undefined {
  const m = /^https:\/\/gw\.api\.animationdigitalnetwork\.com\/video\/(calendar|show\/\d+)$/.exec(url)
  if (!m) return undefined
  return m[1] === 'calendar' ? 'ADN-Kalender' : 'ADN-Katalog'
}

/** Der Beleg zur API-Adresse eines ADN-Termins; `gelesenAm` ist der Tag des Abrufs (`Quelle.gelesenAm`), ohne ihn gibt es nichts zu zeigen (`undefined`). */
export function adnApiBeleg(release: Release, url: string, gelesenAm: string | undefined): NewsBeleg | undefined {
  const quelle = adnEndpunkt(url)
  if (!gelesenAm || release.platform !== 'adn' || !quelle) return undefined
  const seite = adnSerienseite(release)
  return {
    url,
    name: quelle,
    messung: { am: gelesenAm, quelle, zeilen: kalenderZeilen(release) },
    ...(seite ? { seite } : {}),
  }
}

/** Ein Beleg zählt, wenn er keine API-Adresse ist oder seine Messung trägt. */
export function apiBelegMitInhalt(b: NewsBeleg): boolean {
  return !istApiAdresse(b.url) || Boolean(b.messung?.zeilen.length)
}

/**
 * Bau-Zusicherung (`belegFehler`): ein Beleg auf eine API-Adresse trägt seine Messung, und die „Originalseite“ ist nie eine API-Adresse.
 * Ohne Messung bliebe nur „Quelle: X.“, ohne Prüfung führte ein Link in „400 Bad Request“.
 */
export function apiBelegFehler(eintraege: NewsEintrag[]): string[] {
  const fehler: string[] = []
  for (const e of eintraege)
    for (const m of e.meldungen)
      for (const b of m.belege ?? []) {
        if (istApiAdresse(b.url) && !b.messung?.zeilen.length) fehler.push(`Belege: ${e.titel} (${e.am}) hat einen Beleg auf die API-Adresse ${b.url} ohne Inhalt`)
        if (b.seite && istApiAdresse(b.seite)) fehler.push(`Belege: ${e.titel} (${e.am}) verweist als Originalseite auf die API-Adresse ${b.seite}`)
      }
  return fehler
}
