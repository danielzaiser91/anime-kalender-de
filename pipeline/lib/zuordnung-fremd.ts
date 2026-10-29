import { adressGleich, adressKern, istSammelKern } from '../../shared/adresse-kern.ts'
import { ohneSprache } from './fremde-adressen.ts'
import { amazonTitelAdresse } from './amazon-adresse.ts'
import type { BelegAdresse } from './handbeleg-fremde-adresse.ts'

export interface ZuordnungEintrag {
  titleId: number
  plattform?: string
  seite?: string | null
}

export interface FremdZugeordnet {
  titleId: number
  adresse: string
  /** Die Besitzer der Adresse: `Datei:Kennung` (Cartoon, Titel ohne Synchro) oder `Handbeleg:Kennung`. */
  besitzer: string[]
}

/** Die Adresse, die der Bau (`09-3-prime.ts`) für den Eintrag prüft: die Seite der Rohfolge (Migration 030), wo sie vorliegt, sonst die gemeldete. */
function adresseDesEintrags(schluessel: string, e: ZuordnungEintrag): string {
  return e.plattform === 'primevideo' && e.seite ? amazonTitelAdresse(e.seite) : schluessel.split('#')[0]!
}

/**
 * **Zuordnungen (`data/*-zugeordnet.json`) an einer Adresse, die einem anderen Eintrag gehört** (29.10.2026): einem Cartoon
 * oder Titel ohne Synchro (`streams`, Besitzer `Datei:Kennung`) oder einem Handbeleg einer anderen Kennung. Der Zuordner
 * wählt den Titel über Namen und Folgenzahl, nicht über die Adresse; der Bau überspringt solche Einträge nur still.
 * Hat die Kennung selbst einen Handbeleg an der Adresse oder ist sie der Besitzer, gilt die Adresse als ihre.
 * Suchadressen zeigen auf keinen Titel und zählen nicht.
 */
export function findeFremdZugeordnete(
  zugeordnet: readonly [string, ZuordnungEintrag][],
  streams: ReadonlyMap<string, string[]>,
  belege: readonly BelegAdresse[],
): FremdZugeordnet[] {
  const treffer: FremdZugeordnet[] = []
  for (const [schluessel, e] of zugeordnet) {
    const adresse = adresseDesEintrags(schluessel, e)
    if (!adressKern(adresse) || istSammelKern(adressKern(adresse))) continue
    if (belege.some((b) => b.anilistId === e.titleId && adressGleich(b.url, adresse))) continue
    const besitzer = [
      ...(streams.get(ohneSprache(adresse)) ?? []).filter((b) => !b.endsWith(`:${e.titleId}`)),
      ...belege.filter((b) => b.anilistId !== e.titleId && adressGleich(b.url, adresse)).map((b) => `Handbeleg:${b.anilistId}`),
    ]
    if (besitzer.length) treffer.push({ titleId: e.titleId, adresse, besitzer: [...new Set(besitzer)] })
  }
  return treffer
}
