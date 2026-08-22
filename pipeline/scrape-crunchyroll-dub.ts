/**
 * Liest bei Crunchyroll nach, welche Folgen deutsch vertont sind.
 *
 * Warum überhaupt: Ein Stream-Verweis sagt nur, **dass** ein Titel dort läuft.
 * Für 1.156 Crunchyroll-Verweise stand deshalb dauerhaft „🇩🇪 ?" — und die von
 * Hand abzuarbeiten hieße, jede einzelne Seite selbst zu öffnen.
 *
 * ## Der Regelweg: der deutsche Katalog über die beta-api
 *
 * Abgefragt wird `beta-api.crunchyroll.com/cms/v2<bucket>` mit einem
 * **Zugangspaket** aus `CR_ZUGANG` — einer CloudFront-Signatur, die an einer
 * deutschen Leitung entstanden ist und deshalb den deutschen Katalog öffnet,
 * auch von einem Rechner in den USA. Aufrufe, Felder und Grenzen stehen in
 * `lib/crunchyroll-api.ts`, der Ablauf je Serie in `lib/crunchyroll-lesen.ts`.
 *
 * **Ohne gültiges Paket läuft gar nichts.** Kein stilles Ausweichen auf den
 * US-Katalog: Ein Lauf, der unbemerkt die falsche Region liest, ist schlimmer
 * als keiner. Er schreibt Befunde in den Datensatz, die für Deutschland nichts
 * belegen, und niemand sieht es der Datei an. Das Paket gilt 24 Stunden und
 * wird mit `node tools/cr-zugang-holen.mjs --secret` erneuert.
 *
 * Maßgeblich ist ausschließlich `de-DE` in `versions`. `is_dubbed` steht schon
 * auf `true`, wenn es irgendeine Synchronfassung gibt — wer danach ginge, hielte
 * jede Folge für deutsch synchronisiert.
 *
 * ## Die erste Rückfallebene: die Content-API im Browser (`--browser`)
 *
 * Der Weg von vor dem 22.08.2026: Token von der Aufwärmseite mitnehmen, danach
 * über `page.evaluate(fetch(…))` abfragen. Er kommt ohne Zugangspaket aus und
 * ist damit die Antwort auf „das Paket ist abgelaufen und niemand in
 * Deutschland kann gerade ein neues holen". Was er liest, ist der Katalog der
 * Region, in der der Rechner steht — deshalb trägt sein Ergebnis **kein**
 * `katalog`, und ein fehlendes `de-DE` belegt daraus nichts.
 *
 * ## Die zweite Rückfallebene: die gerenderte Seite lesen (`--seitenanzeige`)
 *
 * Der alte Weg steht weiter unten und bleibt aufrufbar, falls Crunchyroll die
 * Schnittstelle ändert. Er ist **langsam** — 17 bis 23 Sekunden je Serie gegen
 * 70 bis 250 Millisekunden — und gröber: Er liest Textmuster („Audio: Deutsch",
 * „Synchro | Untertitel"), hängt damit an Crunchyrolls Übersetzungen und kennt
 * die Folgen nur als Kacheln. Er wird nicht gepflegt, sondern verwahrt.
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
 * Was dafür spricht, ihn zu gehen: `robots.txt` erlaubt `/series/`, `/content/`
 * und `/auth/` ausdrücklich (gesperrt sind Suche, Konto, Merkliste,
 * Bezahlseiten — geprüft am 21.08.2026), es gibt kein Crawl-delay, und der
 * Abruf bleibt getaktet: Auch 200 Millisekunden je Aufruf werden nicht
 * ausgereizt, es bleibt eine Pause dazwischen.
 *
 * Aufruf: npm run data:cr-dub [-- --limit 10] [-- --nur <urlteil>]
 *                             [-- --browser] [-- --seitenanzeige] [-- --pause 400]
 */
