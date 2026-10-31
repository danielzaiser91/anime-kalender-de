import { type Release, type Title } from '../../shared/types.ts'
import { amazonAdresseRichten } from '../lib/amazon-adresse.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { log } from '../lib/util.ts'
import { type Ausloeser, ausloeserZeilen } from '../lib/ausloeser-zeilen.ts'
import { istKeineTitelseite } from './11-7-wege-aus-terminen.ts'
import { uebernehmeBezugswegAdressen } from './13-1-weg-adresse-bezugsweg.ts'

/**
 * **Hat ein Termin keine eigene Adresse, nimmt seine Pille die des Weges desselben Titels** (11.10.2026, Reborn as a Space Mercenary:
 * Prime-Weg von Hand belegt, die Termin-Pille blieb ohne Ziel). Derselbe Anbieter, bei gesetztem Kanal derselbe Kanal, eine
 * Titelseite statt einer Suche. Eine Suchadresse am Termin gilt als fehlende Adresse (13.10.2026, Bleach-Filme bei ADN: die Kuratierung setzte
 * `animationdigitalnetwork.com/de/search?q=…` als Ersatz, die Pille führte nicht zum Anbieter, obwohl der Weg die Titelseite kannte). Mehrdeutig (mehrere solche Wege, etwa zwei Staffeln auf zwei Prime-Seiten) → keine Übernahme,
 * das Panel führt dann zur Suche. Disc, Kino und Fernsehen haben eigene Ziele.
 */
export function adresseDesWegs(r: Release, titel: Title | undefined): string | undefined {
  if (!titel || r.buyUrl || r.releaseType === 'disc' || ['disc', 'tv', 'kino'].includes(r.platform)) return undefined
  if (r.platformUrl && !istKeineTitelseite(r.platformUrl)) return undefined
  const wege = (titel.streams ?? []).filter(
    (s) => s.platform === r.platform && s.url && !istKeineTitelseite(s.url) && (!r.kanal || s.kanal?.toLowerCase() === r.kanal.toLowerCase()),
  )
  return wege.length === 1 ? wege[0]!.url : undefined
}

/**
 * Prime-Termine auf die Video-Adresse richten (`amazonAdresseRichten`) und Terminen ohne Adresse die ihres Weges geben.
 * Gibt zurück, wie viele Adressen gerichtet wurden; die übernommenen stehen im Protokoll.
 */
export function richteTerminAdressen(releases: Release[], titles: Title[]): number {
  uebernehmeBezugswegAdressen(titles)
  const titelNachId = new Map(titles.map((t) => [t.id, t]))
  let gerichtet = 0
  let uebernommen = 0
  const uebernahmen: Ausloeser[] = []
  for (const r of releases) {
    const vomWeg = adresseDesWegs(r, titelNachId.get(r.titleId))
    if (vomWeg) {
      const titel = titelNachId.get(r.titleId)!
      const wege = (titel.streams ?? []).map((s) => s.url)
      uebernahmen.push({ titleId: titel.id, name: anzeigeName(titel), regel: 'terminAdresseVomWeg', terminUrl: `${r.platformUrl ?? '–'} → ${vomWeg}`, wegVorher: wege, wegNachher: wege })
      r.platformUrl = vomWeg
      uebernommen++
    }
    if (r.platform !== 'primevideo' || !r.platformUrl) continue
    const neu = amazonAdresseRichten(r.platformUrl)
    if (neu !== r.platformUrl) gerichtet++
    r.platformUrl = neu
  }
  if (uebernommen) {
    log(`${uebernommen} Termine ohne Adresse haben die des Weges desselben Titels übernommen`)
    for (const z of ausloeserZeilen(uebernahmen)) log(z)
  }
  return gerichtet
}
