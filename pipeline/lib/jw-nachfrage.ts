/**
 * Nachfrage bei JustWatch über den gespeicherten Pfad (`urlV2`), wenn die Namenssuche einen bekannten Titel nicht mehr in den Top 20 liefert.
 * JustWatch führt Titel ohne Angebote oft weiter unter unserer TMDB-Kennung, die Namenssuche liefert sie dann nicht mehr (Rainbow Rangers,
 * City Hunter: Magnum with Love and Fate, Golgo 13: The Professional; gemessen 19.11.2026). Die Detailantwort hat dieselbe Form wie ein Suchtreffer.
 */
import type { fetchJson } from './util.ts'
import { STAFFELN_ABFRAGE } from './jw-staffeln.ts'
import type { JwKnoten } from '../fetch-justwatch-audio.ts'

const NACHFRAGE = `
query Nachfrage($p: String!, $country: Country!, $language: Language!) {
  urlV2(fullPath: $p) {
    node {
      id
      ... on MovieOrShow {
        objectType
        content(country: $country, language: $language) { title originalReleaseYear fullPath ageCertification externalIds { tmdbId } }
        offers(country: $country, platform: WEB) { monetizationType audioLanguages subtitleLanguages standardWebURL package { clearName } }
      }${STAFFELN_ABFRAGE}
    }
  }
}`

interface Vorher { jwId?: string; jwPfad?: string; tmdbId?: number; ohneTreffer?: boolean; verfehltAm?: string }

/** Nachgefragt wird nur bei einem echten alten Befund derselben Kennung, der einen Pfad trägt; ein fremder Befund (Negi) bleibt außen vor. */
export function darfNachfragen(vorher: Vorher | undefined, erwartet: number | undefined): vorher is Vorher & { jwPfad: string } {
  return !!vorher && !vorher.ohneTreffer && !!vorher.jwId && !!vorher.jwPfad && erwartet !== undefined && Number(vorher.tmdbId) === erwartet
}

/** Ein verfehlter Befund, den die Nachfrage holen kann, kommt vor der 28-Tage-Frist wieder (frühestens 7 Tage nach dem Fehlschlag, damit dauerhaft Verschwundene die Schlange nicht füllen); sonst bliebe er bis zum Ablauf offen (Rainbow Rangers, City Hunter, Golgo 13). */
export function nachfrageFaellig(vorher: Vorher | undefined, erwartet: number | undefined, heute: string): boolean {
  return darfNachfragen(vorher, erwartet) && !!vorher.verfehltAm && Date.parse(heute) - Date.parse(vorher.verfehltAm) >= 7 * 86_400_000
}

/**
 * Der Knoten zum Pfad; `undefined` = JustWatch kennt die Adresse nicht (NOT_FOUND) oder der Knoten trägt eine andere TMDB-Kennung als `erwartet`.
 * Jeder andere Fehler wirft (Sperre ist keine Verneinung).
 */
export async function nachfrageUeberPfad(pfad: string, erwartet: number, abruf: typeof fetchJson, endpunkt: string, ua: string): Promise<JwKnoten | undefined> {
  const j = await abruf<{
    errors?: { message: string; extensions?: { code?: string } }[]
    data?: { urlV2?: { node?: JwKnoten } | null } | null
  }>(endpunkt, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': ua },
    body: JSON.stringify({ query: NACHFRAGE, variables: { p: pfad, country: 'DE', language: 'de' } }),
  })
  if (j.errors?.length) {
    if (j.errors.every((e) => e.extensions?.code === 'NOT_FOUND')) return undefined
    throw new Error(j.errors[0].message)
  }
  const knoten = j.data?.urlV2?.node
  /* Bei Titeln ohne Angebote liefert JustWatch einen leeren `fullPath`; die Adresse, über die wir gefragt haben, bleibt. */
  if (!knoten || String(knoten.content.externalIds?.tmdbId ?? '') !== String(erwartet)) return undefined
  return { ...knoten, content: { ...knoten.content, fullPath: knoten.content.fullPath || pfad } }
}
