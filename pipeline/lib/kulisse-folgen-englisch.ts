/** Kindprozess von `check-folgentitel-englisch-bau.ts`: schreibt die Folgenliste von Burn the Witch (116673) in die Kulisse (`AK_ROOT`, cwd gleich) und druckt `f`. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../../shared/types.ts'
import { schreibeFolgenDateien } from '../bau/folgen-dateien.ts'

const wurzel = process.env.AK_ROOT
if (!wurzel) throw new Error('AK_ROOT fehlt — der Lauf würde ins echte Repo schreiben')
const titel = { id: 116673, jpYear: 2020, jpEnd: '2020-12-31', episodes: 3, format: 'ONA', streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/burn-the-witch' }] } as unknown as Title
schreibeFolgenDateien([titel], [])
console.log(JSON.stringify(JSON.parse(readFileSync(join(wurzel, 'public/data/folgen/116673.json'), 'utf8')).f))
