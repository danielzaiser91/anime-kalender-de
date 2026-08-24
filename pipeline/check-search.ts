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

/**
 * Deutsche Titel sind kein Beiwerk — sie sind der Suchbegriff.
 *
 * Daniel suchte am 24.08.2026 nach „Der Held ohne Klasse: Der Aufstieg eines
 * Talentlosen" und fand nichts. Der Anime stand im Kalender (AniList 169969),
 * aber unter seinem japanischen Namen: `titleDe` war leer.
 *
 * Der deutsche Name lag zu dem Zeitpunkt längst im Repo — `data/anisearch.json`
 * führt ihn für 2.553 von 2.615 Einträgen. Ausgewertet hatte ihn nie jemand, und
 * nichts schlug an: Von 2.762 Titeln trugen **99** einen deutschen Namen.
 *
 * Diese Zusicherung macht daraus eine Zahl, die auffällt, wenn sie einbricht.
 * Die Schwelle liegt bewusst deutlich unter dem Erreichbaren — sie soll einen
 * Ausfall der Quelle melden, nicht bei jeder Schwankung rot werden.
 */
console.log('\nDeutsche Titel (der Suchbegriff, den ein deutscher Nutzer kennt):')
{
  const mitDe = titles.filter((t) => t.titleDe?.trim()).length
  const anteil = (mitDe / titles.length) * 100
  console.log(`  ${mitDe} von ${titles.length} Titeln (${anteil.toFixed(0)} %)`)
  pruefe('mindestens die Hälfte der Titel hat einen deutschen Namen', anteil >= 50, `${anteil.toFixed(0)} %`)

  // Der Fall, der die Prüfung ausgelöst hat — namentlich, damit er nicht
  // wieder still verschwindet.
  const held = titles.find((t) => t.id === 169969)
  pruefe(
    'AniList 169969 ist unter „Der Held ohne Klasse" auffindbar',
    /held ohne klasse/i.test(held?.titleDe ?? ''),
    held?.titleDe ?? '(kein deutscher Titel)',
  )
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
