/** Gegenproben zu D-25 (`lib/invarianten-kanal.ts`): Hell Mode, ein Kanal-Titel, dessen Prime-Seite Amazons Sprachangabe trägt. */
import type { Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import { kanalTitelOhneBeleg } from './lib/invarianten-kanal.ts'
import { kanalAdressenOhneBeleg, ohneKanalSprache, rohBelegtDeutsch } from './lib/kanal-titel.ts'

type Pruefe = (name: string, ok: boolean, gefunden?: unknown) => void

export function kanalProben(pruefe: Pruefe): void {
  const hellUrl = 'https://www.amazon.de/gp/video/detail/B0FTW7GP47'
  const hellBeleg = { anilistId: 185262, platform: 'primevideo', url: hellUrl, dub: true, checkedAt: '2026-08-30', note: 'Abos: animedigitalde, aniversede — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg' } as DubCheck
  const hellKanal = kanalAdressenOhneBeleg([ohneKanalSprache(hellBeleg)])
  const hell = (dub?: boolean, extra: Record<string, unknown> = {}) =>
    [{ id: 185262, titleRomaji: 'Hell Mode', streams: [{ platform: 'primevideo', url: hellUrl.replace('/gp/video/detail/', '/dp/'), dub }], ...extra } as unknown as Title]
  const keine = () => false
  pruefe('D-25: Kanal-Titel verliert Amazons Sprachangabe beim Lesen', ohneKanalSprache(hellBeleg).dub === undefined && hellKanal.size === 1)
  pruefe('D-25: Kanal-Titel mit zweiter Quelle behält das Ja', ohneKanalSprache({ ...hellBeleg, zweiteQuelle: 'JustWatch: audio de' }).dub === true)
  pruefe('D-25: ohne Kanal-Warnung bleibt das Ja', ohneKanalSprache({ ...hellBeleg, note: 'Abos: Prime' }).dub === true)
  pruefe('D-25: Prime-Verweis ✓ Deutsch auf einer Kanal-Adresse wird gemeldet', kanalTitelOhneBeleg(hell(true), hellKanal, keine).length === 1)
  pruefe('D-25: Verweis ohne Urteil geht durch', kanalTitelOhneBeleg(hell(undefined), hellKanal, keine).length === 0)
  pruefe('D-25: fremde Adresse geht durch', kanalTitelOhneBeleg(hell(true), new Set(['185262|amazon:b0xxxxxxxx']), keine).length === 0)
  pruefe('D-25: dieselbe Seite bei einem anderen Titel geht durch', kanalTitelOhneBeleg(hell(true), new Set(['999|amazon:b0ftw7gp47']), keine).length === 0)
  pruefe('D-25: eine andere Quelle des Titels (Termin, aniSearch) geht durch', kanalTitelOhneBeleg(hell(true), hellKanal, () => true).length === 0)
  pruefe('D-25: eine deutsche Erstausgabe geht durch', kanalTitelOhneBeleg(hell(true, { deErstausgabe: { von: '2026-01-10' } }), hellKanal, keine).length === 0)
  const deutsch = true
  const lader = [ohneKanalSprache(hellBeleg)]
  pruefe('D-25: gemeldete Folgen auf einer Kanal-Seite belegen kein Deutsch', !rohBelegtDeutsch(deutsch, 185262, hellUrl, lader))
  pruefe('D-25: gemeldete Folgen auf einer anderen Seite belegen Deutsch', rohBelegtDeutsch(deutsch, 185262, 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA', lader))
  pruefe('D-25: gemeldete Folgen ohne Deutsch belegen nichts', !rohBelegtDeutsch(false, 185262, null, []))
}
