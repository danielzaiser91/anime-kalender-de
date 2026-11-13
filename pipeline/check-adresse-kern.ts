/**
 * Direkte Zusicherungen zu `shared/adresse-kern.ts`: Kern ohne Protokoll, Parameter und Schrägstrich; Amazon über die Kennung,
 * YouTube und Awin über ihren Parameter; Sammelseiten; Staffelmarke nur bei Netflix. Läuft in `check:logic`.
 */
import { adressGleich, adressKern, istSammelKern, ohneStaffelMarke } from '../shared/adresse-kern.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

// adressKern
pruefe('leer', adressKern(undefined), '')
pruefe('Protokoll, www, Parameter, Schrägstrich, Kleinschreibung', adressKern('https://www.Example.com/Pfad/?a=1'), 'example.com/pfad')
pruefe('Amazon /dp/', adressKern('https://www.amazon.de/dp/B0ABCDEFGH?tag=x'), 'amazon:b0abcdefgh')
pruefe('Amazon /gp/video/detail/', adressKern('https://www.amazon.de/gp/video/detail/B0ABCDEFGH/ref=x'), 'amazon:b0abcdefgh')
pruefe(
  'Amazon gti im Parameter',
  adressKern('https://x.example/out?gti=amzn1.dv.gti.0123abcd-0123-abcd-0123-0123456789ab'),
  'amazon-gti:amzn1.dv.gti.0123abcd-0123-abcd-0123-0123456789ab',
)
pruefe('YouTube behält v, Schreibung zählt', adressKern('https://www.youtube.com/watch?v=AbC_d-1&t=5'), 'youtube.com/watch?v=AbC_d-1')
pruefe('YouTube Playlist', adressKern('https://youtube.com/playlist?list=PLx1'), 'youtube.com/playlist?list=PLx1')
pruefe('YouTube ohne Kennung bleibt Pfad', adressKern('https://www.youtube.com/watch'), 'youtube.com/watch')
pruefe('Awin behält Produkt', adressKern('https://www.awin1.com/pclick.php?p=123&a=9'), 'awin1.com/pclick.php?p=123')

// adressGleich
pruefe('Amazon gleich trotz Pfadform', adressGleich('https://amazon.de/dp/B0ABCDEFGH', 'https://www.amazon.de/gp/video/detail/B0ABCDEFGH'), true)
pruefe('zwei Videos sind ungleich', adressGleich('https://youtube.com/watch?v=a', 'https://youtube.com/watch?v=b'), false)
pruefe('leer ist nie gleich', adressGleich(undefined, undefined), false)

// istSammelKern
pruefe('nur Host', istSammelKern('crunchyroll.com'), true)
pruefe('Länderseite', istSammelKern('anbieter.de/de'), true)
pruefe('Länderseite mit Region', istSammelKern('anbieter.de/pt-br'), true)
pruefe('Suche', istSammelKern('amazon.de/s'), true)
pruefe('Suche mit Pfad', istSammelKern('amazon.de/search/x'), true)
pruefe('Titelseite ist keine Sammelseite', istSammelKern('crunchyroll.com/de/series/abc'), false)

// ohneStaffelMarke
pruefe('Netflix Staffelmarke fällt weg', ohneStaffelMarke('https://www.netflix.com/title/1#s2'), 'https://www.netflix.com/title/1')
pruefe('Netflix Marke #0', ohneStaffelMarke('https://netflix.com/title/1#0'), 'https://netflix.com/title/1')
pruefe('andere Anbieter bleiben', ohneStaffelMarke('https://www.amazon.de/dp/B0ABCDEFGH#2'), 'https://www.amazon.de/dp/B0ABCDEFGH#2')

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-adresse-kern: ok')
