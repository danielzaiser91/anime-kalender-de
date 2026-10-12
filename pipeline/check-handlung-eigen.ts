/**
 * Zusicherungen zu den eigenen Handlungstexten (`data/handlung-eigen.yaml`, 12.10.2026): ein Eintrag braucht Quelle, Umfang und Lizenz; er gilt nur, wo keine Quelle
 * einen deutschen Text liefert (Vorrang bleibt bei den Quellen); ein überholter oder verwaister Eintrag wird gemeldet (Bau-Warnung). Läuft in `check:logic`.
 * Die echte Datei wird auf Struktur geprüft; gegen den gebauten Bestand hält sie `check-handlung-eigen-bestand.ts` (check:bestand).
 */
import { eigeneHandlungFehler, eigeneTexteAktiv, ladeEigeneHandlungen, seitenText, type EigeneHandlung } from './lib/handlung-eigen.ts'
import { ergaenzeEigeneHandlungen } from './bau/handlung-eigen-einbinden.ts'
import { type SynopsisEintrag } from './bau/13-1-anreichern.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const gut: EigeneHandlung = {
  id: 7,
  text: 'Ein eigener Text.',
  umfang: 'titel',
  lizenz: 'CC BY-SA 4.0',
  quellen: [{ name: 'Wikipedia (DE)', url: 'https://de.wikipedia.org/wiki/Beispiel' }],
}

pruefe('Struktur: ein vollständiger Eintrag ist in Ordnung', eigeneHandlungFehler([gut]).length === 0)
pruefe('Struktur: Eintrag ohne Quelle ist ein Fehler', eigeneHandlungFehler([{ ...gut, quellen: [] }]).some((f) => f.includes('keine Quelle')))
pruefe('Struktur: Quelle ohne https-Adresse ist ein Fehler', eigeneHandlungFehler([{ ...gut, quellen: [{ name: 'x', url: 'http://a.de' }] }]).length === 1)
pruefe('Struktur: Text, Umfang und Lizenz sind Pflicht', eigeneHandlungFehler([{ ...gut, text: ' ', umfang: 'staffel' as never, lizenz: '', quellen: [{ name: 'x', url: 'https://a.de' }] }]).length === 3)
pruefe('Struktur: doppelte Kennung ist ein Fehler', eigeneHandlungFehler([gut, gut]).some((f) => f.includes('doppelt')))
pruefe('Struktur: Wikipedia-Quelle verlangt CC BY-SA 4.0', eigeneHandlungFehler([{ ...gut, lizenz: 'frei' }]).some((f) => f.includes('Wikipedia')))

const hatText = (id: number) => id === 2
const bekannt = (id: number) => id !== 3
const { aktiv, ungenutzt } = eigeneTexteAktiv([{ ...gut, id: 1 }, { ...gut, id: 2 }, { ...gut, id: 3 }], hatText, bekannt)
pruefe('Vorrang: nur der Titel ohne anderen Text bleibt aktiv', aktiv.length === 1 && aktiv[0]!.id === 1)
pruefe('Veraltet: Titel mit Quelltext und unbekannter Titel werden gemeldet', ungenutzt.length === 2 && ungenutzt.some((u) => u.id === 2 && u.grund.includes('Quelle')) && ungenutzt.some((u) => u.id === 3))

/* Mit der echten Datei: Quelltext behält den Platz, der Rest bekommt den eigenen Text samt Quellen und Umfang. */
const echte = ladeEigeneHandlungen()
const reihe = echte.find((e) => e.umfang === 'reihe')!
const titel = echte.find((e) => e.umfang === 'titel')!
const synopsen: Record<number, SynopsisEintrag> = { [reihe.id]: { en: 'English only' }, [titel.id]: { de: 'Text aus einer Quelle' } }
ergaenzeEigeneHandlungen(synopsen, echte.map((e) => ({ id: e.id })))
pruefe('Bau: Titel mit Quelltext behält ihn', synopsen[titel.id]!.de === 'Text aus einer Quelle' && !synopsen[titel.id]!.eigen)
pruefe('Bau: Reihentext trägt Text, Quellen, Lizenz und Reihenkennzeichen', synopsen[reihe.id]!.de === reihe.text && synopsen[reihe.id]!.eigen?.reihe === true && synopsen[reihe.id]!.eigen?.quellen.length === reihe.quellen.length && synopsen[reihe.id]!.eigen?.lizenz === reihe.lizenz)
pruefe('Bau: die englische Fassung bleibt neben dem eigenen Text', synopsen[reihe.id]!.en === 'English only')
pruefe('Teilen-Seite: eigener Text nennt Quellen und Lizenz', seitenText(synopsen[reihe.id])?.endsWith(`(${reihe.lizenz}).`) === true)

pruefe('Datei: data/handlung-eigen.yaml ist gültig', eigeneHandlungFehler(echte).length === 0, eigeneHandlungFehler(echte).join('; '))

console.log(fehler ? `\nEigene Handlung: ${fehler} Zusicherung(en) verletzt.` : 'Eigene Handlung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
