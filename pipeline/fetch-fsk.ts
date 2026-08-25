/**
 * Die Sprachfassung eines Kinofilms bei der FSK belegen.
 *
 * ## Warum ausgerechnet die FSK
 *
 * Am 25.08.2026 wurden sieben Quellen für die Frage „läuft dieser Kinofilm auf
 * Deutsch?" geprüft. Sechs fallen aus — TMDB (Termin ja, Fassung nein),
 * KinoCheck (nur Trailer), MovieGlu (`version_type` ist das Bildformat),
 * InsideKino (nennt keine Fassung), Deutsche Synchronkartei (`robots.txt`
 * sperrt Suche und JSON-Pfad), kinoheld (führt die Fassung, lädt sie aber über
 * den gesperrten `/ajax/`-Pfad nach).
 *
 * Anime2You nennt sie, ist aber **nachrichtengetrieben**. Daniel am 25.08.2026:
 * „sie verlässt sich darauf, dass ein Nachrichtensender darüber einen Artikel
 * schreibt … man kann sich nicht 100% darauf verlassen, dass sie rechtzeitig
 * berichten. Was sie berichten, darauf kann man sich verlassen, dass es zum
 * Zeitpunkt der Veröffentlichung stimmt, aber solche Infos können sich
 * nachträglich immer ändern."
 *
 * **Die FSK hat keine dieser Schwächen.** Jede Fassung, die in einem deutschen
 * Kino läuft, braucht eine Freigabe — das ist keine redaktionelle Entscheidung,
 * sondern gesetzliche Voraussetzung. Wer geprüft wird, steht drin; wer nicht,
 * läuft nicht.
 *
 * ## Was gemessen wurde
 *
 * `robots.txt` trägt `Disallow:` **leer** — alles erlaubt, dazu eine Sitemap.
 * Die Freigabensuche spricht `/fskapi/ReleaseSearch` an und antwortet mit
 * sauberem JSON. Entscheidend ist `subproducts[].productLanguages`:
 *
 * | Film | `productLanguages` | Wirklichkeit |
 * |---|---|---|
 * | Detektiv Conan Film 29 | `["german"]` | deutsche Synchro — von Daniel im Kino gesehen |
 * | Colorful Stage! The Movie | `["subtitles"]` | „exklusiv OmU, keine Synchro geplant" |
 * | Gundam GQuuuuuuX -Beginning- | `["foreign","subtitles","englishSubtitles"]` | OmU |
 * | Overlord: The Sacred Kingdom | `["foreign","subtitles"]` | OmU |
 *
 * **Drei von drei OmU-Fällen richtig, der Synchronfall richtig.** Genau die
 * Unterscheidung, an der dieses Projekt hängt — und die keine andere geprüfte
 * Quelle liefert.
 *
 * ## `releaseDate` ist **nicht** der Kinostart
 *
 * Bei „Detektiv Conan Film 29" steht dort 25.08.2026 — genau unser Starttermin,
 * was zunächst wie ein zweiter Nutzen aussah. Der Gegentest widerlegt das: „A
 * NEW DAWN" trägt `releaseDate: 2026-08-02`, während der Film am **15.10.2026**
 * ins Kino kommt (Anime2You, mit Synchro-Trailer). Daneben steht
 * `__ratingReleaseDate: 06.07.2026` — das ist das Datum der Freigabe.
 *
 * Welches Datum `releaseDate` meint, sagt die FSK nirgends; für einen
 * Kalendertermin taugt es damit nicht. **Die FSK liefert die Fassung, TMDB den
 * Termin** — und genau deshalb ergänzen sich beide, statt einander zu ersetzen.
 *
 * ## Was dieser Lauf tut
 *
 * Für jeden Kino-Release im Bestand wird die Freigabe gesucht und die Fassung
 * abgelegt — nach `data/fsk-kino.json`. Übernommen wird nichts automatisch:
 * Die Zuordnung läuft über einen Titelvergleich, und ein falsch zugeordneter
 * Film bekäme eine fremde Sprachangabe.
 *
 * **Ein Abruf je Sekunde.** Die FSK ist eine Stiftung mit einer kleinen Seite,
 * kein Rechenzentrum.
 *
 * Aufruf: `npm run data:fsk`
 */
