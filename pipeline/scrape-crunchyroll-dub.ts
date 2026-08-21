/**
 * Liest auf den Crunchyroll-Serienseiten nach, welche Folgen deutsch vertont
 * sind.
 *
 * Warum überhaupt: Ein Stream-Verweis sagt nur, **dass** ein Titel dort läuft.
 * Für 1.156 Crunchyroll-Verweise stand deshalb dauerhaft „🇩🇪 ?" — und die von
 * Hand abzuarbeiten hieße, jede einzelne Seite selbst zu öffnen.
 *
 * Was die Seite hergibt, und zwar genau:
 *
 *   Audio: Japanese, Deutsch, English, …     ← Kopf der Serienseite
 *   Synchro | Untertitel                     ← unter einer Folgenkachel
 *   Synchro English | Untertitel             ← Synchro ja, aber englisch
 *   Untertitel                               ← gar keine Synchro
 *
 * Das nackte „Synchro" ohne Sprachzusatz ist die **deutsche** Fassung: Die
 * Seite läuft in deutscher Auslieferung, und Crunchyroll benennt dort nur die
 * fremden Tonspuren ausdrücklich.
 *
 * **Zwei Stufen, und die erste spart fast die ganze Arbeit** (Daniels Zuschnitt
 * vom 12.08.2026): Fehlt „Deutsch" in der Audio-Zeile, gibt es auf der ganzen
 * Seite keine deutsche Folge — dann ist die Seite nach einem Ladevorgang
 * erledigt, ohne Scrollen und ohne Staffelwechsel. Erst wenn Deutsch vorkommt,
 * wird genauer hingesehen; denn die Audio-Zeile steht schon da, wenn eine
 * **einzige** Folge deutsch ist. Bei „That Time I Got Reincarnated as a Slime"
 * etwa fehlt den letzten beiden Folgen der vierten Staffel die deutsche
 * Fassung noch.
 *
 * ## Zur Kennung — eine bewusste Ausnahme
 *
 * Dieser Abruf gibt sich als Chrome aus. Bei ADN und aniSearch haben wir genau
 * das abgeräumt, weil eine gefälschte Kennung dem Betreiber die Möglichkeit
 * nimmt, uns anzuschreiben statt auszusperren. Hier ist es eine gemessene
 * Entscheidung, keine Nachlässigkeit: Mit der ehrlichen Kennung antwortet
 * Crunchyroll zwar mit HTTP 200, liefert aber eine leere Hülle von 1,4 KB ohne
 * Titel und ohne Inhalt (geprüft am 12.08.2026). Es gibt also keinen ehrlichen
 * Weg zu diesen Daten, sondern nur diesen oder gar keinen.
 *
 * Was dafür spricht, ihn zu gehen: `robots.txt` erlaubt `/series/` ausdrücklich
 * (gesperrt sind Suche, Konto, Merkliste, Bezahlseiten), es gibt kein
 * Crawl-delay, und der Abruf ist selten und langsam getaktet.
 *
 * Aufruf: npm run data:cr-dub [-- --limit 10] [-- --nur <urlteil>]
 */
import { chromium, type Page } from 'playwright'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { fortschrittsMelder } from './lib/lauf-fortschritt.ts'
import type { Title } from '../shared/types.ts'
import { addDays, todayIso } from '../shared/time.ts'
import type { CrSerie, CrStaffel } from './lib/crunchyroll-dub.ts'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const LIMIT = zahl('--limit', 0)
const NUR = args.indexOf('--nur') >= 0 ? args[args.indexOf('--nur') + 1] : undefined
/** Ignoriert den vorhandenen Stand und holt alles neu. */
const NEU = args.includes('--neu')
/** Nur die Seiten, bei denen der letzte Lauf einen Fehler vermerkt hat. */
const NUR_FEHLER = args.includes('--nur-fehler')
/**
 * Ab wann eine gelesene Seite erneut drankommt.
 *
 * Der Grund für die Wiedervorlage: Bis zum 15.08.2026 entstand die
 * Kandidatenliste aus `stream.dub === undefined` — also aus „noch nie
 * beantwortet". Was einmal als `false` im Datensatz stand, fiel damit dauerhaft
 * aus der Warteschlange, und ein Falschnegativ konnte sich nie mehr korrigieren.
 * Genau das ist der wahrscheinlichere Fall, seit klar ist, dass Crunchyroll
 * Gästen weniger zeigt als Angemeldeten.
 *
 * Vier Wochen sind ein Kompromiss: Eine Synchro erscheint nicht wöchentlich neu,
 * und 917 Seiten wöchentlich zu holen wäre Last ohne Gegenwert.
 */
