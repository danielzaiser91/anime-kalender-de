/**
 * Kindprozess von `check-folgen-erschienen-je-weg.ts`: schreibt die Folgendatei eines Titels in die Kulisse (`AK_ROOT`)
 * und druckt `de` je Lauf als JSON-Zeile. Argument: `mit` (mit Wochenplan) oder `ohne`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Release, Title } from '../../shared/types.ts'
import { schreibeFolgenDateien } from '../bau/folgen-dateien.ts'

const wurzel = process.env.AK_ROOT
if (!wurzel) throw new Error('AK_ROOT fehlt — der Lauf würde ins echte Repo schreiben')
const titel = { id: 900001, jpYear: 2020, jpEnd: '2020-12-31', streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true }] } as unknown as Title
const plan = (start: string) => ({ slug: 'k', titleId: 900001, name: 'T', platform: 'netflix', releaseType: 'weekly', schedule: { firstEpisodeDate: start, episodeCount: 20 } }) as unknown as Release
const jeArt: Record<string, Release[]> = { mit: [plan('2020-01-01')], zukunft: [plan('2999-01-01')], ohne: [] }
schreibeFolgenDateien([titel], jeArt[process.argv[2]!] ?? [])
console.log(JSON.stringify(JSON.parse(readFileSync(join(wurzel, 'public/data/folgen/900001.json'), 'utf8')).de))
