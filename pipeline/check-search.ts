/**
 * Zusicherungen für die Suche — gegen den echten Titelbestand, nicht gegen
 * Beispieldaten.
 *
 * Anlass (Daniel, 12.08.2026): „Aesthetica of a Rogue Hero" war weder über
 * „aesthetic hero" noch über „ästhetik" zu finden. Beides sind keine
 * Ausnahmefälle, sondern der Normalfall bei langen fremdsprachigen Titeln.
 *
 * Der Test prüft zwei Dinge, die leicht gegeneinander laufen: dass die
 * nachsichtige Stufe die gewünschten Treffer bringt — und dass sie die
 * gewöhnliche Suche nicht verwässert („slime" darf nicht plötzlich hundert
 * Titel liefern).
 *
 * Aufruf: npm run check:search
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Title } from '../shared/types.ts'
import { ROOT } from './lib/util.ts'
import { sucheZweistufig } from '../web/src/lib/search.ts'

const titles = JSON.parse(
  readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8'),
) as Title[]

const namen = (t: Title) => [t.titleDe, t.titleEn, t.titleRomaji, t.titleNative].filter(Boolean) as string[]
const felder = (t: Title) => [...namen(t), ...(t.studios ?? []), ...t.genres, ...t.keywords]

function suche(q: string): Title[] {
  return sucheZweistufig(titles, q, felder, namen)
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const enthaelt = (liste: Title[], id: number) => liste.some((t) => t.id === id)

const AESTHETICA = 13161 // Aesthetica of a Rogue Hero
const SLIME = 101280 // That Time I Got Reincarnated as a Slime
const BOCCHI = 130003 // Bocchi the Rock!

console.log('Wortweise Suche (Stufe 1):')
{
  const a = suche('aesthetic hero')
  pruefe('„aesthetic hero" findet Aesthetica of a Rogue Hero', enthaelt(a, AESTHETICA), a.length)
  const b = suche('hero rogue')
  pruefe('Wortreihenfolge ist gleichgültig', enthaelt(b, AESTHETICA), b.length)
}

console.log('\nTippfehler und Eindeutschung (Stufe 2):')
{
  const a = suche('ästhetik')
  pruefe('„ästhetik" findet Aesthetica', enthaelt(a, AESTHETICA), a.map((t) => t.titleEn).slice(0, 5))
  const b = suche('bochi the rok')
  pruefe('„bochi the rok" findet Bocchi the Rock!', enthaelt(b, BOCCHI), b.map((t) => t.titleEn).slice(0, 5))
}

console.log('\nLokalisierte Namen:')
{
  const de = suche('Meine Wiedergeburt als Schleim')
  pruefe('deutscher Name aus dem Crunchyroll-Kalender trifft', de.length > 0, de.length)
  pruefe('Umschrift trifft', enthaelt(suche('Tensei Shitara Slime'), SLIME))
  pruefe('Originalschrift trifft', enthaelt(suche('転生したらスライム'), SLIME))
}

console.log('\nDie strenge Stufe bleibt streng:')
{
  const s = suche('slime')
  pruefe('„slime" liefert nicht die halbe Datenbank', s.length < 40, s.length)
  pruefe('„slime" enthält den Ursprungstitel', enthaelt(s, SLIME))
  const leer = suche('xqzvwkkk')
  pruefe('sinnloser Begriff liefert nichts', leer.length === 0, leer.length)
}

console.log('\nLaufzeit (die Suche läuft bei jedem Tastendruck):')
{
  const start = process.hrtime.bigint()
  for (const q of ['s', 'sl', 'sli', 'slim', 'slime', 'ästhetik', 'bochi the rok', 'xqzvwkkk']) suche(q)
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  console.log(`  acht Suchen über ${titles.length} Titel: ${ms.toFixed(0)} ms`)
  pruefe('unter 1,5 Sekunden für acht Suchen', ms < 1500, `${ms.toFixed(0)} ms`)
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
