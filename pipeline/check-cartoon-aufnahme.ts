/**
 * Zusicherung zu `hatAufnahmeBeleg` (`lib/cartoon-aufnahme.ts`): Eine Webserie oder ein Fanprojekt ohne deutschen Anbieter
 * erscheint nicht als Cartoon. Eingaben sind erfunden; der Bestandsteil steht in `check-cartoon-aufnahme-bestand.ts`.
 */
import { hatAufnahmeBeleg } from './lib/cartoon-aufnahme.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}`)
}
const e = (o: { anbieterDe?: string[]; netzwerk?: string; studios?: string[] }) => ({ anbieterDe: [], ...o })

console.log('Cartoon-Aufnahme:')
pruefe('Fanprojekt ohne Anbieter, Netzwerk und Studio: nicht aufgenommen', !hatAufnahmeBeleg(e({})))
pruefe('Webserie auf YouTube ohne Anbieter: nicht aufgenommen', !hatAufnahmeBeleg(e({ netzwerk: 'YouTube', studios: ['Irgendein Kanal'] })))
pruefe('Netzwerk Twitch zählt als Webkanal', !hatAufnahmeBeleg(e({ netzwerk: 'Twitch' })))
pruefe('Leere Studioliste zählt nicht als Beleg', !hatAufnahmeBeleg(e({ studios: [] })))
pruefe('Netzwerk TikTok zählt als Webkanal', !hatAufnahmeBeleg(e({ netzwerk: 'TikTok' })))
pruefe('Netzwerk Vimeo zählt als Webkanal', !hatAufnahmeBeleg(e({ netzwerk: 'Vimeo' })))
pruefe('Netzwerk Dailymotion zählt als Webkanal', !hatAufnahmeBeleg(e({ netzwerk: 'Dailymotion' })))
pruefe('Netzwerk „YouTube Premium“ zählt als Webkanal (Namensanfang, nicht Gleichheit)', !hatAufnahmeBeleg(e({ netzwerk: 'YouTube Premium' })))
pruefe('Netzwerk „YouTube Red“ zählt als Webkanal', !hatAufnahmeBeleg(e({ netzwerk: 'YouTube Red', studios: ['Irgendein Kanal'] })))
pruefe('Webkanal nur am Namensanfang: Sender mit „Vimeo“ im Namen zählt als Sender', hatAufnahmeBeleg(e({ netzwerk: 'Nickelodeon (Vimeo-Ableger)' })))
pruefe('YouTube Red mit deutschem Anbieter (Dallas & Robo): aufgenommen', hatAufnahmeBeleg(e({ anbieterDe: ['YouTube Premium'], netzwerk: 'YouTube Red' })))
pruefe('Studio „Independent“ ist kein Studio', !hatAufnahmeBeleg(e({ studios: ['Independent'] })))
pruefe('Sender als Netzwerk ohne Anbieter (angekündigt): aufgenommen', hatAufnahmeBeleg(e({ netzwerk: 'Netflix' })))
pruefe('Studio ohne Netzwerk (angekündigt): aufgenommen', hatAufnahmeBeleg(e({ studios: ['Beispielstudio'] })))
pruefe('Deutscher Anbieter genügt, auch bei YouTube-Netzwerk', hatAufnahmeBeleg(e({ anbieterDe: ['Netflix'], netzwerk: 'YouTube' })))

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
