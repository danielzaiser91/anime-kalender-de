import { leseZugeordnet } from './prime-meldung-riegel.ts'

type Meldung = { titleId: number; plattform?: string; folgen?: { sprachen?: string[] }[] }
export type KanalOffen = { anilistId: number; title: string | undefined; platform: 'primevideo'; url: string }

/**
 * Prime-Meldungen ohne Deutsch in jeder Folge und ohne Handbeleg zum Titel: sie machen den Titel zur Kanal-Prüfung.
 * Liest über `leseZugeordnet`, damit eine von Hand gesperrte Seite keinen Titel zur Prüfliste macht.
 */
export function kanalOffenAusMeldungen(
  hatBeleg: (titleId: number) => boolean,
  titelName: Map<number, string | undefined>,
  roh?: Record<string, Meldung>,
): KanalOffen[] {
  const offen: KanalOffen[] = []
  for (const [url, z] of Object.entries(leseZugeordnet(roh))) {
    const folgen = z.folgen ?? []
    if (z.plattform !== 'primevideo' || z.titleId == null || z.titleId < 0 || !folgen.length) continue
    if (folgen.some((f) => !f.sprachen?.length || f.sprachen.includes('Deutsch'))) continue
    if (hatBeleg(z.titleId)) continue
    offen.push({ anilistId: z.titleId, title: titelName.get(z.titleId), platform: 'primevideo', url })
  }
  return offen
}
