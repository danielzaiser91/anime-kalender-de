/**
 * Kinotermine und Sprachfassung von CineStar.
 *
 * ## Warum diese Quelle
 *
 * Am 25.08.2026 wurden acht Quellen für die Frage „läuft dieser Kinofilm auf
 * Deutsch?" geprüft. CineStar ist die einzige, die sie **je Vorstellung**
 * beantwortet — und sie tut es über eine offene Schnittstelle:
 *
 * | Endpunkt | liefert |
 * |---|---|
 * | `/api/cinema/` | 43 Standorte mit `id`, `city`, `slug` |
 * | `/api/cinema/{id}/show/` | alle Filme des Standorts mit `attributes` und `showtimes` |
 * | `/api/attribute/` | die Bedeutung der 80 Attribute |
 * | `/api/movie/{id}/` | Metadaten: Originaltitel, Laufzeit, Verleih, Regie |
 *
 * `robots.txt` sperrt nur `/app_dev.php`, `/app.php` und `/admin`. Kein
 * Schlüssel, keine Anmeldung.
 *
 * ## Die Fassung steht je Vorstellung, nicht je Film
 *
 * **Das ist der Punkt, an dem eine naive Auswertung falsch liegt.** Auf
 * Filmebene sind die Attribute die *Vereinigung* aller Vorstellungen: Der
 * Conan-Eintrag trägt oben `LANG_DE` **und** `LANG_JA` **und** `AUDIO_OmU`,
 * obwohl keine einzelne Vorstellung beides ist. Bei „Spider-Man" stehen
 * `LANG_EN` und `LANG_DE` nebeneinander.
 *
 * Erst die Vorstellung ist eindeutig:
 *
 * ```
 * 25.08. 16:50  LANG_DE                            → deutsch
 * 25.08. 17:00  AUDIO_OmU, LANG_JA, OV, OMU, SUBS  → OmU
 * ```
 *
 * ## Was in den Kalender kommt: der Tag, nicht die Uhrzeit
 *
 * Daniel am 25.08.2026: „tag genaue termine machen mehr sinn, weil nutzer vom
 * kalender überall in deutschland wohnen könnten, und definitiv nicht alle das
 * selbe kino besuchen würden, und sonst einen falschen eindruck bekommen, wenn
 * uhrzeit nicht mit ihrem kino übereinstimmt."
 *
 * Gemessen an „Detektiv Conan Film 29": **81 Vorstellungen in 36 Städten allein
 * am Starttag**, deutsche Anfangszeiten zwischen 16:50 und 20:00. Es gibt
 * keine „die" Uhrzeit eines Kinostarts. Deshalb sammelt dieser Lauf Tage und
 * Fassungen — und keine Uhrzeit.
 *
 * ## Warum alle 43 Standorte
 *
 * Für „Detektiv Conan" hätten drei genügt: 36 Standorte zeigen ihn, und **alle
 * 36 zeigen beide Fassungen**. Aber das ist ein Film mit bundesweiter
 * Auswertung. Ein kleinerer Titel läuft in fünf Städten, und wenn keine davon
 * unter den drei größten ist, sähen wir ihn gar nicht.
 *
 * 43 Abrufe kosten bei einer Anfrage je Sekunde rund 45 Sekunden und 6,5 MB —
 * weniger als vier Prime-Video-Seitenaufrufe. Für einen Wochenlauf ist das
 * nichts, und Vollständigkeit ist genau der Punkt, an dem Anime2You scheitert.
 *
 * Aufruf: `npm run data:cinestar`
 */
