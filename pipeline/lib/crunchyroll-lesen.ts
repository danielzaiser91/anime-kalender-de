/**
 * Eine Crunchyroll-Serie lesen — Staffeln, Folgen, deutsche Termine.
 *
 * Der Ablauf stand bis zum 22.08.2026 in `scrape-crunchyroll-dub.ts`. Er liegt
 * hier, weil ihn seither zwei Aufrufer brauchen: der Abruf selbst und die
 * Messung in `pipeline/messung-cr-katalog.ts`, die den deutschen Katalog gegen
 * den alten Bestand stellt. Eine zweite, nachgebaute Fassung desselben Ablaufs
 * würde genau das messen, was sie selbst tut, und nicht das, was der Abruf tut.
 *
 * Drei Stufen je Serie:
 *
 *   1. `seasons`  → je Staffel Titel, Folgenzahl und `versions`
 *   2. `episodes` → je Folge `versions`; **hier** entscheidet sich, wie viele
 *                   Folgen einer Staffel deutsch sind („3 von 8")
 *   3. `objects`  → die deutschen Kennungen aus Stufe 2, gebündelt. Nur dort
 *                   steht der **deutsche** Termin.
 *
 * Was hier **nicht** passiert: Crunchyrolls Staffeleinteilung wird nicht
 * übernommen. Sie ist ausschließlich Beleg für die Tonspur — unsere Einteilung
 * kommt von AniList und bleibt maßgeblich (`lib/crunchyroll-dub.ts`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { ROOT } from './util.ts'
import { todayIso } from '../../shared/time.ts'
import type { CrSerie, CrStaffel } from './crunchyroll-dub.ts'
import {
  BUENDEL,
  hatDeutsch,
  hauptStaffeln,
  nameNenntDeutsch,
  staffelAuszaehlen,
  type CrApiObjekt,
  type CrQuelle,
  type CrunchyrollSeiten,
} from './crunchyroll-api.ts'

/** Wohin die Rohantworten je Serie wandern. */
const ARCHIV_DIR = resolve(ROOT, 'data/crunchyroll-raw')

/**
 * Legt die Rohantworten einer Serie gzip-komprimiert ab.
 *
 * `CLAUDE.md`, „Beim Scrapen nichts wegwerfen": Der Abruf ist der teure und der
 * schädliche Teil, nicht das Speichern. Bei ADN war genau das am 12.08.2026
 * real — die Staffelangabe war längst über die Leitung gegangen und der einzige
 * Weg zu ihr trotzdem ein kompletter zweiter Lauf.
 *
 * **Die Region steht im Dateinamen**, seit es zwei Stände gibt: `G6DQDD3WR.de.json.gz`
 * ist der deutsche Katalog, `G6DQDD3WR.json.gz` der Bestand aus den Läufen bis
 * zum 21.08.2026 — durchgehend US, ohne dass es der Datei anzusehen war. Die
 * beiden dürfen sich nicht gegenseitig überschreiben: Aus demselben Namen
 * würden sonst abwechselnd zwei verschiedene Kataloge, und ein Parser über das
 * Archiv vergliche Äpfel mit Birnen. Ohne belegte Region bleibt es beim alten
 * Namen — der Browser-Weg weiß nicht, wo er steht.
 *
 * Eine Datei je Serie, unverändert nicht neu geschrieben: Git speichert binäre
 * Dateien vollständig neu, ein Sammelarchiv landete sonst bei jedem Lauf in
 * voller Größe in der Historie.
 */
export function archiviere(seriesId: string, katalog: string | undefined, inhalt: unknown): void {
  if (!existsSync(ARCHIV_DIR)) mkdirSync(ARCHIV_DIR, { recursive: true })
  const pfad = `${ARCHIV_DIR}/${seriesId}${katalog ? `.${katalog}` : ''}.json.gz`
  const neu = gzipSync(JSON.stringify(inhalt), { level: 9 })
  if (existsSync(pfad) && readFileSync(pfad).equals(neu)) return
  writeFileSync(pfad, neu)
}

/**
 * Manche Verweise zeigen auf eine **Folge**, nicht auf die Serie.
 *
 * `/de/watch/<guid>/<slug>` — 37 der 911 Adressen sahen so aus oder leiteten
 * dorthin um, und ein Seitenaufruf brachte dort naturgemäß keine Serienkennung.
 * Die Folgenkennung steht aber in der Adresse selbst, und `objects` nennt zu
 * jeder Folge ihre `series_id`. Das ist ein API-Aufruf statt eines
 * Seitenaufrufs — billiger als der Weg, der hier gescheitert ist.
 */
