/**
 * `kanal` an einem Stream in `data/watch-links.yaml` (17.11.2026): Snowball Earth (196144) führt Prime nur über den Crunchyroll-Kanal; der Termin ist geschätzt
 * und baut keinen Weg, die Handadresse legt ihn an. Läuft gegen die echte Datei.
 */
import type { Title } from '../shared/types.ts'
import { ergaenzeWegeVonHand } from './bau/03-5-wege-von-hand.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, detail = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const titel = (id: number, streams: Title['streams'] = []) => ({ id, streams, watchLinks: [] }) as unknown as Title
const titles = new Map([
  [196144, titel(196144)],
  [171025, titel(171025, [{ platform: 'primevideo', url: 'https://www.amazon.de/s?k=Magilumiere&i=instant-video' }])],
])
ergaenzeWegeVonHand({ titles })

const snow = titles.get(196144)!.streams
pruefe('Snowball Earth: Prime-Weg mit Kanal und Adresse', snow.length === 1 && snow[0]!.platform === 'primevideo' && snow[0]!.kanal === 'Crunchyroll' && snow[0]!.url.includes('gti=amzn1.dv.gti.a49dacf7'), JSON.stringify(snow))
pruefe('Snowball Earth: kein Tonurteil am Weg', snow[0]?.dub === undefined)
const magi = titles.get(171025)!.streams
pruefe('vorhandener Weg bekommt nur die Adresse, keinen Kanal', magi.length === 1 && magi[0]!.url.includes('B0DDJ1CH7R') && magi[0]!.kanal === undefined, JSON.stringify(magi))

if (fehler) process.exit(1)
console.log('check-watch-links-kanal: ok')
