/**
 * Zusicherungen zu den Seiten für Suchmaschinen (13.10.2026): Ähnliche Titel bevorzugen belegte Synchro,
 * das A–Z-Verzeichnis, Brotkrumen und die Überschriften der Titelseiten. Läuft in `check:logic`, ohne Bestand.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aehnlicheTitel } from '../shared/aehnlich.ts'
import type { Title } from '../shared/types.ts'
import { erreichbar } from './lib/seiten-erreichbar.ts'
import { startseiteInhalt } from './lib/startseite.ts'
import { SITE, seitenTitel, synchroSatz } from './lib/titel-seite.ts'
import { brotkrumenHtml, brotkrumenJsonLd, titelKrumen } from './lib/titel-umfeld.ts'
import { gruppiere, schreibeVerzeichnis, type VerzeichnisTitel } from './lib/titel-verzeichnis.ts'
import { verzeichnisSchluessel } from './lib/verzeichnis-buchstabe.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, dubConfidence: Title['dubConfidence'], keywords: string[]): Title =>
  ({ id, slug: String(id), genres: ['Action'], keywords, dubConfidence, streams: [] }) as unknown as Title

{
  const fueller = Array.from({ length: 60 }, (_, i) => titel(1000 + i, 'high', [`f${i}`]))
  const ich = titel(1, 'high', ['k1', 'k2', 'k3'])
  const unbelegt = titel(2, 'normal', ['k1', 'k2', 'k3'])
  const belegt = titel(3, 'high', ['k1', 'k2', 'k3', 'k4'])
  const v = aehnlicheTitel(ich, [ich, unbelegt, belegt, ...fueller])
  const anteil = (id: number) => v.find((x) => x.title.id === id)?.anteil ?? 0
  pruefe('Ausgangslage: der unbelegte Titel ist rechnerisch ähnlicher', anteil(2) > anteil(3), v.map((x) => [x.title.id, x.anteil]))
  pruefe('Ähnliche Titel: belegte Synchro steht vor unbelegter', v[0]?.title.id === 3 && v[1]?.title.id === 2, v.map((x) => x.title.id))
  const nurUnbelegt = aehnlicheTitel(ich, [ich, unbelegt, ...fueller])
  pruefe('ein unbelegter Titel bleibt ein Vorschlag, wenn es keinen belegten gibt', nurUnbelegt[0]?.title.id === 2)
}

{
  const kopf = readFileSync('web/index.html', 'utf8')
  const inhalt = startseiteInhalt('<li>Termin</li>\n', 1, [])
  pruefe('Startseite: <title> nennt „Deutscher Anime-Kalender“', /<title>[^<]*Deutscher Anime-Kalender[^<]*<\/title>/.test(kopf))
  pruefe('Startseite: Überschrift ist „Deutscher Anime-Kalender“', inhalt.includes('>Deutscher Anime-Kalender</h1>'))
  pruefe('Startseite: Text nennt Synchro und die Anbieter', /Synchro/.test(inhalt) && ['Crunchyroll', 'Netflix', 'Prime Video'].every((a) => inhalt.includes(a)))
  pruefe('Startseite: die App überschreibt den Titel nicht', !/document\.title\s*=/.test(readFileSync('web/src/lib/i18n.tsx', 'utf8')))
}

{
  const schluessel = (n: string) => verzeichnisSchluessel(n)
  pruefe('Verzeichnis: Buchstabe aus dem Namen, Umlaute und Akzente als Grundbuchstabe', schluessel('Äpfel') === 'a' && schluessel('Éclair') === 'e' && schluessel('One Piece') === 'o')
  pruefe('Verzeichnis: Ziffern, Sonderzeichen und Vorsatzzeichen', schluessel('86 -Eighty Six-') === '0-9' && schluessel('„Fate“') === 'f' && schluessel('×××') === '0-9')
  const titelListe: VerzeichnisTitel[] = [
    { name: 'Naruto', adresse: '2', belegt: true },
    { name: 'Bleach', adresse: '1', belegt: true },
    { name: 'Berserk', adresse: '3', belegt: false },
    { name: '86', adresse: '4', belegt: true },
    { name: 'Bleach (doppelt)', adresse: '1', belegt: true },
  ]
  const gruppen = gruppiere(titelListe)
  pruefe('Verzeichnis: Gruppen A–Z, Ziffern zuerst, Namen sortiert, jede Adresse einmal', [...gruppen.keys()].join() === '0-9,b,n' && gruppen.get('b')!.map((e) => e.name).join() === 'Berserk,Bleach (doppelt)', [...gruppen])

  /* Ein Mini-Auftritt in einem Temp-Ordner: Startseite, Verzeichnis, Titelseiten. */
  const aufbau = (mitVerzeichnis: boolean): Map<string, number> => {
    const dist = mkdtempSync(join(tmpdir(), 'seiten-seo-'))
    try {
      const vorlage = { before: '<html><head>', after: '</head><body><div id="root"></div></body></html>', rootTag: '<div id="root"></div>' }
      const buchstaben = mitVerzeichnis ? schreibeVerzeichnis(dist, vorlage, titelListe) : []
      writeFileSync(join(dist, 'index.html'), startseiteInhalt('', 0, buchstaben))
      for (const e of titelListe) {
        mkdirSync(join(dist, 't', e.adresse), { recursive: true })
        writeFileSync(join(dist, 't', e.adresse, 'index.html'), '<html></html>')
      }
      return erreichbar(dist, SITE, 3)
    } finally {
      rmSync(dist, { recursive: true, force: true })
    }
  }
  const haupt = (dubConfidence: Title['dubConfidence'], dub: boolean) =>
    ({ id: 1, slug: '1', genres: [], keywords: [], dubConfidence, streams: dub ? [{ platform: 'netflix', url: 'x', dub: true }] : [] }) as unknown as Title
  pruefe('Titelseite: belegte Synchro mit Streaming und Termin', seitenTitel('Cowboy Bebop', haupt('very-high', true), true) === 'Cowboy Bebop auf Deutsch: Synchro, Streaming und Termine')
  pruefe('Titelseite: belegte Synchro ohne Streaming-Weg und ohne Termin', seitenTitel('Trigun', haupt('high', false), false) === 'Trigun auf Deutsch: Synchro')
  pruefe('Titelseite: ohne belegte Synchro nie „auf Deutsch“', !seitenTitel('Frieren', haupt('normal', false), true).includes('auf Deutsch') && !seitenTitel('Frieren', haupt('low', true), false).includes('auf Deutsch'))
  pruefe('Titelseite: Cartoon ohne Synchro-Beleg heißt Animationsserie', seitenTitel('Bluey', { ...haupt('low', false), westlich: true } as Title, false) === 'Bluey: Animationsserie und wo sie läuft')
  pruefe('Beschreibung: „Mit deutscher Synchronisation“ nur bei Beleg', synchroSatz(haupt('high', false)) === 'Mit deutscher Synchronisation.' && !/Mit deutscher/.test(synchroSatz(haupt('normal', false)) ?? ''))
  const krumen = titelKrumen('Naruto', `${SITE}t/2/`, true)
  pruefe('Brotkrumen: Start › Verzeichnis › Buchstabe › Titel, als HTML mit Rücklinks und als BreadcrumbList', krumen.map((k) => k.name).join('|') === 'Anime-Kalender|Titel von A bis Z|N|Naruto' && brotkrumenHtml(krumen).includes(`<a href="${SITE}"`) && brotkrumenJsonLd(krumen).includes('"position":4'))
  pruefe('Brotkrumen: ein Titel außerhalb des Verzeichnisses führt zur Startseite', titelKrumen('X', `${SITE}t/x/`, false).length === 2)

  const mit = aufbau(true)
  pruefe('Verzeichnis: jede Titelseite ist von der Startseite in höchstens 3 Klicks erreichbar', titelListe.every((e) => mit.has(`t/${e.adresse}`)), [...mit.keys()])
  pruefe('Verzeichnis: ein Buchstabe ist von der Startseite aus ein Klick entfernt', mit.get('titel/b') === 1 && mit.get('t/3') === 2)
  const ohne = aufbau(false)
  pruefe('Gegenprobe: ohne Verzeichnis ist keine Titelseite erreichbar', titelListe.every((e) => !ohne.has(`t/${e.adresse}`)))
}

if (fehler) process.exit(1)
console.log('check-seiten-seo: ok')
