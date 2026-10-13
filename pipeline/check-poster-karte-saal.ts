/**
 * Zusicherung zur Poster-Kachel: Bündeln sich mehrere Kino-Termine eines Titels an einem Tag (`buendeleKacheln`),
 * zeigt auch der Kinosaal das „+N“ der gewöhnlichen Kachel. Der Bestand hat heute keinen solchen Fall, deshalb Mockdaten.
 * Läuft in `check:logic`.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReleaseEvent } from '@shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { istKinoSaal } from '../web/src/components/kalender/KinoBuehne.tsx'
import { Unterzeile } from '../web/src/components/kalender/PosterKarte.tsx'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const termin = (id: string, platform: 'kino' | 'netflix', time: string): ReleaseEvent =>
  ({ id, releaseSlug: 'film-x', titleId: 1, name: 'Film X', date: '2026-10-20', time, releaseType: 'movie', platform }) as ReleaseEvent

function unterzeile(kachel: ReleaseEvent[], anbieter?: Parameters<typeof Unterzeile>[0]['anbieter']): string {
  const [event] = kachel
  const saal = istKinoSaal(event!, undefined, !!anbieter)
  const props = { event: event!, buendel: kachel, anbieter, favorite: false, hidden: false, onOpen: () => {}, saal }
  return renderToStaticMarkup(Unterzeile(props))
}

const art = (): undefined => undefined
const kino = buendeleKacheln([termin('a', 'kino', '17:00'), termin('b', 'kino', '20:00'), termin('c', 'kino', '22:00')], art)
pruefe('drei Kino-Termine desselben Titels werden eine Kachel', kino.length === 1 && kino[0]!.length === 3, String(kino.length))
pruefe('die Kachel ist ein Kinosaal', istKinoSaal(kino[0]![0]!, undefined, false))
pruefe('Kinosaal mit gebündelten Terminen zeigt „+2“', unterzeile(kino[0]!).includes('>+2<'), unterzeile(kino[0]!))

const einzeln = buendeleKacheln([termin('a', 'kino', '17:00')], art)
pruefe('einzelner Kino-Termin: keine Unterzeile im Saal', unterzeile(einzeln[0]!) === '', unterzeile(einzeln[0]!))

const stream = buendeleKacheln([termin('a', 'netflix', '08:00'), termin('b', 'netflix', '09:00')], art)
pruefe('gewöhnliche Kachel zeigt unverändert „+1 Folgen“', unterzeile(stream[0]!).includes('+1 Folgen'), unterzeile(stream[0]!))

if (fehler > 0) {
  console.error(`check-poster-karte-saal: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-poster-karte-saal: ok')
