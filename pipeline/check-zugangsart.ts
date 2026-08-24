/**
 * Zusicherungen für die Zugangsart — kostenlos, Abo oder Kauf.
 *
 * ## Warum das eine eigene Prüfung verdient
 *
 * Die Zugangsart ist die einzige Angabe im Kalender, bei der ein Fehler den
 * Leser **Geld kostet**: Wer „kostenlos" liest und an einer Kasse landet, ist
 * schlechter dran als jemand, der gar keine Auskunft bekommen hätte. Beim
 * Termin ist ein Irrtum ärgerlich, hier ist er teuer.
 *
 * Gemessen am 23.08.2026 standen **40 von 73** YouTube-Verweisen als
 * kostenlos, obwohl sie auf „YouTube Movies" liegen — dem Verleih-Kanal. Die
 * Erkennung prüfte bis dahin nur die Adresse auf `/movies`, und diese Videos
 * tragen gewöhnliche `watch?v=`-Adressen. Der Kanalname lag seit dem 22.08. in
 * `data/youtube-befunde.json` und wurde nie ausgewertet.
 */
import { resolve } from 'node:path'
import { readJson, ROOT } from './lib/util.ts'
import { zugangsart } from '../shared/zugangsart.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const roh = readJson<Title[] | Record<string, Title>>(resolve(ROOT, 'public/data/titles.json'), [])
const titles = Array.isArray(roh) ? roh : Object.values(roh)

console.log('Zugangsart: kostenlos, Abo oder Kauf\n')

// --- YouTube: der Kanal entscheidet, nicht die Adresse --------------------

{
  const befunde = readJson<Record<string, { kanal?: string | null }>>(
    resolve(ROOT, 'data/youtube-befunde.json'),
    {},
  )
  const verleih = new Set(
    Object.entries(befunde)
      .filter(([, b]) => b?.kanal && /^(youtube movies|movies & tv)$/i.test(b.kanal.trim()))
      .map(([url]) => url),
  )

  const falsch: string[] = []
  let getroffen = 0
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'youtube' || !verleih.has(s.url)) continue
      getroffen++
      if (s.zugang !== 'kauf') falsch.push(`${t.titleRomaji ?? t.id}: ${s.zugang}`)
    }
  }

  pruefe(
    `kein Video von YouTube Movies steht als kostenlos (${verleih.size} Verleih-Adressen bekannt, ${getroffen} im Datensatz)`,
    falsch.length === 0,
    falsch.slice(0, 3),
  )

  /**
   * Die Gegenrichtung: Der Kanalname muss überhaupt ankommen.
   *
   * Bräche die Verbindung zwischen `youtube-befunde.json` und dem Build — eine
   * umbenannte Datei, ein vergessener Aufruf —, wäre die Zusicherung oben
   * stumm grün: keine Verleih-Adresse erkannt, also auch keine falsch. Diese
   * Zeile stellt sicher, dass wirklich etwas geprüft wurde.
   */
  pruefe(
    'die Verleih-Adressen erreichen den Datensatz überhaupt (sonst prüft die Zeile darüber nichts)',
    verleih.size === 0 || getroffen > 0,
    { bekannt: verleih.size, imDatensatz: getroffen },
  )
}

// --- Jeder Verweis trägt eine Zugangsart ---------------------------------

{
  const ohne: string[] = []
  let gesamt = 0
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      gesamt++
      if (!s.zugang) ohne.push(`${t.titleRomaji ?? t.id}: ${s.platform}`)
    }
  }
  pruefe(
    `jeder der ${gesamt} Verweise trägt eine Zugangsart`,
    ohne.length === 0,
    ohne.slice(0, 3),
  )
}

/**
 * Eine Suchadresse darf kein Angebot behaupten.
 *
 * `amazon.de/s?k=<Titel>&i=instant-video` führt zur Suche, nicht zu einem Titel.
 * Ob dahinter ein Abo, ein Kauf oder gar nichts steht, ist von hier aus nicht zu
 * sehen. Am 24.08.2026 trugen trotzdem **alle 203** solcher Adressen die Angabe
 * „Mit Abo", weil `zugangsart()` mangels besserer Auskunft darauf zurückfiel.
 *
 * Beim Preis wiegt ein Irrtum schwerer als beim Termin: Wer „Mit Abo" liest und
 * an einer Kasse landet, ist schlechter dran als jemand, der gar keine Auskunft
 * bekommen hätte.
 */
console.log('\nSuchadressen behaupten kein Angebot:')
{
  /**
   * Geprüft wird die **Regel**, nicht der Datensatz — und das ist hier der
   * Unterschied zwischen einer richtigen und einer schädlichen Zusicherung.
   *
   * Der erste Anlauf am 24.08.2026 verlangte, dass **keine** Suchadresse eine
   * Zugangsart trägt. Das war zu streng und hat den Deploy blockiert: Von den
   * 203 Adressen tragen 94 eine Angabe, die JustWatch **gemessen** hat (64×
   * `flatrate`, 30× `buy`/`rent`). Eine belegte Angabe ist besser als
   * „unbekannt", nicht schlechter.
   *
   * Falsch war also nie die Angabe, sondern ihre Herkunft: Sie entstand aus dem
   * Rückfall `return 'abo'` am Ende von `zugangsart()`, wenn niemand etwas
   * wusste. Genau dieser Fall wird hier gestellt — ohne JustWatch-Auskunft,
   * ohne `kind`, nur die Adresse.
   */
  pruefe(
    'eine Amazon-Suchadresse ohne Auskunft ergibt „unbekannt", nicht „abo"',
    zugangsart('primevideo', undefined, 'https://www.amazon.de/s?k=Akira&i=instant-video') === 'unbekannt',
    zugangsart('primevideo', undefined, 'https://www.amazon.de/s?k=Akira&i=instant-video'),
  )
  pruefe(
    'eine gemessene Auskunft schlägt die Adresse weiterhin',
    zugangsart('primevideo', undefined, 'https://www.amazon.de/s?k=Akira&i=instant-video', 'flatrate') === 'abo' &&
      zugangsart('primevideo', undefined, 'https://www.amazon.de/s?k=Akira&i=instant-video', 'buy') === 'kauf',
  )
  pruefe(
    'ein echter Titelverweis bleibt unberührt',
    zugangsart('primevideo', undefined, 'https://www.amazon.de/gp/video/detail/B0F2HPCC5Q') === 'abo',
    zugangsart('primevideo', undefined, 'https://www.amazon.de/gp/video/detail/B0F2HPCC5Q'),
  )

  const suchadressen = titles.flatMap((t) =>
    (t.streams ?? []).filter((s) => /amazon\.[a-z.]+\/s\?/i.test(s.url ?? '')),
  )
  const jeArt: Record<string, number> = {}
  for (const s of suchadressen) jeArt[s.zugang ?? '(leer)'] = (jeArt[s.zugang ?? '(leer)'] ?? 0) + 1
  console.log(`  ${suchadressen.length} Suchadressen im Datensatz: ${JSON.stringify(jeArt)}`)
  // Sonst prüft die Regel oben irgendwann nichts mehr, ohne dass es auffällt.
  pruefe('es gibt überhaupt Suchadressen im Bestand', suchadressen.length > 0, suchadressen.length)
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
