/**
 * Ratsche für dieselbe Amazon-Seite an zwei Titeln: Rechenregel (`gleicheAdresseBilanz`) und der Bestandswächter als eigener
 * Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`): Zeile, Exit 0 und die Fälle neu / über der Grenze / erledigt / leere Dateien.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gleicheAdresseBilanz, type BelegKurz, type GleicheAdresseStand, type ZuordnungKurz } from './lib/gleiche-adresse.ts'

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
const bilanz = (b: BelegKurz[], z: Record<string, ZuordnungKurz>, s: GleicheAdresseStand, folgen: Record<number, number> = {}) => gleicheAdresseBilanz(b, z, s, folgen)

console.log('\nBilanz:')
const anlass = [beleg(97986, detail('B0CWLSM344')), beleg(114745, `${detail('B0CWLSM344')}?ref=x`), beleg(97986, detail('B0FHW8DNTG'))]
pruefe('Anlass: Seite von 114745 mit Beleg auch an 97986', bilanz(anlass, zuordnung, stand([])).fehl.join() === MIA)
pruefe('ohne den Fremdbeleg ist es keine Doppelung', bilanz(anlass.slice(1), zuordnung, stand([])).fehl.length === 0)
pruefe('Eigentümer allein an zwei Belegen (zwei Zeilen derselben Kennung) ist keine Doppelung', bilanz([anlass[1]!, anlass[1]!], zuordnung, stand([])).fehl.length === 0)
pruefe('ein einzelner Beleg an einem Fremdtitel ist keine Doppelung (zählt nur ab zwei Titeln)', bilanz([anlass[0]!], zuordnung, stand([])).fehl.length === 0)
const zweiEigentuemer = { ...zuordnung, [`${detail('B0CVTW992R')}#2`]: { titleId: 97986, seite: 'B0CWLSM344' } }
pruefe('gehört die Seite beiden Titeln laut Zuordnung, ist es keine Doppelung', bilanz(anlass, zweiEigentuemer, stand([])).fehl.length === 0)
pruefe('ohne Eintrag in der Zuordnung nicht entscheidbar: keine Doppelung', bilanz(anlass, {}, stand([])).fehl.length === 0)
const netflix = [beleg(1, 'https://www.netflix.com/title/81186864'), beleg(2, 'https://www.netflix.com/title/81186864')]
pruefe('Netflix-Serienseite mit mehreren Staffeln ist erlaubt', bilanz(netflix, { 'https://www.netflix.com/title/81186864': { titleId: 1 } }, stand([])).fehl.length === 0)
pruefe('Beleg ohne Adresse oder Kennung wird übersprungen', bilanz([{ anilistId: 97986 }, { url: detail('B0CWLSM344') }], zuordnung, stand([])).fehl.length === 0)
const dp = [beleg(97986, 'https://www.amazon.de/dp/B0CWLSM344'), beleg(114745, detail('B0CWLSM344'))]
pruefe('/dp/ und /gp/video/detail/ sind dieselbe Seite', bilanz(dp, zuordnung, stand([])).fehl.join() === MIA)
const b1 = bilanz(anlass, zuordnung, stand([]))
pruefe('Seite außerhalb des Standes ist neu und über der Grenze', b1.neu.join() === MIA && b1.ueberGrenze, b1)
const b2 = bilanz(anlass, zuordnung, stand([MIA]))
pruefe('bekannt und an der Grenze: weder neu noch darüber', !b2.neu.length && !b2.ueberGrenze && !b2.erledigt.length, b2)
const b3 = bilanz(anlass, zuordnung, stand([MIA], 0))
pruefe('bekannt, aber über der Grenze', !b3.neu.length && b3.ueberGrenze, b3)
const b4 = bilanz([], zuordnung, stand(['amazon:a', 'amazon:b']))
pruefe('erledigte Adressen werden genannt', b4.erledigt.join() === 'amazon:a,amazon:b' && !b4.ueberGrenze, b4)
const FREI = 'amazon:b0fhw8dntg'
const sammel = [beleg(97986, detail('B0FHW8DNTG')), beleg(114745, detail('B0FHW8DNTG'))]
const mitErlaubt = (adresse: string, titel = [97986, 114745], folgenSumme = 17): GleicheAdresseStand => ({
  ...stand([]),
  erlaubt: [{ adresse, titel, folgen: folgenSumme, grund: 'Serie plus Beiläufer auf einer Seite' }],
})
/** Serie 97986 mit 13 Folgen plus 114745 mit 4 OVAs = 17 Folgen auf der Seite. */
const FOLGEN = { 97986: 13, 114745: 4 }
pruefe('ohne Eintrag in erlaubt zählt die Sammelseite als Doppelung', bilanz(sammel, zuordnung, stand([]), FOLGEN).fehl.join() === FREI)
const sa = bilanz(sammel, zuordnung, mitErlaubt(FREI), FOLGEN)
pruefe('erlaubte Sammelseite zählt nicht, ist nicht neu und nicht veraltet', sa.fehl.length === 0 && sa.neu.length === 0 && sa.veraltet.length === 0, sa)
pruefe('erlaubt gilt nur für die genannte Adresse', bilanz([...anlass, ...sammel], zuordnung, mitErlaubt(FREI), FOLGEN).fehl.join() === MIA)
const dritter = [...sammel, beleg(555, detail('B0FHW8DNTG'))]
pruefe('dritter Titel mit Beleg auf der erlaubten Seite zählt als Fehl', bilanz(dritter, zuordnung, mitErlaubt(FREI), FOLGEN).fehl.join() === FREI)
pruefe('Eintrag nennt einen Titel, der keinen Beleg dort hat: Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI, [97986, 114745, 555], 17), { ...FOLGEN, 555: 0 }).fehl.join() === FREI)
pruefe('Eintrag nennt nur einen der zwei belegten Titel: Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI, [97986], 13), FOLGEN).fehl.join() === FREI)
pruefe('falsche Summe der Folgen zählt als Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI, [97986, 114745], 18), FOLGEN).fehl.join() === FREI)
pruefe('Titel hat nun andere Folgenzahl als beim Eintragen: Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI), { 97986: 12, 114745: 4 }).fehl.join() === FREI)
pruefe('Folgenzahlen unbekannt: Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI), {}).fehl.join() === FREI)
pruefe('Folgenzahl eines Titels unbekannt, Summe der bekannten passt: Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI), { 97986: 17 }).fehl.join() === FREI)
pruefe('gleich viele Titel, aber ein anderer als belegt: Fehl', bilanz(sammel, zuordnung, mitErlaubt(FREI, [97986, 555], 17), { 97986: 13, 555: 4 }).fehl.join() === FREI)
const veraltet = bilanz(anlass.slice(1), zuordnung, mitErlaubt(FREI), FOLGEN)
pruefe('erlaubte Seite ohne Doppelung wird als veraltet gemeldet', veraltet.veraltet.join() === FREI && veraltet.fehl.length === 0, veraltet)

/** Teilseite: 9 der 13 Folgen von 97986 plus die 4 OVAs von 114745 = 13 Folgen auf der Seite (Hyouka B0B5JVJKCD: Folgen 1–12 plus OVA). */
const mitAnteilen = (anteile: number[], folgenSumme = 13): GleicheAdresseStand => ({
  ...stand([]),
  erlaubt: [{ adresse: FREI, titel: [97986, 114745], folgen: folgenSumme, anteile, grund: 'Teil der Serie plus Beiläufer auf einer Seite' }],
})
const teil = bilanz(sammel, zuordnung, mitAnteilen([9, 4]), FOLGEN)
pruefe('Teilseite mit Anteilen, die die Seitenzahl ergeben: kein Fehl', teil.fehl.length === 0 && teil.veraltet.length === 0, teil)
pruefe('Teilseite: Summe der Anteile weicht von der Seitenzahl ab: Fehl', bilanz(sammel, zuordnung, mitAnteilen([9, 3]), FOLGEN).fehl.join() === FREI)
pruefe('Teilseite: Anteil größer als die Folgen des Titels: Fehl', bilanz(sammel, zuordnung, mitAnteilen([14, 4], 18), FOLGEN).fehl.join() === FREI)
pruefe('Teilseite: Anteil genau so groß wie die Folgen des Titels gilt', bilanz(sammel, zuordnung, mitAnteilen([13, 4], 17), FOLGEN).fehl.length === 0)
pruefe('Teilseite: weniger Anteile als Titel: Fehl', bilanz(sammel, zuordnung, mitAnteilen([13]), FOLGEN).fehl.join() === FREI)
const kopf = [{ ...beleg(97986, detail('B0FHW8DNTG')), available: false }, { ...beleg(114745, detail('B0FHW8DNTG')), available: false }]
pruefe('Beleg „kein Weg“ (available: false) an beiden Titeln beansprucht die Seite nicht', bilanz(kopf, zuordnung, stand([])).fehl.length === 0)
const einKopf = [{ ...beleg(97986, detail('B0FHW8DNTG')), available: false }, beleg(114745, detail('B0FHW8DNTG'))]
pruefe('ein Beleg „kein Weg“ neben einem echten Beleg ist keine Doppelung', bilanz(einKopf, zuordnung, stand([])).fehl.length === 0)
const kopfUndZwei = [...kopf, beleg(97986, detail('B0FHW8DNTG')), beleg(114745, detail('B0FHW8DNTG'))]
pruefe('zwei echte Belege bleiben Doppelung, auch mit „kein Weg“-Belegen daneben', bilanz(kopfUndZwei, zuordnung, stand([])).fehl.join() === FREI)
const mitJa = [{ ...beleg(97986, detail('B0FHW8DNTG')), available: true }, beleg(114745, detail('B0FHW8DNTG'))]
pruefe('available: true zählt wie ein Beleg ohne Angabe', bilanz(mitJa, zuordnung, stand([])).fehl.join() === FREI)

console.log('\nBestandswächter als Prozess:')
const skript = fileURLToPath(new URL('./check-gleiche-adresse-bestand.ts', import.meta.url))
const yamlVon = (liste: { anilistId: number; url: string }[]) => liste.map((e) => `- anilistId: ${e.anilistId}\n  url: ${e.url}\n`).join('')
function lauf(belege: string | undefined, zu: unknown, standInhalt: unknown, titel?: unknown): { code: number | null; ausgabe: string } {
  const w = mkdtempSync(join(tmpdir(), 'gleiche-adresse-'))
  try {
    mkdirSync(join(w, 'data'))
    if (titel !== undefined) {
      mkdirSync(join(w, 'public', 'data'), { recursive: true })
      writeFileSync(join(w, 'public', 'data', 'titles.json'), JSON.stringify(titel))
    }
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
const titelDatei = [{ id: 97986, episodes: 13 }, { id: 114745, episodes: 4 }]
const frei = lauf(yml, zuordnung, mitErlaubt(MIA), titelDatei)
pruefe('Prozess: erlaubte Seite im Stand wird nicht gezählt', frei.code === 0 && frei.ausgabe.includes('Gleiche Amazon-Seite an zwei Titeln: 0 (') && !frei.ausgabe.includes('WARNUNG'), frei)
const summeFalsch = lauf(yml, zuordnung, mitErlaubt(MIA, [97986, 114745], 18), titelDatei)
pruefe('Prozess: falsche Summe, Seite zählt wieder und warnt', summeFalsch.code === 0 && summeFalsch.ausgabe.includes('Gleiche Amazon-Seite an zwei Titeln: 1 (') && summeFalsch.ausgabe.includes('⚠ WARNUNG'), summeFalsch)
const ohneTitel = lauf(yml, zuordnung, mitErlaubt(MIA))
pruefe('Prozess: ohne titles.json zählt die erlaubte Seite', ohneTitel.code === 0 && ohneTitel.ausgabe.includes('Gleiche Amazon-Seite an zwei Titeln: 1 ('), ohneTitel)
const alt = lauf('[]\n', zuordnung, mitErlaubt(MIA), titelDatei)
pruefe('Prozess: veraltete erlaubte Seite wird gemeldet', alt.code === 0 && alt.ausgabe.includes('⚠ WARNUNG Gleiche Adresse: 1 erlaubte Seite(n) ohne Doppelung mehr') && alt.ausgabe.includes(MIA), alt)
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
