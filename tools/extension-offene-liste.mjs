/**
 * Die Liste der Netflix-Titel, bei denen eine Prüfung noch etwas bringt.
 *
 * Ohne sie meldete die Erweiterung **jede** Netflix-Seite: Am 22.08.2026 kam
 * ein Befund zu „Heroes" an, während Daniel dort einfach eine Serie sah. Sein
 * Urteil: „die extension stört beim gucken und will ich da nicht sehen."
 *
 * Aufgenommen wird nur, wo die Antwort fehlt — ein Titel, dessen Synchro schon
 * belegt ist, braucht keinen Knopf mehr.
 *
 * Je Adresse steht dabei, **welche Folgen** sich lohnen. Denn eine Netflix-Seite
 * bedient oft mehrere unserer Staffeln: „My Hero Academia" führt sieben unter
 * einer Adresse. Wer dort nur die erste Folge prüft, weiß nichts über Staffel 7
 * — und genau dort hört die deutsche Fassung auf (Daniel, 22.08.2026).
 *
 * Empfohlen werden **erste und letzte Folge je Staffel**: Sind beide gleich,
 * ist die Staffel einheitlich; weichen sie ab, liegt die Grenze dazwischen und
 * wird gesucht.
 *
 * Aufruf: node tools/extension-offene-liste.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
import { verdachtHinweis, verdachtsfaelle } from './verdacht.mjs'
/** Verweise, denen eine zweite Quelle widerspricht — sie gehören auf die Liste. */
const verdaechtig = verdachtsfaelle(wurzel, 'netflix')
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))

/** Die Kennung aus einer Netflix-Adresse — `/title/70302573` → `70302573`. */
function kennung(url) {
  return /\/title\/(\d+)/.exec(url)?.[1]
}

/** Reihenfolge der Staffeln: japanische Erstausstrahlung, nicht AniList-Kennung. */
const JAHRESZEIT = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
function vergleiche(a, b) {
  return (a.jpYear ?? 0) - (b.jpYear ?? 0) || (JAHRESZEIT[a.jpSeason] ?? 0) - (JAHRESZEIT[b.jpSeason] ?? 0)
}

/** Alle unsere Einträge je Netflix-Adresse — auch die schon beantworteten. */
const jeAdresse = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'netflix') continue
    const id = kennung(s.url)
    if (!id) continue
    jeAdresse.set(id, [...(jeAdresse.get(id) ?? []), { t, dub: s.dub }])
  }
}

/**
 * Was der Anbieter über seine eigenen Staffeln gesagt hat.
 *
 * Sie schlägt unsere Aufteilung, und zwar in beide Richtungen:
 *
 * - Netflix führt BAKI-DOU als **eine** Staffel mit 25 Folgen, wir als zwei mit
 *   13 und 12. Die Empfehlung „2e01" schickte Daniel zu einer Staffel, die es
 *   dort nicht gibt (22.08.2026).
 * - Bei My Hero Academia zählt Netflix über alle Staffeln durch: Staffel 7
 *   beginnt bei Folge 146. Eine Empfehlung „7e01" wäre ins Leere gegangen, und
 *   der Vermerk nach der Meldung („7e170") hätte nie zu ihr gepasst — deshalb
 *   färbte sich nichts ein.
 *
 * Bekannt ist sie erst nach der ersten Prüfung eines Titels. Bis dahin bleibt
 * unsere Aufteilung die beste Schätzung.
 */
const struktur = existsSync(resolve(wurzel, 'data/anbieter-staffeln.json'))
  ? JSON.parse(readFileSync(resolve(wurzel, 'data/anbieter-staffeln.json'), 'utf8'))
  : {}

/*
  **Die aniSearch-Kennung gehört auch in die Netflix- und Disney-Liste.**

  Daniel am 28.08.2026: „kannst du die anilist links mit anisearch ersetzen in
  der melde extension?" — Bei Prime steckte der Verweis schon im Prüfkasten, hier
  gab es gar keinen. aniSearch führt deutsche Titel, deutsche Beschreibungen und
  eine Episodenliste mit deutschen Folgentiteln; bei einer Reihe, die der
  Anbieter anders schneidet als wir, ist das die Seite, die es klärt.
*/
const anisearchKennung = (() => {
  try {
    const roh = JSON.parse(readFileSync(resolve(wurzel, 'data/anisearch.json'), 'utf8'))
    const jeId = {}
    for (const [id, wert] of Object.entries(roh)) if (wert?.anisearchId) jeId[id] = wert.anisearchId
    return jeId
  } catch {
    return {}
  }
})()