import { chromium, type Browser, type Page } from 'playwright'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { fortschrittsMelder } from './lib/lauf-fortschritt.ts'
import type { Title } from '../shared/types.ts'
import { addDays, todayIso } from '../shared/time.ts'
import type { CrSerie, CrStaffel } from './lib/crunchyroll-dub.ts'
import { crunchyrollSeriesId } from './lib/crunchyroll.ts'
import { serieHinterFolge, serieLesen } from './lib/crunchyroll-lesen.ts'
import {
  CrunchyrollApi,
  CrunchyrollGesperrt,
  CrunchyrollCms,
  CrunchyrollSeiten,
  ZugangspaketFehlt,
  beschaffeZugang,
  bucketLand,
  type CrQuelle,
  type Tonspur,
} from './lib/crunchyroll-api.ts'

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
const ALTER_GESETZT = args.includes('--alter')
const WIEDERVORLAGE_TAGE = zahl('--alter', 28)
/**
 * Wie lange eine **Nichtauskunft** ihre eigene Wiederholung blockiert.
 *
 * Ein Eintrag mit `fehler` ist keine Antwort — er sagt, dass gerade nichts zu
 * erfahren war. Die Wiedervorlage von vier Wochen gilt trotzdem für ihn, und
 * das ist am 21.08.2026 teuer geworden: Ein Lauf mit noch fehlender
 * Wiederholung schrieb 371-mal „keine Serienkennung hinter dieser Adresse" und
 * 204-mal „Staffelliste hat nicht geantwortet". Der Lauf danach — mit der
 * Wiederholung — rührte diese 575 Adressen nicht mehr an: Sie galten als frisch
 * geprüft. Eine einmalige Störung hätte damit 575 Serien für vier Wochen
 * stillgelegt, und zwar genau die, über die wir nichts wissen.
 *
 * Sieben Tage statt eines Tages, weil manche Adressen dauerhaft nichts hergeben
 * (tote Slugs ohne Fehlerseite). Die kosten dann einen Seitenaufruf je Woche
 * statt einen je Lauf.
 */
const FEHLER_TAGE = zahl('--fehler-alter', 7)
/** Rückfallebene: die gerenderte Seite lesen statt der Content-API. */
const SEITENANZEIGE = args.includes('--seitenanzeige')
/**
 * Rückfallebene: die Content-API im Browser statt der beta-api mit Signatur.
 *
 * Der Schalter existiert für den einen Fall, in dem der Regelweg nicht geht —
 * kein gültiges Zugangspaket und niemand in Deutschland, der eins holen kann.
 * Er liest dann den Katalog der Region, in der der Rechner steht, und sagt das
 * auch: Das Ergebnis trägt kein `katalog`, und `beurteile()` macht daraus kein
 * `dub: false`.
 */
const BROWSER = args.includes('--browser')
/**
 * Pause zwischen zwei Aufrufen. Die Taktung bleibt rücksichtsvoll.
 *
 * 400 statt 250 Millisekunden, und das ist gemessen, nicht geschätzt: Mit 250
 * lief der Lauf vom 21.08.2026 nach rund 300 Serien in 25 Minuten in
 * Crunchyrolls Bot-Sperre (HTTP 403, danach kein Token mehr). Die Sperre löste
 * sich nach einer Viertelstunde von selbst. Schneller zu fahren, als der
 * Betreiber es duldet, bringt nichts ein — der Lauf endet dann früher, statt
 * mehr zu schaffen.
 */
const PAUSE_MS = zahl('--pause', 500)

// Die Typen stehen in `lib/crunchyroll-dub.ts` — dort, wo auch die Auswertung
// wohnt. Zwei Fassungen desselben Typs laufen unweigerlich auseinander.
export type { CrStaffel, CrSerie } from './lib/crunchyroll-dub.ts'

/**
 * Was zu einer Adresse an Serienkennung bekannt ist.
 *
 * Die Datei ist ein Gedächtnis, kein Zwischenspeicher: Eine Slug-Adresse in die
 * `/series/`-Form aufzulösen kostet einen vollen Seitenaufruf, und das Ergebnis
 * ändert sich nie — eine Serienkennung ist stabil. Ohne diese Datei zahlte
 * jeder Lauf denselben Preis erneut, und zwar auf einem fremden Server.
 *
 * **Ein Fehlschlag ist dagegen nicht endgültig.** Steht kein `seriesId` darin,
 * kommt die Adresse nach der Wiedervorlagefrist erneut dran. Sonst wäre die
 * Datei genau der Filter, vor dem `CLAUDE.md` warnt: „hole, was noch fehlt"
 * macht jede Antwort endgültig, und ein Falschbefund kann sich nicht mehr
 * korrigieren. Bei der Kennung selbst ist das unbedenklich, beim Nicht-Finden
 * nicht.
 */
