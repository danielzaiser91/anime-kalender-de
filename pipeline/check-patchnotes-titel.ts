/**
 * Patch Notes nennen Titel so, wie die Seite sie anzeigt (`anzeigeName`). Läuft in der PR-Prüfkette (`check:logic`, Ereignis `pull_request`):
 * geprüft werden nur die im PR neuen oder geänderten Einträge, gegen `titles.json` und `cartoons.json` der Basis des PR (per `git show`,
 * nie der gebaute Bestand im Arbeitsbaum). Außerhalb des PR-Ereignisses laufen nur die Gegenproben.
 * Prüft nur Namen, die als englischer/Romaji-Name eines Titels erkennbar sind (keine Heuristik über beliebige Wörter).
 */
import { execFileSync } from 'node:child_process'
import { ladeBasis } from '../tools/pr-basis.mjs'
import { abweichendeTitel, titelMeldungen, type TitelNamen } from './lib/patchnotes-titel.ts'
import { basisTitel, geaenderteEintraege, type Git } from './lib/patchnotes-titel-pr.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`FEHLER: ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

const t = (id: number, titleDe?: string, titleEn?: string, titleRomaji?: string): TitelNamen => ({ id, titleDe, titleEn, titleRomaji })
const meldungen = (text: string, titel: TitelNamen[]): number => titelMeldungen([{ name: 'x', text }], titel).length

function gegenproben(): void {
  const probe = [t(1, 'Blue Exorcist', 'Blue Exorcist', 'Ao no Exorcist')]
  pruefe('Gegenprobe: abweichender Name wird gemeldet', meldungen('Ao no Exorcist neu', probe) === 1)
  const zwei = titelMeldungen([{ name: 'a', text: 'Ao no Exorcist' }, { name: 'b', text: 'Ao no Exorcist' }], probe)
  pruefe('Gegenprobe: jeder Eintrag meldet für sich (Dateiname vorn)', zwei.length === 2 && zwei[0].startsWith('a: ') && zwei[1].startsWith('b: '), zwei)
  pruefe('Gegenprobe: angezeigter Name ist in Ordnung', meldungen('Blue Exorcist neu', probe) === 0)
  pruefe('Gegenprobe: kleingeschriebenes Wort ist kein Titel', meldungen('orange Pille', [t(1, 'Orange', 'orange')]) === 0)
  pruefe('Gegenprobe: Teilwort dahinter zählt nicht', meldungen('Ao no Exorcists', probe) === 0)
  pruefe('Gegenprobe: Wortanfang davor zählt nicht', meldungen('XAo no Exorcist', probe) === 0)
  pruefe('Gegenprobe: Ziffer davor zählt nicht', meldungen('2Ao no Exorcist', probe) === 0)
  pruefe('Gegenprobe: Ziffer dahinter zählt nicht', meldungen('Ao no Exorcist2', probe) === 0)
  pruefe('Gegenprobe: Name mit 6 Zeichen wird gemeldet', meldungen('Abcdef', [t(1, 'Anders', 'Abcdef')]) === 1)
  pruefe('Gegenprobe: Name mit 5 Zeichen bleibt still', meldungen('Abcde', [t(1, 'Anders', 'Abcde')]) === 0)
  const lang = [t(1, 'Final Fantasy: Die Mächte', 'Final Fantasy')]
  pruefe('Gegenprobe: ausgeschriebener angezeigter Name im Text erlaubt den kürzeren Namen', meldungen('Final Fantasy: Die Mächte neu', lang) === 0)
  pruefe('Gegenprobe: ein anderer Titel mit genau diesem Namen als Anzeigename erlaubt ihn', meldungen('Final Fantasy neu', [...lang, t(2, 'Final Fantasy')]) === 0)
}

