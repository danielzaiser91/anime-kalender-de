/**
 * Kindprozess von `check-folgen-erschienen-je-weg.ts`: schreibt die Folgendatei eines Titels in die Kulisse (`AK_ROOT`)
 * und druckt `de` je Lauf als JSON-Zeile. Argument: `mit` (mit Wochenplan), `ohne`, `zukunft`,
 * `mehrere` oder `zusatz` (über `schreibeZusatzdateien`, den Aufrufer im Bau).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Release, Title } from '../../shared/types.ts'
import { schreibeFolgenDateien } from '../bau/folgen-dateien.ts'
import { schreibeZusatzdateien } from '../bau/13-4-zusatzdateien.ts'

const wurzel = process.env.AK_ROOT
if (!wurzel) throw new Error('AK_ROOT fehlt — der Lauf würde ins echte Repo schreiben')
const titel = { id: 900001, jpYear: 2020, jpEnd: '2020-12-31', streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true }] } as unknown as Title
const plan = (start: string, platform = 'netflix') => ({ slug: `k-${platform}`, titleId: 900001, name: 'T', platform, releaseType: 'weekly', schedule: { firstEpisodeDate: start, episodeCount: 20 } }) as unknown as Release
const jeArt: Record<string, Release[]> = {
  mit: [plan('2020-01-01')],
  zukunft: [plan('2999-01-01')],
  /* Der Netflix-Plan steht vor dem Plan eines anderen Anbieters: beide müssen beim Titel ankommen. */
  mehrere: [plan('2020-01-01'), plan('2020-01-01', 'crunchyroll')],
  ohne: [],
}
const art = process.argv[2]!
if (art === 'zusatz') {
  /* Der echte Aufrufer im Bau (`13-4-zusatzdateien.ts`): reicht er die Releases an die Folgendatei durch? */
  schreibeZusatzdateien({ titles: new Map([[titel.id, titel]]), anisearch: {}, slim: [], verschoben: [], releases: jeArt.mit!, synopses: {}, jpStartAnzeige: new Map() })
} else {
  schreibeFolgenDateien([titel], jeArt[art] ?? [])
}
console.log(JSON.stringify(JSON.parse(readFileSync(join(wurzel, 'public/data/folgen/900001.json'), 'utf8')).de))