import { readJson, writeJson, log, sleep } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Release, Title } from '../shared/types.ts'

const ZIEL = 'data/fsk-kino.json'
const ABSTAND_MS = 1100

interface FskSubprodukt {
  fskNumber?: string
  title?: string
  productLanguages?: string[]
  runtimeMin?: number
}

interface FskTreffer {
  mainTitle?: string
  mainOriginalTitle?: string
  productType?: string
  releaseDate?: string
  productionType?: string[]
  subproducts?: FskSubprodukt[]
  __productTypeFull?: string
  __exploitationFormNice?: string
  __ratingString?: string
}

/** Was `productLanguages` über die deutsche Fassung sagt. */
export function fassungAus(sprachen: string[] | undefined): 'deutsch' | 'nur-untertitel' | 'unklar' {
  if (!sprachen?.length) return 'unklar'
  if (sprachen.includes('german')) return 'deutsch'
  // `foreign` heißt Originalton, `subtitles` deutsche Untertitel. Beides ohne
  // `german` ist genau der Fall, den dieses Projekt von einer Synchro trennt.
  if (sprachen.includes('subtitles') || sprachen.includes('foreign')) return 'nur-untertitel'
  return 'unklar'
}


async function suche(titel: string): Promise<FskTreffer[]> {
  const u = new URL('https://www.fsk.de/fskapi/ReleaseSearch')
  u.searchParams.set('searchTitle', titel)
  u.searchParams.set('searchLayout', 'full')
  u.searchParams.set('superType', 'single')
  const antwort = await fetch(u, {
    headers: {
      accept: 'application/json',
      'user-agent': 'anime-kalender.de (nicht-kommerziell, 1 Anfrage/s)',
    },
  })
  if (!antwort.ok) throw new Error(`FSK: HTTP ${antwort.status}`)
  const daten = (await antwort.json()) as { data?: { docs?: FskTreffer[] } }
  return daten.data?.docs ?? []
}

/**
 * Der Spielfilm, nicht der Trailer.
 *
 * Zu einem Kinostart führt die FSK mehrere Freigaben: den Film, meist zwei bis
 * drei Trailer, gelegentlich Werbung. Sie tragen fast denselben Titel und
 * **verschiedene** Sprachfassungen — ein Trailer läuft oft auf Deutsch, während
 * der Film untertitelt bleibt. Wer den ersten Treffer nimmt, bekommt die
 * Auskunft eines anderthalbminütigen Vorspanns.
 */
function spielfilmAus(treffer: FskTreffer[], name: string): FskTreffer | null {
  /**
   * Verglichen wird **wortweise**, nicht als ganze Zeichenkette.
   *
   * Der erste Anlauf verlangte, dass der eine Titel den anderen enthält. Das
   * fand einen von fünf: Unser „Detektiv Conan – Der gefallene Engel des
   * Highways" und die FSK-Fassung „DETEKTIV CONAN **FILM 29**: DER GEFALLENE
   * ENGEL DES HIGHWAYS" unterscheiden sich um zwei Wörter, und schon enthält
   * keiner den anderen.
   *
   * Jetzt zählt, ob die **bedeutungstragenden Wörter unseres** Titels alle im
   * FSK-Titel vorkommen. Die Gegenrichtung wäre falsch: Die FSK ergänzt gern
   * „FILM 29", „Teil 2" oder den Originaltitel, wir nicht.
   */
  const woerter = name
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter((w) => w.length > 2 && !['der', 'die', 'das', 'und', 'von', 'the', 'des', 'dem'].includes(w))
  if (!woerter.length) return null
  const passend = treffer.filter((t) => {
    if (t.productType !== 'SP') return false
    return [t.mainTitle, t.mainOriginalTitle].some((x) => {
      if (!x) return false
      const klein = x.toLowerCase()
      return woerter.every((w) => klein.includes(w))
    })
  })
  return passend[0] ?? null
}