export async function serieHinterFolge(quelle: CrQuelle, url: string): Promise<string | undefined> {
  const guid = /\/watch\/([A-Z0-9]+)/i.exec(url)?.[1]
  if (!guid) return undefined
  const antwort = await quelle.objekte([guid])
  return antwort?.data?.[0]?.episode_metadata?.series_id
}

/**
 * Holt zu den deutschen Kennungen den **deutschen** Termin.
 *
 * Warum das ein eigener Aufruf ist: `/episodes` liefert die Episoden der
 * Originalstaffel, auch wenn dort eine deutsche Fassung in `versions` steht.
 * `versions` sagt zwar, *dass* es eine deutsche Fassung gibt, aber alle
 * Datumsfelder gehören zur japanischen Ausstrahlung. Für „Mushoku Tensei"
 * Staffel 3 stand dort der 04.07.2026 — die deutschen Folgen erschienen am
 * 19.08.2026 (Daniel, 21.08.2026).
 *
 * Übernommen wird ein Datum nur, wenn das Objekt selbst `audio_locale: de-DE`
 * meldet. Ein Objekt, das etwas anderes zurückgibt, als angefragt wurde, ist
 * kein Beleg für irgendetwas.
 */
async function deutscheTermine(quelle: CrQuelle, guids: string[], archiv: unknown[]): Promise<Map<string, string>> {
  const termine = new Map<string, string>()
  for (let i = 0; i < guids.length; i += BUENDEL) {
    const antwort = await quelle.objekte(guids.slice(i, i + BUENDEL))
    if (!antwort) continue
    archiv.push(JSON.parse(antwort.roh))
    for (const objekt of antwort.data as CrApiObjekt[]) {
      const m = objekt.episode_metadata
      if (m?.audio_locale !== 'de-DE' || !m.premium_available_date) continue
      termine.set(objekt.id, m.premium_available_date)
    }
  }
  return termine
}

/**
 * Liest eine Serie über eine der beiden Schnittstellen.
 *
 * `seiten` ist der zweite Beleg für „gibt es nicht mehr" und wird nur dann
 * angefordert, wenn die Staffelliste leer bleibt — ein Browser kostet Sekunden
 * beim Start, und die allermeisten Serien brauchen ihn nie. Fehlt der Rückruf,
 * bleibt eine leere Staffelliste eine Nichtauskunft: `nichtVerfuegbar` entfernt
 * Verweise aus dem Datensatz, und ein zerstörender Schluss braucht einen
 * zweiten Beleg (`CLAUDE.md`).
 */
