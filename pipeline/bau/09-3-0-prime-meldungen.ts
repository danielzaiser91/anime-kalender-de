import { leseZugeordnet, adresseFremdBelegt, adresseVerneint } from '../lib/prime-meldung-riegel.ts'
import { type PlatformId, type Title } from '../../shared/types.ts'
import { dubKey, adressGleich, type DubCheck } from '../lib/dub-confirmed.ts'
import { germanizeUrl } from '../../shared/mappings.ts'
import { amazonAdresseRichten, amazonTitelAdresse } from '../lib/amazon-adresse.ts'
import { kanalAdresseGemerkt, kanalWissen } from '../lib/kanal-wissen.ts'
import { rohDeutsch } from '../lib/kanal-titel.ts'
import { istSchwaechereSchwester } from '../lib/staerkste-seite.ts'
import { log } from '../lib/util.ts'

/**
 * **Was Daniel bei Prime gemeldet hat, wird zum Verweis.**
 *
 * `fetch-rohfolgen.ts` legt die gemeldeten Folgen über unsere Zählung und
 * schreibt das Ergebnis nach `data/prime-zugeordnet.json`. Diese Datei las
 * bis zum 29.08.2026 **niemand** — die ganze Kette von der Erweiterung über
 * den Briefkasten bis zur Zuordnung endete in einer Datei, die nirgends
 * ankam. Der Fund kam aus der ersten echten Messung mit `titel_id`: Zwei
 * Adressen waren sauber zugeordnet, und im Datensatz änderte sich nichts.
 *
 * Zwei Dinge entstehen daraus:
 *
 * - **Die Sprachangabe.** Nennt irgendeine gemeldete Folge „Deutsch", ist
 *   `dub: true` belegt — von einer angemeldeten Sitzung an der Seite selbst,
 *   also der stärkste Beleg, den dieses Projekt kennt.
 * - **Die Adresse.** Gemeldet wird oft von einer **Suchadresse**; die Meldung
 *   bringt die ASIN der Seite mit, auf der Daniel tatsächlich war. Daraus
 *   wird eine echte Titelseite, und die nächste Prüfung beginnt nicht wieder
 *   bei der Suche.
 *
 * **Ein Handbeleg schlägt das trotzdem.** Er ist dieselbe Quelle, nur
 * ausdrücklich eingetragen — und er kann ein Nein enthalten, das eine
 * automatische Ergänzung nicht überschreiben darf (CLAUDE.md, „ein Titel ohne
 * Verweis ist nicht dasselbe wie ein Titel ohne geprüften Verweis").
 */