async function main(): Promise<void> {
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const kino = releases.filter((r) => r.platform === 'kino')
  if (!kino.length) {
    log('FSK: keine Kino-Releases im Bestand.')
    return
  }

  const bekannt = readJson<{ filme?: Record<string, unknown> }>(ZIEL, {}).filme ?? {}
  const ergebnis: Record<string, unknown> = { ...bekannt }
  let belegt = 0
  let ohne = 0

  for (const r of kino) {
    const titel = titles.find((t) => t.id === r.titleId)
    /**
     * Gesucht wird mit dem **deutschen** Namen.
     *
     * Die FSK führt deutsche Verleihtitel („DETEKTIV CONAN FILM 29: DER
     * GEFALLENE ENGEL DES HIGHWAYS"). Mit „Meitantei Conan: Highway no
     * Datenshi" findet man dort nichts.
     */
    const name = r.name || titel?.titleDe || titel?.titleEn || titel?.titleRomaji
    if (!name) continue

    /**
     * **Kurz suchen, vollständig zuordnen.**
     *
     * Die FSK-Suche findet einen langen Verleihtitel nicht: „Detektiv Conan –
     * Der gefallene Engel des Highways" gibt null Treffer, „Detektiv Conan"
     * gibt zwanzig — darunter den richtigen. Gesucht wird deshalb mit den
     * ersten beiden bedeutungstragenden Wörtern, zugeordnet danach über den
     * vollen Titel.
     */
    const suchbegriff = name
      .split(/[^p{L}p{N}]+/u)
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .join(' ')
    if (!suchbegriff) continue

    await sleep(ABSTAND_MS)
    let treffer: FskTreffer[]
    try {
      treffer = await suche(suchbegriff)
    } catch (e) {
      log(`  FEHLER bei „${suchbegriff}": ${String(e).slice(0, 80)}`)
      continue
    }

    const film = spielfilmAus(treffer, name)
    if (!film) {
      ohne++
      ergebnis[r.slug] = { name, gefunden: false, geprueftAm: new Date().toISOString().slice(0, 10) }
      continue
    }

    const sprachen = film.subproducts?.[0]?.productLanguages
    const fassung = fassungAus(sprachen)
    if (fassung !== 'unklar') belegt++
    ergebnis[r.slug] = {
      name,
      gefunden: true,
      fskTitel: film.mainTitle,
      // **Kein Kinostart** — siehe den Abschnitt oben. Mitgeschrieben, weil es
      // bei der Nachschau hilft, nicht weil es einen Termin belegt.
      fskReleaseDate: film.releaseDate,
      fassung,
      productLanguages: sprachen,
      fskNummer: film.subproducts?.[0]?.fskNumber,
      freigabe: film.__ratingString?.replace(/<[^>]+>/g, ''),
      geprueftAm: new Date().toISOString().slice(0, 10),
    }
  }

  writeJson(ZIEL, { geholtAm: new Date().toISOString(), filme: ergebnis })
  log(`FSK: ${kino.length} Kino-Releases geprüft, ${belegt} mit belegter Fassung, ${ohne} nicht gefunden`)
  for (const [slug, e] of Object.entries(ergebnis)) {
    const x = e as { fassung?: string; fskTitel?: string; gefunden?: boolean }
    log(`  ${(x.fassung ?? 'nicht gefunden').padEnd(15)} ${slug.padEnd(34)} ${x.fskTitel ?? ''}`)
  }

  recordSource('fsk', belegt, belegt ? undefined : 'keine Fassung belegt')
}

await main()
