/** Kindprozess von `check-folgen-nummern-bau.ts`: schreibt die Folgenliste eines Titels in die Kulisse (`AK_ROOT`) und druckt `f` und die Bau-Logzeile. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../../shared/types.ts'
import { schreibeFolgenDateien } from '../bau/folgen-dateien.ts'

const wurzel = process.env.AK_ROOT
if (!wurzel) throw new Error('AK_ROOT fehlt — der Lauf würde ins echte Repo schreiben')
const titel = { id: 900001, jpYear: 2020, jpEnd: '2020-12-31', streams: [] } as unknown as Title
schreibeFolgenDateien([titel], [])
console.log(JSON.stringify(JSON.parse(readFileSync(join(wurzel, 'public/data/folgen/900001.json'), 'utf8')).f))
