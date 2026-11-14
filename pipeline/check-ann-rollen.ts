/**
 * Zusicherungen zu `lib/ann.ts`: nur deutsche Besetzung, Entities entschlüsselt, Zusammenführung mit AniList ohne Doppelte.
 * Läuft in `check:logic`.
 */
import { annUrl, deutscheRollen, rollenZusammenfuehren } from './lib/ann.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const XML = `<ann><anime id="26334">
  <cast gid="1" lang="JA"><role>Frieren</role><person id="1">Atsumi Tanezaki</person></cast>
  <cast gid="2" lang="DE">
    <role>Frieren</role>
    <person id="2">Julia Casper</person>
  </cast>
  <cast lang="DE" gid="3"><role>Frieren&#039;s Lehrerin &amp; Magierin</role><person id="3"> Anna &quot;A&quot; M&#252;ller </person></cast>
  <cast gid="4" lang="DE"><role>Ohne Sprecher</role></cast>
  <cast gid="5" lang="DE"><person id="5">Ohne Rolle</person></cast>
  <cast gid="6" lang="EN"><role>Fern</role><person id="6">Jill Harris</person></cast>
</anime></ann>`

pruefe('nur DE, unvollständige Blöcke fallen weg, Entities entschlüsselt, Ränder getrimmt', deutscheRollen(XML), [
  { character: 'Frieren', actor: 'Julia Casper' },
  { character: "Frieren's Lehrerin & Magierin", actor: 'Anna "A" Müller' },
])
pruefe('leere Antwort', deutscheRollen(''), [])
pruefe('ohne deutsche Besetzung', deutscheRollen('<cast lang="JA"><role>X</role><person>Y</person></cast>'), [])
pruefe('lang="DEU" ist kein DE', deutscheRollen('<cast lang="DEU"><role>X</role><person>Y</person></cast>'), [])
pruefe('&lt; &gt; &apos;', deutscheRollen('<cast lang="DE"><role>&lt;A&gt;</role><person>O&apos;Neil</person></cast>'), [{ character: '<A>', actor: "O'Neil" }])
// Ein Durchgang: doppelt kodiertes „&amp;#039;“ bleibt „&#039;“ (so liefert ANN es nicht; festgehalten, damit eine Änderung bewusst geschieht).
pruefe('Entities nur einmal entschlüsselt', deutscheRollen('<cast lang="DE"><role>A&amp;#039;B</role><person>P</person></cast>')[0]?.character, 'A&#039;B')

const anilist = [
  { character: 'Frieren', actor: 'Julia Casper', role: 'MAIN' },
  { character: 'Fern', actor: 'Lisa Mitsch', role: 'SUPPORTING' },
]
const ann = [
  { character: 'FRIEREN', actor: 'julia casper' },
  { character: 'Fern', actor: 'Andere Stimme' },
  { character: 'Stark', actor: 'Max Muster' },
]
pruefe('AniList vorn, Doppelte über Figur und Sprecher ohne Groß/klein, Neusynchro bleibt', rollenZusammenfuehren(anilist, ann), [
  ...anilist,
  { character: 'Fern', actor: 'Andere Stimme' },
  { character: 'Stark', actor: 'Max Muster' },
])
pruefe('ohne AniList: ANN unverändert', rollenZusammenfuehren([], ann), ann)
pruefe('ohne ANN: AniList unverändert', rollenZusammenfuehren(anilist, []), anilist)
pruefe('annUrl', annUrl(26334), 'https://www.animenewsnetwork.com/encyclopedia/anime.php?id=26334')

if (fehler) process.exit(1)
console.log('check-ann-rollen: ok')
