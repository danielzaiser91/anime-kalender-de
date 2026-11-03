/**
 * Fälle zu `findeFremdeNotizseiten` (02.11.2026) ohne `public/data`: die echten Anlassfälle Haganai (Block der ersten Staffel
 * mit der Seite von Haganai NEXT) und Yashahime (Seite gehört InuYasha) als Rot, dazu Ausnahmen (`sharedWith`, mehrere Besitzer,
 * eigene Seite) und die Notizseite allein. Läuft in `check:logic`; der Bestand wird in `check-handbeleg-notizseite-bestand.ts` geprüft.
 */
import { baueBesitz, findeFremdeNotizseiten, type BlockSeite } from './lib/handbeleg-notizseite.ts'
import { ALTFAELLE, ratscheVerletzt } from './lib/handbeleg-notizseite-altfaelle.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const weg = (url: string, extra: object = {}) => ({ platform: 'primevideo', url, ...extra })
const titel = [
  { id: 14967, streams: [weg('https://www.amazon.de/gp/video/detail/B09JV7CC61')] },
  { id: 10719, streams: [weg('https://www.amazon.de/gp/video/detail/B0EIGEN001')] },
  { id: 249, streams: [weg('https://www.amazon.de/gp/video/detail/B0INUYASHA')] },
  { id: 131264, streams: [weg('https://www.amazon.de/gp/video/detail/B0D58K5WH5')] },
  { id: 900001, streams: [weg('https://www.amazon.de/gp/video/detail/B0SHARED01', { sharedWith: 2 })] },
  { id: 900002, streams: [weg('https://www.amazon.de/gp/video/detail/B0SHARED01', { sharedWith: 2 })] },
  { id: 900003, streams: [weg('https://www.amazon.de/gp/video/detail/B0PENDEL01')] },
  { id: 900004, streams: [weg('https://www.amazon.de/gp/video/detail/B0PENDEL01')] },
  { id: 900007, streams: [weg('https://www.amazon.de/gp/video/detail/B0SOLOSHA1', { sharedWith: 2 })] },
  { id: 900008, streams: [weg('https://www.amazon.de/s?k=x', { seite: 'https://www.amazon.de/gp/video/detail/B0NURSEITE' })] },
  { id: 900005, streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/B0NETFLIX1' }] },
]
const besitz = baueBesitz(titel, { 'https://www.amazon.de/dp/B0ZUGEORD1': { titleId: 900006 } })
const finde = (b: BlockSeite[]) => findeFremdeNotizseiten(b, besitz)
const block = (anilistId: number, url: string, note = '', platform = 'primevideo'): BlockSeite => ({ anilistId, platform, url, note })

pruefe('Haganai (10719) mit der Adresse von Haganai NEXT (14967) ist rot', finde([block(10719, 'https://www.amazon.de/dp/B09JV7CC61')]).join() === '10719@B09JV7CC61')
pruefe('Yashahime (131264) mit InuYasha-Seite nur in der Notiz ist rot, wenn InuYasha sie besitzt', finde([block(131264, 'https://www.amazon.de/dp/B0D58K5WH5', 'Tonspuren — Amazon-Seite B0INUYASHA: alle 27 Folgen')]).join() === '131264@B0INUYASHA')
pruefe('Eigene Adresse und eigene Notizseite: kein Treffer', finde([block(10719, 'https://www.amazon.de/dp/B0EIGEN001', 'Amazon-Seite B0EIGEN001: x')]).length === 0)
pruefe('Seite mit sharedWith: kein Treffer', finde([block(900001, 'https://www.amazon.de/dp/B0SHARED01'), block(900002, 'https://www.amazon.de/dp/B0SHARED01'), block(10719, 'https://www.amazon.de/dp/B0SHARED01')]).length === 0)
pruefe('sharedWith bei einem einzigen Besitzer: kein Treffer', finde([block(10719, 'https://www.amazon.de/dp/B0SOLOSHA1')]).length === 0)
pruefe('Besitz über das Feld seite zählt', finde([block(10719, 'https://www.amazon.de/dp/B0NURSEITE')]).join() === '10719@B0NURSEITE')
pruefe('Block mit dub: false zählt ebenfalls', finde([{ ...block(10719, 'https://www.amazon.de/dp/B09JV7CC61'), dub: false }]).join() === '10719@B09JV7CC61')
const unveraendert = block(10719, 'https://www.amazon.de/dp/B0WANDERT1')
const mitBesitzer = (ids: number[]) => baueBesitz(ids.map((id) => ({ id, streams: [weg('https://www.amazon.de/gp/video/detail/B0WANDERT1')] })), {})
pruefe('Besitzerlose Seite: kein Treffer', findeFremdeNotizseiten([unveraendert], mitBesitzer([])).length === 0)
pruefe('Seite bekommt einen fremden Besitzer: derselbe Block wird rot', findeFremdeNotizseiten([unveraendert], mitBesitzer([14967])).join() === '10719@B0WANDERT1')
pruefe('Seite hat zwei Besitzer: kein Treffer', findeFremdeNotizseiten([unveraendert], mitBesitzer([14967, 249])).length === 0)
pruefe('Seite fällt von zwei auf einen Besitzer: derselbe Block wird rot', findeFremdeNotizseiten([unveraendert], mitBesitzer([249])).join() === '10719@B0WANDERT1')
pruefe('Seite mit zwei Besitzern (pendelnd): kein Treffer', finde([block(10719, 'https://www.amazon.de/dp/B0PENDEL01')]).length === 0)
pruefe('Besitz aus prime-zugeordnet.json zählt', finde([block(10719, 'https://www.amazon.de/dp/B0ZUGEORD1')]).join() === '10719@B0ZUGEORD1')
pruefe('Netflix-Weg gilt nicht als Prime-Besitz', finde([block(10719, 'https://www.amazon.de/dp/B0NETFLIX1')]).length === 0)
pruefe('Block einer anderen Plattform zählt nicht', finde([block(10719, 'https://www.amazon.de/dp/B09JV7CC61', '', 'netflix')]).length === 0)
pruefe('Unbekannte Seite: kein Treffer', finde([block(10719, 'https://www.amazon.de/dp/B0UNBEKANN')]).length === 0)
pruefe('Adresse und Notizseite gleich: ein Treffer, nicht zwei', finde([block(10719, 'https://www.amazon.de/dp/B09JV7CC61', 'Amazon-Seite B09JV7CC61: x')]).length === 1)
pruefe('Zwei fremde Seiten desselben Blocks: zwei Treffer', finde([block(10719, 'https://www.amazon.de/dp/B09JV7CC61', 'Amazon-Seite B0INUYASHA: x')]).length === 2)
pruefe('Block ohne Kennung zählt nicht', finde([{ platform: 'primevideo', url: 'https://www.amazon.de/dp/B09JV7CC61' }]).length === 0)
pruefe('Nur die erste Adresskennung der URL zählt (Suchparameter fremder Seiten stört nicht)', finde([block(10719, 'https://www.amazon.de/dp/B0EIGEN001?ref=B09JV7CC61')]).length === 0)

const liste = (n: number) => Array.from({ length: n }, (_, i) => `${i}@B0X`)
pruefe('Ratsche: die echte Altfall-Liste hat höchstens 11 Einträge', !ratscheVerletzt(ALTFAELLE, 11), ALTFAELLE.length)
pruefe('Ratsche: genau an der Grenze ist grün', !ratscheVerletzt(liste(11), 11))
pruefe('Ratsche: ein Fall mehr als die Grenze ist rot', ratscheVerletzt(liste(12), 11))
pruefe('Ratsche: kürzere Liste ist grün', !ratscheVerletzt(liste(10), 11))

if (fehler) process.exit(1)
console.log(`check-handbeleg-notizseite: ${faelle} Fälle grün, Seite eines anderen Titels im Handbeleg-Block wird gemeldet.`)