interface KennungsEintrag {
  seriesId?: string
  /** Wohin die Adresse geführt hat — bei einem Fehlschlag der Beleg dafür. */
  ziel?: string
  geprueftAm: string
  fehler?: string
  /**
   * Was die Seite selbst gesagt hat: `weg` das Banner, `fehlt` die 404-Seite.
   *
   * Ohne dieses Feld ging der Befund beim zweiten Lesen verloren. Der Ablauf
   * dahinter: Eine Adresse ohne Serienkennung wird nicht bei jedem Lauf neu
   * aufgerufen — geschieht das nicht, stand vom letzten Mal nur die Textzeile
   * da, und aus „Crunchyroll sagt selbst, es gibt die Seite nicht" wurde ein
   * „keine Auskunft" (37 Adressen am 21.08.2026). Die Zeile ist der Beleg, das
   * Feld ist der Befund.
   */
  art?: 'weg' | 'fehlt'
}
interface KennungsDatei {
  aufgeloestAm: string
  adressen: Record<string, KennungsEintrag>
}
const KENNUNGS_DATEI = 'data/crunchyroll-series-ids.json'

// ─────────────────── Rückfallebene: die gerenderte Seite lesen ───────────────
//
// Alles ab hier ist der Weg von vor dem 21.08.2026 und wird nur noch mit
// `--seitenanzeige` aufgerufen. Er bleibt, weil er ohne die Content-API
// auskommt: Ändert Crunchyroll die Schnittstelle, ist er die einzige Auskunft,
// die noch da ist. Zu wissen ist über ihn zweierlei — er braucht 17 bis 23
// Sekunden je Serie statt 70 bis 250 Millisekunden, und er liest Textmuster
// („Audio: Deutsch"), hängt also an Crunchyrolls Übersetzungen.

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

async function serieLesenSeitenanzeige(page: Page, url: string): Promise<CrSerie> {
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
    return { url, quelle: 'seitenanzeige', nichtVerfuegbar: true, geprueftAm: heute, fehler: befund.zeile.trim() }
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
  if (!audio) return { url, quelle: 'seitenanzeige', geprueftAm: heute, fehler: 'keine Audio-Zeile gefunden' }

  // Stufe 1 — und für die meisten Seiten schon das Ende.
  if (!/\bDeutsch\b/.test(audio)) return { url, quelle: 'seitenanzeige', deutschImAngebot: false, geprueftAm: heute }

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

  return { url, quelle: 'seitenanzeige', deutschImAngebot: true, staffeln, geprueftAm: heute }
}

/**
 * Wie oft eine Adresse drankommt — je nachdem, ob sich dort etwas bewegt.
 *
 * Bis zum 22.08.2026 galt für alle 959 Adressen dieselbe Frist von vier Wochen.
 * Das behandelt eine Serie von 2009, die seit Jahren unverändert dasteht,
 * genauso wie eine, die nächste Woche eine neue Folge bekommt — und weil ein
 * Lauf bei 300 Adressen gedeckelt ist, dauert ein voller Durchgang 3,2 Wochen.
 *
 * Daniels Vorschlag (22.08.2026): „es könnte sinn machen die liste auch
 * aufzuteilen nach wichtigen und weniger wichtigen titeln. und entsprechend die
 * häufigkeit der polls anpassen."
 *
 * Die Staffelung, gemessen am Bestand:
 *
 * | Gruppe                 | Titel | Frist    | Abrufe/Woche |
 * |------------------------|------:|---------:|-------------:|
 * | anstehender Termin     |    56 |   7 Tage |           56 |
 * | ab 2024 erschienen     |   139 |  14 Tage |           70 |
 * | 2015 bis 2023          |   568 |  28 Tage |          142 |
 * | vor 2015               |   355 |  90 Tage |           27 |
 * |                        |       |          |      **295** |
 *
 * Das passt unter den Deckel von 300, den Crunchyrolls Drosselung setzt — und
 * die 56 Titel, bei denen wirklich etwas passiert, sind viermal so oft dran wie
 * vorher.
 *
 * `--alter <tage>` schaltet die Staffelung ab und setzt eine feste Frist für
 * alle. Das bleibt der Weg für gezielte Läufe.
 */