const WIEDERVORLAGE_TAGE = zahl('--alter', 28)

/** Was auf einer Folgenkachel steht. */
type Tonspur = 'deutsch' | 'fremd' | 'keine'

// Die Typen stehen in `lib/crunchyroll-dub.ts` — dort, wo auch die Auswertung
// wohnt. Zwei Fassungen desselben Typs laufen unweigerlich auseinander.
export type { CrStaffel, CrSerie } from './lib/crunchyroll-dub.ts'

/**
 * Liest die Tonspur einer Folgenkachel.
 *
 * Die Unterscheidung steckt im Sprachzusatz: „Synchro" allein ist die deutsche
 * Fassung, „Synchro English" eine fremde. Ohne diese Trennung zählte man die
 * englische Fassung als deutsche mit — bei „Slime" wäre das eine Folge zu viel.
 */
function tonspurAus(text: string): Tonspur {
  const teile = text.split('|').map((t) => t.trim())
  const synchro = teile.find((t) => /^Synchro\b/i.test(t))
  if (!synchro) return 'keine'
  return /^Synchro$/i.test(synchro) ? 'deutsch' : 'fremd'
}

/**
 * Lädt alle Folgenkacheln einer Staffel nach.
 *
 * Die Liste zeigt zunächst **zwanzig** Kacheln und lädt weitere erst auf einen
 * Klick auf „Mehr anzeigen" — Scrollen allein bewirkt nichts. Genau das hat
 * beim ersten Versuch drei Staffeln von „Slime" einträchtig als „20/20"
 * gemeldet, obwohl keine von ihnen zwanzig Folgen hat (12.08.2026). Eine
 * abgeschnittene Zählung ist schlimmer als gar keine: Sie sieht vollständig aus.
 *
 * Abbruch, wenn der Knopf verschwindet **oder** ein Klick keine neue Kachel
 * mehr bringt — der zweite Fall fängt ab, dass „Mehr anzeigen" auch am
 * Serientext hängt und dort nichts nachlädt.
 */
async function bisAnsEnde(page: Page): Promise<void> {
  const zaehlen = () => page.evaluate(() => document.querySelectorAll('[data-t^="episode-card"]').length)
  let vorher = await zaehlen()
  for (let runde = 0; runde < 40; runde++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2))
    await page.waitForTimeout(400)
    const knopf = page.locator('button:has-text("Mehr anzeigen"), button:has-text("Show more")').last()
    if (!(await knopf.count())) break
    await knopf.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined)
    await knopf.click({ timeout: 4000 }).catch(() => undefined)
    await page.waitForTimeout(900)
    const jetzt = await zaehlen()
    if (jetzt === vorher) break
    vorher = jetzt
  }
}

/**
 * Zählt die Folgen der gerade sichtbaren Staffel.
 *
 * Bewusst über die Kacheln selbst (`[data-t^="episode-card"]`) statt über
 * `innerText` der Seite: Im Fließtext steht dieselbe Zeichenfolge auch im Kopf
 * der Serie („Untertitel | Synchro" neben den Genres), und die zählte sonst als
 * Folge mit — bei „Slime" ergaben sich so 50 Badges auf 40 Kacheln.
 *
 * Der Name der Staffel steht im Auswahlfeld selbst (`.erc-seasons-select
 * .season-info`), nicht in einer Überschrift. Das ist der Unterschied zwischen
 * „12/12" und „Staffel 4: 12/12" — und ohne ihn ist die Zahl wertlos, weil
 * niemand weiß, worauf sie sich bezieht.
 */
