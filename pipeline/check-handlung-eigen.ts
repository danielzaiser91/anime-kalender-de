/**
 * Zusicherungen zu den eigenen Handlungstexten (`data/handlung-eigen.yaml`, 12.10.2026): ein Eintrag braucht Quelle, Umfang und Lizenz; er gilt nur, wo keine Quelle
 * einen deutschen Text liefert (Vorrang bleibt bei den Quellen); ein überholter oder verwaister Eintrag wird gemeldet (Bau-Warnung). Läuft in `check:logic`.
 * Die echte Datei wird auf Struktur geprüft; gegen den gebauten Bestand hält sie `check-handlung-eigen-bestand.ts` (check:bestand).
 */
import { eigeneHandlungFehler, eigeneTexteAktiv, ladeEigeneHandlungen, seitenQuelle, type EigeneHandlung } from './lib/handlung-eigen.ts'
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
  quellen: [
    { name: 'Wikipedia (DE)', url: 'https://de.wikipedia.org/wiki/Beispiel' },
    { name: 'aniSearch', url: 'https://www.anisearch.de/anime/1' },
  ],
}
const nurAnisearch: EigeneHandlung['quellen'] = [{ name: 'aniSearch', url: 'https://www.anisearch.de/anime/1' }]
const nurWikipedia: EigeneHandlung['quellen'] = [
  { name: 'Wikipedia (DE)', url: 'https://de.wikipedia.org/wiki/Beispiel' },
  { name: 'Wikipedia (EN)', url: 'https://en.wikipedia.org/wiki/Example' },
]
const freigabe = 'Daniel, 13.10.2026: Lizenz mit dem Betreiber geklärt'

pruefe('Struktur: ein vollständiger Eintrag ist in Ordnung', eigeneHandlungFehler([gut]).length === 0)
pruefe('Struktur: Eintrag ohne Quelle ist ein Fehler', eigeneHandlungFehler([{ ...gut, quellen: [] }]).some((f) => f.includes('keine Quelle')))
pruefe('Struktur: Quelle ohne https-Adresse ist ein Fehler', eigeneHandlungFehler([{ ...gut, quellen: [{ name: 'x', url: 'http://a.de' }] }]).length === 1)
pruefe('Struktur: Text, Umfang und Lizenz sind Pflicht', eigeneHandlungFehler([{ ...gut, text: ' ', umfang: 'staffel' as never, lizenz: '', quellen: [{ name: 'x', url: 'https://a.de' }], freigabe }]).length === 3)
pruefe('Struktur: zwei Quellen gleichen Namens sind ein Fehler', eigeneHandlungFehler([{ ...gut, quellen: [...gut.quellen, { name: gut.quellen[0]!.name, url: 'https://en.wikipedia.org/wiki/Zweite' }] }]).some((f) => f.includes('Name')))
pruefe('Struktur: doppelte Kennung ist ein Fehler', eigeneHandlungFehler([gut, gut]).some((f) => f.includes('doppelt')))
pruefe('Struktur: Wikipedia-Quelle verlangt CC BY-SA 4.0', eigeneHandlungFehler([{ ...gut, lizenz: 'frei' }]).some((f) => f.includes('Wikipedia')))

/* Quellenregel (13.10.2026): Fakten aus mindestens zwei Quellen oder ausdrückliche Freigabe; aniSearch allein nie unter CC. */
const quellenFehler = (e: EigeneHandlung) => eigeneHandlungFehler([e]).join('; ')
pruefe('Quellen: nur aniSearch mit CC BY-SA ist ein Fehler', quellenFehler({ ...gut, quellen: nurAnisearch }).includes('nicht unter CC'))
pruefe('Quellen: nur aniSearch mit CC BY-SA bleibt auch mit Freigabe ein Fehler', quellenFehler({ ...gut, quellen: nurAnisearch, freigabe }).includes('nicht unter CC'))
pruefe('Quellen: nur aniSearch, andere Lizenz, ohne Freigabe ist ein Fehler', quellenFehler({ ...gut, quellen: nurAnisearch, lizenz: 'Betreiber-Erlaubnis' }).includes('nur eine Quelle'))
pruefe('Quellen: nur aniSearch, andere Lizenz, mit Freigabe ist in Ordnung', quellenFehler({ ...gut, quellen: nurAnisearch, lizenz: 'Betreiber-Erlaubnis', freigabe }) === '')
pruefe('Quellen: zwei Wikipedia-Sprachen zählen als eine Quelle', quellenFehler({ ...gut, quellen: nurWikipedia }).includes('nur eine Quelle'))
pruefe('Quellen: Wikipedia und aniSearch sind zwei Quellen', quellenFehler(gut) === '')
pruefe('Quellen: eine Freigabe ohne Namen und Datum zählt nicht', quellenFehler({ ...gut, quellen: nurWikipedia, freigabe: 'passt schon' }).includes('nur eine Quelle'))
pruefe('Quellen: zwei aniSearch-Seiten sind eine Quelle', quellenFehler({ ...gut, quellen: [...nurAnisearch, { name: 'aniSearch (Reihe)', url: 'https://www.anisearch.de/anime/2' }] }).includes('nicht unter CC'))

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
ergaenzeEigeneHandlungen(synopsen, echte.map((e) => ({ id: e.id })), [])
pruefe('Bau: Titel mit Quelltext behält ihn', synopsen[titel.id]!.de === 'Text aus einer Quelle' && !synopsen[titel.id]!.eigen)
pruefe('Bau: Reihentext trägt Text, Quellen, Lizenz und Reihenkennzeichen', synopsen[reihe.id]!.de === reihe.text && synopsen[reihe.id]!.eigen?.reihe === true && synopsen[reihe.id]!.eigen?.quellen.length === reihe.quellen.length && synopsen[reihe.id]!.eigen?.lizenz === reihe.lizenz)
pruefe('Bau: die englische Fassung bleibt neben dem eigenen Text', synopsen[reihe.id]!.en === 'English only')
pruefe('Teilen-Seite: Quellen und Lizenz stehen mit Links da, ein Text aus einer Quelle bekommt keine Zeile', seitenQuelle(synopsen[reihe.id]).includes('href="https://creativecommons.org/') && seitenQuelle(synopsen[reihe.id]).includes(reihe.quellen[0]!.url) && seitenQuelle({ de: 'x' }) === '')

pruefe('Datei: data/handlung-eigen.yaml ist gültig', eigeneHandlungFehler(echte).length === 0, eigeneHandlungFehler(echte).join('; '))

console.log(fehler ? `\nEigene Handlung: ${fehler} Zusicherung(en) verletzt.` : 'Eigene Handlung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