import { readJson, writeJson, log, sleep, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const ZIEL = 'data/cinestar.json'
const ABSTAND_MS = 1050
const KOPF = {
  accept: 'application/json',
  'user-agent': 'anime-kalender.de (nicht-kommerziell, 1 Anfrage/s)',
}

interface Kino {
  id: number
  name?: string
  city?: string
  slug?: string
}

interface Vorstellung {
  datetime?: string
  attributes?: string[]
  name?: string
}

interface CsFilm {
  id?: number
  title?: string
  movie?: number
  attributes?: Record<string, string> | string[]
  showtimes?: Vorstellung[]
  detailLink?: string
}

export type Fassung = 'deutsch' | 'OmU' | 'OV' | 'unbekannt'

/**
 * Welche Fassung eine **einzelne Vorstellung** hat.
 *
 * Die Reihenfolge ist nicht beliebig: `AUDIO_OmU` schlägt `LANG_DE`, weil eine
 * OmU-Vorstellung deutsche **Untertitel** trägt und deshalb ebenfalls
 * `LANG_DE`-nah ausgezeichnet sein kann. Wer zuerst auf `LANG_DE` prüft, hält
 * die Untertitel für eine Synchronfassung — genau die Verwechslung, an der
 * sich dieses Projekt von jedem anderen Kalender scheidet.
 */
export function fassungAus(attribute: string[] | undefined): Fassung {
  const a = attribute ?? []
  if (a.includes('AUDIO_OmU') || a.includes('AUDIO_OmeU')) return 'OmU'
  if (a.includes('AUDIO_OV')) return 'OV'
  if (a.includes('LANG_DE')) return 'deutsch'
  if (a.includes('LANG_JA')) return 'OmU'
  return 'unbekannt'
}

/** Zum Vergleichen: Kleinschreibung, ohne Satzzeichen, ohne Zusätze in Klammern. */
function schlicht(s: string): string {
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[–—-]\s*CineAnime\s*$/i, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
}

async function holeJson<T>(pfad: string): Promise<T | null> {
  try {
    const antwort = await fetch(`https://www.cinestar.de${pfad}`, { headers: KOPF })
    if (!antwort.ok) return null
    return (await antwort.json()) as T
  } catch {
    return null
  }
}

function alsListe<T>(daten: unknown): T[] {
  if (Array.isArray(daten)) return daten as T[]
  if (daten && typeof daten === 'object') {
    const o = daten as Record<string, unknown>
    if (Array.isArray(o.data)) return o.data as T[]
    return Object.values(o) as T[]
  }
  return []
}

/** Ein Film, wie er in `data/cinestar.json` landet. */
interface Sammlung {
  titel: string
  /** Unser Titel, wenn die Zuordnung eindeutig war. */
  anilistId?: number
  /** Je Tag: welche Fassungen an diesem Tag laufen und in wie vielen Städten. */
  tage: Record<string, { fassungen: Record<string, number>; staedte: string[] }>
  /** Über alle Tage: wo der Film überhaupt läuft. */
  staedte: string[]
  cineAnime: boolean
  detailLink?: string
}

async function main(): Promise<void> {
  const kinos = alsListe<Kino>(await holeJson('/api/cinema/'))
  if (!kinos.length) {
    warn('CineStar: keine Kinoliste erhalten.')
    return
  }
  log(`CineStar: ${kinos.length} Standorte`)

  const titles = readJson<Title[]>('public/data/titles.json', [])
  /**
   * Zugeordnet wird **wortweise**, nicht über den ganzen Namen.
   *
   * CineStar ergänzt die Reihennummer und den Reihennamen: „Detektiv Conan
   * **Film 29**: Der gefallene Engel des Highways **– CineAnime**". Unser Titel
   * heißt „Detektiv Conan: Der gefallene Engel des Highways". Ein Vergleich der
   * ganzen Zeichenketten findet das nie.
   *
   * Verlangt wird deshalb, dass **alle** bedeutungstragenden Wörter unseres
   * Titels im CineStar-Titel vorkommen. Die Gegenrichtung wäre falsch — der
   * Zusatz steht dort, nicht bei uns. Und mehrdeutige Namen fallen ganz heraus:
   * Ein falsch zugeordneter Kinotermin ist schlimmer als keiner.
   */
  const FUELL = new Set(['der', 'die', 'das', 'und', 'von', 'the', 'des', 'dem', 'ein', 'eine'])
  const zerlege = (s: string): string[] =>
    schlicht(s)
      .split(' ')
      .filter((w) => w.length > 2 && !FUELL.has(w))

  const kandidaten: Array<{ id: number; woerter: string[] }> = []
  for (const t of titles) {
    for (const n of [t.titleDe, t.titleEn, t.titleRomaji]) {
      if (!n) continue
      const woerter = zerlege(n)
      /**
       * **Mindestens drei Wörter**, sonst wird es beliebig.
       *
       * Der erste Anlauf ließ zwei genügen und ordnete prompt „Sunny Dancer"
       * und „The Danish Girl" Anime-Titeln zu — beides keine Anime. Bei zwei
       * kurzen Wörtern trifft irgendein Titel aus 2.762 immer.
       */
      if (woerter.length >= 3) kandidaten.push({ id: t.id, woerter })
    }
  }

  /**
   * Der eindeutige Treffer zu einem CineStar-Titel, sonst `undefined`.
   *
   * Zwei Bedingungen, und beide sind nötig:
   *
   * 1. **Wortgleichheit, nicht Teilzeichenkette.** `includes` lässt „sunny" in
   *    „sunnydancer" durchgehen; verglichen werden deshalb ganze Wörter.
   * 2. **Höchstens drei zusätzliche Wörter** auf CineStar-Seite. Der Zusatz
   *    dort ist „Film 29" oder „– CineAnime"; wer mehr braucht, um zu passen,
   *    passt nicht.
   */
  const ordneZu = (titel: string): number | undefined => {
    const csWoerter = new Set(zerlege(titel))
    const treffer = new Set<number>()
    for (const k of kandidaten) {
      if (!k.woerter.every((w) => csWoerter.has(w))) continue
      if (csWoerter.size - k.woerter.length > 3) continue
      treffer.add(k.id)
    }
    return treffer.size === 1 ? [...treffer][0] : undefined
  }

  const filme = new Map<string, Sammlung>()
  let fehler = 0

  for (const [i, kino] of kinos.entries()) {
    await sleep(ABSTAND_MS)
    const daten = await holeJson(`/api/cinema/${kino.id}/show/`)
    if (!daten) {
      fehler++
      continue
    }
    const stadt = kino.city ?? kino.name ?? String(kino.id)

    for (const f of alsListe<CsFilm>(daten)) {
      const titel = f.title ?? ''
      if (!titel) continue
      const attribute = Array.isArray(f.attributes)
        ? f.attributes
        : Object.values(f.attributes ?? {})
      const cineAnime = attribute.includes('ZGP_CINEANIME')

      const schluessel = schlicht(titel)
      const anilistId = ordneZu(titel)

      /**
       * Aufgenommen wird, was **entweder** zur Anime-Reihe gehört **oder**
       * einem unserer Titel entspricht.
       *
       * Nur `ZGP_CINEANIME` zu nehmen wäre zu eng — nicht jeder Anime-Film
       * läuft unter der Reihe. Nur den Titelabgleich zu nehmen wäre zu eng in
       * die andere Richtung: Ein Film, den wir noch nicht führen, ist genau
       * der interessante Fund.
       */
      if (!cineAnime && !anilistId) continue

      const bestand =
        filme.get(schluessel) ??
        ({ titel, anilistId, tage: {}, staedte: [], cineAnime, detailLink: f.detailLink } as Sammlung)
      bestand.cineAnime = bestand.cineAnime || cineAnime
      if (anilistId && !bestand.anilistId) bestand.anilistId = anilistId
      if (!bestand.staedte.includes(stadt)) bestand.staedte.push(stadt)

      for (const s of f.showtimes ?? []) {
        const tag = (s.datetime ?? '').slice(0, 10)
        if (!tag) continue
        const fassung = fassungAus(s.attributes)
        const eintrag = (bestand.tage[tag] ??= { fassungen: {}, staedte: [] })
        eintrag.fassungen[fassung] = (eintrag.fassungen[fassung] ?? 0) + 1
        if (!eintrag.staedte.includes(stadt)) eintrag.staedte.push(stadt)
      }
      filme.set(schluessel, bestand)
    }
    if ((i + 1) % 15 === 0) log(`  ${i + 1}/${kinos.length} Standorte`)
  }

  /** Was schon gelaufen ist, hilft dem Kalender nicht mehr. */
  const heute = new Date().toISOString().slice(0, 10)
  const ergebnis: Record<string, Sammlung> = {}
  for (const [k, v] of filme) {
    const kuenftig = Object.keys(v.tage).filter((t) => t >= heute)
    if (!kuenftig.length) continue
    ergebnis[k] = {
      ...v,
      tage: Object.fromEntries(kuenftig.sort().map((t) => [t, v.tage[t]])),
      staedte: v.staedte.sort(),
    }
  }

  writeJson(ZIEL, { geholtAm: new Date().toISOString(), standorte: kinos.length, filme: ergebnis })

  const mitDeutsch = Object.values(ergebnis).filter((f) =>
    Object.values(f.tage).some((t) => t.fassungen.deutsch),
  ).length
  log(
    `CineStar: ${Object.keys(ergebnis).length} Filme mit künftigen Terminen, ` +
      `${mitDeutsch} mit belegter deutscher Fassung` +
      (fehler ? ` (${fehler} Standorte nicht erreichbar)` : ''),
  )
  for (const f of Object.values(ergebnis)) {
    const erster = Object.keys(f.tage)[0]
    const arten = [...new Set(Object.values(f.tage).flatMap((t) => Object.keys(t.fassungen)))]
    log(
      `  ${erster}  ${f.titel.slice(0, 46).padEnd(48)} ${arten.join('+').padEnd(16)} ` +
        `${f.staedte.length} Städte${f.anilistId ? ` · AniList ${f.anilistId}` : ''}`,
    )
  }

  recordSource('cinestar', Object.keys(ergebnis).length)
}

await main()
