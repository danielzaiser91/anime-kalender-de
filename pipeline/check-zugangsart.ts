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
import { echteAmazonAdresse } from './lib/amazon-adresse.ts'
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

  /**
   * Der zweite Weg zum selben Urteil: ein gemessenes Kaufangebot.
   *
   * Der Kanalname deckt nicht alles ab. Neun Verweise antworteten bei oEmbed
   * mit HTTP 401 und trugen deshalb **keinen** — sie standen bis zum
   * 24.08.2026 als „kostenlos" im Kalender, darunter „Your Name", „FF7 Advent
   * Children" und „Fireworks".
   *
   * Zwei Fehler in einem, und der zweite ist der teurere: Der Lauf legte den
   * 401 pauschal als „kostenpflichtig" ab, ohne nachzusehen. An den
   * Videoseiten gemessen tragen **sechs** der neun ein Kaufangebot, drei
   * nicht — der 401 hat auch andere Ursachen (Altersfreigabe,
   * Einbettungssperre), und zwei der drei sind sogar Folgen mit Untertiteln
   * statt Synchro. Belegt wird der Kauf seither über `offerId` auf der
   * Videoseite.
   */
  const mitKaufangebot = new Set(
    Object.entries(readJson<Record<string, { kaufAngebot?: boolean }>>(resolve(ROOT, 'data/youtube-befunde.json'), {}))
      .filter(([, b]) => b?.kaufAngebot === true)
      .map(([url]) => url),
  )
  const gratisTrotzKasse: string[] = []
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'youtube' || !mitKaufangebot.has(s.url)) continue
      if (s.zugang !== 'kauf') gratisTrotzKasse.push(`${t.titleRomaji ?? t.id}: ${s.zugang}`)
    }
  }
  pruefe(
    `kein Verweis mit belegtem Kaufangebot steht als kostenlos (${mitKaufangebot.size} belegt)`,
    gratisTrotzKasse.length === 0,
    gratisTrotzKasse.slice(0, 3),
  )

  // Beide Richtungen der Regel selbst, unabhängig vom Datenstand.
  const beispiel = 'https://www.youtube.com/watch?v=IFKqfiIE66Q'
  pruefe(
    'ein belegtes Kaufangebot ergibt „kauf"',
    zugangsart('youtube', undefined, beispiel, undefined, undefined, true) === 'kauf',
    zugangsart('youtube', undefined, beispiel, undefined, undefined, true),
  )
  pruefe(
    'ohne Beleg wird daraus kein Kauf',
    zugangsart('youtube', undefined, beispiel, undefined, undefined, false) !== 'kauf',
    zugangsart('youtube', undefined, beispiel, undefined, undefined, false),
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

{
  /*
    **Aus einer Suchadresse wird die echte Titelseite.**

    Die 118 Prime-Suchadressen kann heute niemand prüfen — auf einer
    Trefferliste stehen keine Tonspuren. Die Erweiterung führt seit 3.39 zur
    Titelseite; gemeldet wird weiterhin unter der Suchadresse, weil nur die im
    Datensatz steht. Die echte Seite kommt aus der Notiz.

    Geprüft wird mit eigenen Fällen, nicht am Bestand: Diese Liste soll leer
    werden, und eine Zusicherung, die daran hängt, wird rot, sobald die Arbeit
    getan ist (siehe CLAUDE.md).
  */
  const suche = 'https://www.amazon.de/s?k=Cowboy%20Bebop&i=instant-video'
  pruefe(
    'aus Suchadresse und Notiz wird die Titelseite',
    echteAmazonAdresse({ plattform: 'primevideo', url: suche, notiz: 'Amazon-Seite B000W9GBW6: 26 Folgen geprüft' }) ===
      'https://www.amazon.de/dp/B000W9GBW6',
  )
  /* Prime Video führt neben zehnstelligen ASINs auch GTIs mit 26 Zeichen. */
  pruefe(
    'eine lange Kennung (GTI) wird nicht abgeschnitten',
    echteAmazonAdresse({ plattform: 'primevideo', url: suche, notiz: 'Amazon-Seite 0J16B1NAB82TO0O5A5Q8TLG1VP: geprüft' }) ===
      'https://www.amazon.de/dp/0J16B1NAB82TO0O5A5Q8TLG1VP',
  )
  pruefe(
    'ein echter Titelverweis wird nicht angefasst',
    echteAmazonAdresse({
      plattform: 'primevideo',
      url: 'https://www.amazon.de/dp/B0F2HPCC5Q',
      notiz: 'Amazon-Seite B0F2HPCC5Q: geprüft',
    }) === null,
  )
  pruefe(
    'ohne Kennung in der Notiz bleibt es bei der Suchadresse',
    echteAmazonAdresse({ plattform: 'primevideo', url: suche, notiz: 'von Hand geprüft' }) === null,
  )
  pruefe(
    'ein fremder Anbieter bleibt unberührt',
    echteAmazonAdresse({ plattform: 'netflix', url: suche, notiz: 'Amazon-Seite B000W9GBW6: x' }) === null,
  )
}
console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