const offen = {}
for (const [id, eintraege] of jeAdresse) {
  /**
   * Gefragt wird nur nach dem, was auch angezeigt wird.
   *
   * Sonst steht ein Titel auf der Liste, weil eine OVA offen ist, zeigt aber nur
   * Serienstaffeln — und die sind alle beantwortet. Bei Haikyu!! war genau das
   * der Fall: vier abgehakte Staffeln, und trotzdem eine Zeile mit nichts zu tun.
   *
   * Netflix zählt die OVAs ohnehin als Folgen der Staffeln mit: Es meldet
   * 26 + 26 + 11 + 27 = 90 Folgen, unsere fünf Fernsehstaffeln haben 85, die
   * vier OVA-Einträge zusammen fünf. Wer die Staffel prüft, hat die OVA mit
   * geprüft.
   */
  const serien = eintraege.filter((e) => e.t.format === 'TV' || e.t.format === 'ONA')
  const zuZeigen = serien.length ? serien : eintraege
  /*
    **Ein Verdachtsfall hat ein Urteil — es ist nur womöglich überholt.**

    Der Grundfilter zeigt, was **kein** Urteil hat. Wer in
    `data/tonspur-verdacht.json` steht, hat eines, dem eine zweite Quelle
    widerspricht; er gehört genauso auf die Liste (Daniel, 31.08.2026: „das kann
    doch alles auf die prüfliste und mit extension gecheckt werden oder nicht?").
  */
  const verdacht = eintraege.map((e) => verdaechtig.get(e.t.id)).find(Boolean)
  if (!zuZeigen.some((e) => e.dub === undefined) && !verdacht) continue
  /**
   * OVAs und Specials fallen weg, wo Serienstaffeln dieselbe Adresse haben.
   *
   * An Haikyu!!s Netflix-Seite hängen neun unserer Einträge: fünf Fernsehstaffeln
   * und vier OVAs dazwischen. Netflix führt die OVAs nicht als eigene Staffeln —
   * es zeigt fünf. In der Liste standen sie trotzdem, und weil sie auf den
   * Positionen 2, 4, 6 und 8 lagen, hieß es dort „Film 2, Film 4, Film 6,
   * Film 8" bei einer Serie (Daniel, 22.08.2026: „komische liste und komisches
   * haiku!!").
   *
   * Ein Titel, an dessen Adresse **nur** Filme hängen, bleibt unberührt — dort
   * ist der Film die Sache selbst, nicht das Beiwerk.
   */
  const sortiert = [...zuZeigen].sort((a, b) => vergleiche(a.t, b.t))
  const gemeldet = struktur[id]?.staffeln
  if (gemeldet?.length) {
    // Der Anbieter hat selbst gesagt, wie er teilt — dann gilt seine Zählung,
    // denn genau die steht im Player und landet später im Vermerk.
    offen[id] = {
      ...(verdacht ? { wiedervorlage: verdachtHinweis(verdacht) } : {}),
      titel: sortiert[0].t.titleDe ?? sortiert[0].t.titleEn ?? sortiert[0].t.titleRomaji ?? '',
    asId: anisearchKennung[String(sortiert[0].t.id)] ?? null,
      asId: anisearchKennung[String(sortiert[0].t.id)] ?? null,
      staffeln: gemeldet.map((s, i) => ({
        nr: s.seq,
        name: s.name ?? `Staffel ${s.seq}`,
        folgen: s.folgen,
        // Die Nummer der ersten Folge — bei durchgezählten Reihen nicht 1.
        erste: s.erste ?? 1,
        film: eintraege.length === 1 && eintraege[0].t.format === 'MOVIE',
        /**
         * Ob diese Staffel noch offen ist, weiß nur unser Datensatz.
         *
         * Der Anbieter sagt, **wie** er teilt — nicht, was wir schon geprüft
         * haben. Ohne diesen Abgleich standen bei Aggretsuko plötzlich wieder
         * alle fünf Staffeln da, obwohl zwei davon belegt sind (22.08.2026).
         *
         * Gepaart wird der Reihe nach. Reicht unsere Liste nicht so weit,
         * gilt die Staffel als offen: Lieber einmal zu viel gefragt als eine
         * Lücke, von der niemand weiß.
         */
        /* Ein Verdachtsfall ist offen, obwohl er ein Urteil hat — es ist womöglich überholt. */
        offen: sortiert[i]
          ? sortiert[i].dub === undefined || verdaechtig.has(sortiert[i].t.id)
          : true,
      })),
      laut: 'anbieter',
    }
    /**
     * Bleibt nach dem Abgleich keine offene Staffel, gehört der Titel nicht auf
     * die Liste.
     *
     * Der Fall entsteht, wo der Anbieter gröber teilt als wir: Netflix führt
     * BAKI-DOU als **eine** Staffel, wir als zwei — die erste ist beantwortet,
     * die zweite hat bei Netflix keine Entsprechung. Auf der Liste stand dann
     * eine Zeile ohne eine einzige Folge zum Anklicken (22.08.2026).
     */
    if (!offen[id].staffeln.some((s) => s.offen)) delete offen[id]
    continue
  }
  offen[id] = {
    titel: sortiert[0].t.titleDe ?? sortiert[0].t.titleEn ?? sortiert[0].t.titleRomaji ?? '',
    asId: anisearchKennung[String(sortiert[0].t.id)] ?? null,
    staffeln: sortiert.map((e, i) => ({
      nr: i + 1,
      name: e.t.titleDe ?? e.t.titleEn ?? e.t.titleRomaji ?? '',
      folgen: e.t.episodes ?? 0,
      // Ein Film hat keine Folge zum Auswählen — man startet ihn einfach.
      // Ohne diese Angabe stand in der Liste „1e01" (Daniel, 22.08.2026).
      // Nur ein echter Film ist ein Film. OVAs und Specials sind meist Folgen
      // einer Staffel und werden oben ohnehin ausgefiltert, wo eine Serie
      // dieselbe Adresse hat.
      //
      // **Bis auf das Special, das allein auf seiner Seite steht.** „Pokémon:
      // Blauer Himmel in der Ferne!" ist ein SPECIAL mit einer Folge und einer
      // eigenen Netflix-Adresse; in der Liste stand „offen: E1", und die Folge
      // gab es nicht zum Anklicken (Daniel, 30.08.2026). Wo eine Serie dieselbe
      // Adresse hat, greift der Filter oben — was hier ankommt, steht für sich
      // und wird wie ein Film bedient. `=== 1` und nicht `<= 1`: „ONE PIECE"
      // läuft und trägt `folgen: 0`, ist aber eine Serie (22.08.2026).
      film: e.t.format === 'MOVIE' || (e.t.format !== 'TV' && e.t.episodes === 1),
      // Was hier schon beantwortet ist, muss niemand mehr anklicken.
      offen: e.dub === undefined || verdaechtig.has(e.t.id),
    })),
  }
}

const ziel = resolve(wurzel, 'extension/offene-netflix.js')
/**
 * Als Skript, nicht als JSON.
 *
 * Der Weg über `fetch(chrome.runtime.getURL(…))` scheiterte an Netflix'
 * Sicherheitsregeln: Die Seite lässt keine Abrufe auf `chrome-extension://` zu,
 * und die Erweiterung blieb stumm — kein Knopf, keine Meldung (Daniel,
 * 22.08.2026, mit Bild von netflix.com/browse).
 *
 * Ein Content-Script wird dagegen vom Browser selbst geladen, bevor die Seite
 * etwas dazu sagen kann. Daran kommt keine Regel der Seite heran.
 */
writeFileSync(ziel, 'globalThis.AK_OFFENE_TITEL = ' + JSON.stringify(offen) + '\n')
const staffeln = Object.values(offen).reduce((n, o) => n + o.staffeln.filter((s) => s.offen).length, 0)
console.log(`${Object.keys(offen).length} Netflix-Adressen mit ${staffeln} offenen Staffeln`)
