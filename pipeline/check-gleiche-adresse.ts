/**
 * Ratsche für dieselbe Amazon-Seite an zwei Titeln: Rechenregel (`gleicheAdresseBilanz`) und der Bestandswächter als eigener
 * Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`): Zeile, Exit 0 und die Fälle neu / über der Grenze / erledigt / leere Dateien.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gleicheAdresseBilanz, type GleicheAdresseStand } from './lib/gleiche-adresse.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const detail = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const beleg = (anilistId: number, url: string) => ({ anilistId, url })
/** Der Anlass: Seite B0CWLSM344 gehört laut Zuordnung (Feld `seite` einer Teilseite) 114745, der Beleg hing auch an 97986. */
const zuordnung = {
  [`${detail('B0CVTW992R')}#1`]: { titleId: 114745, seite: 'B0CWLSM344' },
  [`${detail('B0FHW8DNTG')}#0`]: { titleId: 97986, seite: 'B0FHW8DNTG' },
}
const stand = (adressen: string[], hoechstens = adressen.length): GleicheAdresseStand => ({ stand: '2026-10-28', hoechstens, adressen })
const MIA = 'amazon:b0cwlsm344'

console.log('\nBilanz:')
const anlass = [beleg(97986, detail('B0CWLSM344')), beleg(114745, `${detail('B0CWLSM344')}?ref=x`), beleg(97986, detail('B0FHW8DNTG'))]
pruefe('Anlass: Seite von 114745 mit Beleg auch an 97986', gleicheAdresseBilanz(anlass, zuordnung, stand([])).fehl.join() === MIA)
pruefe('ohne den Fremdbeleg ist es keine Doppelung', gleicheAdresseBilanz(anlass.slice(1), zuordnung, stand([])).fehl.length === 0)
pruefe('Eigentümer allein an zwei Belegen (zwei Zeilen derselben Kennung) ist keine Doppelung', gleicheAdresseBilanz([anlass[1]!, anlass[1]!], zuordnung, stand([])).fehl.length === 0)
pruefe('ein einzelner Beleg an einem Fremdtitel ist keine Doppelung (zählt nur ab zwei Titeln)', gleicheAdresseBilanz([anlass[0]!], zuordnung, stand([])).fehl.length === 0)
const zweiEigentuemer = { ...zuordnung, [`${detail('B0CVTW992R')}#2`]: { titleId: 97986, seite: 'B0CWLSM344' } }
pruefe('gehört die Seite beiden Titeln laut Zuordnung, ist es keine Doppelung', gleicheAdresseBilanz(anlass, zweiEigentuemer, stand([])).fehl.length === 0)
pruefe('ohne Eintrag in der Zuordnung nicht entscheidbar: keine Doppelung', gleicheAdresseBilanz(anlass, {}, stand([])).fehl.length === 0)
const netflix = [beleg(1, 'https://www.netflix.com/title/81186864'), beleg(2, 'https://www.netflix.com/title/81186864')]
pruefe('Netflix-Serienseite mit mehreren Staffeln ist erlaubt', gleicheAdresseBilanz(netflix, { 'https://www.netflix.com/title/81186864': { titleId: 1 } }, stand([])).fehl.length === 0)
pruefe('Beleg ohne Adresse oder Kennung wird übersprungen', gleicheAdresseBilanz([{ anilistId: 97986 }, { url: detail('B0CWLSM344') }], zuordnung, stand([])).fehl.length === 0)
const dp = [beleg(97986, 'https://www.amazon.de/dp/B0CWLSM344'), beleg(114745, detail('B0CWLSM344'))]
pruefe('/dp/ und /gp/video/detail/ sind dieselbe Seite', gleicheAdresseBilanz(dp, zuordnung, stand([])).fehl.join() === MIA)
const b1 = gleicheAdresseBilanz(anlass, zuordnung, stand([]))
pruefe('Seite außerhalb des Standes ist neu und über der Grenze', b1.neu.join() === MIA && b1.ueberGrenze, b1)
const b2 = gleicheAdresseBilanz(anlass, zuordnung, stand([MIA]))
pruefe('bekannt und an der Grenze: weder neu noch darüber', !b2.neu.length && !b2.ueberGrenze && !b2.erledigt.length, b2)
const b3 = gleicheAdresseBilanz(anlass, zuordnung, stand([MIA], 0))
pruefe('bekannt, aber über der Grenze', !b3.neu.length && b3.ueberGrenze, b3)
const b4 = gleicheAdresseBilanz([], zuordnung, stand(['amazon:a', 'amazon:b']))
pruefe('erledigte Adressen werden genannt', b4.erledigt.join() === 'amazon:a,amazon:b' && !b4.ueberGrenze, b4)