export function uebernehmePrimeMeldungen({ titles, checks, alleChecks, lautPruefungTot, checksJePlattform }: {
  titles: Map<number, Title>
  checks: Map<string, DubCheck>
  alleChecks: DubCheck[]
  lautPruefungTot: (url: string) => boolean
  checksJePlattform: Map<string, DubCheck[]>
}) {
  {
    const meldungen = leseZugeordnet<
        {
          titleId: number
          asin: string | null
          /** Die gemeldete Seite (Migration 030), wenn die Rohfolgen sie tragen. */
          seite?: string | null
          /* Wer gemeldet hat. */
          plattform: string
          folgen: { unsere: number | null; sprachen: string[] }[]
        }
    >()
    let ausRoh = 0
    let adressen = 0
    /** Meldungen, die einen dritten Prime-Verweis angelegt hätten — siehe unten. */
    let uebersprungen = 0
    /** Zuordnungen, deren Adresse ein Handbeleg einem anderen Titel zuschreibt. */
    let fremdeAdresse = 0
    for (const [schluessel, eintrag] of Object.entries(meldungen)) {
      const title = titles.get(eintrag.titleId)
      if (!title) continue
      /*
        **Ein Handbeleg gilt seiner Adresse, nicht der ganzen Plattform.**

        Der Riegel stand hier als `checks.has(<titel>|primevideo)` — `checks`
        hält je Titel und Anbieter den letzten Beleg, also sperrte
        eine geprüfte Ausgabe jede Meldung zur zweiten. Genau den Fall
        beschreibt der Kommentar unten seit dem 30.08.2026: „My First
        Girlfriend is a Gal" läuft bei Prime als Kauftitel mit elf Folgen (KAZÉ,
        FSK 16, deutsch) **und** über den Crunchyroll-Kanal mit zehn (FSK 18).
        Daniel hatte den Kanal-Titel am 30.08. geprüft; seine Meldung zum
        Kauftitel vom 01.09. lief deshalb ins Leere und lag am 05.09.2026 noch
        unverwertet im Briefkasten.

        **Was der Riegel schützen soll, bleibt geschützt:** Ein letzter Beleg **ohne**
        Adresse ist eine Aussage über den Anbieter — er sperrt weiter alles; ein früherer
        Nein ohne Adresse sperrt nichts (wie `check:handbelege`, Fall 900010 im Check).
        Einer **mit** Adresse sperrt genau diese Adresse. Ein Nein zur einen
        Ausgabe ist kein Nein zur anderen; sie haben verschiedene Verlage,
        verschiedene Preise und verschiedene Tonspuren.
      */
      /*
        **Der Verweis gehört dem Anbieter, der gemeldet hat.**

        Hier stand dreimal `'primevideo'` fest verdrahtet — aus der Zeit, als nur
        Prime Rohfolgen meldete. Netflix und Disney+ gehen dieselbe Route
        (seit 16.10.2026 erkennt `rohDeutsch` auch ihre Sprachformen), sonst wäre
        daraus ein Prime-Verweis auf eine Netflix-Adresse geworden.

        Alles Amazon-Eigene bleibt an Prime gebunden: die Seite aus der ASIN und
        der Rückfall auf eine vorhandene Suchadresse. Bei den übrigen Anbietern
        ist die gemeldete Adresse die Seite, und eine Suchadresse gibt es dort
        nicht.
      */
      const plattform = eintrag.plattform as PlatformId
      const beleg = checks.get(dubKey(eintrag.titleId, plattform))
      /*
        **Die gemeldete Adresse ist die Seite — die ASIN je Zeile ist die Folge.**

        Der Schlüssel dieser Ablage trägt `url#asin`; `url` ist die Seite, auf
        der Daniel stand. `eintrag.asin` stammt dagegen aus der ersten Zeile der
        Gruppe, und bei einer Folgenliste gehört sie der **ersten Folge**: Die
        Meldung zu `dp/B0GPD4GNLL` (My First Girlfriend Is a Gal, Kauftitel)
        führte elf Zeilen mit elf verschiedenen ASINs, die erste `B0GSSL7BMZ`.
        Ein Verweis darauf führt auf eine einzelne Folge statt auf den Titel.

        Die ASIN bleibt der Weg für Meldungen von einer **Suchadresse** — dort
        gibt es keine Seite, auf die man verweisen könnte, und genau dafür ist
        sie mitgeschickt worden.
      */
      const gemeldeteAdresse = schluessel.split('#')[0]!
      let seite =
        plattform !== 'primevideo'
          ? germanizeUrl(plattform, gemeldeteAdresse)
          : /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\//i.test(gemeldeteAdresse)
            ? amazonAdresseRichten(gemeldeteAdresse)
            : eintrag.asin
              ? amazonTitelAdresse(eintrag.asin)
              : null
      if (beleg ? !beleg.url || adressGleich(beleg.url, seite ?? undefined) : kanalAdresseGemerkt(alleChecks, eintrag.titleId, plattform, seite)) continue
      /*
        **Gehört die Adresse laut Handbeleg einem anderen Titel, gilt die Meldung nicht ihr.**

        Rohfolgen tragen die Adresse der Prüfliste, nicht die der Seite, auf der
        gemeldet wurde (die ASIN hier ist die der ersten Folge). Nach einem
        Staffelwechsel landete so die deutsche Staffel 2 von „Vinland Saga"
        unter `B0C55SJB1W` — der Seite von Staffel 1, die laut Meldung vom
        17.09.2026 nur japanischen Ton hat. Im Panel stand „24 Fg. 🇩🇪 ✓" an
        einer Seite ohne Deutsch. Gemessen: sieben Zuordnungen widersprechen so
        einem Handbeleg. Übersprungen statt umgebogen — welche Seite die
        richtige ist, sagt die Rohfolge nicht.
      */
      const fremdBelegt = (adresse: string | null): boolean => adresseFremdBelegt(kanalWissen(alleChecks), eintrag.titleId, plattform, adresse)
      /* Seit Migration 030 kennt die Rohfolge die gemeldete Seite — dann gilt die Meldung ihr. */
      if (fremdBelegt(seite) && plattform === 'primevideo' && eintrag.seite) {
        seite = amazonTitelAdresse(eintrag.seite)
      }
      if (fremdBelegt(seite)) {
        fremdeAdresse++
        continue
      }
      const belegt = rohDeutsch(eintrag.folgen, eintrag.titleId, plattform === 'primevideo' ? { seite: eintrag.seite, url: gemeldeteAdresse } : null, kanalWissen(alleChecks))
      if (belegt === undefined) continue
      /* Kein Schreibzweig für eine Adresse, die irgendein Handbeleg verneint — `checks` kennt je Titel nur den letzten (Date A Live, 19.10.2026). */
      if (adresseVerneint(alleChecks, eintrag.titleId, plattform, seite)) continue

      /* Keine Adresse, die die Linkprüfung als tot kennt (17.09.2026) — weder als neuer Weg noch als Ersatz einer Suchadresse (Fairy Tail, 05.11.2026). */
      if (seite && lautPruefungTot(seite)) continue
      /**
       * **Zwei Ausgaben desselben Titels sind zwei Wege, keine Dublette.**
       *
       * Prime führt „My First Girlfriend is a Gal" als Kauftitel mit 11 Folgen
       * und FSK 16 — die KAZÉ-Fassung samt OVA, mit deutscher Synchro — und
       * über den Crunchyroll-Kanal mit 10 Folgen und FSK 18, mit völlig anderen
       * Folgentiteln, weil zwei Verlage unabhängig übersetzt haben (Daniel,
       * 30.08.2026, mit Bildern; Verlagsangaben bei Anime2You und
       * AnimeNachrichten nachgeschlagen).
       *
       * Bis hierher nahm der Bau je Titel **einen** Prime-Verweis, und die
       * zweite Meldung überschrieb die erste. Für einen Besucher sind es aber
       * zwei Angebote mit verschiedenem Inhalt und verschiedenem Preis — genau
       * die Frage, für die er die Seite aufruft.
       *
       * Gesucht wird deshalb nach **dieser** Adresse. Nur wenn es sie noch nicht
       * gibt, greift der Rückfall auf einen vorhandenen Prime-Verweis mit
       * Suchadresse: Der ist keine eigene Ausgabe, sondern eine offene Frage,
       * und wird von der Titelseite abgelöst.
       *
       * Die Oberfläche trennt beide schon: Sie gruppiert nach Zugangsart, also
       * steht der Kauftitel unter „Kaufen oder leihen" und der Kanal-Titel unter
       * „Im Abo".
       */
      const da =
        (seite ? title.streams.find((x) => x.platform === plattform && germanizeUrl(plattform, x.url) === seite) : null) ??
        (plattform === 'primevideo'
          ? title.streams.find((x) => x.platform === 'primevideo' && /amazon\.[a-z.]+\/s\?/i.test(x.url))
          : undefined)
      if (da) {
        if (belegt && da.dub !== true) {
          da.dub = true
          ausRoh++
        }
        /* Eine Titelseite schlägt eine Suchadresse — nie umgekehrt. */
        if (seite && /amazon\.[a-z.]+\/s\?/i.test(da.url)) {
          da.url = seite
          adressen++
        }
      } else if (seite) {
        /*
          **Zwei Ausgaben sind zwei Wege — zweiundfünfzig sind ein Fehler.**

          Der Kommentar darüber erlaubt bewusst einen zweiten Prime-Verweis je
          Titel. Wie schnell daraus etwas anderes wird, zeigt der Verlauf von
          `data/prime-zugeordnet.json`: Über alle Fassungen zusammengenommen
          stehen dort **3.136 Adressen**, und die Verteilung sagt, was sie sind
          — 52 für „Niklaas, ein Junge aus Flandern", 51 für „Fullmetal
          Alchemist", 50 für „Digimon Frontier". Eine je Folge, aus der Zeit vor
          dem 02.09.2026, als Prime jeder Folge eine eigene ASIN gab und die
          Gruppierung ihr darin folgte.

          Der Gruppierungsfehler ist behoben, aber die Zahl bleibt der Maßstab:
          Ein Titel hat bei Prime zwei Wege, die ein Besucher unterscheiden kann
          — im Abo und zum Kauf. Genau danach gruppiert die Oberfläche. Ein
          dritter Verweis beantwortet keine Frage mehr, die der zweite offen
          gelassen hätte, und ist viel eher ein Artefakt als eine dritte
          Ausgabe.

          **Der Deckel gilt nur für das Anlegen.** Eine Sprachangabe an einem
          vorhandenen Verweis (oben) und ein Handbeleg gehen ihn nichts an.
        */
        /* Die schwächere Schwester einer vorhandenen Seite bringt keinen zweiten Weg neben ihr. */
        const vorhandene = title.streams.filter((x) => x.platform === plattform)
        const belegeDerPlattform = checksJePlattform.get(dubKey(eintrag.titleId, plattform)) ?? []
        if (vorhandene.some((v) => istSchwaechereSchwester(belegeDerPlattform, v.url, seite))) continue
        if (vorhandene.length >= 2) {
          uebersprungen++
          continue
        }
        /*
          Tote Adressen sind oben vor `da` schon ausgeschieden (`lautPruefungTot`): Gemeldete
          Folgen belegen die Sprache der Seite, nicht ihren Fortbestand („Your Name.",
          17.09.2026).
        */
        title.streams.push({ platform: plattform, url: seite, dub: belegt || undefined })
        ausRoh++
      }
    }
    if (ausRoh || adressen) {
      log(`${ausRoh} Prime-Verweise aus Daniels Meldungen belegt, ${adressen} Suchadresse(n) durch die Titelseite ersetzt`)
    }
    if (uebersprungen) {
      log(`${uebersprungen} Meldung(en) haetten einen dritten Prime-Verweis angelegt \u2014 uebersprungen`)
    }
    if (fremdeAdresse) log(`${fremdeAdresse} Zuordnung(en) übersprungen: die Adresse gehört laut Handbeleg einem anderen Titel`)
  }

}
