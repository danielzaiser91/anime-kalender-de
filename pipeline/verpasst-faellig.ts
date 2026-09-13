/**
 * **Welche ausgebliebenen Folgen heute recherchiert werden — und ob die Recherche sauber war.**
 *
 * Zwei Aufrufe, beide aus `claude-verpasst-recherche.yml`:
 *
 * - ohne Schalter: schreibt die fälligen Vermerke nach `--aus <datei>` und
 *   `anzahl=<n>` nach `$GITHUB_OUTPUT`. Bei null startet kein Claude — das ist
 *   der Normalfall, und er kostet dann nichts.
 * - `--pruefen`: vergleicht die Datei nach der Recherche mit dem Stand davor.
 *   Claude darf genau drei Felder schreiben; alles andere ist ein Fehler, und
 *   dann wird nichts eingereicht.
 * - `--stempeln --aus <datei>`: setzt `rechercheAm` für jeden fälligen Eintrag
 *   auf die echte Uhrzeit, auch wenn nichts gefunden wurde.
 *
 * Warum die Prüfung nicht dem Prompt überlassen wird: `neuErwartet` verschiebt
 * alle folgenden Termine im Kalender. Ein Datum ohne Quelle oder ein
 * versehentlich geändertes `erschienenAm` wäre genau die unbelegte Behauptung,
 * gegen die dieses Projekt gebaut ist.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { readJson, writeJson } from './lib/util.ts'
import { rechercheFaellig } from './lib/ausgeblieben.ts'
import type { VerpassterTermin } from './termine-pruefen.ts'

const DATEI = 'data/termine-verpasst.json'
/*
  **`rechercheAm` schreibt nicht Claude, sondern `--stempeln`.**

  Der erste erfolgreiche Lauf am 13.09.2026 endete um 20:09 UTC und trug
  „20:45" ein — geraten, und in der Zukunft. Ein Modell kennt die Uhrzeit nicht;
  der Workflow schon.
*/
const ERLAUBT = new Set(['recherche', 'rechercheQuelle', 'neuErwartet'])
const args = process.argv.slice(2)
const jetzt = new Date()

if (args.includes('--stempeln')) {
  const liste = /--aus[= ](\S+)/.exec(args.join(' '))?.[1]
  if (!liste) {
    console.error('--stempeln braucht --aus <datei> mit den fälligen Einträgen')
    process.exit(1)
  }
  const ids = new Set((JSON.parse(readFileSync(liste, 'utf8')) as VerpassterTermin[]).map((v) => v.id))
  const alle = readJson<VerpassterTermin[]>(DATEI, [])
  const stempel = jetzt.toISOString()
  for (const v of alle) if (ids.has(v.id)) v.rechercheAm = stempel
  writeJson(DATEI, alle, true)
  console.log(`${ids.size} Eintrag/Einträge mit rechercheAm ${stempel} gestempelt`)
  process.exit(0)
}

if (args.includes('--pruefen')) {
  const vorher = JSON.parse(execSync(`git show HEAD:${DATEI}`, { encoding: 'utf8' })) as VerpassterTermin[]
  const nachher = JSON.parse(readFileSync(DATEI, 'utf8')) as VerpassterTermin[]
  const fehler: string[] = []
  const alt = new Map(vorher.map((v) => [v.id, v]))
  if (nachher.length !== vorher.length) fehler.push(`Zahl der Einträge geändert: ${vorher.length} → ${nachher.length}`)
  for (const n of nachher) {
    const a = alt.get(n.id)
    if (!a) {
      fehler.push(`${n.id}: neuer Eintrag`)
      continue
    }
    const schluessel = new Set([...Object.keys(a), ...Object.keys(n)])
    for (const k of schluessel) {
      const feld = (x: VerpassterTermin) => JSON.stringify((x as unknown as Record<string, unknown>)[k] ?? null)
      const gleich = feld(a) === feld(n)
      if (!gleich && !ERLAUBT.has(k)) fehler.push(`${n.id}: Feld „${k}" geändert`)
    }
    /*
      **Geprüft wird, was dieser Lauf geändert hat — nicht der Altbestand.**

      Der erste Lauf am 13.09.2026 wurde rot an „Mushoku Tensei Staffel 3,
      30.08.": Deren `recherche` stammt von Hand aus dem August, ist länger als
      320 Zeichen und hat kein Quellenfeld, weil es das damals nicht gab. Claude
      hatte den Eintrag nicht angefasst, und verworfen wurde trotzdem der ganze
      Lauf samt seiner Recherche zu einer anderen Folge.
    */
    const geaendert = (k: keyof VerpassterTermin) => JSON.stringify(a[k] ?? null) !== JSON.stringify(n[k] ?? null)
    if ((geaendert('recherche') || geaendert('rechercheQuelle')) && n.recherche != null) {
      if (typeof n.recherche !== 'string' || n.recherche.length > 320) fehler.push(`${n.id}: recherche leer oder über 320 Zeichen`)
      if (!n.rechercheQuelle || !/^https:\/\/\S+$/.test(n.rechercheQuelle)) fehler.push(`${n.id}: recherche ohne https-Quelle`)
    }
    if (geaendert('rechercheAm') && n.rechercheAm != null && Number.isNaN(Date.parse(n.rechercheAm))) fehler.push(`${n.id}: rechercheAm ist kein Zeitpunkt`)
    if (n.neuErwartet !== a.neuErwartet && n.neuErwartet != null) {
      const t = Date.parse(n.neuErwartet)
      if (Number.isNaN(t) || !/T\d\d:\d\d/.test(n.neuErwartet)) fehler.push(`${n.id}: neuErwartet ohne Datum mit Uhrzeit`)
      else if (t <= Date.parse(n.erwartetAm)) fehler.push(`${n.id}: neuErwartet liegt nicht nach dem ausgebliebenen Termin`)
      if (!n.rechercheQuelle) fehler.push(`${n.id}: neuErwartet ohne Quelle`)
    }
  }
  if (fehler.length) {
    console.error(`Recherche verworfen, ${fehler.length} Befund(e):\n  ${fehler.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`Recherche sauber: ${nachher.filter((n, i) => JSON.stringify(n) !== JSON.stringify(vorher[i])).length} Eintrag/Einträge geändert`)
  process.exit(0)
}

const aus = /--aus[= ](\S+)/.exec(args.join(' '))?.[1]
const faellig = readJson<VerpassterTermin[]>(DATEI, []).filter((v) => rechercheFaellig(v, jetzt))
console.log(`${faellig.length} ausgebliebene Folge(n) fällig für die Recherche`)
for (const v of faellig) console.log(`  · ${v.name}, Folge ${v.episode ?? '?'} — erwartet ${v.erwartetAm}`)
if (aus) writeFileSync(aus, JSON.stringify(faellig, null, 2))
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `anzahl=${faellig.length}\n`)