async function staffelZaehlen(page: Page): Promise<{ name: string; karten: { nummer: string; badge: string }[] }> {
  return page.evaluate(() => {
    const karten = [...document.querySelectorAll('[data-t^="episode-card"]')].map((k) => {
      const zeilen = [...k.querySelectorAll('*')]
        .filter((e) => e.children.length === 0)
        .map((e) => (e.textContent || '').trim())
      return {
        // „E12 – Die Entwicklung von Tempest" → „E12"
        nummer: (zeilen.find((t) => /^E\d+\b/.test(t)) ?? '').match(/^E\d+/)?.[0] ?? '',
        badge: zeilen.find((t) => /^(Synchro|Untertitel)\b/.test(t)) ?? '',
      }
    })
    const feld = document.querySelector('.erc-seasons-select .season-info')
    // Der Knopf doppelt seinen Text („Staffel 1Staffel 1"); die erste Hälfte
    // genügt.
    const roh = (feld?.textContent || '').replace(/\s+/g, ' ').trim()
    const haelfte = roh.length > 1 && roh.slice(0, roh.length / 2) === roh.slice(roh.length / 2)
    return { name: (haelfte ? roh.slice(0, roh.length / 2) : roh) || 'einzige Staffel', karten }
  })
}

/**
 * Blättert zur nächsten Staffel. Gibt false zurück, wenn es keine mehr gibt.
 *
 * Über die Vor/Zurück-Knöpfe statt über die aufklappende Liste: Die Liste
 * verlangt einen Klick zum Öffnen, einen zum Auswählen und lässt sich schwerer
 * daraufhin prüfen, ob sie überhaupt offen ist. Der Wechsel gilt erst als
 * vollzogen, wenn sich der angezeigte Name geändert hat — sonst zählt man
 * dieselbe Staffel zweimal.
 */
async function naechsteStaffel(page: Page, bisher: string): Promise<boolean> {
  const knopf = page.locator('[data-t="next-season"]').first()
  if (!(await knopf.count())) return false
  const klickbar = await knopf.isEnabled().catch(() => false)
  if (!klickbar) return false
  await knopf.click({ timeout: 4000 }).catch(() => undefined)
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500)
    const { name } = await staffelZaehlen(page)
    if (name && name !== bisher) return true
  }
  return false
}

