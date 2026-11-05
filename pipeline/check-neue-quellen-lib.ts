/**
 * Reine Funktionen für neue Beleg-Adressen (`pipeline/lib/neue-quellen.ts`): welche Adressen neu sind, welches Urteil ein Status ergibt,
 * was ausgelassen wird, und dass das Abrufmaximum nur echte Abrufe zählt.
 */
import { neueQuellen, pruefeQuellen, urteilVon, wirdAusgelassen } from './lib/neue-quellen.ts'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}

const ALT = `- slug: a
  sources: [https://beispiel.test/alt]
- slug: b
  sources:
    - https://beispiel.test/b1
    - https://beispiel.test/b2
`
const NEU = `- slug: a
  sources: [https://beispiel.test/alt, https://beispiel.test/neu-a]
- slug: b
  sources:
    - https://beispiel.test/b1
  premiere:
    quelle: https://beispiel.test/neu-quelle
  disputedDates:
    - date: "2026-01-01"
      source: https://beispiel.test/neu-source
`

// Neue, unveränderte und entfernte Adressen
const neu = neueQuellen('x.yaml', ALT, NEU)
const adressen = neu.map((n) => n.adresse).sort()
pruefe('neue Adressen aus sources, quelle und source', JSON.stringify(adressen) === JSON.stringify(['https://beispiel.test/neu-a', 'https://beispiel.test/neu-quelle', 'https://beispiel.test/neu-source']), adressen)
pruefe('unveränderte Adresse nicht dabei', !adressen.includes('https://beispiel.test/alt') && !adressen.includes('https://beispiel.test/b1'))
pruefe('entfernte Adresse nicht dabei', !adressen.includes('https://beispiel.test/b2'))
pruefe('Fundstelle nennt slug und Feld', neu.find((n) => n.adresse.endsWith('neu-a'))?.schluessel === 'a.sources', neu)
pruefe('Fundstelle tief im Eintrag nennt den slug', neu.find((n) => n.adresse.endsWith('neu-quelle'))?.schluessel === 'b.premiere.quelle', neu)
pruefe('Datei neu (Basis null): alles neu', neueQuellen('x.yaml', null, NEU).length === 5)
pruefe('url-Felder zählen nicht', neueQuellen('x.yaml', '[]', '- slug: c\n  url: https://beispiel.test/anbieter\n').length === 0)
pruefe('gleiche Adresse in einem anderen Eintrag ist nicht neu', neueQuellen('x.yaml', ALT, ALT + '- slug: c\n  sources: [https://beispiel.test/alt]\n').length === 0)

// Urteil: nur 404/410 sind rot, jeder andere Fehler ist Nichtauskunft
const erwartet: [number | null, string][] = [[200, 'ok'], [301, 'ok'], [404, 'tot'], [410, 'tot'], [403, 'nichtauskunft'], [429, 'nichtauskunft'], [500, 'nichtauskunft'], [503, 'nichtauskunft'], [null, 'nichtauskunft']]
for (const [status, soll] of erwartet) pruefe(`Status ${status} ergibt ${soll}`, urteilVon(status) === soll, urteilVon(status))

// Ausgelassene Hosts
for (const a of ['https://www.anisearch.de/anime/1', 'https://www.netflix.com/title/82012956', 'https://netflix.com/title/1', 'https://cdn.anisearch.com/x.jpg', 'https://www.crunchyroll.com/de/series/x', 'https://animationdigitalnetwork.com/de/video/1', 'ftp://x.test/y', 'kein url'])
  pruefe(`ausgelassen: ${a}`, wirdAusgelassen(a))
for (const a of ['https://www.anime2you.de/news/1', 'https://uci-kinowelt.de/x', 'https://notanisearch.de/x', 'https://www.whats-on-netflix.com/x', 'https://crunchyroll.com.beispiel.test/x'])
  pruefe(`nicht ausgelassen: ${a}`, !wirdAusgelassen(a))

// Ablauf: aniSearch ohne Abruf, Maximum zählt nur Abrufe, Doppelte nur einmal
const gefragt: string[] = []
const attrappe = async (a: string) => {
  gefragt.push(a)
  return a.endsWith('tot') ? 404 : a.endsWith('403') ? 403 : 200
}
const eingabe = ['https://a.test/tot', 'https://www.anisearch.de/x', 'https://a.test/403', 'https://a.test/tot', 'https://a.test/ok', 'https://a.test/ok2'].map((adresse) => ({ datei: 'd', schluessel: 's', adresse }))
const befunde = await pruefeQuellen(eingabe, attrappe, 3)
pruefe('aniSearch wird nie abgerufen', !gefragt.some((a) => a.includes('anisearch')), gefragt)
pruefe('doppelte Adresse nur einmal abgerufen', gefragt.filter((a) => a.endsWith('/tot')).length === 1, gefragt)
pruefe('Maximum 3 Abrufe, ausgelassene zählen nicht mit', gefragt.length === 3, gefragt)
pruefe('Urteile in Reihenfolge', befunde.map((b) => b.urteil).join() === 'tot,ausgelassen,nichtauskunft,ok,ungeprueft', befunde.map((b) => b.urteil))
const zeitueberschreitung = await pruefeQuellen([{ datei: 'd', schluessel: 's', adresse: 'https://a.test/x' }], async () => null, 5)
pruefe('Zeitüberschreitung ist Nichtauskunft', zeitueberschreitung[0].urteil === 'nichtauskunft')

if (fehler.length) {
  console.error(`check-neue-quellen-lib: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-neue-quellen-lib: neue/unveränderte/entfernte Adresse, 404/410 rot, 403/429/5xx/Zeitüberschreitung Nichtauskunft, aniSearch/Crunchyroll/ADN ausgelassen, Maximum nur für Abrufe.')
