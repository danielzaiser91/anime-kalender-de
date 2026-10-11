/**
 * Zusicherung zu Stufe D der AniList-Ablösung: Die Sprecher kommen im Bau zuerst aus aniSearch, AniList und ANN nur dort, wo aniSearch den
 * Sprecher im Titel nicht führt; kein Titel verliert dabei Rollen, und ein zweiter Bau ändert nichts mehr. Regel: `bau/sprecher-zusammen.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-sprecher-anisearch.ts`
 */
import { falte, ohneGrossschrift, sammleSchreibweisen, sprecherAnzeige, sprecherSchluessel } from './bau/sprecher-namen.ts'
import { fuehreZusammen, ohneAnisearchAbgedeckte, type AnisearchRolle, type Rolle } from './bau/sprecher-zusammen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nSprecher aus aniSearch: Namen')
const bekannt = sammleSchreibweisen(['Gerrit Schmidt-Foß', 'Ilona Brokowski', 'Antje von der Ahe', 'Hans MÜLLER'])
pruefe('Bekannte Schreibweise gewinnt (ß statt SS)', sprecherAnzeige('Gerrit SCHMIDT-FOSS', bekannt) === 'Gerrit Schmidt-Foß', sprecherAnzeige('Gerrit SCHMIDT-FOSS', bekannt))
pruefe('Ohne Treffer greift die Regel: Familienname klein mit Anfangsbuchstaben', sprecherAnzeige('Thomas Nero WOLFF', bekannt) === 'Thomas Nero Wolff')
pruefe('Partikel bleiben klein', ohneGrossschrift('Antje VON DER AHE') === 'Antje von der Ahe', ohneGrossschrift('Antje VON DER AHE'))
pruefe('Ein Name nur aus Großbuchstaben bleibt, wie er ist', ohneGrossschrift('MARC') === 'MARC' && ohneGrossschrift('ELLEN KRETZ') === 'ELLEN KRETZ')
pruefe('Figurennamen: Familienname groß wird klein', ohneGrossschrift('Erwin SMITH') === 'Erwin Smith' && ohneGrossschrift('TACHIKOMA') === 'TACHIKOMA')
pruefe('Schreibweisen mit Großschrift lernen wir nicht als Vorbild', !sammleSchreibweisen(['Hans MÜLLER']).has(falte('Hans MÜLLER')))
pruefe('Schlüssel: erstes und letztes Wort, gefaltet', sprecherSchluessel('Thomas Nero WOLFF') === sprecherSchluessel('Thomas Wolff') && sprecherSchluessel('Gerrit Schmidt-Foß') === 'gerrit foss')

console.log('\nSprecher aus aniSearch: Zusammenführung')
const al: Rolle[] = [
  { character: 'Spike', actor: 'Viktor Neumann', role: 'MAIN' },
  { character: 'Ed', actor: 'Ilona Brokowski' },
  { character: 'Aussteiger', actor: 'Nur Anilist' },
  { character: 'Zusatz', actor: 'Ann Sprecher', von: 'ann' },
]
const as: AnisearchRolle[] = [
  { figur: 'Spike SPIEGEL', sprecher: 'Viktor NEUMANN' },
  { figur: 'Edward WONG', sprecher: 'Ilona OTTO' },
  { figur: 'Spike SPIEGEL', sprecher: 'Viktor NEUMANN' },
]
const z = fuehreZusammen(al, as, bekannt)
pruefe('aniSearch steht vorn, ohne Doppelte', z.rollen.slice(0, 2).map((r) => `${r.character}|${r.actor}|${r.von}`).join() === 'Spike Spiegel|Viktor Neumann|anisearch,Edward Wong|Ilona Otto|anisearch', z.rollen)
pruefe('Derselbe Sprecher bei aniSearch ersetzt die Rolle aus AniList', !z.rollen.some((r) => r.actor === 'Viktor Neumann' && !r.von))
pruefe('Sprecher, den aniSearch nicht führt, bleibt (auch Alias und ANN)', z.rollen.some((r) => r.actor === 'Nur Anilist') && z.rollen.some((r) => r.actor === 'Ilona Brokowski') && z.rollen.some((r) => r.von === 'ann'), z.rollen)
pruefe('Zähler: 1 ersetzt, 3 behalten', z.ersetzt === 1 && z.behalten === 3, [z.ersetzt, z.behalten])
const zwei = fuehreZusammen(z.rollen, as, bekannt)
pruefe('Zweiter Bau über das Ergebnis ändert nichts', JSON.stringify(zwei.rollen) === JSON.stringify(z.rollen), zwei.rollen)
pruefe('Ohne aniSearch-Rollen bleibt die Liste, wie sie war', JSON.stringify(fuehreZusammen(al, [], bekannt).rollen) === JSON.stringify(al))
pruefe('Ein Titel ohne frühere Rollen bekommt die von aniSearch', fuehreZusammen([], as, bekannt).rollen.length === 2)
pruefe('Kein Titel mit Rollen verliert sie: Ergebnis nie leer, wenn eine der Quellen Rollen hat', [al, []].every((alt) => [as, []].every((a) => alt.length + a.length === 0 || fuehreZusammen(alt, a, bekannt).rollen.length > 0)))
pruefe('Sammler: ANN-Rollen eines von aniSearch geführten Sprechers kommen nicht zurück', ohneAnisearchAbgedeckte(z.rollen, [{ actor: 'Viktor NEUMANN' }, { actor: 'Neu Dazu' }]).length === 1)
pruefe('Sammler: ohne aniSearch-Rollen bleibt alles', ohneAnisearchAbgedeckte(al, [{ actor: 'Viktor Neumann' }]).length === 1)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nSprecher aus aniSearch: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