export async function serieLesen(
  quelle: CrQuelle,
  url: string,
  seriesId: string,
  seiten?: () => Promise<CrunchyrollSeiten>,
): Promise<CrSerie> {
  const heute = todayIso()
  const kopf: CrSerie = { url, seriesId, quelle: 'api', katalog: quelle.katalog, geprueftAm: heute }
  const staffelAntwort = await quelle.staffeln(seriesId)
  if (!staffelAntwort) return { ...kopf, fehler: 'Content-API hat auf die Staffelliste nicht geantwortet' }

  const archiv: {
    seriesId: string
    url: string
    katalog?: string
    holtAm: string
    seasons: unknown
    episodes: Record<string, unknown>
    objects: unknown[]
  } = {
    seriesId,
    url,
    // Auch im Inhalt, nicht nur im Dateinamen: Wer das Archiv einliest, soll
    // die Region am Datensatz selbst ablesen können und nicht am Pfad.
    katalog: quelle.katalog,
    holtAm: new Date().toISOString(),
    seasons: JSON.parse(staffelAntwort.roh),
    episodes: {},
    objects: [],
  }

  /**
   * Eine Kennung ohne Staffeln ist für sich genommen eine **Nichtauskunft**.
   *
   * Was daraus wird, entscheidet die Seite — und nur sie. Der Abgleich am
   * 21.08.2026 zeigte, dass beide dasselbe meinen: „Durarara!!", „Nisekoi" und
   * „91 Days" liefern `total: 0`, und auf ihrer Seite steht „Leider sind die
   * Videos dieser Serie nicht mehr verfügbar." Genommen wird trotzdem die
   * Seite, nicht die Zahl.
   */
  if (!staffelAntwort.data.length) {
    archiviere(seriesId, quelle.katalog, archiv)
    if (!seiten) return { ...kopf, fehler: 'Content-API kennt keine Staffel zu dieser Kennung' }
    const befund = await (await seiten()).seitenBefund(url, true)
    if (befund.art) return { ...kopf, nichtVerfuegbar: true, fehler: befund.zeile }
    return { ...kopf, fehler: 'Content-API kennt keine Staffel zu dieser Kennung' }
  }

  const staffeln: CrStaffel[] = []
  const gesehen = new Set<string>()
  let unvollstaendig = false
  /**
   * Je Tonspur eine eigene Staffel — das führt nur der ältere CMS-Pfad.
   *
   * Ungefiltert zählte „Fairy Tail" 452 Folgen in fünf Blöcken statt 277 in
   * drei, und `beurteile()` legte unsere Staffeln an Blöcken an, die dieselben
   * Folgen zweimal führen. Die Begründung für die Auswahl steht bei
   * `hauptStaffeln()`.
   */
  for (const st of hauptStaffeln(staffelAntwort.data)) {
    if (gesehen.has(st.id)) continue
    gesehen.add(st.id)

    const folgenAntwort = await quelle.folgen(st.id)
    /**
     * Eine Staffel, die nicht antwortet, macht die **ganze** Serie unbrauchbar.
     *
     * `beurteile()` rechnet Blocksummen gegen unsere Staffeln; eine fehlende
     * Staffel verschöbe jede Zuordnung danach. Und „alle Blöcke vollständig
     * deutsch" wäre bei einem fehlenden Block schlicht falsch. Lieber gar keine
     * Aussage als eine aus lückenhafter Grundlage.
     */
    if (!folgenAntwort) {
      unvollstaendig = true
      break
    }
    archiv.episodes[st.id] = JSON.parse(folgenAntwort.roh)

    const { jeFolge, deutscheFolgen } = staffelAuszaehlen(folgenAntwort.data)
    const tonspuren = [...jeFolge.values()]
    const termine = deutscheFolgen.length
      ? await deutscheTermine(
          quelle,
          deutscheFolgen.map((f) => f.guid),
          archiv.objects,
        )
      : new Map<string, string>()
    staffeln.push({
      name: st.title || `Staffel ${st.season_number ?? '?'}`,
      staffelId: st.id,
      folgen: jeFolge.size,
      kacheln: folgenAntwort.data.length,
      deutsch: tonspuren.filter((t) => t === 'deutsch').length,
      fremd: tonspuren.filter((t) => t === 'fremd').length,
      deutscheFassung: hatDeutsch(st.versions),
      deutscheFolgen: deutscheFolgen.length
        ? deutscheFolgen.map((f) => ({ ...f, verfuegbarAb: termine.get(f.guid) }))
        : undefined,
    })
  }
  archiviere(seriesId, quelle.katalog, archiv)

  const deutschImAngebot =
    staffelAntwort.data.some((st) => hatDeutsch(st.versions)) || staffeln.some((s) => s.deutsch > 0)

  /**
   * Der Staffelname ist die Kontrolle, nicht der Beleg.
   *
   * Im deutschen Katalog trägt die Synchronfassung einen eigenen Block mit der
   * Fassung im Titel („Fairy Tail (German Dub)"). Wo Name und `versions`
   * dasselbe sagen, bestätigen sie einander; wo nicht, **gewinnt `versions`** —
   * ein Titel ist Redaktion, eine Fassungsliste ist Bestand. Der Fall wird
   * trotzdem festgehalten, weil ein Muster darin ein Hinweis auf einen
   * Denkfehler wäre und keiner auf einen Einzelfall.
   */
  const imNamen = staffelAntwort.data.some((st) => nameNenntDeutsch(st.title, st.slug_title))
  const namensWiderspruch =
    imNamen === deutschImAngebot
      ? undefined
      : imNamen
        ? 'ein Staffelname nennt die deutsche Fassung, versions führt kein de-DE'
        : 'versions führt de-DE, kein Staffelname nennt die deutsche Fassung'

  if (unvollstaendig) {
    return {
      ...kopf,
      deutschImAngebot,
      namensWiderspruch,
      fehler: 'mindestens eine Staffel hat keine Folgenliste geliefert',
    }
  }
  return { ...kopf, deutschImAngebot, namensWiderspruch, staffeln }
}
