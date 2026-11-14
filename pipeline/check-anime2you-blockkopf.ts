/**
 * Zusicherungen zu `lib/anime2you-blockkopf.ts`: welche Titelzeile »…« über einem Zitat im Sammelartikel steht (Abstand, Zitat über zwei
 * Blöcke, mehrfache Fundstellen) und ob eine Titelzeile genau den Titel nennt. Läuft in `check:logic`.
 */
import { titelzeilePasst, titelzeilenUeber } from './lib/anime2you-blockkopf.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const ARTIKEL = [
  'Diese Anime starten im Herbst:',
  '»Frieren«',
  '',
  'Episoden: 28',
  'Sprache: Deutsch, Japanisch (UT)',
  'Simulcast: ja',
  'Stream: Crunchyroll',
  '»Dandadan« – Staffel 2',
  'Sprache: Japanisch (UT)',
  'Stream: Netflix',
  '»Kaiju No. 8«',
  'Sprache: Japanisch (UT)',
].join('\n')

pruefe('Zitat unter genau einer Titelzeile (Leerzeilen zählen nicht)', titelzeilenUeber(ARTIKEL, 'Sprache: Deutsch, Japanisch (UT)'), ['»Frieren«'])
pruefe('Zitat über zwei Zeilen im Block, Leerraum egal', titelzeilenUeber(ARTIKEL, 'Simulcast:  ja\nStream:Crunchyroll'), ['»Frieren«'])
pruefe('Titelzeile mit Zusatz', titelzeilenUeber(ARTIKEL, 'Stream: Netflix'), ['»Dandadan« – Staffel 2'])
pruefe('derselbe Wortlaut in zwei Blöcken: beide Titel', titelzeilenUeber(ARTIKEL, 'Sprache: Japanisch (UT)'), ['»Dandadan« – Staffel 2', '»Kaiju No. 8«'])
pruefe('Zitat reicht in den nächsten Block: keiner', titelzeilenUeber(ARTIKEL, 'Stream: Crunchyroll »Dandadan« – Staffel 2 Sprache'), [])
pruefe('Zitat vor jeder Titelzeile: keiner', titelzeilenUeber(ARTIKEL, 'Diese Anime starten'), [])
pruefe('Zitat nicht im Text', titelzeilenUeber(ARTIKEL, 'Stream: Disney+'), [])
pruefe('leeres Zitat', titelzeilenUeber(ARTIKEL, ''), [])
pruefe('leerer Text', titelzeilenUeber('', 'Sprache'), [])

{
  const weit = ['»Weit«', ...Array.from({ length: 8 }, (_, i) => `Zeile ${i}`), 'Ziel acht', 'Ziel neun'].join('\n')
  pruefe('Abstand 8 Zeilen: noch gefunden', titelzeilenUeber(weit, 'Zeile 7'), ['»Weit«'])
  pruefe('Abstand 9 Zeilen: nicht mehr', titelzeilenUeber(weit, 'Ziel acht'), [])
}
pruefe('Name über 120 Zeichen ist keine Titelzeile, 120 schon', [titelzeilenUeber(`»${'a'.repeat(121)}«\nSprache: Deutsch`, 'Sprache: Deutsch'), titelzeilenUeber(`»${'a'.repeat(120)}«\nSprache: Deutsch`, 'Sprache: Deutsch').length], [[], 1])


pruefe('Titel passt', titelzeilePasst('Frieren', '»Frieren«'), true)
pruefe('Zusatz über 40 Zeichen: keine Titelzeile', titelzeilenUeber(`»Frieren« – ${'b'.repeat(41)}\nSprache: Deutsch`, 'Sprache: Deutsch'), [])
pruefe('Zusatz nur im Kopf', titelzeilePasst('Dandadan', '»Dandadan« – Staffel 2'), true)
pruefe('Zusatz im Titel und im Kopf', titelzeilePasst('Dandadan Staffel 2', '»Dandadan« – Staffel 2'), true)
pruefe('Zusatz nur im Titel', titelzeilePasst('Dandadan Staffel 2', '»Dandadan«'), false)
pruefe('anderer Titel', titelzeilePasst('Kaiju No. 8', '»Frieren«'), false)
pruefe('Kopf nennt mehr Wörter als der Titel', titelzeilePasst('Kaiju', '»Kaiju No. 8«'), false)
pruefe('Groß/klein und Satzzeichen egal', titelzeilePasst('KAIJU NO 8', '»Kaiju No. 8«'), true)
pruefe('keine Titelzeile', titelzeilePasst('Frieren', 'Sprache: Deutsch'), false)

if (fehler) process.exit(1)
console.log('check-anime2you-blockkopf: ok')