async function serieLesen(page: Page, url: string): Promise<CrSerie> {
  const heute = new Date().toISOString().slice(0, 10)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  /**
   * Erst warten, bis die Audio-Zeile **da** ist — nicht stur 4,5 Sekunden.
   *
   * `domcontentloaded` feuert, sobald das erste HTML geparst ist: vor der
   * Weiterleitung von der alten Slug-Adresse auf `/series/<id>/` und vor dem
   * Aufbau der Anwendung. Der feste Schlaf danach traf das Ziel oft nicht, und
   * dann las der Scraper die Zeile der **vorherigen** Seite.
   *
   * Die Zahlen dazu, gemessen am Lauf vom 20.08.2026: Über die Slug-Form fand
   * er auf nur 12 Prozent der Seiten Deutsch, über die `/series/`-Form auf 39
   * Prozent. Dieselben Seiten, dreifacher Unterschied — der Verdacht kam von
   * Daniel („wartet der Scraper evtl. die Weiterleitung nicht ab?"), und er
   * stimmte.
   */
  /**
   * Auf das Erste warten, was die Seite zu sagen hat — Banner oder Audio-Zeile.
   *
   * Beides erscheint erst, wenn die Seite fertig gerendert ist; die Seite wird
   * mit `domcontentloaded` geladen, und zu dem Zeitpunkt steht keines von
   * beiden da. Ein erster Versuch am 21.08.2026 fragte den Banner direkt nach
   * dem Laden ab und fand nie einen — der Abruf lief weiter in den
   * Zwanzig-Sekunden-Ablauf der Audio-Zeile, genau wie vorher. Aufgefallen ist
   * es nur, weil Daniel fragte, ob der Lauf überhaupt geprüft sei; zu dem
   * Zeitpunkt arbeitete er bereits seit zwei Stunden an 594 Seiten für nichts.
   *
   * Ein einziges Warten auf beide Möglichkeiten ist die Antwort — und nebenbei
   * schneller als zwei nacheinander.
   */
  const befund = await page
    .waitForFunction(
      () => {
        const text = document.body.innerText
        const weg = text.match(/^.*nicht mehr verfügbar.*$/m)
        if (weg) return { art: 'weg', zeile: weg[0] }
        // Crunchyrolls eigene Fehlerseite. Sie steht sofort da und ist an ihrer
        // Länge zu erkennen — rund 1.160 Zeichen, immer derselbe Text.
        const fehlt = text.match(/^404 - Seite nicht gefunden.*$/m)
        if (fehlt) return { art: 'fehlt', zeile: fehlt[0] }
        const ton = text.match(/^Audio:.*$/m)
        if (ton) return { art: 'audio', zeile: ton[0] }
        return null
      },
      undefined,
      { timeout: 20000 },
    )
    .then((h) => h.jsonValue() as Promise<{ art: string; zeile: string }>)
    .catch(() => null)

  /**
   * Crunchyroll sagt selbst, dass es die Serie nicht mehr gibt.
   *
   * Das ist `available: false` und nicht `dub: false`: Es fehlt das Angebot,
   * nicht die deutsche Fassung (Daniel, 21.08.2026, an „Dragon Ball" gezeigt).
   */
  if (befund?.art === 'weg' || befund?.art === 'fehlt') {
    /**
     * Zwei Wege, dasselbe Ergebnis — und der Unterschied gehört trotzdem
     * festgehalten.
     *
     * „Leider sind die Videos dieser Serie nicht mehr verfügbar" heißt: Es gab
     * ein Angebot, es ist weg. „404 - Seite nicht gefunden" heißt: Diese
     * Adresse führt ins Nichts, meist eine veraltete Slug-Form aus AniList.
     * Beides ist `available: false`, aber die Notiz sagt, welches von beidem.
     *
     * Die 404-Erkennung kam am 21.08.2026 dazu, nachdem der Reparaturlauf mit
     * 23 Sekunden je Serie hochgerechnet 216 Minuten gebraucht hätte — bei
     * einem Timeout von 180. Fünf Stichproben zeigten: immer 1.508 Zeichen,
     * nie eine Audio-Zeile, nie ein Banner. Es waren Fehlerseiten, und die
     * stehen nach 250 Millisekunden fest.
     */
    return { url, nichtVerfuegbar: true, geprueftAm: heute, fehler: befund.zeile.trim() }
  }

  const audio = befund?.art === 'audio' ? befund.zeile : ''


  /**
   * Keine Zeile heißt **nicht gesehen**, nicht „kein Deutsch".
   *
   * Hier stand `deutschImAngebot: false` — ein Fehlschlag als Befund, und damit
   * genau der Fehler, den dieses Projekt an drei anderen Stellen schon einmal
   * gemacht hat. Daniel am 20.08.2026: „dann mach dass er erst prüft ob er das
   * Element überhaupt findet, und dann ‚Nicht gefunden' statt ‚nicht auf
   * deutsch'."
   */
  if (!audio) return { url, geprueftAm: heute, fehler: 'keine Audio-Zeile gefunden' }

  // Stufe 1 — und für die meisten Seiten schon das Ende.
  if (!/\bDeutsch\b/.test(audio)) return { url, deutschImAngebot: false, geprueftAm: heute }

  /**
   * Stufe 2: jede Staffel einzeln zählen.
   *
   * Nötig, weil die Audio-Zeile schon dasteht, wenn eine **einzige** Folge
   * deutsch ist. Bei „That Time I Got Reincarnated as a Slime" fehlt den
   * letzten beiden Folgen der vierten Staffel die deutsche Fassung, und
   * einzelne Einträge des Wählers — Filme, OVAs — sind gar nicht vertont
   * (Daniel, 12.08.2026). Ohne das Durchblättern würde aus „ein Teil ist
   * deutsch" ein „alles ist deutsch".
   */
  const staffeln: CrStaffel[] = []
  const gesehen = new Set<string>()
  for (let runde = 0; runde < 20; runde++) {
    await bisAnsEnde(page)
    const { name, karten } = await staffelZaehlen(page)
    if (gesehen.has(name)) break
    gesehen.add(name)

    /**
     * Je Folgennummer nur einmal zählen.
     *
     * Crunchyroll führt dieselbe Folge mehrfach auf, und es gibt sogar zwei
     * Einträge im Wähler mit derselben Staffel (Daniel, 12.08.2026). Wer
     * Kacheln zählt statt Folgennummern, holt sich diese Fehler in den eigenen
     * Datensatz — und genau das soll nicht passieren: Die Staffelstruktur
     * bleibt unsere, Crunchyroll liefert hier nur die Tonspur.
     *
     * Kacheln ohne erkennbare Nummer (Filme, Specials) bekommen einen eigenen
     * Schlüssel, damit sie nicht alle zu einer verschmelzen.
     */
    const jeFolge = new Map<string, Tonspur>()
    karten.forEach((k, i) => {
      const schluessel = k.nummer || `#${i}`
      const ton = tonspurAus(k.badge)
      // Eine deutsche Fassung schlägt eine fremde: Steht dieselbe Folge zweimal
      // da, einmal mit und einmal ohne Synchro, gibt es sie deutsch.
      const bisher = jeFolge.get(schluessel)
      if (bisher === 'deutsch') return
      if (bisher === 'fremd' && ton === 'keine') return
      jeFolge.set(schluessel, ton)
    })
    const tonspuren = [...jeFolge.values()]
    staffeln.push({
      name,
      folgen: jeFolge.size,
      kacheln: karten.length,
      deutsch: tonspuren.filter((t) => t === 'deutsch').length,
      fremd: tonspuren.filter((t) => t === 'fremd').length,
    })
    if (!(await naechsteStaffel(page, name))) break
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  return { url, deutschImAngebot: true, staffeln, geprueftAm: heute }
}

async function main(): Promise<void> {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  /**
   * **Alle** Crunchyroll-Adressen, nicht nur die unbeantworteten.
   *
   * Vorher stand hier `s.dub === undefined`. Das klang sparsam und war eine
   * Einbahnstraße: Eine Adresse, die einmal ein `false` erzeugt hatte, kam nie
   * wieder vor — die Antwort verhinderte ihre eigene Überprüfung. Aussortiert
   * wird jetzt weiter unten nach dem **Alter** der letzten Prüfung, und das ist
   * ein Kriterium, das sich von selbst wieder öffnet.
   */
  const offen = new Set<string>()
  for (const t of titles) {
    for (const s of t.streams) {
      if (s.platform === 'crunchyroll') offen.add(s.url)
    }
  }
  let adressen = [...offen].sort()
  if (NUR) adressen = adressen.filter((u) => u.includes(NUR))

  /**
   * Wiederaufsatz: Was schon gelesen ist, wird nicht noch einmal geholt.
   *
   * Der erste Volldurchlauf schrieb sein Ergebnis erst **am Ende**. Beim
   * Abbruch nach 579 von 918 Seiten wäre alles verloren gewesen — anderthalb
   * Stunden Last auf einem fremden Server für nichts (12.08.2026). Ein langer
   * Lauf ohne Zwischenstand ist ein Lauf ohne Netz.
   *
   * Mit `--neu` wird der Bestand ignoriert und alles frisch geholt.
   */
  const bestand = new Map<string, CrSerie>(
    NEU ? [] : readJson<{ serien: CrSerie[] }>('data/crunchyroll-dub.json', { serien: [] }).serien.map((s) => [s.url, s]),
  )
  // Frisch genug ist, was innerhalb der Wiedervorlagefrist gelesen wurde.
  const grenze = addDays(todayIso(), -WIEDERVORLAGE_TAGE)
  /**
   * Gezielt die Seiten erneut prüfen, bei denen der letzte Lauf nichts sagen
   * konnte.
   *
   * Anlass: Am 21.08.2026 kam die Erkennung des Banners „Leider sind die Videos
   * dieser Serie nicht mehr verfügbar" dazu. Die 472 Seiten, die vorher mit
   * „keine Audio-Zeile gefunden" endeten, haben ihre Antwort damit schon in der
   * Seite stehen — nur konnte sie niemand lesen. Sie einzeln nachzuholen
   * kostet eine knappe Stunde; alle 952 noch einmal zu holen wären zwei, und
   * die frisch geprüften brächten dabei nichts Neues.
   */
  const frisch = (u: string) => {
    const s = bestand.get(u)
    if (!s) return false
    if (NUR_FEHLER) return !s.fehler
    return s.geprueftAm >= grenze
  }
  const schonDa = adressen.filter(frisch).length
  adressen = adressen.filter((u) => !frisch(u))
  if (LIMIT > 0) adressen = adressen.slice(0, LIMIT)
  log(
    `Crunchyroll: ${adressen.length} Serienadressen offen` +
      (schonDa ? (NUR_FEHLER ? ` (${schonDa} ohne Fehler beim letzten Mal, werden übersprungen)` : ` (${schonDa} in den letzten ${WIEDERVORLAGE_TAGE} Tagen gelesen, werden übersprungen)`) : ''),
  )
  if (!adressen.length) {
    log('Nichts zu tun.')
    return
  }

  // Der Fortschritt geht an die Statusanzeige, damit von außen sichtbar ist,
  // ob dieser Lauf bei Seite 3 oder bei Seite 500 steht. Lokal ohne Token tut
  // der Melder nichts.
  const melde = fortschrittsMelder(adressen.length)

  const browser = await chromium.launch()
  const page = await browser.newPage({ userAgent: CHROME, locale: 'de-DE', viewport: { width: 1600, height: 1200 } })
  let ohneDeutsch = 0

  /** Schreibt den Stand — alles Bekannte plus alles gerade Gelesene. */
  const sichern = () =>
    writeJson('data/crunchyroll-dub.json', { scrapedAt: new Date().toISOString(), serien: [...bestand.values()] }, true)

  for (const [i, url] of adressen.entries()) {
    const kurz = url.replace(/^https?:\/\/(www\.)?crunchyroll\.com\/de\//, '')
    try {
      const serie = await serieLesen(page, url)
      bestand.set(url, serie)
      if (!serie.deutschImAngebot) ohneDeutsch++
      log(
        `  ${i + 1}/${adressen.length} ${serie.deutschImAngebot ? '🇩🇪' : '—'} ${kurz.slice(0, 52)}` +
          (serie.staffeln ? ` (${serie.staffeln.map((s) => `${s.name}: ${s.deutsch}/${s.folgen}`).join(', ')})` : ''),
      )
    } catch (err) {
      /**
       * Ein Fehlschlag wird **nicht** als „keine Synchro" gespeichert.
       *
       * Sonst stünde ein Zeitüberschreitungs-Fehler später als belegtes Nein im
       * Datensatz — und der Wiederaufsatz würde die Seite nie wieder anfassen.
       * Sie bleibt offen und kommt beim nächsten Lauf erneut dran.
       */
      warn(`${url}: ${(err as Error).message.slice(0, 100)}`)
    }
    // Alle zehn Seiten sichern: Ein Abbruch kostet dann höchstens zehn Abrufe.
    if (i % 10 === 9) sichern()
    // Nicht abwarten: Der Lauf hat mit der Statusanzeige nichts zu schaffen,
    // und 594 Wartezeiten von je einer Zehntelsekunde wären Minuten für nichts.
    // Ein Fehlschlag darf hier ohnehin nichts bewirken.
    void melde(i + 1, kurz)
    await sleep(1500)
  }
  await browser.close()

  sichern()
  recordSource('crunchyroll-dub', bestand.size, bestand.size ? undefined : 'keine Seite gelesen')
  log(`Fertig: ${bestand.size} Seiten im Bestand, davon ${ohneDeutsch} in diesem Lauf ohne deutsche Tonspur`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
