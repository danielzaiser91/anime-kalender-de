/**
 * Zusicherung: Ein Reihenteil, dessen Name nach dem Reihennamen nur eine Zahl oder ein Satzzeichen übrig lässt, zeigt in der Reihenliste und im Kopf des
 * Detail-Panels einen lesbaren Namen („Jujutsu Kaisen 0" stand als „0" da, 12.10.2026). Regeln: `reihen-regeln.ts` (`istNichtssagend`, `kurzName`,
 * `zeilenZusatz`), Kopf: `teilNameVon` in `reihen-namen.ts`. Der Bestandsteil steht in `check-reihen-teilname-bestand.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-reihen-teilname.ts`
 */
import type { FranchiseMember, Title } from '../shared/types.ts'
import { teilNameVon } from '../web/src/components/detail/reihen-namen.ts'
import { istNichtssagend, kurzName, zeilenZusatz } from '../web/src/components/detail/reihen-regeln.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const teil = (id: number, name: string, format = 'MOVIE') => ({ id, name, format, jpYear: 2020 + id }) as unknown as FranchiseMember
const titel = (m: FranchiseMember) => ({ id: m.id, titleEn: m.name, format: m.format, jpYear: m.jpYear }) as unknown as Title

console.log('\nNichtssagender Rest:')
for (const rest of ['0', '2', '2.0', '!', '+', '?'] as const) pruefe(`„${rest}" sagt allein nichts`, istNichtssagend(rest))
for (const rest of ['', 'Der Film', 'OVA 1', '(2016)', 'Staffel 2', 'x UT'] as const) pruefe(`„${rest}" ist ein Name oder leer`, !istNichtssagend(rest))

console.log('\nName in der Reihenliste und im Kopf:')
{
  pruefe('Rest „0" zeigt den vollen Namen', kurzName('0', 'Jujutsu Kaisen 0') === 'Jujutsu Kaisen 0', kurzName('0', 'Jujutsu Kaisen 0'))
  pruefe('Ein Rest mit Buchstaben bleibt gekürzt', kurzName('Der Film', 'Cowboy Bebop: Der Film') === 'Der Film')
  pruefe('Ohne Rest steht der volle Name', kurzName('', 'Fairy Tail') === 'Fairy Tail')
  const nr = (staffel: number, eigenerName = true) => ({ staffel, eigenerName })
  pruefe('„Staffel 2 · 2" wird zu „Staffel 2"', zeilenZusatz(nr(2), '2', 'My Hero Academia 2') === '', zeilenZusatz(nr(2), '2', 'My Hero Academia 2'))
  pruefe('Steins;Gate 0 behält die Null als Teil des Namens', zeilenZusatz(nr(2), '0', 'Steins;Gate 0') === 'Steins;Gate 0')
  pruefe('Eine Zahl, die nicht die Staffelnummer ist, zeigt den vollen Namen', zeilenZusatz(nr(3), '2', 'Pucca 2') === 'Pucca 2')
  pruefe('Ein Zusatz mit Buchstaben bleibt', zeilenZusatz(nr(4), 'War of the Three Titans', 'X War of the Three Titans') === 'War of the Three Titans')
  pruefe('Ohne eigenen Namen kein Zusatz', zeilenZusatz(nr(2, false), '2', 'Y 2') === '')

  const film = teil(2, 'Jujutsu Kaisen 0')
  const reihe = [teil(1, 'Jujutsu Kaisen', 'TV'), film]
  const kopf = teilNameVon(titel(film), 'Jujutsu Kaisen', reihe)
  pruefe('Kopf: „Jujutsu Kaisen 0" statt „0"', kopf === 'Jujutsu Kaisen 0', kopf)
  const staffel = teil(3, 'Bungo Stray Dogs 2', 'TV')
  const kopfStaffel = teilNameVon(titel(staffel), 'Bungo Stray Dogs', [teil(4, 'Bungo Stray Dogs', 'TV'), staffel])
  pruefe('Kopf: „Bungo Stray Dogs 2" statt „2"', kopfStaffel === 'Bungo Stray Dogs 2', kopfStaffel)
  const der = teil(5, 'Cowboy Bebop: Der Film')
  const kopfFilm = teilNameVon(titel(der), 'Cowboy Bebop', [teil(6, 'Cowboy Bebop', 'TV'), der])
  pruefe('Kopf: „Der Film" bleibt gekürzt', kopfFilm === 'Der Film', kopfFilm)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
