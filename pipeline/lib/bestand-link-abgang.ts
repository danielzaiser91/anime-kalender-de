/**
 * Synchro-Belege (`dub === true`), die seit dem vorigen Bestand fehlen, getrennt in begründet und unerklärt.
 * Begründet: die Linkprüfung (`data/link-check.json`) führt die Seite (jüngster Befund je `adressKern`) mit 404 oder „region"
 * und keine jüngere Handprüfung sticht sie; dann nimmt `09-2-linkpruefung.ts` den Weg vorgesehen heraus. Die Regeln
 * (`juengsteJeKern`, `istTot`, `handStichtGegenLink`) kommen aus dem Bau, nicht nachgebaut (Anlass: Naruto Shippuden, 04.11.2026).
 */
import { execFileSync } from 'node:child_process'
import type { Title } from '../../shared/types.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { adressGleich, adressKern, dubKey, type DubCheck } from './dub-confirmed.ts'
import { handStichtGegenLink, istTot, juengsteJeKern, type LinkBefund } from './link-befund.ts'

type MitStreams = Pick<Title, 'id' | 'titleDe' | 'titleEn' | 'titleRomaji' | 'streams'>

export interface LinkAbgang {
  anbieter: string
  /** „Titel (Kennung): Adresse" */
  text: string
  /** Eintrag aus link-check.json, falls vorhanden. */
  befund?: string
}
export interface LinkAbgaenge {
  begruendet: LinkAbgang[]
  unerklaert: LinkAbgang[]
}

/** Handseite der Regel: Belege aus `dub-confirmed.yaml` und der Weg-Stempel aus `verweise-von-hand.yaml` (Adresskern → belegtAm). */
export interface HandStand {
  belege: readonly DubCheck[]
  vonHandBelegtAm: ReadonlyMap<string, string>
}

/** Der jüngste Beleg mit Aussage (`dub` oder `available`) für genau diese Adresse; der Bau wählt über `belegFuer` ebenso den jüngsten. */
function handBelegFuer(belege: readonly DubCheck[], titelId: number, platform: string, url: string): DubCheck | undefined {
  const passend = belege.filter(
    (b) => dubKey(b.anilistId, b.platform) === dubKey(titelId, platform) && (typeof b.dub === 'boolean' || b.available === false) && b.url && adressGleich(b.url, url),
  )
  return passend.sort((a, b) => String(b.checkedAt ?? '').localeCompare(String(a.checkedAt ?? '')))[0]
}

export function linkAbgaenge(
  vorher: readonly MitStreams[],
  jetzt: readonly MitStreams[],
  link: Record<string, LinkBefund>,
  hand: HandStand = { belege: [], vonHandBelegtAm: new Map() },
): LinkAbgaenge {
  const neu = new Map(jetzt.map((t) => [t.id, new Set((t.streams ?? []).filter((s) => s.dub === true).map((s) => adressKern(s.url)))]))
  const jeKern = juengsteJeKern(link)
  const aus: LinkAbgaenge = { begruendet: [], unerklaert: [] }
  for (const t of vorher) {
    for (const s of t.streams ?? []) {
      if (s.dub !== true || neu.get(t.id)?.has(adressKern(s.url))) continue
      const b = jeKern.get(adressKern(s.url))
      const sticht = handStichtGegenLink(handBelegFuer(hand.belege, t.id, s.platform, s.url), String(b?.geprueftAm ?? ''), s.url, hand.vonHandBelegtAm)
      const eintrag: LinkAbgang = {
        anbieter: s.platform,
        text: `${anzeigeName(t)} (${t.id}): ${s.url}`,
        befund: b ? `link-check: ${JSON.stringify(b)}${sticht ? ' (jüngere Handprüfung widerspricht)' : ''}` : undefined,
      }
      if (istTot(b?.status) && !sticht) aus.begruendet.push(eintrag)
      else aus.unerklaert.push(eintrag)
    }
  }
  return aus
}

/** Der Hauptbestand eines Commits samt Streams; ohne Git oder Datei leer (dann erklärt die Wache nichts). */
export function bestandAusCommit(wurzel: string, stand = 'HEAD'): MitStreams[] {
  try {
    const text = execFileSync('git', ['show', `${stand}:public/data/titles.json`], {
      cwd: wurzel,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const roh = JSON.parse(text) as MitStreams[] | Record<string, MitStreams>
    return Array.isArray(roh) ? roh : Object.values(roh)
  } catch {
    return []
  }
}