const FRIST_TERMIN = 7
const FRIST_JUNG = 14
const FRIST_MITTEL = 28
const FRIST_ALT = 90

/** Titel, für die ein Termin in der Zukunft steht. */
function titelMitTermin(): Set<number> {
  const events = readJson<Array<{ titleId: number; date: string }>>('public/data/events.json', [])
  const heute = todayIso()
  const menge = new Set<number>()
  for (const e of events) if (e.date >= heute) menge.add(e.titleId)
  return menge
}

/**
 * Die Frist je Adresse. Zeigen mehrere Titel auf dieselbe Adresse — bei Demon
 * Slayer sind es fünf —, gewinnt die kürzeste: Ein Termin an einem davon macht
 * die ganze Adresse interessant.
 */
function fristenJeAdresse(titles: Title[]): Map<string, number> {
  const mitTermin = titelMitTermin()
  const fristen = new Map<string, number>()
  for (const t of titles) {
    const frist = mitTermin.has(t.id)
      ? FRIST_TERMIN
      : (t.jpYear ?? 0) >= 2024
        ? FRIST_JUNG
        : (t.jpYear ?? 0) >= 2015
          ? FRIST_MITTEL
          : FRIST_ALT
    for (const s of t.streams) {
      if (s.platform !== 'crunchyroll') continue
      const bisher = fristen.get(s.url)
      if (bisher === undefined || frist < bisher) fristen.set(s.url, frist)
    }
  }
  return fristen
}