function gegenprobenReihenUndKopf(): void {
  const tempal = [t(212888, 'Overgeared', 'Overgeared', 'Tempal: Item no Chikara')]
  pruefe('Anlass „Tempal“ (PR 1535): Kopf vor „: “ des Romaji-Namens wird gemeldet', meldungen('Etwa bei Tempal und Gachiakuta', tempal) === 1)
  pruefe('Anlass „Tempal“: die Meldung nennt den angezeigten Namen', titelMeldungen([{ name: 'x', text: 'bei Tempal' }], tempal)[0]?.includes('die Seite zeigt „Overgeared“') === true)
  pruefe('Anlass „Tempal“: „Overgeared“ ist in Ordnung', meldungen('Etwa bei Overgeared und Gachiakuta', tempal) === 0)
  const mond = [t(530, 'Sailor Moon', 'Sailor Moon'), t(740, 'Sailor Moon R', 'Sailor Moon R'), t(532, 'Sailor Moon S', 'Sailor Moon S')]
  pruefe('Reihenname: „Sailor Moon“ (Wortpräfix dreier Namen) ist kein Fund', meldungen('Blu-ray: Sailor Moon Staffel 2–5', [t(1, 'Sailor Moon Kristall', 'Sailor Moon', 'Bishoujo'), ...mond]) === 0)
  const haganai = [t(1, 'Haganai Eins', 'Haganai'), t(2, 'Haganai Zwei', 'Haganai 2'), t(3, 'Haganai Drei', 'Haganai 3')]
  pruefe('Reihenname: „Haganai“ (Wortpräfix dreier Namen) ist kein Fund', meldungen('Digimon, Haganai', haganai) === 0)
  const ff = [t(1361, 'Die Mächte in Dir', 'Final Fantasy'), t(317, 'Final Fantasy VII: Advent Children', 'Final Fantasy VII: Advent Children'), t(1157, 'Final Fantasy VII: Last Order', 'Final Fantasy VII: Last Order')]
  pruefe('Reihenname: „Final Fantasy“ vor „VII Advent Children“ meldet nicht den Titel 1361', titelMeldungen([{ name: 'x', text: 'Final Fantasy VII Advent Children' }], ff).every((m) => !m.includes('„Final Fantasy“')))
  const wort = [t(1, 'Anders', 'Moonlight Tale'), t(2, 'Moonlight Talent Show')]
  pruefe('Wortgrenze: „Moonlight Talent“ ist kein Wortpräfix von „Moonlight Tale“ (Fund)', meldungen('Moonlight Tale', wort) === 1)
  const andere = [t(1, 'Die Boonies: Zeitreise', 'Boonie Bears: Blast into the Past'), t(2, 'Boonie Bears: Ein tierisches Abenteuer')]
  pruefe('Reihenname aus einem anderen Titel: „Boonie Bears“ ist kein Fund', meldungen('Zum Beispiel Boonie Bears', andere) === 0)
  pruefe('Kurzform des eigenen Titels: „Pororo“ für „Pororo: The Racing Adventure“ ist kein Fund', meldungen('Auch Pororo', [t(1, 'Pororo: The Racing Adventure', 'Pororo: The Racing Adventure')]) === 0)
  pruefe('Nur ein anderer Titel trägt den Namen nicht am Anfang: Fund', meldungen('Zum Beispiel Boonie Bears', [andere[0]]) === 1)
}

function gegenprobenAnzeigename(): void {
  const ohneDe = [t(495, undefined, 'Sorcerer Hunters', 'Bakuretsu Hunters')]
  pruefe('Anzeigename ohne titleDe: der englische Name ist der angezeigte', meldungen('Sorcerer Hunters, Digimon', ohneDe) === 0)
  const meldung = titelMeldungen([{ name: 'x', text: 'Bakuretsu Hunters' }], ohneDe)[0] ?? ''
  pruefe('Anzeigename ohne titleDe: die Meldung nennt „Sorcerer Hunters“, nie „undefined“', meldung.includes('die Seite zeigt „Sorcerer Hunters“'), meldung)
  pruefe('Anzeigename mit Staffel: „Log Horizon Season 2“ im Text weicht von „Staffel 2“ ab', meldungen('Log Horizon Season 2 neu', [t(1, undefined, 'Log Horizon Season 2')]) === 1)
  pruefe('Angezeigter Name im Text: ein zusätzlich genannter Alias ist in Ordnung', meldungen('Overgeared Deutsch (Tempal)', [t(1, 'Overgeared Deutsch', 'Overgeared Original', 'Tempal: Item')]) === 0)
  pruefe('Voller Name bei kurzem Kopf: „Ao: Hidden Thing“ wird gemeldet', meldungen('Ao: Hidden Thing', [t(1, 'Anders', 'Ao: Hidden Thing')]) === 1)
  const ziffer = [t(1, 'Anders', 'Moonlight Tale'), t(2, 'Moonlight Tale2 Show')]
  pruefe('Wortgrenze im Anzeigenamen: „Moonlight Tale2“ ist kein Wortpräfix (Fund)', meldungen('Moonlight Tale', ziffer) === 1)
  pruefe('Anzeigename mit Staffel: „Log Horizon Staffel 2“ im Text ist in Ordnung', meldungen('Log Horizon Staffel 2 neu', [t(1, undefined, 'Log Horizon Season 2')]) === 0)
  const doppelt = [t(1, 'Erster', 'Kuma Kuma Bear'), t(2, 'Zweiter', 'Kuma Kuma Bear')]
  pruefe('Gleicher Name bei zwei Titeln: die Meldung nennt den ersten', abweichendeTitel('Kuma Kuma Bear', doppelt).map((a) => a.angezeigt).join() === 'Erster')
}

/** Die im PR neuen oder geänderten Einträge gegen die Titel der Basis; die Basis kommt aus dem Ereignis der Action und wird bei Bedarf nachgeladen. */
function pruefeGegenBasis(): void {
  const git: Git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  const basis = ladeBasis(git)
  const titel = basisTitel(basis, git)
  pruefe('Basis: titles.json und cartoons.json sind gelesen', titel.length > 0)
  const eintraege = geaenderteEintraege(basis, git)
  const gefunden = titelMeldungen(eintraege, titel)
  pruefe(`Patch-Notes-Titel: ${eintraege.length} neue oder geänderte Einträge gegen ${titel.length} Titel der Basis ${basis.slice(0, 7)}`, gefunden.length === 0, gefunden)
}

function main(): void {
  gegenproben()
  gegenprobenReihenUndKopf()
  gegenprobenAnzeigename()
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') pruefeGegenBasis()
  else console.log('  – Patch-Notes-Titel: nur im PR-Ereignis gegen die Basis geprüft (hier nicht).')
  if (fehler > 0) process.exit(1)
}

main()
