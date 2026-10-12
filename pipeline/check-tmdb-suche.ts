/**
 * Zusicherungen zur TMDB-Suche für Titel ohne Cover (`lib/tmdb-suche.ts`): nur ein sicherer Treffer gilt, sonst kein Cover. Aufruf: `npm run check:logic`.
 */
import { besterTreffer, urteilTreffer, type TmdbTreffer } from './lib/tmdb-suche.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tv = (id: number, name: string, jahr: number, genre = [16]): TmdbTreffer => ({ id, name, original_name: name, first_air_date: `${jahr}-04-01`, genre_ids: genre })

console.log('\nTMDB-Suche: sicherer Treffer')
pruefe('Name, Jahr und Animation passen: Treffer', besterTreffer(['Martial Peak'], 2024, [tv(1, 'Martial Peak', 2024)])?.id === 1)
pruefe('Jahr um eins daneben gilt noch', besterTreffer(['Squishy Fish Eggs'], 2020, [tv(2, 'Squishy Fish Eggs', 2021)])?.id === 2)
pruefe('Jahr um zwei daneben: kein Treffer', besterTreffer(['Wish Cat'], 2024, [tv(3, 'Wish Cat', 2026)]) === undefined)
pruefe('ohne eigenes Jahr: kein Treffer', besterTreffer(['Wish Cat'], undefined, [tv(3, 'Wish Cat', 2024)]) === undefined)
pruefe('ohne Genre Animation (Realfilm gleichen Namens): kein Treffer', besterTreffer(['Take Me Home'], 2018, [tv(4, 'Take Me Home', 2018, [18])]) === undefined)
pruefe('anderer Name: kein Treffer', besterTreffer(['Take Me Home'], 2018, [tv(5, 'Take Me Out', 2018)]) === undefined)

console.log('\nTMDB-Suche: bester statt erster')
pruefe('der Treffer mit dem genaueren Jahr gewinnt, auch wenn er hinten steht', besterTreffer(['Luck'], 2022, [tv(6, 'Luck', 2021), tv(7, 'Luck', 2022)])?.id === 7)
pruefe('zwei verschiedene Werke gleich nah: unsicher, kein Treffer', besterTreffer(['Luck'], 2022, [tv(6, 'Luck', 2021), tv(7, 'Luck', 2023)]) === undefined)

console.log('\nTMDB-Suche: Grund ohne Treffer')
pruefe('anderer Name: kein Treffer', urteilTreffer(['Luck'], 2022, [tv(8, 'Fortune', 2022)]).grund === 'kein Treffer')
pruefe('Name gleich, Jahr daneben: unsicher mit Kandidat', urteilTreffer(['Luck'], 2022, [tv(9, 'Luck', 2010)]).grund === 'unsicher' && urteilTreffer(['Luck'], 2022, [tv(9, 'Luck', 2010)]).kandidaten[0]?.id === 9)
pruefe('zwei gleich nahe Werke: mehrere Kandidaten', urteilTreffer(['Luck'], 2022, [tv(6, 'Luck', 2021), tv(7, 'Luck', 2023)]).grund === 'mehrere Kandidaten')

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Suche: alle Zusicherungen grün.')