async function main(): Promise<void> {
  /**
   * Das Zugangspaket wird als **Erstes** geprüft, nicht beim ersten Abruf.
   *
   * Sonst liefe der Lauf erst durch Titelliste, Bestand und Warteschlange, um
   * dann an Serie 1 abzubrechen — und in der Zwischenzeit stünde in der
   * Statusanzeige „läuft". Ein Lauf, der aus einem Grund scheitert, der schon
   * vor dem Start feststand, soll das auch vor dem Start sagen.
   */
  const zugang = SEITENANZEIGE || BROWSER ? undefined : await beschaffeZugang()
  if (zugang) log(`Zugangspaket für ${zugang.land}, Bucket ${zugang.bucket}, gültig bis ${zugang.gueltig_bis}`)
  /**
   * Aus welchem Katalog dieser Lauf fragt — schon hier, nicht erst bei `quelle`.
   *
   * Die Auswahl der Adressen weiter unten braucht die Antwort, und die läuft
   * lange vor dem Aufbau der Quelle. Der Bucket ist unterschrieben, `land`
   * steht nur daneben; im Zweifel gilt, was in der Signatur steht.
   */
  const katalogJetzt = zugang ? (bucketLand(zugang.bucket) ?? zugang.land).toLowerCase() : undefined

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
  // Frisch genug ist, was innerhalb seiner eigenen Frist gelesen wurde — die
  // hängt daran, ob sich bei diesem Titel überhaupt etwas bewegt.
  const fristen = ALTER_GESETZT ? new Map<string, number>() : fristenJeAdresse(titles)
  const grenzeFuer = (u: string) => addDays(todayIso(), -(fristen.get(u) ?? WIEDERVORLAGE_TAGE))
  const fehlerGrenze = addDays(todayIso(), -FEHLER_TAGE)
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
    /**
     * Ein Befund aus einem anderen Katalog ist keiner — egal wie jung er ist.
     *
     * Der Lauf vom 21.08.2026 lief von einem US-Runner und schrieb 172 Serien
     * mit `katalog: "us"` fort. Diese Antworten sind nicht *veraltet*, sie
     * beantworten eine **andere Frage**: „Fairy Tail" hat in Deutschland 277
     * deutsche Folgen und in der US-Antwort keine einzige. Die Frist schützte
     * sie trotzdem — vier Wochen lang wäre die falsche Auskunft stehen
     * geblieben, obwohl ein deutscher Zugang längst da war.
     *
     * Deshalb entscheidet der Katalog **vor** dem Datum: Was aus einer anderen
     * Region stammt als der Zugang, mit dem wir gerade fragen, kommt neu dran.
     */
    if (katalogJetzt && s.katalog && s.katalog !== katalogJetzt) return false
    if (NUR_FEHLER) return !s.fehler
    /**
     * „Nicht verfügbar" ist ein Befund, „hat nicht geantwortet" ist keiner.
     *
     * Beide tragen einen `fehler` — bei `nichtVerfuegbar` ist er die Zeile, mit
     * der Crunchyroll selbst sagt, dass es das Angebot nicht mehr gibt. Alles
     * andere mit `fehler` ist eine Nichtauskunft und kommt früher wieder dran.
     */
    const befund = s.nichtVerfuegbar === true || !s.fehler
    return s.geprueftAm >= (befund ? grenzeFuer(u) : fehlerGrenze)
  }
  const schonDa = adressen.filter(frisch).length
  const nachgefasst = adressen.filter((u) => !frisch(u) && bestand.get(u)?.fehler).length
  adressen = adressen.filter((u) => !frisch(u))
  if (LIMIT > 0) adressen = adressen.slice(0, LIMIT)
  log(
    `Crunchyroll: ${adressen.length} Serienadressen offen` +
      (schonDa ? (NUR_FEHLER ? ` (${schonDa} ohne Fehler beim letzten Mal, werden übersprungen)` : ` (${schonDa} innerhalb ihrer Frist gelesen, werden übersprungen)`) : '') +
      (nachgefasst ? `, darunter ${nachgefasst} ohne Auskunft aus einem früheren Lauf` : ''),
  )
  if (!adressen.length) {
    log('Nichts zu tun.')
    return
  }

  // Der Fortschritt geht an die Statusanzeige, damit von außen sichtbar ist,
  // ob dieser Lauf bei Seite 3 oder bei Seite 500 steht. Lokal ohne Token tut
  // der Melder nichts.
  const melde = fortschrittsMelder(adressen.length)

  /**
   * Der Browser wird erst angeworfen, wenn ihn jemand braucht.
   *
   * Auf dem Regelweg ist das die Ausnahme: Zwei Dinge stehen nur auf der Seite —
   * die Serienkennung hinter einer Slug-Adresse und Crunchyrolls eigene Ansage,
   * dass es eine Serie nicht mehr gibt. Alles andere kommt jetzt über einen
   * gewöhnlichen `fetch`. Ein Chromium-Start kostet mehrere Sekunden und ein
   * paar hundert Megabyte; ein Lauf über lauter bekannte Kennungen braucht ihn
   * kein einziges Mal.
   */
  let browser: Browser | undefined
  const browserHolen = async (): Promise<Browser> => (browser ??= await chromium.launch())
  let seiten: CrunchyrollSeiten | undefined
  const seitenHolen = async (): Promise<CrunchyrollSeiten> => {
    if (!seiten) {
      seiten = new CrunchyrollSeiten(await browserHolen(), PAUSE_MS)
      await seiten.oeffnen()
    }
    return seiten
  }

  let ohneDeutsch = 0

  /** Schreibt den Stand — alles Bekannte plus alles gerade Gelesene. */
  const sichern = () =>
    writeJson('data/crunchyroll-dub.json', { scrapedAt: new Date().toISOString(), serien: [...bestand.values()] }, true)

  /**
   * Ein Zeilenprotokoll je Serie, damit ein Abbruch nachvollziehbar bleibt.
   *
   * Bei „3 von 8" steht die Zahl hier, nicht nur in der Datei — das ist die
   * Angabe, die es vorher nirgends gab.
   */
  const melden = (i: number, kurz: string, serie: CrSerie) =>
    log(
      `  ${i + 1}/${adressen.length} ${serie.nichtVerfuegbar ? '✕' : serie.deutschImAngebot ? '🇩🇪' : serie.fehler ? '?' : '—'} ${kurz.slice(0, 52)}` +
        (serie.staffeln?.length
          ? ` (${serie.staffeln.map((s) => `${s.name}: ${s.deutsch}/${s.folgen}`).join(', ')})`
          : serie.fehler
            ? ` — ${serie.fehler.slice(0, 60)}`
            : ''),
    )

  if (SEITENANZEIGE) {
    const page = await (await browserHolen()).newPage({
      userAgent: CHROME,
      locale: 'de-DE',
      viewport: { width: 1600, height: 1200 },
    })
    for (const [i, url] of adressen.entries()) {
      const kurz = url.replace(/^https?:\/\/(www\.)?crunchyroll\.com\/de\//, '')
      try {
        const serie = await serieLesenSeitenanzeige(page, url)
        bestand.set(url, serie)
        if (!serie.deutschImAngebot) ohneDeutsch++
        melden(i, kurz, serie)
      } catch (err) {
        /**
         * Ein Fehlschlag wird **nicht** als „keine Synchro" gespeichert.
         *
         * Sonst stünde ein Zeitüberschreitungs-Fehler später als belegtes Nein
         * im Datensatz — und der Wiederaufsatz würde die Seite nie wieder
         * anfassen. Sie bleibt offen und kommt beim nächsten Lauf erneut dran.
         */
        warn(`${url}: ${(err as Error).message.slice(0, 100)}`)
      }
      if (i % 10 === 9) sichern()
      void melde(i + 1, kurz)
      await sleep(1500)
    }
    await browser?.close()
    sichern()
    recordSource('crunchyroll-dub', bestand.size, bestand.size ? undefined : 'keine Seite gelesen')
    log(`Fertig: ${bestand.size} Seiten im Bestand, davon ${ohneDeutsch} in diesem Lauf ohne deutsche Tonspur`)
    return
  }

  /**
   * Der Regelweg ist die beta-api mit Signatur; `--browser` ist die Rückfallebene.
   *
   * Der Unterschied ist nicht bloß technisch: Die eine kennt ihre Region und
   * belegt damit auch ein Nein, die andere kennt sie nicht. Was daraus folgt,
   * steht in `beurteile()` — hier wird nur festgehalten, welcher Weg es war.
   */
  let quelle: CrQuelle
  if (zugang) {
    quelle = new CrunchyrollCms(zugang, PAUSE_MS)
  } else {
    const api = new CrunchyrollApi(await browserHolen(), PAUSE_MS)
    await api.oeffnen()
    // Dieselbe Seite tut es auch für die Seitenaufrufe — ein zweites Fenster
    // wäre ein zweites Fenster für nichts.
    seiten = api
    quelle = api
  }
  log(`Katalog: ${quelle.katalog ?? 'unbelegt (Region des Rechners)'}`)

  const kennungen = readJson<KennungsDatei>(KENNUNGS_DATEI, { aufgeloestAm: '', adressen: {} })
  const kennungenSichern = () =>
    writeJson(KENNUNGS_DATEI, { aufgeloestAm: new Date().toISOString(), adressen: kennungen.adressen }, true)

  /**
   * Eine Serie wird je Lauf **einmal** geholt, nicht einmal je Adresse.
   *
   * Der Bestand ist nach Adresse geschlüsselt, und dieselbe Serie steht mehrfach
   * darin: `http://` und `https://`, Slug-Form und `/series/`-Form. Von 959
   * Adressen führen 283 die Kennung schon selbst; die übrigen lösen sich beim
   * Auflösen reihenweise auf dieselben Kennungen auf. Ohne diese Zwischenablage
   * wäre jede Dublette ein zweiter vollständiger Abruf über alle Staffeln.
   */
  const jeSerie = new Map<string, CrSerie>()
  let neuAufgeloest = 0
  let ohneKennung = 0
  let gesperrt = false

  for (const [i, url] of adressen.entries()) {
    const kurz = url.replace(/^https?:\/\/(www\.)?crunchyroll\.com\/de\//, '')
    try {
      /**
       * Schritt 1: die Serienkennung.
       *
       * Steht sie in der Adresse, ist nichts zu tun. Sonst kostet sie einen
       * Seitenaufruf — und der wird festgehalten, damit er einmalig bleibt.
       * Eine Adresse, die schon als „nicht verfügbar" im Bestand steht, wird
       * dabei nicht noch einmal angefasst: Sie hat ihre Antwort.
       */
      let seriesId = crunchyrollSeriesId(url) ?? kennungen.adressen[url]?.seriesId
      const bekannt = kennungen.adressen[url]
      // Ein gefundener Eintrag hält ewig, ein Fehlschlag nur bis zur
      // Wiedervorlage — siehe `KennungsEintrag`. Und weil ein Fehlschlag keine
      // Auskunft ist, gilt für ihn die kurze Frist.
      const nochmal = !bekannt || (!bekannt.seriesId && (NUR_FEHLER || bekannt.geprueftAm < fehlerGrenze))
      if (!seriesId && nochmal && !bestand.get(url)?.nichtVerfuegbar) {
        const befund = await (await seitenHolen()).seitenBefund(url)
        // Zeigt der Verweis auf eine einzelne Folge, steht die Serie nicht auf
        // der Seite, aber in der Folgenkennung.
        seriesId =
          befund.seriesId ?? (await serieHinterFolge(quelle, befund.ziel)) ?? (await serieHinterFolge(quelle, url))
        kennungen.adressen[url] = {
          seriesId,
          ziel: befund.ziel,
          geprueftAm: todayIso(),
          fehler: seriesId ? undefined : (befund.zeile ?? 'keine Serienkennung hinter dieser Adresse'),
          art: seriesId ? undefined : befund.art,
        }
        neuAufgeloest++
        // Die Seite hat gerade selbst gesagt, dass es die Serie nicht gibt.
        // Das ist derselbe Beleg wie beim alten Weg — und er kostet hier keinen
        // zusätzlichen Aufruf, weil die Seite ohnehin geladen wurde.
        if (!seriesId && befund.art) {
          const serie: CrSerie = {
            url,
            quelle: 'api',
            nichtVerfuegbar: true,
            geprueftAm: todayIso(),
            fehler: befund.zeile,
          }
          bestand.set(url, serie)
          melden(i, kurz, serie)
          if (i % 10 === 9) {
            sichern()
            kennungenSichern()
          }
          void melde(i + 1, kurz)
          continue
        }
      }

      if (!seriesId) {
        ohneKennung++
        /**
         * Ohne Kennung ist über diese Adresse nichts zu sagen — und „nichts zu
         * sagen" ist ein `fehler`, kein `deutschImAngebot: false`. Ein
         * Fehlschlag als Befund ist der Fehler, den dieses Projekt an vier
         * Stellen schon gemacht hat.
         */
        // Hat die Seite beim Auflösen selbst gesagt, dass es sie nicht gibt,
        // bleibt das ein Befund — auch dann, wenn sie diesmal nicht noch einmal
        // aufgerufen wurde.
        const serie: CrSerie = {
          url,
          quelle: 'api',
          geprueftAm: todayIso(),
          nichtVerfuegbar: kennungen.adressen[url]?.art ? true : undefined,
          fehler: kennungen.adressen[url]?.fehler ?? 'keine Serienkennung zu dieser Adresse',
        }
        bestand.set(url, serie)
        melden(i, kurz, serie)
        if (i % 10 === 9) sichern()
        void melde(i + 1, kurz)
        continue
      }

      const schon = jeSerie.get(seriesId)
      const serie = schon ? { ...schon, url } : await serieLesen(quelle, url, seriesId, seitenHolen)
      if (!schon) jeSerie.set(seriesId, serie)
      bestand.set(url, serie)
      // Gezählt wird nur, wo die Antwort auch eine ist: „nicht verfügbar" und
      // „keine Auskunft" sind kein „ohne deutsche Tonspur".
      if (serie.deutschImAngebot === false) ohneDeutsch++
      melden(i, kurz, serie)
    } catch (err) {
      /**
       * Eine geschlossene Tür wird nicht 200-mal angeklopft.
       *
       * Am 21.08.2026 zog Crunchyroll nach rund 300 Serien die Bot-Sperre. Der
       * Lauf machte weiter, scheiterte an jeder weiteren Adresse — und weil
       * `page.goto` fehlschlug, ohne die Seite zu wechseln, schrieb er 91
       * Adressen die Staffelliste der Aufwärmseite zu. Beides ist behoben; hier
       * steht die zweite Hälfte davon: aufhören, sichern, den Rest beim
       * nächsten Lauf holen.
       */
      /**
       * Läuft die Unterschrift mitten im Lauf ab, ist der Lauf zu Ende.
       *
       * Weiterzumachen hieße hier, ab dieser Stelle den US-Katalog zu lesen und
       * ihn in dieselbe Datei zu schreiben — genau das, was der harte Abbruch
       * beim Start verhindern soll, nur unbemerkt in der Mitte. Der Fehler
       * fliegt deshalb weiter nach oben und macht den Lauf rot: Wer die Meldung
       * sieht, holt ein frisches Paket.
       */
      if (err instanceof ZugangspaketFehlt) throw err
      if (err instanceof CrunchyrollGesperrt) {
        gesperrt = true
        warn(`Crunchyroll hat nach ${i} Adressen dichtgemacht: ${(err as Error).message}`)
        warn('Der Lauf endet hier. Was gelesen ist, bleibt; der Rest kommt beim nächsten Lauf dran.')
        break
      }
      // Wie beim alten Weg: Ein Fehlschlag wird nicht gespeichert. Die Adresse
      // bleibt offen und kommt beim nächsten Lauf erneut dran.
      warn(`${url}: ${(err as Error).message.slice(0, 100)}`)
    }
    if (i % 10 === 9) {
      sichern()
      kennungenSichern()
    }
    void melde(i + 1, kurz)
  }

  await seiten?.schliessen()
  await browser?.close()

  sichern()
  kennungenSichern()
  recordSource('crunchyroll-dub', bestand.size, bestand.size ? undefined : 'keine Serie gelesen')
  const termine = [...jeSerie.values()].reduce(
    (n, s) => n + (s.staffeln ?? []).reduce((m, st) => m + (st.deutscheFolgen ?? []).filter((f) => f.verfuegbarAb).length, 0),
    0,
  )
  log(
    `Fertig: ${bestand.size} Adressen im Bestand, ${jeSerie.size} Serien in diesem Lauf gelesen, ` +
      `${ohneDeutsch} davon ohne deutsche Tonspur`,
  )
  if (neuAufgeloest) log(`${neuAufgeloest} Adressen neu in eine Serienkennung aufgelöst, ${ohneKennung} ohne Kennung`)
  log(`${termine} deutsche Folgen mit belegtem Termin aus der Content-API`)
  // Kein Fehler-Exit: Die Sperre ist kein kaputter Lauf, sondern ein früh
  // beendeter. Ein roter Lauf für etwas, das sich von selbst wieder öffnet,
  // wäre eine Warnung, auf die man aufhört hinzusehen.
  if (gesperrt) log('Abgebrochen wegen Crunchyrolls Bot-Sperre — der Rest steht beim nächsten Lauf wieder offen.')
}

main().catch((err) => {
  /**
   * Ein fehlendes Zugangspaket ist kein Absturz, sondern eine Anweisung.
   *
   * Ein Stapelabzug darüber macht aus „hol ein neues Paket" eine Suche nach der
   * Zeile, in der es geknallt hat. Der Satz allein sagt alles, was zu tun ist.
   */
  if (err instanceof ZugangspaketFehlt) {
    console.error(`\nCrunchyroll-Abruf nicht möglich: ${err.message}`)
    console.error('Ohne Paket geht nur `npm run data:cr-dub -- --browser` — der liest dann den US-Katalog.')
    process.exit(1)
  }
  console.error(err)
  process.exit(1)
})