console.log('\nBestandswächter als Prozess:')
const skript = fileURLToPath(new URL('./check-gleiche-adresse-bestand.ts', import.meta.url))
const yamlVon = (liste: { anilistId: number; url: string }[]) => liste.map((e) => `- anilistId: ${e.anilistId}\n  url: ${e.url}\n`).join('')
function lauf(belege: string | undefined, zu: unknown, standInhalt: unknown): { code: number | null; ausgabe: string } {
  const w = mkdtempSync(join(tmpdir(), 'gleiche-adresse-'))
  try {
    mkdirSync(join(w, 'data'))
    if (belege !== undefined) writeFileSync(join(w, 'data', 'dub-confirmed.yaml'), belege)
    if (zu !== undefined) writeFileSync(join(w, 'data', 'prime-zugeordnet.json'), JSON.stringify(zu))
    if (standInhalt !== undefined) writeFileSync(join(w, 'data', 'gleiche-adresse-stand.json'), JSON.stringify(standInhalt))
    const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { env: { ...process.env, AK_ROOT: w }, encoding: 'utf8', timeout: 60_000, windowsHide: true })
    return { code: r.status, ausgabe: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(w, { recursive: true, force: true })
  }
}
const yml = yamlVon([beleg(97986, detail('B0CWLSM344')), beleg(114745, detail('B0CWLSM344'))])
const ruhig = lauf(yml, zuordnung, stand([MIA]))
pruefe('Stand eingehalten: Exit 0, Zählzeile, keine Warnung', ruhig.code === 0 && ruhig.ausgabe.includes('Gleiche Amazon-Seite an zwei Titeln: 1 (Stand 2026-10-28: höchstens 1)') && !ruhig.ausgabe.includes('WARNUNG'), ruhig)
const neu = lauf(yml, zuordnung, stand([]))
pruefe('neue Doppelung: Exit 0 und Zeile „⚠ WARNUNG“ mit der Seite', neu.code === 0 && /⚠ WARNUNG Gleiche Adresse: 1 neue Amazon-Seite\(n\).*amazon:b0cwlsm344/.test(neu.ausgabe) && neu.ausgabe.includes('mehr als die Grenze 0'), neu)
const erledigt = lauf('[]\n', zuordnung, stand(Array.from({ length: 10 }, (_, i) => `amazon:s${i}`)))
pruefe('zehn erledigte Adressen: Hinweis zum Kürzen, Exit 0', erledigt.code === 0 && erledigt.ausgabe.includes('10 Adressen'), erledigt)
const neun = lauf('[]\n', zuordnung, stand(Array.from({ length: 9 }, (_, i) => `amazon:s${i}`)))
pruefe('neun erledigte Adressen: noch kein Hinweis', neun.code === 0 && !neun.ausgabe.includes('WARNUNG'), neun)
const leer = lauf(undefined, undefined, undefined)
pruefe('alle Dateien fehlen: Exit 0, Zählzeile mit 0', leer.code === 0 && leer.ausgabe.includes('Gleiche Amazon-Seite an zwei Titeln: 0'), leer)

console.log(`\nGleiche Adresse: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
