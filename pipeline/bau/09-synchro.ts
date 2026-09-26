import { type PlatformId, type StreamLink, type Title, type Release } from '../../shared/types.ts'
import { crunchyrollSeriesId, beobachtungenZusammenfuehren, type CrunchyrollEntry } from '../lib/crunchyroll.ts'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, warn, log, readJson, slugify, discSlug, writeJson } from '../lib/util.ts'
import yaml from 'js-yaml'
import { type Zugangsart, zugangsart } from '../../shared/zugangsart.ts'
import { adressKern, adressGleich, loadDubChecks, type DubCheck, dubKey } from '../lib/dub-confirmed.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { kanalAusNotiz, amazonAdresseRichten, amazonTitelAdresse } from '../lib/amazon-adresse.ts'
import { crNamensindexAusDatei, crAdresseZu as crAdresseNachName } from '../lib/cr-katalog-adresse.ts'
import { netflixTitelAdresse } from '../lib/netflix-adresse.ts'
import { netflixAdresseTaugt } from '../../shared/netflix-adresse-pruefung.ts'
import { todayIso, addDays } from '../../shared/time.ts'
import {
  type CrDubData,
  beurteile,
  deutscheFolgenNachDemEnde,
  beurteileNachFolgennummern,
  beurteileJeBlock,
  beurteileBlockketten,
  beurteileTeilblock,
  kapitelImBlock,
} from '../lib/crunchyroll-dub.ts'
import { alleTermine, ausgelassen as termineAusgelassen, beobachtungenAusBlock } from '../lib/crunchyroll-termine.ts'
import { meldeAnClaude } from '../lib/meldung.ts'
import { terminAusEintrag, verlagAlsDienst } from '../lib/anisearch-termine.ts'
import { type MotnDaten, LEER as MOTN_LEER, ordneShowsZu, tmdbZuordnung, uebernehmbar } from '../lib/motn.ts'
import { releaseStatus } from '../../shared/logic.ts'
import { staffelnDesFranchise, passtZuSerie, bewerteTreffer, volltreffer, type AdnData } from '../lib/adn.ts'
import { adnAdresseSchaerfen, adnFolgenAdresse, ladeAdnArchiv, beurteileAdnVerweis } from '../lib/adn-sprachen.ts'
import { NEIN_GILT_TAGE, type EntfernterVerweis } from './grundlagen.ts'
import { providerName } from '../../shared/mappings.ts'
import { eindeutschenStaffel } from '../../shared/titles.ts'
import { rtlplusWochentermine, type RtlFolge } from '../lib/rtlplus-folgen.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'

export function pruefeSynchroJePlattform({
  releases,
  titles,
  crBySeriesId,
  tmdbMehrdeutig,
  tmdbTitles,
  tvJeTmdb,
  toteAdressen,
  netflixOhneKennung,
  anisearch,
  verweiseEntfernt,
  katalogEintraege,
  adnKatalog,
  adnVerweiseErgaenzt,
}: {
  releases: Release[]
  titles: Map<number, Title>
  crBySeriesId: Map<string, CrunchyrollEntry>
  tmdbMehrdeutig: Set<string>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  tvJeTmdb: Set<string>
  toteAdressen: Set<string>
  netflixOhneKennung: number
  anisearch: Record<string, AnisearchEintrag>
  verweiseEntfernt: EntfernterVerweis[]
  katalogEintraege: KatalogEintrag[]
  adnKatalog: AdnData
  adnVerweiseErgaenzt: number
}) {
  // Ein Stream-Link allein sagt nichts über die Sprache. Belegt ist die Synchro
  // nur dort, wo sie tatsächlich nachgewiesen wurde.
  const dubByTitle = new Map<number, Set<PlatformId>>()
  for (const release of releases) {
    if (release.titleId < 0) continue
    const set = dubByTitle.get(release.titleId) ?? new Set<PlatformId>()
    set.add(release.platform)
    dubByTitle.set(release.titleId, set)
  }
  for (const title of titles.values()) {
    const confirmed = dubByTitle.get(title.id)
    for (const stream of title.streams) {
      if (confirmed?.has(stream.platform)) {
        stream.dub = true
        continue
      }
      if (stream.platform === 'crunchyroll') {
        const id = crunchyrollSeriesId(stream.url)
        // Nur ein Treffer beweist etwas. Ein Fehlen beweist nichts: Der
        // Simulcast-Kalender führt ausschließlich laufende Staffeln, nicht den
        // gesamten Katalog. „Nicht gefunden" bleibt deshalb „ungeprüft".
        if (id && crBySeriesId.has(id)) stream.dub = true
      }
    }
  }

  /**
   * **Verweise, die kein Sammellauf findet — von Hand belegt.**
   *
   * Die Erweiterung meldet Seiten, die unser Datensatz gar nicht kennt: Ein
   * Anbieter führt denselben Anime unter mehreren Kennungen, und aniSearch
   * nennt nur eine. Solche Meldungen landen in
   * `daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md` — und blieben dort
   * liegen, weil es **keinen Weg gab, die Adresse einzutragen**. Am 10.09.2026
   * warteten so 54 Meldungen zu drei Haikyu!!-Staffeln, zwei davon für Titel
   * ohne einen einzigen Prime-Verweis.
   *
   * `data/adn-adressen.yaml` und `data/rtlplus-adressen.yaml` **ersetzen** eine
   * vorhandene Adresse; diese Datei **legt eine an**. Deshalb die dritte.
   *
   * **Der Eintrag urteilt nicht.** Er sagt „dort gibt es diesen Titel", nicht
   * „dort ist er auf Deutsch" — das Sprachurteil kommt weiter aus den
   * Meldungen. Steht die Adresse erst im Datensatz, findet `fetch-pruefungen.ts`
   * sie über `nachUrl` und ordnet die Folgenbefunde zu.
   *
   * Ein Verweis, der schon dasteht, wird nicht verdoppelt: Verglichen wird über
   * denselben Adresskern wie überall.
   */
  let vonHand = 0
  /** Adresskern → `belegtAm` der von Hand bestätigten Wege (für `handSticht`, 22.09.2026). */
  const vonHandBelegtAm = new Map<string, string>()
  {
    const roh = existsSync(resolve(ROOT, 'data/verweise-von-hand.yaml'))
      ? yaml.load(readFileSync(resolve(ROOT, 'data/verweise-von-hand.yaml'), 'utf8'))
      : []
    const eintraege = Array.isArray(roh)
      ? (roh as Array<{ anilistId?: number; platform?: string; url?: string; beleg?: string; belegtAm?: string; zugang?: Zugangsart }>)
      : []
    for (const e of eintraege) {
      if (!e.anilistId || !e.platform || !e.url) continue
      if (e.belegtAm) vonHandBelegtAm.set(adressKern(e.url), String(e.belegtAm))
      const title = titles.get(e.anilistId)
      if (!title) {
        warn(`verweise-von-hand: Titel ${e.anilistId} steht nicht im Bestand`)
        continue
      }
      if ((title.streams ?? []).some((s) => adressGleich(s.url, e.url!))) continue
      title.streams = [
        ...(title.streams ?? []),
        { platform: e.platform as PlatformId, url: e.url, ...(e.zugang ? { zugang: e.zugang } : {}) } as StreamLink,
      ]
      vonHand++
    }
  }
  if (vonHand) log(`${vonHand} Verweise aus data/verweise-von-hand.yaml ergänzt`)

  /**
   * **Joyn-Angebote von JustWatch werden Joyn-Verweise** (22.09.2026).
   *
   * `providerToPlatform` ordnet „Joyn" und „Joyn Plus" der eigenen Plattform `joyn` zu. Die
   * JustWatch-Runden unten überspringen solche Angebote, weil ein Verweis mit Sprachurteil sie
   * trägt — nur legte für Joyn niemand einen an. Gemessen am 22.09.2026: JustWatch nennt 81
   * Joyn-Adressen, im Datensatz standen 2. Naruto, Detektiv Conan, Frieren, Solo Leveling,
   * My Hero Academia waren dort nicht zu finden, obwohl kostenlos abrufbar.
   *
   * Joyn selbst taugt nicht als Quelle: Das Impressum behält Text- und Data-Mining nach § 44b
   * UrhG ausdrücklich vor, `api.joyn.de` sperrt per robots.txt alles. JustWatch ist der
   * erlaubte Weg (docs/wissen/quellen.md).
   *
   * Stichprobe am selben Tag, 7 Seiten: 6 leben, die Lizenz stimmt mit JustWatch überein
   * (ADS = kostenlos, Joyn Plus = Abo); der Film „Ame & Yuki" lieferte 404. Tote Adressen
   * nimmt die Linkprüfung weiter unten heraus (`linkBefunde`), sobald sie gemessen sind.
   * Joyn zeigt oft nur ein rollendes Fenster (Frieren: 5 Folgen) — der Verweis sagt „läuft
   * dort", nicht „alle Folgen".
   *
   * Ein Special unter der TMDB-Kennung einer TV-Serie erbt deren Angebote nicht (`tvJeTmdb`).
   */
  let joynVonJw = 0
  /*
    Adresse → Zugang, aus JustWatchs `art`. TMDB kennt nur flatrate/rent/buy, keine
    Werbefinanzierung, und `joyn` steht in der Abo-Liste von `zugangsart()` — ohne diese Karte
    stünde jeder kostenlose Joyn-Titel als „Abo" da (Angels of Death: JustWatch ADS, Pille „abo").
  */
  const joynZugang = new Map<string, Zugangsart>()
  {
    const jw = readJson<Record<string, { angebote?: { anbieter: string; art?: string; url?: string }[] }>>(
      'data/justwatch-audio.json',
      {},
    )
    /*
      Ein Joyn-Weg von Hand bringt seine Zugangsart mit (`verweise-von-hand.yaml`, Feld `zugang`) —
      Dragon Ball Super stand sonst als „Abo" da, obwohl die Folgen kostenlos sind (22.09.2026).
      Die Karte gilt vor JustWatch: `zugangsart()` setzt sonst später „abo".
    */
    for (const t of titles.values())
      for (const st of t.streams ?? []) if (st.platform === 'joyn' && st.zugang) joynZugang.set(st.url, st.zugang)
    for (const b of Object.values(jw))
      for (const x of b.angebote ?? []) {
        if (!x.url || providerToPlatform(x.anbieter) !== 'joyn') continue
        /* Kostenlos schlägt Abo: Dieselbe Seite steht bei JustWatch oft als „Joyn" und „Joyn Plus". */
        if (x.art === 'ADS' || x.art === 'FREE') { if (!joynZugang.has(x.url) || joynZugang.get(x.url) === 'abo') joynZugang.set(x.url, 'kostenlos') }
        else if (!joynZugang.has(x.url)) joynZugang.set(x.url, 'abo')
      }
    for (const title of titles.values()) {
      if ((title.streams ?? []).some((s) => s.platform === 'joyn')) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const info = tmdbTitles[title.id]
      if (title.format !== 'TV' && info && tvJeTmdb.has(`${info.kind}${info.tmdbId}`)) continue
      const a = (jw[String(title.id)]?.angebote ?? []).find(
        (x) => x.url && providerToPlatform(x.anbieter) === 'joyn' && !toteAdressen.has(x.url),
      )
      if (!a?.url) continue
      title.streams = [...(title.streams ?? []), { platform: 'joyn', url: a.url } as StreamLink]
      joynVonJw++
    }
  }
  if (joynVonJw) log(`${joynVonJw} Joyn-Verweise aus JustWatch ergänzt`)

  /**
   * Was ein Mensch nachgesehen hat, schlägt jede Ableitung.
   *
   * Für YouTube, Netflix, Prime Video, RTL+ und Joyn gibt es keine Quelle, die
   * die Tonspur nennt — 3.021 Verweise standen deshalb dauerhaft auf „🇩🇪 ?".
   * `data/dub-confirmed.yaml` löst das auf dem einzigen Weg, der zum
   * Projektgrundsatz passt: durch tatsächliches Nachsehen. Ein Eintrag dort ist
   * ein Beleg, kein Vorschlag, und gilt deshalb auch gegen ein automatisch
   * gesetztes `true`.
   */
  let geprueft = 0
  /** YouTube-Verweise, deren Urteil aus der Tonspur-Angabe der Videoseite stammt. */
  let ytAusTonspur = 0
  let entfernt = 0
  let ytEntfernt = 0
  let totEntfernt = 0
  let adressen = 0
  // `loadDubChecks()` führt mehrere Zeilen zu einem Verweis bereits zusammen und
  // lässt dabei den jüngeren Befund gewinnen — hier liegt je Schlüssel genau
  // einer vor.
  /**
   * **Der Beleg zur Adresse schlägt den Beleg zur Plattform.**
   *
   * `loadDubChecks()` hält seit dem 07.09.2026 je Ausgabe einen eigenen Eintrag
   * — vorher verschmolzen zwei Prime-Ausgaben desselben Titels zu einem, und
   * ein `dub: true` für die eine färbte die andere (Date a Live IV: Prime-Abo
   * mit Deutsch, Crunchyroll-Kanal ohne). Hier wird ausgewählt, welcher gilt:
   *
   * 1. der Beleg mit **derselben** Adresse wie der Verweis,
   * 2. sonst der Beleg **ohne** Adresse — er gilt der Plattform,
   * 3. sonst keiner. Ein Beleg zu einer fremden Ausgabe sagt nichts über diese.
   *
   * Punkt 3 ist der eigentliche Fix. Er ist streng, und das muss er sein: Ein
   * Ja für die falsche Ausgabe ist genau die Behauptung, die diese Seite nicht
   * machen darf.
   */
  const alleChecks = loadDubChecks()
  /*
    **Der Zusatzkanal hängt an der Adresse, nicht am Sprachurteil** (21.09.2026). Gelesen
    wird er aus dem jüngsten Beleg der Adresse, der Abos nennt — auch aus einem ohne
    Urteil. Genau die Kanal-Pillen ohne Urteil (ein Kanal-Nein wird bewusst nicht
    übernommen) brauchen den Hinweis am meisten; Golden Wind stand nach dem ersten
    Anlauf als nacktes „Prime Video" da, obwohl die Meldung „Abos: crunchyrollde" trug.
  */
  const kanalJeAdresse = new Map<string, string | undefined>()
  /*
    **Und die Zugangsart, die die Erweiterung auf genau dieser Seite gemessen hat** (21.09.2026).
    Sie stand in jeder Meldung („zugang=kauf") und wurde nie gelesen; die Pille nahm JustWatchs
    Angabe je Titel oder die Vorgabe „Prime = Abo". Gemessen über 700 Prime-Seiten mit Angabe:
    111 zeigten die falsche Zugangsart — 46 als Kauf, obwohl im Abo, 65 als Abo, obwohl nur zu
    kaufen oder zu leihen. Lupin III. Part 6 stand als Abo da, Daniels Bild zeigte „Als
    Kauftitel verfügbar". JustWatch spricht über den Titel, die Meldung über die Ausgabe.
  */
  const zugangJeAdresse = new Map<string, 'abo' | 'kauf'>()
  for (const c of [...alleChecks].sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))) {
    if (c.platform !== 'primevideo' || !c.url) continue
    const k = adressKern(c.url)
    if (/Abos: /.test(c.note ?? '') && !kanalJeAdresse.has(k)) kanalJeAdresse.set(k, kanalAusNotiz(c.note))
    const z = /zugang=([a-z_]+)/.exec(c.note ?? '')?.[1]
    if (z && !zugangJeAdresse.has(k)) {
      if (z === 'abo' || z === 'abo_und_kauf') zugangJeAdresse.set(k, 'abo')
      else if (z === 'kauf' || z === 'kauf_oder_leihe') zugangJeAdresse.set(k, 'kauf')
    }
  }
  const checksJePlattform = new Map<string, DubCheck[]>()
  for (const c of alleChecks) {
    /*
      **Adressbelege bleiben draußen — sie tragen keine Aussage über den Verweis.**

      `dub-confirmed.yaml` führt neben den Urteilen auch Zeilen, die nur die
      Herkunft einer Adresse festhalten („Verweis aus Netflix' eigener
      Staffelliste erschlossen"): mit `url`, ohne `dub` und ohne `available`.
      Solange `loadDubChecks()` beide verschmolz, fiel das nicht auf; seit der
      Trennung je Ausgabe (07.09.2026) gewann der Adressbeleg gegen das Urteil,
      weil er die passende Adresse trug — fünf Staffeln „My Hero Academia"
      standen so trotz belegtem Nein im Datensatz.

      **`available` gehört dazu, `dub` allein genügt nicht.** Ein erster Anlauf
      filterte nur auf `dub` und warf 262 „nicht verfügbar"-Belege weg; aus
      sechs Meldungen in `check:handbelege` wurden 268. Beide Felder sind
      verschiedene Aussagen (siehe `DubCheck.available`), aber beide sind
      Aussagen.
    */
    if (typeof c.dub !== 'boolean' && typeof c.available !== 'boolean') continue
    const k = dubKey(c.anilistId, c.platform)
    const liste = checksJePlattform.get(k) ?? []
    liste.push(c)
    checksJePlattform.set(k, liste)
  }
  /*
    **Der jüngste Beleg steht vorn — einmal sortiert, nicht bei jedem Aufruf.**

    `belegFuer()` greift in jeder Stufe den ersten passenden Eintrag. Ohne
    Sortierung ist das der erste der Datei, und bei 26 Verweisen war das ein
    Beleg, den ein jüngerer längst überholt hatte (07.09.2026). Die Reihenfolge
    ist für alle Aufrufe dieselbe, also wird sie einmal hier festgelegt.
  */
  for (const liste of checksJePlattform.values()) {
    liste.sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))
  }

  /**
   * **Eine zweite Ausgabe mit Deutsch wird ein eigener Verweis.**
   *
   * Digimon stand mit genau einer Prime-Adresse im Bestand, der
   * Crunchyroll-Kanal-Ausgabe `B0CHHNJJW3` — ohne deutschen Ton. Die Ausgabe
   * „In Prime enthalten" (`B0CGRJGJX1`) hat ihn, und ihr Beleg trägt die
   * Adresse. `belegFuer()` nimmt bei einem einzigen Weg aber zuerst den Beleg mit
   * **derselben** Adresse; das Nein zur Kanal-Seite gewann, der Verweis flog
   * heraus, und das Ja zur anderen Seite fand keinen Weg, an dem es hängen
   * konnte (Daniel, 14.09.2026).
   *
   * Angelegt wird nur, wenn **jeder** vorhandene Weg dieser Plattform belegt
   * ohne Deutsch ist. Sonst ist die Adresse im Beleg eine Korrektur (siehe
   * `belegFuer()`), und ein zusätzlicher Verweis wäre eine Dublette. Nur für
   * Amazon-Titelseiten: Dort sind Ausgaben mit eigener Kennung die Regel.
   */
  let ausgabeErgaenzt = 0
  for (const [schluessel, liste] of checksJePlattform) {
    const [idRoh, plattform] = schluessel.split('|')
    const title = titles.get(Number(idRoh))
    if (!title) continue
    const wege = title.streams.filter((s) => s.platform === plattform)
    if (!wege.length) continue
    /* Je Adresse zählt der jüngste Beleg — die Liste ist oben schon sortiert. */
    const neuestes = new Map<string, DubCheck>()
    for (const c of liste) if (c.url && !neuestes.has(adressKern(c.url))) neuestes.set(adressKern(c.url), c)
    if (!wege.every((s) => neuestes.get(adressKern(s.url))?.dub === false)) continue
    for (const c of neuestes.values()) {
      if (c.dub !== true || !/amazon\.de\/(?:dp|gp\/video\/detail)\//.test(c.url ?? '')) continue
      if (title.streams.some((s) => adressGleich(s.url, c.url))) continue
      title.streams.push({ platform: plattform as PlatformId, url: c.url! } as StreamLink)
      ausgabeErgaenzt++
    }
  }
  if (ausgabeErgaenzt) log(`${ausgabeErgaenzt} Verweise auf eine zweite Ausgabe mit deutschem Ton angelegt`)
  const belegFuer = (
    titleId: number,
    plattform: PlatformId,
    url?: string,
    /** Wie viele Verweise dieser Plattform der Titel hat — entscheidet über die Strenge. */
    anzahlWege = 1,
  ): DubCheck | undefined => {
    const alle = checksJePlattform.get(dubKey(titleId, plattform))
    if (!alle?.length) return undefined
    /*
      **Ein Beleg ohne Sprachurteil ist kein Sprachbeleg.**

      In `dub-confirmed.yaml` stehen zwei Arten von Einträgen: Sprachurteile
      (`dub: true|false`) und **Adressbelege** — Zeilen, die nur festhalten, wo
      ein Verweis herkommt („Verweis aus Netflix' eigener Staffelliste
      erschlossen"). Die zweite Art trägt eine `url` und kein `dub`.

      Seit die Belege je Ausgabe getrennt geführt werden (07.09.2026), standen
      beide Arten nebeneinander in derselben Liste — und weil der Adressbeleg
      die passende `url` trug, gewann er nach Regel 1 gegen das Urteil, das
      keine hatte. Fünf Staffeln „My Hero Academia" waren auf Netflix als „ohne
      deutsche Tonspur" geprüft und standen trotzdem im Datensatz;
      `check:handbelege` hat es gemeldet und den Datenlauf rot gemacht.

      Für die Auswahl zählen deshalb nur Einträge mit einer **Aussage über den
      Verweis** — `dub` (gibt es dort deutschen Ton?) oder `available` (gibt es
      dort überhaupt ein Angebot?). Was ein Adressbeleg beiträgt, die richtige
      Adresse, wird an anderer Stelle gelesen.

      **`available` gehört ausdrücklich dazu.** Ein erster Anlauf filterte nur
      auf `dub` und warf damit 262 „nicht verfügbar"-Belege weg — aus sechs
      Meldungen in `check:handbelege` wurden 268. Die beiden Felder sind
      verschiedene Aussagen (siehe `DubCheck.available`), aber beide sind
      Aussagen; nur der Adressbeleg ist keine.
    */
    /*
      **Und innerhalb jeder Stufe gewinnt der jüngste Beleg.**

      `loadDubChecks()` ließ den jüngeren gewinnen, solange es je Schlüssel nur
      einen Eintrag gab. Seit der Trennung je Ausgabe liegen mehrere
      nebeneinander, und `find()` nahm schlicht den ersten der Datei — bei 26
      Verweisen war das ein Beleg, den ein jüngerer längst überholt hatte
      (gemessen 07.09.2026, `check:handbelege` meldet solche Fälle namentlich).

      Ein Sortiervorgang je Aufruf wäre Verschwendung: Die Reihenfolge ist für
      alle Aufrufe dieselbe, also wird sie einmal beim Aufbau der Karte gesetzt.
    */
    const liste = alle
    if (!liste.length) return undefined
    if (url) {
      const genau = liste.find((c) => c.url && adressGleich(c.url, url))
      if (genau) return genau
    }
    const ohneAdresse = liste.find((c) => !c.url)
    if (ohneAdresse) return ohneAdresse
    /*
      **Bei einem einzigen Weg ist die Adresse im Beleg eine Korrektur, keine
      Unterscheidung.**

      Genau dafür ist das Feld da (siehe `DubCheck.url`): „Die richtige
      Adresse, falls die im Datensatz danebenliegt." Wer hier streng vergleicht,
      wirft 60 Belege weg, die den Verweis gerade richtigstellen sollen.

      **Erst ab zwei Wegen wird die Adresse zur Unterscheidung** — dann gibt es
      zwei Ausgaben, und ein Beleg für die eine sagt nichts über die andere. Das
      ist der Date-a-Live-Fall vom 07.09.2026.
    */
    return anzahlWege > 1 ? undefined : liste[0]
  }
  /* Rückwärtsverträglich für die Stellen, die keine Adresse zur Hand haben. */
  /**
   * **Eine nackte Domain ist kein Weg zu einem Titel.**
   *
   * Gemessen am 07.09.2026: Zwei Crunchyroll-Verweise trugen als Adresse
   * schlicht `https://crunchyroll.com` — einer davon mit großem C, beide ohne
   * Pfad. Sie stammen aus einer Quelle, die statt einer Titelseite ihre eigene
   * Startseite gemeldet hat.
   *
   * Für einen Besucher ist das die schlechteste Art von Verweis: Er sieht aus
   * wie eine Auskunft („dort läuft es"), führt aber auf eine Startseite, auf
   * der er den Titel selbst suchen muss. Ein Fragezeichen wäre ehrlicher
   * gewesen, gar kein Verweis noch mehr.
   *
   * **Ins Gedächtnis kommt das nicht**: Es ist kein belegtes Nein, sondern eine
   * kaputte Adresse. Taucht dieselbe Serie später mit einer echten Adresse auf,
   * soll sie kommen dürfen.
   */

  /**
   * **Eine Suchadresse ist kein Weg — auch nicht als Notbehelf.**
   *
   * Bis zum 10.09.2026 hat genau diese Stelle aus einer pfadlosen Adresse eine
   * Crunchyroll-Suche gemacht, mit unserem Titel als Suchbegriff. Der Gedanke
   * war, dem Besucher wenigstens etwas zu geben. Gemessen an dem, was dabei
   * herauskam, war es weniger als nichts: Für „Kaiju No. 8 Narumi's Week at
   * Work" antwortet Crunchyroll mit **„Es konnte nichts gefunden werden"**
   * (Daniel, 10.09.2026, mit Bild). Unser Titel ist dort der Name eines
   * Staffelblocks, kein Suchbegriff.
   *
   * Daniels Ansage: „alle links die auf such query gehen, statt direkt auf
   * treffer, müssen entfernt werden von der webseite."
   *
   * **Die echte Adresse lag die ganze Zeit im Repo.** Der deutsche Katalog
   * (`data/cr-katalog-de.json`, 1.656 Serien) führt „Kaiju No. 8" unter
   * `GG5H5XQ7D`/`kaiju-no-8` — Zeichen für Zeichen die Adresse, die Daniel
   * von Hand herausgesucht hat. Dieselbe Klasse wie die fünf Fälle vom
   * 06./07.09.2026: geschrieben, committet, nie gelesen.
   *
   * **Gefragt wird nur nach der Adresse, nicht nach dem Ob.** Der Verweis
   * steht bereits — mitsamt seinem Sprachurteil; hier wird ausschließlich
   * seine kaputte Adresse ersetzt. Deshalb genügt ein Namensabgleich, wo er
   * sonst zu Recht als unzuverlässig gilt: Er beantwortet die Frage „wo genau
   * liegt das beim Anbieter", nicht „läuft das dort" (dieselbe Trennung wie
   * bei JustWatch, 10.09.2026).
   *
   * Und weil eine Crunchyroll-Serienseite alle Staffeln und Nebenausgaben
   * einer Reihe führt (Daniels Bildschirmabzug zeigt „Season 1 · Mission
   * Recon · Season 2 · Narumi's Week at Work" unter einer Adresse), ist der
   * Reihenkopf für ein Special die **richtige** Antwort, nicht die zweitbeste.
   *
   * **Warum die Reparatur hier steht und das Entfernen ganz unten:** Eine
   * pfadlose Adresse überlebt die nachfolgenden Runden nicht — sie fliegt als
   * kaputter Verweis heraus, und dann gibt es nichts mehr zu reparieren.
   * Umgekehrt ersetzen spätere Runden Suchadressen noch durch echte
   * Titelseiten (Daniels Prime-Meldungen); wer sie hier wegwirft, nimmt ihnen
   * die Gelegenheit. Zwei Aufgaben, zwei Stellen.
   */
  const crNamen = crNamensindexAusDatei()
  const crAdresseZu = (name: string): string | undefined => crAdresseNachName(crNamen, name)
  /**
   * Welche Serien der deutsche Katalog mit deutscher Tonspur führt.
   *
   * Nur für die Frage „lohnt ein Verweis überhaupt" — als Sprachbeleg taugt die
   * Liste nicht: Sie gilt der Reihe, nicht der Folge (CLAUDE.md, 22.08.2026).
   */
  const crKatalogDeutsch = new Set(
    (readJson<{ eintraege?: { id?: string; audio?: string[]; tonspuren?: string[] }[] }>('data/cr-katalog-de.json', {})
      .eintraege ?? [])
      .filter((e) => (e.audio ?? e.tonspuren ?? []).includes('de-DE'))
      .map((e) => e.id ?? '')
      .filter(Boolean),
  )
  /**
   * **Ein „nicht mehr verfügbar" aus dem US-Katalog gilt nicht, wo der deutsche Katalog die Serie führt.**
   *
   * Gemessen am 17.09.2026: 109 Serien tragen `nichtVerfuegbar` aus dem Lauf vom
   * 21.08. mit `katalog: us`; 33 davon führt der deutsche Katalog mit deutscher
   * Tonspur — Death Note, One-Punch Man, vier InuYasha-Filme. Der Bau entfernte
   * ihre Verweise trotzdem, und weil sich die Warteschlange des Dub-Laufs aus
   * den Verweisen bildet, kamen sie nie mehr zur Prüfung mit deutschem Zugang.
   * CLAUDE.md sagt es seit dem 22.08.: „Wo eine Serienkennung bekannt ist,
   * entscheidet der Katalog und nicht die Seite." Der Verweis bleibt deshalb
   * ohne Urteil stehen, bis der deutsche Lauf ihn beurteilt.
   *
   * **Nur, wenn es noch keinen deutschen Befund gibt.** 19 der 33 sind unter einer
   * anderen Schreibweise der Adresse längst mit deutschem Zugang geprüft
   * (`/kiss-him-not-me` neben `/de/kiss-him-not-me`); dort entscheidet dieser
   * Befund, und die US-Adresse fliegt wie bisher. Der erste Bau mit der breiten
   * Regel kostete fünf „DE ✓" (Durarara!!, Lupin III. Part 6 …). Übrig bleiben 14.
   */
  let crDeutschGeprueft: Set<string> | undefined
  const usNeinWiderlegt = (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null }): boolean => {
    if (!serie.nichtVerfuegbar || serie.katalog === 'de' || !serie.seriesId || !crKatalogDeutsch.has(serie.seriesId))
      return false
    /* `crDub` wird weiter unten geladen; gerufen wird erst danach. */
    crDeutschGeprueft ??= new Set(
      crDub.serien.filter((c) => c.katalog === 'de' && c.seriesId).map((c) => c.seriesId as string),
    )
    return !crDeutschGeprueft.has(serie.seriesId)
  }

  /** Was am Ende übrig bleibt und niemand automatisch auflösen kann. */
  const suchOffen: { id: number; titel: string; plattform: string; url: string }[] = []
  /** Titel und Anbieter, zu denen ein Handbeleg „gibt es dort nicht" sagt. */
  const beantworteteSuchen = new Set(
    alleChecks.filter((c) => c.available === false).map((c) => `${c.anilistId}|${c.platform}`),
  )

  let ohnePfad = 0
  let ohnePfadWeg = 0
  for (const title of titles.values()) {
    if (!title.streams?.length) continue
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? ''
    title.streams = title.streams.filter((stream) => {
      let pfad = ''
      try {
        pfad = new URL(stream.url).pathname
      } catch {
        pfad = ''
      }
      if (pfad !== '' && pfad !== '/') return true
      if (stream.platform === 'crunchyroll' && name) {
        const echte = crAdresseZu(name)
        if (echte) {
          stream.url = echte
          ohnePfad++
          return true
        }
      }
      /*
        **Ins Gedächtnis kommt das nicht**: Es ist kein belegtes Nein, sondern
        eine kaputte Adresse. Taucht dieselbe Serie später mit einer echten
        Adresse auf, soll sie kommen dürfen.
      */
      ohnePfadWeg++
      /*
        **Eine beantwortete Frage kommt nicht wieder** (22.09.2026). Overgeared stand weiter als
        Suchadresse in der Statusanzeige und führte auf Crunchyrolls Startseite, obwohl Daniel am
        20.09. geantwortet hatte: „dort gibt es keine Serienseite" (`available: false`).
      */
      if (!beantworteteSuchen.has(`${title.id}|${stream.platform}`))
        suchOffen.push({ id: title.id, titel: name, plattform: stream.platform, url: stream.url })
      return false
    })
  }
  if (ohnePfad) log(`${ohnePfad} Verweise ohne Pfad über den deutschen Katalog auf ihre Serienadresse gesetzt`)
  if (ohnePfadWeg) log(`${ohnePfadWeg} Verweise ohne Pfad entfernt — eine nackte Domain ist kein Weg zu einem Titel`)

  const checks = new Map(alleChecks.map((c) => [dubKey(c.anilistId, c.platform), c]))
  /** Befund je YouTube-Adresse aus `pipeline/check-youtube.ts`. */
  const youtubeBefunde = readJson<Record<string, { art: string; inDE: number; unklar?: boolean }>>(
    'data/youtube-check.json',
    {},
  )
  /**
   * Der YouTube-Kanal je Adresse, aus `pipeline/check-youtube.mjs`.
   *
   * Er entscheidet über kostenlos oder Kauf: Was auf „YouTube Movies" liegt,
   * muss bezahlt werden, trägt aber eine ganz gewöhnliche `watch?v=`-Adresse.
   * Die Datei liegt seit dem 22.08.2026 im Repo und wurde nie ausgewertet —
   * 40 Titel standen deshalb als kostenlos, die es nicht sind.
   */
  const ytKanal: Record<string, string> = {}
  /**
   * Adressen mit belegtem Kaufangebot — die Videoseite nennt eine `offerId`.
   *
   * Der Kanalname allein reicht nicht: Bei einem HTTP 401 gibt oEmbed keinen
   * heraus, und genau diese neun Verweise standen bis zum 24.08.2026 als
   * "kostenlos" im Kalender, obwohl sechs davon Geld kosten.
   */
  const ytKauf = new Set<string>()
  /**
   * **Was YouTube selbst über die Tonspur sagt — je Adresse.**
   *
   * `pipeline/check-youtube.mjs` liest die Angabe seit dem 23.08.2026 aus der
   * Videoseite („Audio: Deutsch"). Sie stand seither in `youtube-befunde.json`
   * und erreichte den Datensatz nie: Dieser Block las `kanal` und
   * `kaufAngebot`, das dritte Feld daneben las niemand. 41 Verweise trugen eine
   * belegte Sprachangabe, und 22 YouTube-Verweise standen trotzdem ohne Urteil
   * im Kalender (gemessen 29.08.2026).
   *
   * Die Aussage gilt dem **Verweis**, nicht dem Werk — genau das ist
   * `stream.dub`. Ein „Japanisch" bei einer Seite, die mit `de-DE` angefragt
   * wurde, heißt: Hier gibt es keinen deutschen Ton zu holen.
   */
  const ytAudio = new Map<string, boolean>()
  /**
   * **Ein Trailer ist kein Bezugsweg** (Daniel an „Your Name.", 17.09.2026:
   * „youtube pill verlinkt dort fälschlicherweise auf trailer, dafür ist trailer
   * button da").
   *
   * YouTube Movies zeigt zum Kaufangebot eines Films dessen Trailer als eigenes
   * Video; die Adresse trägt deshalb eine `offerId` und sieht wie ein Kaufweg
   * aus. Gemessen an allen fünf Verweisen mit `kategorie: 'Trailers'` (17.09.2026)
   * dauert das Video 60 bis 106 Sekunden und heißt „… - Trailer" — bei Your Name
   * sogar „Trailer (OmU)", also nicht einmal die deutsche Fassung, während der
   * Verweis „DE ✓" trug.
   *
   * Der Film selbst liegt unter einer Adresse, die wir nicht kennen, und
   * JustWatch führt für diese Titel gar kein YouTube-Angebot. Ein Weg, der auf
   * den Trailer führt, ist deshalb schlechter als keiner — dieselbe Entscheidung
   * wie bei den Suchadressen (10.09.2026).
   */
  const ytTrailer = new Set<string>()
  for (const [url, b] of Object.entries(
    readJson<
      Record<string, { kanal?: string | null; kaufAngebot?: boolean; audioDeutsch?: boolean; kategorie?: string }>
    >('data/youtube-befunde.json', {}),
  )) {
    if (b?.kanal) ytKanal[url] = b.kanal
    if (b?.kaufAngebot === true) ytKauf.add(url)
    if (typeof b?.audioDeutsch === 'boolean') ytAudio.set(url, b.audioDeutsch)
    if (b?.kategorie === 'Trailers') ytTrailer.add(url)
  }
  /** Antwortstatus je Anbieter-Adresse aus `pipeline/check-links.ts`. */
  const linkBefundeRoh = readJson<
    Record<string, { status: number | string; prime?: boolean; geprueftAm?: string }>
  >('data/link-check.json', {})
  /*
    **Ein Befund gehört der Seite, nicht ihrer Schreibweise** (21.09.2026). Seit Prime-Verweise
    unter `/gp/video/detail/` ausgeliefert werden, misst die Linkprüfung auch diese Form; der Bau
    trägt aus seinen Quellen aber oft noch `/dp/`. „Haikyu!! Karasuno vs. Shiratorizawa" war
    unter der Video-Adresse als „in Deutschland nicht abrufbar" gemessen, galt unter `/dp/` als
    unbekannt, blieb im Datensatz — und `check:tote-adressen` brach den Bau ab (Lauf
    35619070607). Der exakte Treffer gewinnt weiter; sonst zählt der jüngste Befund derselben
    Seite (`adressKern`). So bleiben alle zehn Nachschlagestellen, wie sie sind.
  */
  const befundJeKern = new Map<string, (typeof linkBefundeRoh)[string]>()
  for (const [u, b] of Object.entries(linkBefundeRoh)) {
    const k = adressKern(u)
    const alt = befundJeKern.get(k)
    if (!alt || (b.geprueftAm ?? '') > (alt.geprueftAm ?? '')) befundJeKern.set(k, b)
  }
  const linkBefunde = new Proxy(linkBefundeRoh, {
    get: (o, k) => (typeof k === 'string' ? (o[k] ?? befundJeKern.get(adressKern(k))) : undefined),
  })
  /*
    **Eine späte Runde legt keine Adresse an, die die Linkprüfung als tot kennt**
    (17.09.2026). Der Filter gegen tote Verweise steht weiter unten vor den
    Ergänzungen aus aniSearch und dem Crunchyroll-Katalog; was dort entsteht,
    sah er nie. Sechs Joyn-Adressen standen so seit dem 20.08. als 404 in
    `data/link-check.json` und trotzdem im Datensatz, ohne Sprachurteil.
  */
  const lautPruefungTot = (url: string): boolean => {
    const status = linkBefunde[url]?.status
    return status === 404 || status === 'region'
  }
  /** Wie oft der Kanal-Verweis mit dem Crunchyroll-Befund entfallen ist. */
  let kanalMitEntfernt = 0
  /** Welche Anbieter der zuletzt ausgelieferte Stand je Titel mit „DE ✓" führte — für die Abgänge. */
  const vorherDeutsch = new Map<number, Set<string>>()
  {
    const alt = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
    for (const t of Array.isArray(alt) ? alt : Object.values(alt)) {
      /* Auch die geführten Abgänge — sonst verschwände einer beim Bau nach seinem Entstehen. */
      const deutsch = [
        ...(t.streams ?? []).filter((s) => s.dub === true).map((s) => s.platform),
        ...(t.entfernteStreams ?? []).filter((s) => s.dub === true).map((s) => s.platform),
      ]
      if (deutsch.length) vorherDeutsch.set(t.id, new Set(deutsch))
    }
  }

  for (const title of titles.values()) {
    /**
     * Tote Verweise verschwinden, statt ein „✕" zu bekommen.
     *
     * Sechs von zehn Verweisen aus dem ersten Prüfdurchgang waren nicht
     * „vorhanden, aber nur untertitelt", sondern schlicht weg: „Videos nicht
     * verfügbar" oder eine Weiterleitung auf die Startseite. Ein „🇩🇪 ✕"
     * behauptete dort ein Angebot ohne deutsche Fassung — also etwas, das es
     * gar nicht gibt.
     */
    /*
      Netflix schreibt dieselbe Seite auf drei Arten — hier wird daraus eine.

      **Außer die eine Form ist nachweislich tot und die andere nicht.** Am
      06.09.2026 gemessen an zwei Fate-Titeln, die Netflix nur als Folge bzw.
      Film **innerhalb** einer Serie führt:

          /watch/82850867   HTTP 200 (20.08.2026)
          /title/82850867   HTTP 404 (29.08.2026)

      Eine eigene Titelseite gibt es für sie nicht. Die Vereinheitlichung machte
      aus einer lebenden Adresse eine tote, der Abgangsfilter entfernte den
      Verweis daraufhin zu Recht — und beide Titel standen danach ohne Weg da.

      Der Riegel ist eng: Er greift nur, wo für die **neue** Form ein 404 vorliegt
      und für die alte keiner. Ohne Messung bleibt es bei der Vereinheitlichung,
      die für die übrigen 596 Netflix-Verweise richtig ist.
    */
    for (const s of title.streams) {
      if (s.platform !== 'netflix') continue
      const vereinheitlicht = netflixTitelAdresse(s.url)
      if (vereinheitlicht === s.url) continue
      const neuTot = linkBefunde[vereinheitlicht]?.status === 404
      const altTot = linkBefunde[s.url]?.status === 404
      if (neuTot && !altTot) continue
      s.url = vereinheitlicht
    }
    /*
      **Was auch danach keine Kennung trägt, führt ins Leere.**

      Zwei Verweise bleiben nach der Vereinheitlichung übrig, beide aus AniLists
      Verweisliste: `netflix.com/title/` ohne Nummer und
      `netflix.com/DetectiveConanMovies`, das auf eine Genre-Liste führt statt
      auf den Film. Ein Besucher klickt und findet nicht, wonach er gesucht hat.

      Der Titel bleibt im Bestand und landet über die reguläre Prüfliste wieder
      auf dem Tisch — entfernt wird der Weg, nicht das Werk.
    */
    const vorNetflix = title.streams.length
    title.streams = title.streams.filter((s) => s.platform !== 'netflix' || netflixAdresseTaugt(s.url))
    netflixOhneKennung += vorNetflix - title.streams.length

    /*
      Abgänge werden gesammelt, nicht weggeworfen — siehe `entfernteStreams`.
    */
    const abgaenge: typeof title.streams = []
    /*
      **Ein Abgang nur, wo es vorher Deutsch gab.** „Netflix — nicht mehr abrufbar" stand
      über Mushoku Tensei Staffel 3, die dort nie lief (Daniel, 16.09.2026, mit Bild des
      Staffel-Dropdowns: nur Staffel 1 und 2). Alle 514 Abgänge im Datensatz trugen kein
      Sprachurteil — die Pille behauptete einen Verlust, den niemand belegt hatte.
      Belegt ist er nur, wenn ein Handbeleg oder der zuletzt ausgelieferte Stand dort
      deutschen Ton führte.
    */
    const warDeutsch = (s: { platform: PlatformId; url: string }) =>
      (checksJePlattform.get(dubKey(title.id, s.platform)) ?? []).some((c) => c.dub === true) ||
      (vorherDeutsch.get(title.id)?.has(s.platform) ?? false)
    title.streams = title.streams.filter((stream) => {
      /**
       * Was YouTube selbst über seine Verweise sagt.
       *
       * `pipeline/check-youtube.ts` fragt je Adresse die offizielle Data API:
       * Wie viele der dort liegenden Videos sind **in Deutschland** abrufbar?
       * Null heißt, der Verweis führt einen Besucher hier ins Leere — sei es,
       * weil die Playlist gelöscht ist, weil sie keine Videos führt, oder weil
       * alle auf einen anderen Erdteil beschränkt sind.
       *
       * Das war der Normalfall, nicht die Ausnahme: Von 460 bewertbaren
       * Adressen führten am 20.08.2026 **362** ins Leere, allein 290 wegen einer
       * Ländersperre (Daniels Fund: eine Playlist zu „Sword of the Demon
       * Hunter", deren 24 Videos auf den asiatisch-pazifischen Raum beschränkt
       * sind und chinesische Untertitel tragen).
       *
       * Kanäle bleiben unangetastet — ein Kanal ist keine Folgenliste, und was
       * dort liegt, sagt nichts über diesen Titel.
       */
      const yt = stream.platform === 'youtube' ? youtubeBefunde[stream.url] : undefined
      /**
       * Kanaladressen fliegen raus, ohne Prüfung.
       *
       * Ein Kanal ist keine Folgenliste: Er beantwortet nicht, ob **dieser**
       * Titel dort zu sehen ist, sondern zeigt irgendwas vom Sender. Bis zum
       * 20.08.2026 blieben sie stehen, weil sie sich nicht bewerten lassen —
       * genau das ist aber der Grund, sie wegzulassen (Daniel: „YouTube-
       * Verlinkungen zu Kanälen statt Videos/Playlists direkt streichen").
       */
      if (yt?.art === 'kanal') {
        ytEntfernt++
        return false
      }
      /* Ein Trailer beantwortet die Frage nicht, wo der Film läuft — siehe `ytTrailer`. */
      if (ytTrailer.has(stream.url)) {
        ytEntfernt++
        return false
      }
      /* `unklar` heißt „die Abfrage hat nicht geantwortet" — kein Grund, einen Verweis zu entfernen (17.09.2026). */
      if (yt && yt.art !== 'kanal' && yt.inDE === 0 && !yt.unklar) {
        ytEntfernt++
        return false
      }
      /**
       * Führt der Verweis überhaupt noch irgendwohin?
       *
       * `pipeline/check-links.ts` misst es für die Anbieter, deren Antwort etwas
       * bedeutet. Eine Stichprobe am 20.08.2026 fand bei Joyn 9 von 11 und bei
       * Aniverse 9 von 30 Verweisen mit 404 — ein Versprechen auf eine
       * Fehlerseite.
       *
       * **Nur ein hartes 404 entfernt.** Zeitüberschreitung, 403 und Netzfehler
       * sagen etwas über den Weg dorthin, nicht über den Verweis. Crunchyroll
       * und ADN antworten jedem Skript mit 403; sie werden gar nicht erst
       * geprüft, sonst verwürfe diese Zeile reihenweise gültige Verweise.
       */
      /*
        **Ein Abgang wird vermerkt, nicht verschwiegen** (Daniel, 01.09.2026).

        Bis dahin fiel ein Verweis stillschweigend heraus, sobald er ins Leere
        führte oder eine Prüfung ihn als weg meldete. Für den Leser sah das aus,
        als hätte es ihn nie gegeben — dabei ist genau das die Auskunft, die er
        sucht: „seit <Datum> nicht mehr im Katalog von <Anbieter>".

        Der Eintrag bleibt deshalb stehen und trägt `entferntAm`. Die Oberfläche
        zeigt ihn als Vermerk statt als Verweis; anklickbar ist er nicht mehr,
        denn dort ist nichts.
      */
      const check = belegFuer(title.id, stream.platform, stream.url, title.streams.filter((x) => x.platform === stream.platform).length)
      const befund = linkBefunde[stream.url]?.status
      /*
        **Eine jüngere Handprüfung derselben Adresse schlägt den Linkbefund** (22.09.2026). Die
        Linkprüfung sah bei Fairy Tail nur Staffel 1 („region") und entfernte den Weg; Daniel sah
        dieselbe Seite zwei Tage später mit Staffel 2–9 zum Kauf. Gilt nur, wenn der Beleg genau
        diese Adresse nennt, jünger ist und die Seite nicht selbst als weg meldet.
      */
      const linkAm = String(linkBefunde[stream.url]?.geprueftAm ?? '')
      const handSticht =
        check?.available !== false &&
        ((Boolean(check?.url && adressGleich(check.url, stream.url)) && String(check?.checkedAt ?? '') > linkAm) ||
          /* Ein von Hand bestätigter Weg (`verweise-von-hand.yaml`) — der Lader kennt Belege ohne Urteil nicht. */
          (vonHandBelegtAm.get(adressKern(stream.url)) ?? '') > linkAm)
      if ((befund === 404 || befund === 'region') && !handSticht) {
        totEntfernt++
        abgaenge.push({ ...stream, entferntAm: linkBefunde[stream.url]?.geprueftAm ?? todayIso() })
        return false
      }
      if (check?.available === false) {
        entfernt++
        abgaenge.push({ ...stream, entferntAm: check.checkedAt ?? todayIso() })
        return false
      }
      if (check && typeof check.dub === 'boolean') {
        stream.dub = check.dub
        geprueft++
      }
      // Die Handprüfung hat Vorrang; wo sie schweigt, spricht YouTube selbst.
      if (stream.dub === undefined && stream.platform === 'youtube') {
        const ton = ytAudio.get(stream.url)
        if (ton !== undefined) {
          stream.dub = ton
          ytAusTonspur++
        }
      }
      // Wo der deutsche Ton aufhört, steht nur in den Bereichen. Sie kommen
      // fertig auf diese Staffel umgerechnet aus fetch-pruefungen.ts.
      if (check?.dubRanges?.length) {
        stream.dubRanges = check.dubRanges.map((r) => ({ from: r.from, to: r.to, dub: r.dub }))
      }
      /*
        Der Teilbereich gehört zur Adresse, nicht zum Befund: Er sagt, welchen
        Ausschnitt der Anbieter-Liste dieser Eintrag meint.
      */
      if (check?.teilBereich) {
        stream.teilBereich = { von: check.teilBereich.von, bis: check.teilBereich.bis }
      }
      /*
        Eine von Hand gefundene Adresse schlägt jede geratene — **außer sie ist tot**.
        Der 404-Riegel steht wenige Zeilen darüber und prüft die Adresse, die der
        Verweis **vorher** trug; bei „Your Name." war das die Suchadresse (HTTP 200),
        und erst hier wurde daraus die gelöschte Seite `B0FLLFC2L6`. Der Beleg kam so
        an jedem Riegel vorbei (17.09.2026).
      */
      if (check?.url && !lautPruefungTot(check.url)) {
        stream.url = check.url
        adressen++
      }
      return true
    })
    /*
      **Ein Abgang je Anbieter, der jüngste.** Wechselt eine Adresse und fällt
      auch die neue weg, steht sonst zweimal dasselbe da.

      Und nur, solange der Anbieter keinen gültigen Weg mehr trägt: Führt ein
      Titel nach einem Adresswechsel wieder einen Netflix-Verweis, ist der alte
      Abgang keine Auskunft mehr, sondern eine Irreführung.
    */
    if (abgaenge.length) {
      const jeAnbieter = new Map<string, (typeof abgaenge)[number]>()
      for (const a of abgaenge) {
        /*
          **Eine Suchadresse ist kein Abgang.** Sie war nie ein Eintrag im
          Katalog, sondern ein Suchauftrag — „nicht mehr abrufbar" würde
          behaupten, dort sei einmal etwas gewesen. 61 der ersten 613 Abgänge
          waren solche Adressen (Cowboy Bebop auf Prime etwa).
        */
        if (/[?&]k=|\/s\?/.test(a.url)) continue
        if (title.streams.some((s) => s.platform === a.platform)) continue
        if (!warDeutsch(a)) continue
        const bisher = jeAnbieter.get(a.platform)
        if (!bisher || (a.entferntAm ?? '') > (bisher.entferntAm ?? '')) jeAnbieter.set(a.platform, { ...a, dub: true })
      }
      if (jeAnbieter.size) title.entfernteStreams = [...jeAnbieter.values()]
    }

    /*
      **Crunchyroll über Prime Video ist Crunchyroll.**

      Der Kanal zeigt denselben Katalog — wer ihn bei Prime dazubucht, sieht
      dort, was Crunchyroll führt, und sonst nichts. Daniel am 03.09.2026:
      „crunchy in prime ist identisch zu crunchy, also wenn wir crunchy in prime
      pills haben, und sie gleichzeitig laut unserem Bestand nicht in crunchy
      sind, dann sind sie auch nicht in crunchy in prime."

      Deshalb erbt der Kanal-Verweis den Befund: Ist der Crunchyroll-Verweis
      **belegt entfallen** — kein Deutsch, nicht mehr abrufbar —, dann führt der
      Weg über Prime genauso ins Leere und verschwindet mit.

      **Was er nicht erbt, ist das Schweigen.** Ein Titel ohne
      Crunchyroll-Verweis heißt meist nur, dass wir keine Adresse kennen; dort
      ist der Kanal-Verweis der einzige Hinweis überhaupt und bleibt stehen. Der
      Unterschied ist derselbe wie überall in diesem Projekt: Gestrichen wird,
      was eine Quelle **aktiv widerlegt**.
    */
    /* Alle Abgänge, nicht nur die angezeigten — ein Crunchyroll-Verweis ohne früheres Deutsch ist trotzdem weg. */
    const crWeg = abgaenge.some((s) => s.platform === 'crunchyroll')
    const crDa = title.streams.some((s) => s.platform === 'crunchyroll')
    if (crWeg && !crDa && title.watchLinks?.length) {
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter(
        (w) => !/crunchyroll/i.test(w.name ?? '') || !/prime/i.test(w.name ?? ''),
      )
      kanalMitEntfernt += vorher - title.watchLinks.length
    }
  }
  if (kanalMitEntfernt) {
    log(`${kanalMitEntfernt} Kanal-Verweise „Crunchyroll über Prime Video" entfernt — Crunchyroll selbst ist dort belegt weg`)
  }
  /**
   * Verweise, die es nur von Hand gibt.
   *
   * Steht in `dub-confirmed.yaml` eine Adresse zu einer Plattform, die der
   * Titel gar nicht führt, wird sie angelegt. Der Fall entsteht, wo ein
   * Anbieter mehrere unserer Staffeln unter einer Reihe zeigt und die Quellen
   * deshalb nur eine davon kennen.
   *
   * **Ein `available: false` legt nichts an.** Der Block darüber entfernt genau
   * solche Verweise, und dieser hier legte sie unmittelbar danach wieder an —
   * die Adresse steht ja im Beleg. Zwei Schritte, die sich widersprechen, und
   * der zweite gewann.
   *
   * Aufgefallen ist es am 26.08.2026, als die Erweiterung erstmals
   * „nicht verfügbar" **mit** Adresse meldete: `check:handbelege` wurde rot und
   * nannte acht Titel, die „als nicht verfügbar geprüft" waren und trotzdem im
   * Datensatz standen — Aoashi, Chainsaw Man, SPY×FAMILY und fünf weitere. Der
   * Deploy blieb zwei Läufe lang hängen.
   *
   * Die Zusicherung hat den Widerspruch gefunden, nicht der Vorsatz.
   */
  let ergaenzt = 0
  for (const title of titles.values()) {
    for (const check of checks.values()) {
      if (check.anilistId !== title.id || !check.url) continue
      if (check.available === false) continue
      /*
        **Und eine tote Adresse legt der Beleg genauso wenig an** (17.09.2026). Der
        Handbeleg sagt, welche Sprache die Seite hatte — nicht, dass es sie noch gibt.
        Bei „Your Name." hat Daniel am 31.08. auf `B0FLLFC2L6` deutschen Ton gemeldet;
        Amazon hat die Ausgabe seitdem gelöscht (HTTP 404, gemessen 17.09.), der Block
        darüber entfernte den Verweis, und dieser legte ihn unmittelbar wieder an —
        derselbe Widerspruch wie beim `available: false` am 26.08.2026.
      */
      if (lautPruefungTot(check.url)) continue
      if (title.streams.some((s) => s.platform === check.platform)) continue
      title.streams.push({ platform: check.platform, url: check.url, dub: check.dub })
      ergaenzt++
    }
  }
  if (ergaenzt) log(`${ergaenzt} Verweise aus geprüften Adressen ergänzt`)

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
  {
    const roh = readJson<
      Record<
        string,
        {
          titleId: number
          asin: string | null
          /** Die gemeldete Seite (Migration 030), wenn die Rohfolgen sie tragen. */
          seite?: string | null
          /* Wer gemeldet hat. */
          plattform: string
          folgen: { unsere: number | null; sprachen: string[] }[]
        }
      >
    >('data/prime-zugeordnet.json', {})
    let ausRoh = 0
    let adressen = 0
    /** Meldungen, die einen dritten Prime-Verweis angelegt hätten — siehe unten. */
    let uebersprungen = 0
    /** Zuordnungen, deren Adresse ein Handbeleg einem anderen Titel zuschreibt. */
    let fremdeAdresse = 0
    for (const [schluessel, eintrag] of Object.entries(roh)) {
      const title = titles.get(eintrag.titleId)
      if (!title) continue
      /*
        **Ein Handbeleg gilt seiner Adresse, nicht der ganzen Plattform.**

        Der Riegel stand hier als `checks.has(<titel>|primevideo)` — je Titel
        und Anbieter gibt es genau einen zusammengeführten Beleg, also sperrte
        eine geprüfte Ausgabe jede Meldung zur zweiten. Genau den Fall
        beschreibt der Kommentar unten seit dem 30.08.2026: „My First
        Girlfriend is a Gal" läuft bei Prime als Kauftitel mit elf Folgen (KAZÉ,
        FSK 16, deutsch) **und** über den Crunchyroll-Kanal mit zehn (FSK 18).
        Daniel hatte den Kanal-Titel am 30.08. geprüft; seine Meldung zum
        Kauftitel vom 01.09. lief deshalb ins Leere und lag am 05.09.2026 noch
        unverwertet im Briefkasten.

        **Was der Riegel schützen soll, bleibt geschützt:** Ein Beleg **ohne**
        Adresse ist eine Aussage über den Anbieter — er sperrt weiter alles.
        Einer **mit** Adresse sperrt genau diese Adresse. Ein Nein zur einen
        Ausgabe ist kein Nein zur anderen; sie haben verschiedene Verlage,
        verschiedene Preise und verschiedene Tonspuren.
      */
      /*
        **Der Verweis gehört dem Anbieter, der gemeldet hat.**

        Hier stand dreimal `'primevideo'` fest verdrahtet — aus der Zeit, als nur
        Prime Rohfolgen meldete. Sobald Netflix oder Disney+ dieselbe Route
        gehen (`status.md`, „Sammeln und Zuordnen vollstaendig trennen"), wäre
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
          ? gemeldeteAdresse
          : /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\//i.test(gemeldeteAdresse)
            ? amazonAdresseRichten(gemeldeteAdresse)
            : eintrag.asin
              ? amazonTitelAdresse(eintrag.asin)
              : null
      if (beleg && (!beleg.url || adressGleich(beleg.url, seite ?? undefined))) continue
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
      const fremdBelegt = (adresse: string | null): boolean =>
        Boolean(adresse) &&
        alleChecks.some(
          (c) =>
            c.platform === plattform && c.url && c.anilistId !== eintrag.titleId && adressGleich(c.url, adresse ?? undefined),
        )
      /* Seit Migration 030 kennt die Rohfolge die gemeldete Seite — dann gilt die Meldung ihr. */
      if (fremdBelegt(seite) && plattform === 'primevideo' && eintrag.seite) {
        seite = amazonTitelAdresse(eintrag.seite)
      }
      if (fremdBelegt(seite)) {
        fremdeAdresse++
        continue
      }
      const deutsch = eintrag.folgen.some((f) => f.sprachen.includes('Deutsch'))
      if (!deutsch) continue

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
        (seite ? title.streams.find((x) => x.platform === plattform && x.url === seite) : null) ??
        (plattform === 'primevideo'
          ? title.streams.find((x) => x.platform === 'primevideo' && /amazon\.[a-z.]+\/s\?/i.test(x.url))
          : undefined)
      if (da) {
        if (da.dub !== true) {
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
        if (title.streams.filter((x) => x.platform === plattform).length >= 2) {
          uebersprungen++
          continue
        }
        /*
          **Und keine Adresse, die die Linkprüfung als tot kennt** (17.09.2026). Die
          gemeldeten Folgen belegen die Sprache der Seite, nicht ihren Fortbestand: Bei
          „Your Name." hat Amazon die Ausgabe nach Daniels Meldung vom 31.08. gelöscht,
          und diese Runde legte den 404 nach jedem Bau erneut an — dieselbe Stelle wie
          bei den Handbelegen eine Runde später.
        */
        if (lautPruefungTot(seite)) continue
        title.streams.push({ platform: plattform, url: seite, dub: true })
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

  /**
   * Jedem Verweis seine Zugangsart geben.
   *
   * Steht spät, damit auch die ergänzten und umsortierten Verweise sie bekommen.
   * Was es kostet, entscheidet `shared/zugangsart.ts` aus Name, Adresse und der
   * Angabe des Anbieters selbst — `kind: 'buy'` ist die stärkste davon.
   */
  for (const title of titles.values()) {
    /**
     * Die lizenzierte Angabe von JustWatch (über TMDB) schlägt die Namensliste.
     *
     * Sie gilt für **diesen Titel bei diesem Anbieter**, nicht für den Anbieter
     * im Allgemeinen — und genau daran scheiterte das Raten: Prime Video führt
     * Abo-Titel und Kauftitel nebeneinander. Gemessen am 23.08.2026 betraf das
     * 28 von 774 belegbaren Verweisen, alle bei Prime Video als „abo" geraten.
     *
     * Die Daten lagen die ganze Zeit in `data/tmdb-titles.json`; ausgewertet
     * wurden sie bisher nur für Anbieter **ohne** eigene Plattform.
     */
    const angebote = tmdbTitles[title.id]?.offers ?? []
    const jwArt = (platform: PlatformId) =>
      angebote.find((o) => providerToPlatform(o.name) === platform)?.kind

    for (const s of title.streams ?? []) {
      // Der YouTube-Kanal entscheidet über Kauf oder kostenlos — siehe
      // `zugangsart()`. Er steht in den Befunden, nicht im Verweis selbst.
      const kanal = s.platform === 'youtube' ? ytKanal[s.url] : undefined
      /* Auf der Seite gemessen schlägt JustWatch je Titel — siehe `zugangJeAdresse`. */
      const gemessen =
        s.platform === 'primevideo'
          ? zugangJeAdresse.get(adressKern(s.url))
          : s.platform === 'joyn'
            ? joynZugang.get(s.url)
            : undefined
      s.zugang = gemessen ?? zugangsart(s.platform, undefined, s.url, jwArt(s.platform), kanal, ytKauf.has(s.url))
    }
    for (const w of title.watchLinks ?? []) {
      w.zugang = zugangsart(w.name, w.kind, w.url, jwArt(providerToPlatform(w.name) as PlatformId))
    }
  }

  if (checks.size) {
    log(
      `${geprueft} geprüfte Synchro-Angaben übernommen, ${entfernt} tote Verweise entfernt (${checks.size} Prüfungen)` +
        (ytAusTonspur ? `, ${ytAusTonspur} YouTube-Urteile aus der Tonspur-Angabe` : ''),
    )
  }
  if (adressen) {
    log(`${adressen} Anbieter-Adressen durch die von Hand geprüfte ersetzt`)
  }
  if (totEntfernt) log(`${totEntfernt} Verweise entfernt: die Seite dahinter antwortet mit 404`)
  if (ytEntfernt) log(`${ytEntfernt} YouTube-Verweise entfernt: dort ist in Deutschland kein Video abrufbar`)

  /**
   * Auch Kaufwege können ins Leere führen.
   *
   * Die Bereinigung fasste bis zum 20.08.2026 nur `streams` an. In den
   * `watchLinks` standen daneben **188** Adressen, die mit 404 oder einer
   * Regionssperre antworten — dieselbe Prüfung, dieselben Befunde, nur nie
   * angewendet. Aufgefallen ist es, weil Daniel einen Kaufweg anklickte, der
   * nicht funktionierte.
   */
  let kaufwegeEntfernt = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => {
      const s = linkBefunde[w.url]?.status
      return !(s === 404 || s === 'region')
    })
    kaufwegeEntfernt += vorher - title.watchLinks.length
    if (!title.watchLinks.length) delete title.watchLinks
  }
  if (kaufwegeEntfernt) log(`${kaufwegeEntfernt} Kaufwege entfernt: die Seite dahinter ist weg oder hier gesperrt`)

  /**
   * Ein Suchlink weicht der echten Produktseite.
   *
   * AniList liefert für die meisten Titel keinen Deeplink zu Prime Video,
   * deshalb steht dort eine Suche — am 20.08.2026 bei **225 von 226**
   * Verweisen. Das ist besser als ins Nichts zu schicken, aber schlechter als
   * die Seite selbst: Daniel musste beim Prüfen jedes Mal erst den richtigen
   * Treffer heraussuchen („zu mühselig, alles von Hand zu prüfen").
   *
   * Für 137 dieser Titel steht die echte Adresse längst in unserem
   * aniSearch-Bestand — nur unter dem Anbieternamen `amazon`, der bei uns als
   * **Kauf** gilt. Ob dahinter ein Video oder eine Disc liegt, lässt sich den
   * Daten nicht ansehen; es steht im Seitentitel, und genau den liest
   * `check-links.ts` mit („Amazon.de: … ansehen | Prime Video").
   *
   * Ersetzt wird deshalb nur, was **belegt** ein Prime-Video-Eintrag ist und
   * mit 200 antwortet. Alles andere bleibt die Suche.
   */
  /*
    **Gesucht wird in zwei Beständen, nicht in einem.**

    Bis zum 25.08.2026 sah dieser Block nur in `watchLinks` nach. Dorthin schafft
    es eine aniSearch-Amazon-Adresse aber nur als Kaufweg — und Kaufwege werden
    weiter oben aussortiert, sobald die Seite tot oder hier gesperrt ist. Für
    „The Ghost in the Shell" blieb dadurch die Suchadresse stehen, obwohl
    `amazon.de/dp/B0GZD5N2GP` seit dem aniSearch-Abruf im Haus lag; Daniel
    schickte genau diese Kennung von Hand („führt beim klick auf ‚bei prime
    ansehen' auf die suchseite statt hierhin").

    Der zweite Bestand ist deshalb `data/anisearch.json` selbst. Die Bedingung
    bleibt dieselbe und ist der ganze Punkt: **belegt** ein Prime-Video-Eintrag,
    Status 200. Hinter `/dp/` kann auch eine DVD liegen, und eine Disc als Stream
    auszugeben wäre schlimmer als eine Suche.
  */
  let ersetzt = 0
  for (const title of titles.values()) {
    const prime = title.streams.find((s) => s.platform === 'primevideo')
    if (!prime || !/amazon\.[a-z.]+\/s\?/.test(prime.url)) continue
    const belegt = (u: string | undefined): u is string => {
      if (!u) return false
      const b = linkBefunde[u]
      return b?.prime === true && b.status === 200
    }
    /**
     * **Die zweite Quelle für „diese Seite gibt es": Daniels eigene Notiz.**
     *
     * Der Riegel darüber verlangt einen Link-Befund mit Status 200. Den gibt es
     * für Amazon nur in Losen — der Prüflauf kommt nach rund 660 Abrufen in die
     * Abwehr und bucht danach `unklar` (623 Adressen am 07.09.2026). Deshalb
     * stand am 10.09.2026 für 33 Titel eine Amazon-**Suche** im Kalender,
     * obwohl aniSearch die Titelseite kennt und Daniel sie beim Prüfen selbst
     * offen hatte.
     *
     * Genau das ist der Beleg: Seine Notiz nennt die Kennung, auf der er
     * nachgesehen hat („Amazon-Seite B0F2GXP162 … Seitenadresse: B0DXS2THFS").
     * Steht **dieselbe** Kennung auch in aniSearchs Quellenliste, haben zwei
     * unabhängige Stellen dieselbe Seite genannt — ein Mensch mit der Seite vor
     * Augen schlägt einen HTTP-Statuscode.
     *
     * Gemessen: 19 der 33 tragen das. Die übrigen 14 bleiben bei der Suche —
     * entweder kennt aniSearch keine Kennung (7) oder die Notiz nennt eine
     * andere Seite als aniSearch (7), und dann entscheidet nichts.
     */
    const ausNotiz = (): string | undefined => {
      const notizen = (checksJePlattform.get(dubKey(title.id, 'primevideo')) ?? [])
        .map((c) => c.note ?? '')
        .join(' ')
      if (!notizen) return undefined
      for (const quelle of anisearch[title.id]?.streams ?? []) {
        const kennung = /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,})/i.exec(
          String(quelle.url ?? ''),
        )?.[1]
        if (kennung && notizen.includes(kennung)) return amazonTitelAdresse(kennung)
      }
      return undefined
    }
    const echt =
      (title.watchLinks ?? []).find((w) => belegt(w.url))?.url ??
      (anisearch[title.id]?.streams ?? [])
        .map((s) => s.url?.split('?')[0])
        .find((u) => belegt(u)) ??
      ausNotiz()
    /*
      **Auch hier keine Adresse, die die Linkprüfung als tot kennt** (18.09.2026,
      Mob Psycho 100 und Horimiya). `ausNotiz()` baut die Adresse aus der Kennung
      neu (`amazonTitelAdresse`) und fragt dabei nicht nach, ob sie noch lebt.
      Ein zweiter, per `verweise-von-hand.yaml` angelegter Verweis auf dieselbe
      — lebende — Kennung wurde danach als Dublette verworfen, und übrig blieb
      die hier neu eingesetzte tote Adresse. Dieselbe Stelle wie bei den
      Handbelegen und den Rohfolgen: Der Riegel gehört vor jede Zuweisung.
    */
    if (!echt || lautPruefungTot(echt)) continue
    /*
      **Und keine Adresse, die ein Handbeleg als nicht verfügbar führt** (21.09.2026).
      Golden Wind stand mit einer Prime-Suche im Bestand; der Belegfilter weiter oben lief
      über die Suchadresse und fand nichts. Erst hier wurde daraus B0CG7KDCTS — der Kopf
      der JoJo-Sammelseite, den ein Handbeleg am selben Morgen mit `available: false`
      ausgetragen hatte. `check:handbelege` brach den Bau ab (Lauf 35566086288), und
      gefunden hat es eine Instrumentierung, die jede Änderung an den Streams des Titels
      mitschrieb. Dritte Stelle dieser Art nach dem 26.08. und dem 17.09.2026: Jede
      Zuweisung einer Adresse fragt den Beleg zu genau dieser Adresse.
    */
    const belegZurAdresse = belegFuer(title.id, 'primevideo', echt, 2)
    if (belegZurAdresse?.available === false || belegZurAdresse?.dub === false) continue
    prime.url = echt
    ersetzt++
  }
  if (ersetzt) log(`${ersetzt} Prime-Suchlinks durch die echte Produktseite ersetzt`)

  /**
   * Was auf Crunchyrolls Serienseiten steht — als Beleg, nicht als Vorbild.
   *
   * Der Scraper liest dort je Folge, ob eine deutsche Tonspur vorliegt.
   * Übernommen wird ausschließlich diese Auskunft; Crunchyrolls
   * Staffeleinteilung bleibt draußen. Sie enthält Folgendoppelungen, mehrfache
   * Wähler-Einträge zur selben Staffel und Blöcke, die zwei unserer Staffeln
   * zusammenfassen (Daniel, 12.08.2026). Unsere Einteilung kommt von AniList
   * und bleibt maßgeblich.
   *
   * Handgeprüftes schlägt auch das: Der Block läuft **vor** dem Einlesen von
   * `dub-confirmed.yaml`, damit ein Mensch das letzte Wort behält.
   */
  /*
    **Titel ohne Verweis, für die der deutsche Crunchyroll-Katalog Deutsch führt.**

    1.331 Titel im Bestand haben keinen einzigen Verweis. Für 101 nannte TMDB
    Crunchyroll als Anbieter; `tools/cr-vorschlaege-pruefen.mjs` hat sie am
    28.08.2026 einzeln in der Suche nachgeschlagen — von einer deutschen Leitung,
    weil Crunchyroll die Region aus der IP ableitet.

    Sieben davon führen `de-DE` in ihren Tonspuren. Das ist ein **Beleg**, keine
    Vermutung: Die Angabe steht am Werk selbst und kommt aus dem Katalog, den ein
    Besucher hier sieht.

    **Ein Handbeleg schlägt sie trotzdem.** Wer in `dub-confirmed.yaml` steht,
    wurde angesehen — auch wenn dort ein Nein steht. Das ist die Regel, an der
    am 25.08.2026 ein Lauf fünf geprüfte Neins überschrieben hat.
  */
  const crVorschlaege = readJson<
    Record<string, { gefunden?: boolean; seriesId?: string; crTitel?: string; deutsch?: boolean }>
  >('data/cr-vorschlaege.json', {})
  let crErgaenzt = 0
  for (const [id, v] of Object.entries(crVorschlaege)) {
    if (!v.deutsch || !v.seriesId) continue
    const title = titles.get(Number(id))
    if (!title) continue
    if (title.streams.some((x) => x.platform === 'crunchyroll')) continue
    /* Ein Handbeleg — auch ein verneinender — hat Vorrang. */
    if (checks.has(dubKey(Number(id), 'crunchyroll'))) continue
    title.streams.push({
      platform: 'crunchyroll',
      url: `https://www.crunchyroll.com/de/series/${v.seriesId}`,
      dub: true,
    })
    crErgaenzt++
  }
  if (crErgaenzt) log(`${crErgaenzt} Crunchyroll-Verweise aus der Suche ergänzt (deutscher Katalog nennt de-DE)`)

  const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  if (crDub.serien.length) {
    const nachUrl = new Map<string, Title[]>()
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'crunchyroll') continue
        const liste = nachUrl.get(stream.url) ?? []
        liste.push(title)
        nachUrl.set(stream.url, liste)
      }
    }
    let belegt = 0
    let verschwunden = 0
    let usNeinOffen = 0
    /**
     * Was entfernt wurde, und warum — der Datenbestand behält es.
     *
     * Daniel am 27.08.2026: „wenn du für tracking zwecke intern die links
     * weiterhin benötigst kannst du sie im datenbestand bestehen lassen und
     * entsprechend markieren. auf der webseite sichtbar für user sollten sie
     * jedenfalls nicht werden."
     *
     * `data/` ist der Bestand, `public/data/` die Auslieferung. Die Trennung
     * ist genau die gewünschte: Hier steht jeder entfernte Verweis mit Grund
     * und Prüfdatum, ausgeliefert wird er nicht.
     */
    /* Die Liste steht weiter oben auf Funktionsebene — auch spätere
       Entfernungen sollen hineinschreiben, nicht nur die dieses Blocks. */
    for (const serie of crDub.serien) {
      /**
       * „Leider sind die Videos dieser Serie nicht mehr verfügbar."
       *
       * Crunchyroll sagt es selbst — dann gibt es dort kein Angebot mehr, und
       * ein Verweis darauf führt Besucher ins Leere. Das ist `available: false`
       * und ausdrücklich **nicht** `dub: false`: Es fehlt das Angebot, nicht die
       * deutsche Fassung (Daniel, 21.08.2026, an „Dragon Ball" gezeigt).
       *
       * Der Verweis wird entfernt, so wie bei jeder anderen toten Adresse auch.
       * Kommt die Serie zurück, bringt der nächste Katalogabruf sie mit.
       */
      /**
       * **Kein Block im deutschen Katalog heißt: dort läuft nichts.**
       *
       * Bis zum 27.08.2026 galt nur Crunchyrolls ausdrückliches „Leider sind
       * die Videos dieser Serie nicht mehr verfügbar" als Nein. Daneben stand
       * ein zweiter Fall, der genauso endet und nichts auslöste: Die
       * Content-API antwortet mit HTTP 200 und **null Staffeln**.
       *
       * 287 unserer Verweise sind so. Der Grund, sie stehen zu lassen, war
       * Vorsicht: Der erste Beleg war lange Crunchyrolls Fehlerseite aus
       * **US**-Sicht, und `CLAUDE.md` verlangt deshalb einen zweiten. Der liegt
       * jetzt vor, und beide stammen aus Deutschland:
       *
       *  1. Die Content-API mit deutschem Token (`katalog: de`) findet unter
       *     der Serienkennung keine einzige Staffel.
       *  2. Die Suche im deutschen Katalog findet den Titel nicht — während
       *     dieselbe Suche „Detektiv Conan", „Fairy Tail", „Frieren" und
       *     „JUJUTSU KAISEN" auf Anhieb und exakt trifft.
       *
       * Dazu Daniels Augenschein vom 27.08.2026 an drei Stichproben aus seiner
       * angemeldeten deutschen Sitzung — Witch Hunter Robin, Trinity Blood,
       * Chrono Crusade: dreimal „Keine Videos verfügbar", mit Bild.
       *
       * Seine Ansage dazu: „auf unserem kalender sollen nur funktionierende
       * links angezeigt werden." Ein Verweis, der auf eine Fehlermeldung führt,
       * ist schlechter als kein Verweis — er kostet einen Klick und liefert
       * nichts.
       *
       * **Verloren geht dabei nichts.** Was entfernt wird, steht mit Grund und
       * Datum in `data/verweise-entfernt.json`; kommt die Serie zurück, bringt
       * der nächste Katalogabruf sie mit, denn der liest den Katalog, nicht
       * unseren Bestand.
       *
       * Zwei Bedingungen halten die Regel eng: Es braucht eine **Serienkennung**
       * (sonst wurde gar nicht richtig gefragt) und den **deutschen** Katalog
       * (`katalog: de`). Ein Befund aus dem US-Katalog entfernt weiterhin nichts
       * — das ist genau der Fehler, vor dem `CLAUDE.md` warnt.
       */
      const ohneBlock = Boolean(serie.seriesId) && serie.katalog === 'de' && !(serie.staffeln ?? []).length
      if (usNeinWiderlegt(serie)) {
        usNeinOffen++
        continue
      }
      if (serie.nichtVerfuegbar || ohneBlock) {
        for (const title of nachUrl.get(serie.url) ?? []) {
          const vorher = title.streams.length
          title.streams = title.streams.filter(
            (s) => !(s.platform === 'crunchyroll' && s.url === serie.url),
          )
          const weg = vorher - title.streams.length
          verschwunden += weg
          if (weg) {
            verweiseEntfernt.push({
              titleId: title.id,
              titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
              plattform: 'crunchyroll',
              url: serie.url,
              seriesId: serie.seriesId ?? null,
              grund: serie.nichtVerfuegbar
                ? 'Crunchyroll meldet: Videos dieser Serie nicht mehr verfügbar'
                : 'deutscher Katalog führt unter dieser Kennung keine einzige Staffel',
              geprueftAm: serie.geprueftAm ?? null,
              entferntAm: todayIso(),
              /* Bleibt der Titel danach ganz ohne Weg? Das gehoert ins Protokoll. */
              letzterWeg: title.streams.length === 0,
            })
          }
        }
        continue
      }
      for (const urteil of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        belegt++
      }
    }

    /*
      **Was Crunchyroll je Folge weiß, gehört an den Verweis.**

      Daniel am 12.09.2026 an „Das Band der Unterwelt": Im Panel stand „8 von 24
      Folgen auf Deutsch", während Crunchyroll 19 führte. Die 8 kam von Disney+,
      wo ein Handbeleg Folgen 1–8 nennt — und die Regel im Panel lautet zu
      Recht: Sobald **ein** Verweis Bereiche belegt, entscheiden nur noch diese.
      Der Crunchyroll-Verweis trug keine.

      Gemessen am selben Tag: Von 625 Crunchyroll-Verweisen mit `dub: true`
      trugen **625 minus einen** keine Bereiche, obwohl `crunchyroll-dub.json`
      23.404 deutsche Folgen mit Nummern führt. Das Wissen lag im Haus und kam
      nie an — dieselbe Klasse wie „Eine Datei zu schreiben ist nicht dasselbe
      wie sie zu benutzen" (CLAUDE.md).

      **Streng, wie bei den Terminen.** Übernommen wird nur, wo nichts zu raten
      ist: genau ein Titel an dieser Adresse, genau ein Block mit deutschen
      Folgen, und dessen Folgenzahl passt zu unserer. Sonst entscheidet die
      Zuordnung über das Ergebnis, und eine falsche Bereichsangabe behauptet
      etwas über einzelne Folgen — schlimmer als gar keine.

      Ein Handbeleg wird nie überschrieben: Er ist gemessen, das hier ist
      abgeleitet.
    */
    let bereicheNeu = 0
    for (const serie of crDub.serien) {
      const unsere = nachUrl.get(serie.url) ?? []
      if (unsere.length !== 1) continue
      const title = unsere[0]!
      const stream = title.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
      if (!stream || stream.dub !== true || stream.dubRanges?.length) continue
      const bloecke = (serie.staffeln ?? []).filter((st) => (st.deutscheFolgen ?? []).length)
      if (bloecke.length !== 1) continue
      const nummern = [
        ...new Set(
          (bloecke[0]!.deutscheFolgen ?? [])
            .map((f) => Number(f.nummer))
            .filter((n) => Number.isFinite(n) && n >= 1),
        ),
      ].sort((a, b) => a - b)
      if (!nummern.length) continue
      /* Mehr deutsche Folgen als der Titel hat, heißt: Der Block ist nicht seiner. */
      if (title.episodes && nummern[nummern.length - 1]! > title.episodes) continue
      /* Neu beginnende Nummern: Die laufende Nummer entscheidet (Captain Tsubasa, 17.09.2026). */
      if (deutscheFolgenNachDemEnde(bloecke, title.episodes)) continue
      const bereiche: { from: number; to: number; dub: boolean }[] = []
      for (const n of nummern) {
        const letzter = bereiche[bereiche.length - 1]
        if (letzter && n === letzter.to + 1) letzter.to = n
        else bereiche.push({ from: n, to: n, dub: true })
      }
      /* „Alle Folgen deutsch" sagt der Kasten ohnehin — ein Bereich über alles ist Ballast. */
      if (bereiche.length === 1 && bereiche[0]!.from === 1 && bereiche[0]!.to === (title.episodes ?? 0)) continue
      stream.dubRanges = bereiche
      bereicheNeu++
    }
    if (bereicheNeu) log(`${bereicheNeu} Crunchyroll-Verweise mit Folgenbereichen aus dem Dub-Bestand`)

    /**
     * Zweite Runde: über die **Serienkennung** statt über die Adresse.
     *
     * Dieselbe Crunchyroll-Serie steht bei uns unter mehreren Schreibweisen —
     * `http://…/golden-kamuy`, `https://…/golden-kamuy` und
     * `…/series/GY8DWQN5Y/golden-kamuy` sind für die Zuordnung drei verschiedene
     * Töpfe, obwohl `seriesId` dreimal `GY8DWQN5Y` lautet. Unsere fünf
     * Golden-Kamuy-Staffeln verteilen sich genau so und kommen über die Adresse
     * nie zusammen.
     *
     * Erst zusammen ergeben sie die Summe, die `beurteileNachFolgennummern`
     * braucht: 12+12+12+13+13 = 62, und genau bis 62 zählt Crunchyroll dort
     * seine deutschen Folgen (Daniels Vorschlag vom 23.08.2026, die Zuordnung
     * episodenspezifisch statt über Blockgrößen zu machen).
     *
     * Diese Runde läuft **nach** der ersten und respektiert deren Ergebnis:
     * Was schon ein Urteil hat, wird nicht angefasst.
     */
    const nachSerienId = new Map<string, { serie: (typeof crDub.serien)[number]; titel: Map<number, Title> }>()
    for (const serie of crDub.serien) {
      if (!serie.seriesId || serie.nichtVerfuegbar) continue
      const eintrag = nachSerienId.get(serie.seriesId) ?? { serie, titel: new Map<number, Title>() }
      // Der Eintrag mit den meisten Folgendaten gewinnt — Adressen derselben
      // Serie tragen unterschiedlich viel, je nachdem wann sie geholt wurden.
      const bisher = (eintrag.serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
      const jetzt = (serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
      if (jetzt > bisher) eintrag.serie = serie
      for (const t of nachUrl.get(serie.url) ?? []) eintrag.titel.set(t.id, t)
      nachSerienId.set(serie.seriesId, eintrag)
    }
    let ueberNummern = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      for (const urteil of beurteileNachFolgennummern(serie, [...gruppe.values()])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        ueberNummern++
      }
    }
    if (ueberNummern) log(`${ueberNummern} weitere über die durchgezählten Folgennummern belegt`)

    /**
     * Dritte Runde: **je Titel der passende Block**, wo die Gesamtrechnung
     * scheitert.
     *
     * Die beiden Runden davor verlangen, dass unsere Einträge die Blöcke einer
     * Serie vollständig decken. Das ist bei `dub: false` richtig und bei
     * `dub: true` zu streng: Gemessen am 26.08.2026 lag für 60 Titel die
     * deutsche Fassung in den Daten und bekam trotzdem kein Urteil, weil
     * irgendein Nachbarblock nicht aufging — „One-Punch Man" an einem
     * Ein-Folgen-Block, „PSYCHO-PASS 2" an einer gleich langen Extended Edition,
     * „Durarara!!" an 24 gegen 25 Folgen.
     *
     * Diese Runde setzt ausschließlich `true` und nur bei Namensgleichheit.
     * 23 Titel bekommen dadurch ein Urteil, das die Daten längst hergaben.
     */
    let jeBlock = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      const offene = [...gruppe.values()].filter((t) =>
        t.streams.some((s) => s.platform === 'crunchyroll' && s.dub === undefined),
      )
      if (!offene.length) continue
      for (const urteil of beurteileJeBlock(serie, offene)) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        jeBlock++
      }
    }
    if (jeBlock) log(`${jeBlock} weitere über den Blocknamen belegt`)

    /*
      **Vierte Runde: ein Block deckt mehrere unserer Staffeln.**

      Crunchyroll bündelt, wo wir trennen: „Dr. STONE Season 3" führt 22
      deutsche Folgen, bei uns sind das „New World" (11) und „New World Cour 2"
      (11). Für `beurteileNachFolgennummern` ist das nichts, weil dort jeder
      Block bei 1 zu zählen beginnt; für `beurteileJeBlock` auch nicht, weil
      der Name nicht passt.

      `beurteileBlockketten` legt die Blöcke der Reihe nach auf unsere nach
      Jahr sortierten Einträge und verlangt, dass die Summen **exakt** aufgehen.
      Gemessen am 29.08.2026 an fünfzehn offenen TV-Verweisen.
    */
    let ketten = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      const offene = [...gruppe.values()].filter((t) =>
        t.streams.some((s) => s.platform === 'crunchyroll' && s.dub === undefined),
      )
      if (!offene.length) continue
      /* Die Kette rechnet über **alle** Einträge der Adresse, nicht nur die offenen. */
      for (const urteil of beurteileBlockketten(serie, [...gruppe.values()])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        ketten++
      }
    }
    if (ketten) log(`${ketten} weitere über Blockketten belegt (ein Block deckt mehrere Staffeln)`)

    /*
      **Fünfte Runde: ein Block, den ein Titel und sein zweiter Teil zusammen füllen.**

      Die Kette oben bricht ab, sobald **ein** Block der Adresse unvollständig deutsch ist —
      bei Sword Art Online ist das „Alicization" (25 Folgen, 24 deutsch), und deshalb blieb
      „War of Underworld – Teil 2" ohne Urteil, obwohl sein Block restlos deutsch ist.
      `beurteileTeilblock` sieht jeden Block für sich an und verlangt Blocknamen, Teil-Namen
      und exakte Summe zugleich; gemessen am 23.09.2026: acht Treffer, sieben davon
      Bestätigungen vorhandener Urteile, kein Widerspruch.
    */
    let teilbloecke = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      const offene = [...gruppe.values()].filter((t) =>
        t.streams.some((s) => s.platform === 'crunchyroll' && s.dub === undefined),
      )
      if (!offene.length) continue
      /* Gerechnet wird über **alle** Einträge der Adresse — der erste Teil hat oft schon ein Urteil. */
      for (const urteil of beurteileTeilblock(serie, [...gruppe.values()])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        teilbloecke++
      }
    }
    if (teilbloecke) log(`${teilbloecke} weitere über Teilblöcke belegt (Titel plus zweiter Teil füllen einen Block)`)

    /**
     * **Ein deutscher Block, den keiner unserer Titel führt — das Special.**
     *
     * Der teuerste Fall dieser Woche (Daniel, 12.09.2026): „Lord of Mysteries"
     * führt bei Crunchyroll vier Blöcke. Unser Datensatz kannte nur den ersten,
     * denn die drei anderen sind bei AniList **eigene Einträge** — Specials,
     * Chibi-Kurzfilme, der nächste Arc. Am 10.09.2026 erschienen die drei
     * Specials auf Deutsch; auf der Seite stand davon nichts, und zwar nicht
     * wegen eines fehlenden Abrufs: `beurteile()` fragt nur Titel, die diese
     * Adresse schon **tragen**. Ein Titel ohne Verweis wird nie beurteilt, und
     * ohne Urteil bekommt er keinen Verweis — eine Warteschlange, die ihre
     * eigene Lücke bewacht (dieselbe Klasse wie in `CLAUDE.md`, „Eine
     * Warteschlange, die sich aus dem Bestand bildet").
     *
     * Diese Runde schließt sie, und zwar eng:
     *
     * - Der Block muss **vollständig deutsch** sein (`deutsch === folgen`).
     * - Keiner der Titel dieser Adresse darf dieselbe Folgenzahl haben — sonst
     *   gehört der Block ihm, nicht einem Geschwister.
     * - Unter den Geschwistern derselben Reihe darf es **genau einen** Titel
     *   mit dieser Folgenzahl geben, und der darf noch keinen
     *   Crunchyroll-Verweis tragen.
     *
     * Bleibt es mehrdeutig, passiert nichts: Eine falsche Zuordnung behauptet
     * eine Sprachfassung über den falschen Titel, und das ist schlimmer als
     * eine Lücke, die eine Zeile im Log nennt.
     */
    let geschwisterBloecke = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      if (serie.katalog !== 'de' || !serie.deutschImAngebot || serie.nichtVerfuegbar) continue
      const unsere = [...gruppe.values()]
      if (!unsere.length) continue
      const reihe = unsere[0]!.franchiseId ?? unsere[0]!.id
      const belegteZahlen = new Set(unsere.map((t) => t.episodes).filter(Boolean))
      for (const block of serie.staffeln ?? []) {
        const zahl = block.folgen ?? 0
        if (!zahl || block.deutsch !== zahl) continue
        if (belegteZahlen.has(zahl)) continue
        /* Geschwister aus dem Bestand **und** aus dem Katalog — das Special steht meist dort. */
        const ausBestand = [...titles.values()].filter(
          (t) => (t.franchiseId ?? t.id) === reihe && t.id !== reihe && t.episodes === zahl,
        )
        const ausKatalog = katalogEintraege.filter(
          (e) =>
            e.folgen === zahl &&
            !titles.has(e.id) &&
            (e.eltern ?? []).some((x) => unsere.some((t) => t.id === x)),
        )
        const treffer = [...ausBestand.map((t) => t.id), ...ausKatalog.map((e) => e.id)]
        if (treffer.length !== 1) continue
        const id = treffer[0]!
        let ziel = titles.get(id)
        if (!ziel) {
          const e = katalogEintraege.find((x) => x.id === id)!
          const anzeige = e.t[1] ?? e.latein ?? e.t[0] ?? String(e.id)
          ziel = {
            id: e.id,
            slug: `${slugify(anzeige)}-${e.id}`,
            keywords: [],
            dubConfidence: 'low' as const,
            titleRomaji: e.t[0] ?? undefined,
            titleEn: e.t[1] ?? e.latein ?? undefined,
            titleNative: e.t[2] ?? undefined,
            format: e.format ?? undefined,
            jpYear: e.jahr ?? undefined,
            episodes: e.folgen ?? undefined,
            genres: e.genres?.length ? [...e.genres] : [],
            coverImage: e.cover ? `https://s4.anilist.co/file/anilistcdn/media/anime/cover/${e.cover}` : undefined,
            streams: [],
            franchiseId: reihe,
          }
          titles.set(e.id, ziel)
        }
        if (ziel.streams.some((x) => x.platform === 'crunchyroll')) continue
        ziel.streams.push({ platform: 'crunchyroll', url: serie.url, dub: true })
        geschwisterBloecke++
        log(
          `  Crunchyroll-Block „${block.name}" (${zahl} Folgen, deutsch) dem Titel ${ziel.id} ` +
            `(${ziel.titleDe ?? ziel.titleEn ?? ziel.titleRomaji}) zugeordnet`,
        )
      }
    }
    if (geschwisterBloecke)
      log(`${geschwisterBloecke} deutsche Blöcke einem Geschwistertitel zugeordnet, der bisher keinen Weg hatte`)


    /**
     * **Fünfte Runde: Filme und Specials, die der Katalog einzeln führt.**
     *
     * Die Suche nach Serienkennungen läuft mit `type=series` — Filme findet sie
     * nie. Am 29.08.2026 hatten 26 der 56 offenen Verweise deshalb keine
     * Kennung, davon 18 Filme. `data:cr-einzelwerke` sucht ohne Typ-Filter und
     * findet sie als `movie_listing`, mit ihren Tonspuren.
     *
     * **Der Beleggrad ist derselbe wie bei einer Serie:** Der deutsche Katalog
     * nennt für diesen Titel `de-DE`. Der Namensvergleich ist exakt (nach
     * Kleinschreibung ohne Sonderzeichen) — ein Film hat keinen zweiten
     * Prüfstein, keine Folgenzahl und keine Staffelstruktur, deshalb wird hier
     * nichts geraten.
     *
     * **Nur Ja, kein Nein.** Findet der Katalog den Film nicht, heißt das „hier
     * nicht geführt" — und daraus wird kein `dub: false` (CLAUDE.md).
     */
    let einzeln = 0
    for (const eintrag of readJson<
      { id: number; treffer?: { audio?: string[] } | null }[]
    >('data/cr-einzelwerke.json', [])) {
      if (!eintrag.treffer?.audio?.includes('de-DE')) continue
      const title = titles.get(eintrag.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      einzeln++
    }
    if (einzeln) log(`${einzeln} Filme/Specials über den deutschen Katalog belegt (Einzelwerk-Suche)`)

    /**
     * **Sechste Runde: der Film hat einen eigenen Block in einer Filmreihe.**
     *
     * Crunchyroll führt Filmreihen als eigene Serie — „Fairy Tail Movies" mit
     * je einem Block pro Film, jeder mit eigener Sprachangabe. Unser Eintrag
     * „Fairy Tail: The Movie - Phoenix Priestess" findet dort seinen Block; die
     * Serie „Fairy Tail" mit ihren 175 deutschen Folgen sagt über ihn nichts.
     *
     * Verglichen wird das **Kennwort** — „Phoenix Priestess" —, nicht der ganze
     * Name: Reihenname und Nummerierung schreibt jede Seite anders.
     *
     * Auch hier nur Ja: Wird kein Block gefunden, heißt das „nicht gefunden".
     */
    let filmbloecke = 0
    for (const eintrag of readJson<{ id: number; treffer?: { audio?: string[] } | null }[]>(
      'data/cr-filmbloecke.json',
      [],
    )) {
      if (!eintrag.treffer?.audio?.includes('de-DE')) continue
      const title = titles.get(eintrag.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      filmbloecke++
    }
    if (filmbloecke) log(`${filmbloecke} Filme/Specials über ihren eigenen Block in einer Filmreihe belegt`)

    /**
     * **Ein Kapitel ist eine Folge im Block der Filmreihe.**
     *
     * Crunchyroll führt „Princess Principal: Crown Handler" als **einen** Block
     * mit vier Folgen („Crown Handler I" bis „IV"), unser Bestand vier Filme
     * „… - Chapter 1" bis „4". Deutsch sind nur I und II (17.09.2026, deutscher
     * Katalog, je Folge). Zugeordnet wird, wenn der Name ohne „Chapter N" genau
     * einen Block derselben Adresse benennt und N in dessen Folgenzahl liegt.
     * Gemessen über den Bestand: genau diese vier Filme, das Kurz-OVA „Chapter
     * 1: BUSY EASY MONEY" fällt zu Recht heraus. Nur aus dem deutschen Katalog
     * wird daraus ein Nein.
     */
    {
      let kapitel = 0
      const crNachAdresse = new Map(crDub.serien.map((s) => [s.url, s]))
      for (const title of titles.values()) {
        for (const stream of title.streams) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const serie = crNachAdresse.get(stream.url)
          const urteil = serie ? kapitelImBlock(serie, title) : undefined
          if (urteil === undefined) continue
          stream.dub = urteil
          kapitel++
        }
      }
      if (kapitel) log(`${kapitel} Kapitel einer Filmreihe über ihre Folge im Block beurteilt`)
    }

    /**
     * **Siebte Runde: der Abgleich gegen den vollständigen deutschen Katalog.**
     *
     * `discover/browse` gibt ihn ganz heraus — 1.591 Einträge in 16 Abrufen.
     * Danach braucht es keine Suchanfrage mehr, und Titel, die dort völlig
     * anders heißen, finden trotzdem ihren Eintrag: „Fruits Basket: Prelude"
     * steht im Katalog als **„-prelude-"**.
     *
     * **Der Filter ist streng, und das ist der Kern.** Ein Namensteil trifft
     * immer den Reihennamen; ein erster Versuch ordnete 16 von 30 zu, davon die
     * Mehrzahl falsch („One Punch Man OVAs" → „One-Punch Man"). Verlangt wird
     * deshalb ein zweites, **zählbares** Merkmal: die Folgenzahl, bei einem Film
     * 0 oder 1. Übrig bleibt einer — und der ist richtig.
     */
    let ausKatalog = 0
    for (const z of readJson<{ id: number; audio?: string[] }[]>('data/cr-katalog-zuordnung.json', [])) {
      if (!z.audio?.includes('de-DE')) continue
      const title = titles.get(z.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      ausKatalog++
    }
    if (ausKatalog) log(`${ausKatalog} über den vollständigen deutschen Katalog belegt`)

    /**
     * **Achte Runde: die Serienkennung aus der Adresse gegen den Katalog.**
     *
     * Die Runde darüber gleicht **Namen** ab und ist deshalb streng gefiltert —
     * ein Namensteil trifft immer den Reihennamen. Wo der Verweis aber selbst
     * eine Serienkennung trägt (`crunchyroll.com/de/series/GXXXXXXXX/…`),
     * braucht es keinen Namensabgleich: Die Kennung steht in beiden Beständen,
     * und `data/cr-katalog-de.json` nennt zu ihr die Tonspuren.
     *
     * Das ist derselbe Unterschied, der die RTL+-Umstellung am 07.09.2026
     * tragfähig gemacht hat: **Zeichenkette gegen Zeichenkette statt Name gegen
     * Name.** An den Fällen, an denen dieses Projekt gescheitert ist
     * (`To Love-Ru`, `Wolf's Rain OVA`, die 16 Katalogzuordnungen vom
     * 29.08.2026), war der Name jedes Mal das einzige Merkmal.
     *
     * **Der Katalog ist der deutsche** — er entsteht mit einem anonymen Token,
     * dessen Region die der abrufenden IP ist, und läuft deshalb von Daniels
     * Rechner (siehe `refresh-weekly.yml`). Damit gilt hier die Regel aus
     * `CLAUDE.md`: Aus **diesem** Katalog ist auch ein fehlendes `de-DE` ein
     * Beleg — anders als aus dem US-Katalog, wo es gar nichts heißt.
     *
     * **Eine Serie ohne Folgen wird übersprungen.** `folgen: 0` steht im
     * Katalog für Einträge ohne abrufbare Folgen; über deren Tonspuren sagt die
     * Liste nichts Belastbares.
     *
     * Gemessen am 07.09.2026: vier der 52 offenen Crunchyroll-Verweise tragen
     * eine Kennung, die der Katalog führt — drei mit `de-DE`, einer ohne.
     */
    let ausKennung = 0
    {
      const katalog = readJson<{
        geholtAm?: string
        eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
      }>('data/cr-katalog-de.json', {})
      const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
      /**
       * **Die Kennung steht nicht immer in der Adresse — dann steht sie im Gedächtnis.**
       *
       * Crunchyrolls alte Slug-Form (`/de/<name>`) trägt keine Serienkennung,
       * und diese Runde stieg dort bisher aus. Gemessen am 07.09.2026: **43
       * der 44 offenen Crunchyroll-Verweise** haben genau diese Form.
       *
       * `data/crunchyroll-series-ids.json` löst sie längst auf — jede der 396
       * betroffenen Adressen steht dort, mit Kennung und Prüfdatum. Gelesen hat
       * die Datei nur `scrape-crunchyroll-dub.ts`, also der Abruf, der sie
       * schreibt. Wieder der Fall aus `CLAUDE.md`: „Eine Datei zu schreiben ist
       * nicht dasselbe wie sie zu benutzen."
       *
       * Der Gewinn ist heute klein — drei Verweise, alle mit belegtem Nein —
       * und wächst mit jeder Serie, die der Katalog künftig führt. Die übrigen
       * 29 hängen am Franchise-Problem: Ihre Kennung nennt mehrere Blöcke, und
       * welcher unsere Staffel ist, sagt die Serienebene nicht.
       */
      const kennungsGedaechtnis = readJson<{ adressen?: Record<string, { seriesId?: string }> }>(
        'data/crunchyroll-series-ids.json',
        {},
      ).adressen
      const kernVon = (u: string): string =>
        u
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('?')[0]!
          .replace(/\/$/, '')
          .toLowerCase()
      const kennungJeAdresse = new Map(
        Object.entries(kennungsGedaechtnis ?? {})
          .filter(([, v]) => v.seriesId)
          .map(([u, v]) => [kernVon(u), v.seriesId as string]),
      )
      /*
        Eine Staffel im Katalog kann trotzdem zwei Werke tragen: Captain Tsubasa
        2018 und „Junior Youth" liegen unter `GZJH3D7G9` in einem Block, deutsch
        sind nur die laufenden Nummern 53–91 (17.09.2026). Die laufende Nummer
        aus dem Prüflauf sperrt das Ja. Gemessen über 106 Kandidaten dieser
        Runde: genau dieser eine Fall. Die breitere Regel „Katalog hat mehr
        Folgen als der Titel" träfe 24, fast alle zu Recht deutsch (geteilte
        Cours wie 86 oder Dead Mount Death Play).
      */
      const crBloeckeJeKennung = new Map(
        crDub.serien.filter((s) => s.seriesId).map((s) => [s.seriesId as string, s.staffeln ?? []]),
      )
      const hinterDemEnde = (kennung: string, title: Title): boolean =>
        deutscheFolgenNachDemEnde(crBloeckeJeKennung.get(kennung) ?? [], title.episodes)
      if (nachKennung.size) {
        for (const title of titles.values()) {
          for (const stream of title.streams) {
            if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
            const kennung =
              /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1] ?? kennungJeAdresse.get(kernVon(stream.url))
            if (!kennung) continue
            const eintrag = nachKennung.get(kennung)
            if (!eintrag || !eintrag.folgen) continue
            if (hinterDemEnde(kennung, title)) continue
            /*
              **Nur wo die Serie genau ein Werk ist.**

              Der Katalog antwortet auf **Serienebene**, und eine Serienkennung
              bei Crunchyroll ist ein Franchise: `GRDQV2VWY` heißt „Free! -
              Iwatobi Swim Club" und führt **neun** Staffeln mit 51 Folgen. Ein
              `de-DE` dort sagt nichts über „Free! Take Your Marks", einen Film
              — genau dieses falsche Ja hätte die erste Fassung dieser Runde am
              07.09.2026 gesetzt.

              Widerlegt hat es Bofuri: Der Katalog meldet `de-DE` für die Serie,
              der Prüflauf fand **12 deutsche Folgen in Staffel 1 und null in
              Staffel 2** — und unser Titel ist Staffel 2. Dieselbe Lehre steht
              seit dem 25.08.2026 in `CLAUDE.md` („Eine Serie ist bei
              Crunchyroll kein Block"); sie beim Bauen nicht angewandt zu haben,
              war der Fehler.

              **Bei genau einer Staffel fallen Serie und Werk zusammen**, und
              dann trägt die Angabe. 321 der 1.589 Katalogeinträge (20 %) tun
              das nicht — für sie bleibt der Verweis offen, bis der Prüflauf je
              Folge antwortet.
            */
            if ((eintrag.staffeln ?? 0) !== 1) continue
            stream.dub = (eintrag.audio ?? []).includes('de-DE')
            ausKennung++
          }
        }
        /**
         * **Der jüngere Katalog überstimmt ein älteres Nein.**
         *
         * Das ist Daniels eigentliche Kill-Blue-Meldung vom 07.09.2026: „im
         * anime-kalender hat dieser eintrag gar keine crunchy-pill, also
         * behaupten wir es wäre nicht synchronisiert auf crunchy."
         *
         * Die Runde darüber fasst nur unbeurteilte Verweise an, und der von
         * Kill Blue war beurteilt — mit einem **16 Tage alten** Befund:
         *
         * | Quelle | Stand | Aussage |
         * |---|---|---|
         * | `crunchyroll-dub.json`, Serie `GT00371896` | **22.08.2026** | `deutschImAngebot: true`, Staffel 1 mit **0** deutschen Folgen |
         * | `cr-katalog-de.json`, derselbe Eintrag | **07.09.2026, 06:44** | `audio` enthält **`de-DE`** |
         *
         * Der ältere Befund gewann, der Verweis flog mit „belegtes Nein" heraus
         * — und der Kalender behauptete das Gegenteil der Wirklichkeit. Am
         * 06.09. sind dort die Folgen 1–8 auf Deutsch erschienen.
         *
         * Damit ist es derselbe Fehler wie beim Gedächtnis der entfernten
         * Verweise (Frist von 28 Tagen, weiter unten): **Ein Nein ist eine
         * Aussage über einen Tag, nicht über alle Zeit.** Nur steht hier eine
         * jüngere Messung daneben, die es widerlegt — es braucht also gar keine
         * Frist, sondern nur den Blick auf das Datum.
         *
         * **Nur in diese Richtung.** Ein `de-DE` im Katalog hebt ein Nein auf;
         * ein fehlendes `de-DE` hebt umgekehrt **kein** Ja auf. Der Katalog
         * antwortet auf Serienebene, und die Trennung „Serie ist kein Block"
         * gilt unverändert — deshalb weiterhin nur bei genau einer Staffel.
         */
        const dubStand = crDub.scrapedAt?.slice(0, 10) ?? ''
        const katalogStand = (katalog.geholtAm ?? '').slice(0, 10)
        let ausKatalogNeuer = 0
        const geprueftJe = new Map(
          crDub.serien.filter((s) => s.seriesId).map((s) => [s.seriesId as string, s.geprueftAm ?? dubStand]),
        )
        for (const title of titles.values()) {
          for (const stream of title.streams) {
            if (stream.platform !== 'crunchyroll' || stream.dub !== false) continue
            const kennung = /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1]
            if (!kennung) continue
            const eintrag = nachKennung.get(kennung)
            if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
            if (!(eintrag.audio ?? []).includes('de-DE')) continue
            if (hinterDemEnde(kennung, title)) continue
            /* Nur wenn der Katalog wirklich jünger ist als die Messung, die das Nein trug. */
            if (katalogStand <= (geprueftJe.get(kennung) ?? '')) continue
            stream.dub = true
            ausKatalogNeuer++
            log(
              `  ${title.titleDe ?? title.id}: Nein vom ${geprueftJe.get(kennung)} durch den Katalog vom ${katalogStand} überholt`,
            )
          }
        }
        if (ausKatalogNeuer)
          log(`${ausKatalogNeuer} Nein(s) vom Katalog überholt: er ist jünger und führt de-DE`)
      }
      if (ausKennung) log(`${ausKennung} über die Serienkennung im deutschen Katalog belegt`)
    }

    /**
     * **Die Verweise, die alle Runden davor nicht beurteilen konnten.**
     *
     * Daniel am 07.09.2026: „39 Fragezeichen? wir haben crunchyroll
     * automatisiert, es sollte 0 fragezeichen geben." Gemessen am 09.09.2026
     * blieben 34 übrig, und keiner davon aus einem Fehler: 27 tragen eine
     * Adresse im alten Format ohne Serienkennung, der Rest sind Filme und OVAs,
     * die eine Serienrunde bauartbedingt nicht beurteilt.
     *
     * `pipeline/fetch-crunchyroll-offene.ts` geht sie einzeln an — Kennung aus
     * der Adresse auflösen, sonst die Serie im Katalog suchen und ihre
     * **Staffelliste** lesen. Hier wird nur angewandt, was dort belegt wurde.
     *
     * **Ein `tot` ist kein Sprachurteil.** Die Videokennung ist abgelaufen, die
     * Adresse führt ins Leere; der Verweis fliegt weiter unten über dieselbe
     * Regel wie jede andere tote Adresse. Ihn hier auf `dub: false` zu setzen
     * hieße, ein fehlendes Angebot als „ohne deutschen Ton" auszugeben — die
     * Unterscheidung, die `DubCheck.available` seit dem 12.08.2026 zieht.
     */
    {
      const offene = readJson<Record<string, { herkunft?: string; dub?: boolean; grund?: string }>>(
        'data/crunchyroll-offene.json',
        {},
      )
      let ausOffenen = 0
      let toteOffene = 0
      for (const title of titles.values()) {
        for (const stream of [...title.streams]) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const b = offene[stream.url]
          if (!b) continue
          /**
           * **Ein `tot` wurde gezählt und nie angewandt — 11 Verweise standen so
           * dauerhaft auf „🇩🇪 ?".**
           *
           * Der Kommentar darüber sagte, der Verweis fliege „weiter unten über
           * dieselbe Regel wie jede andere tote Adresse". Die Regel gibt es, nur
           * kennt sie diese Adressen nicht: Sie läuft über `crDub.serien`, also
           * über die Serien, die der wöchentliche Lauf geprüft hat. Was
           * `fetch-crunchyroll-offene.ts` als tot belegt, steht dort nicht.
           *
           * Gemessen am 10.09.2026: 28 Verweise ohne Sprachurteil im Datensatz,
           * 17 davon beim Lauf offen — und **11 als tot beurteilt**, ohne jede
           * Wirkung. Die Erklärung vom Vortag („das macht die aniSearch-Nachrunde
           * wieder auf") war falsch: Dem Lauf war keine einzige dieser Adressen
           * unbekannt.
           *
           * Entfernt wird, nicht auf `dub: false` gesetzt: Es fehlt das Angebot,
           * nicht die deutsche Fassung — dieselbe Unterscheidung wie bei
           * „Videos dieser Serie nicht mehr verfügbar".
           */
          if (b.herkunft === 'tot') {
            title.streams = title.streams.filter((s) => s !== stream)
            toteOffene++
            verweiseEntfernt.push({
              titleId: title.id,
              titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
              plattform: 'crunchyroll',
              url: stream.url,
              seriesId: null,
              grund: b.grund ?? 'Adresse führt ins Leere (fetch-crunchyroll-offene)',
              geprueftAm: null,
              entferntAm: todayIso(),
              letzterWeg: title.streams.length === 0,
            })
            continue
          }
          if (typeof b.dub !== 'boolean') continue
          stream.dub = b.dub
          ausOffenen++
        }
      }
      if (ausOffenen)
        log(`${ausOffenen} Crunchyroll-Verweise über Videokennung oder Staffelliste beurteilt`)
      if (toteOffene)
        log(`${toteOffene} Crunchyroll-Verweise entfernt: die Adresse führt ins Leere (abgelaufene Videokennung oder im deutschen Katalog nicht geführt)`)
    }

    /**
     * **Neunte Runde: der Katalog legt den Verweis an, nicht nur das Urteil.**
     *
     * Die Runde darüber beurteilt einen Verweis, der schon dasteht. Genau daran
     * ist am 07.09.2026 „Kill Blue" gescheitert, von Daniel gemeldet:
     *
     * - Am 24.08. hatte Crunchyroll dort **null** deutsche Folgen — der Verweis
     *   flog zu Recht heraus.
     * - Am **06.09.** erschienen die Folgen 1–8 auf Deutsch.
     * - Der Kalender zeigte weiter keinen Crunchyroll-Weg und behauptete damit
     *   das Gegenteil.
     *
     * **Kein einziger Lauf hätte es finden können**, und das ist der eigentliche
     * Befund:
     *
     * | Lauf | was er sieht |
     * |---|---|
     * | `crunchyroll` (stündlich) | den **Sendekalender** — dort steht Kill Blue nicht, denn eine nachgereichte Katalog-Synchro ist kein Simulcast-Termin |
     * | `crunchyroll-dub` (wöchentlich) | nur Serien, die **schon** einen Verweis haben |
     * | `cr-katalog` | den ganzen deutschen Katalog — läuft aber nicht automatisch, weil er eine deutsche IP braucht |
     *
     * Diese Runde schließt die Lücke: Der Katalog nennt zu jeder Serienkennung
     * ihre Tonspuren. Führt er `de-DE` und der Titel hat keinen
     * Crunchyroll-Weg, entsteht er hier — mit Urteil, denn dieselbe Antwort
     * belegt beides.
     *
     * **Die Zuordnung läuft über die aniSearch-Adresse**, nicht über den Namen.
     * Ein Namensabgleich gegen 1.589 Katalogeinträge ist genau der Fehler, der
     * am 29.08.2026 fünfzehn von sechzehn Zuordnungen falsch gemacht hat. Wo
     * aniSearch eine Crunchyroll-Adresse mit Kennung führt, ist die Zuordnung
     * dagegen eine Zeichenkette.
     *
     * **Und nur bei genau einer Staffel** — aus demselben Grund wie eine Runde
     * darüber: Eine Serienkennung ist ein Franchise.
     */
    let ausKatalogNeu = 0
    {
      const katalog = readJson<{
        eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
      }>('data/cr-katalog-de.json', {})
      const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
      if (nachKennung.size) {
        for (const title of titles.values()) {
          if (title.streams.some((s) => s.platform === 'crunchyroll')) continue
          const asCr = (anisearch[title.id]?.streams ?? []).find((q) => q.provider === 'crunchyroll')
          const kennung = /\/series\/([A-Z0-9]+)/.exec(asCr?.url ?? '')?.[1]
          if (!kennung) continue
          const eintrag = nachKennung.get(kennung)
          if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
          if (!(eintrag.audio ?? []).includes('de-DE')) continue
          const url = (asCr?.url ?? '').split('?')[0]!
          title.streams.push({ platform: 'crunchyroll', url, dub: true })
          ausKatalogNeu++
        }
      }
      if (ausKatalogNeu)
        log(`${ausKatalogNeu} Crunchyroll-Wege neu angelegt: der deutsche Katalog führt sie mit deutscher Tonspur`)
    }
    log(`${belegt} Synchro-Angaben aus den Crunchyroll-Serienseiten belegt (${crDub.serien.length} Seiten gelesen)`)
    if (verschwunden) log(`${verschwunden} Crunchyroll-Verweise entfernt — die Serie ist dort nicht mehr verfügbar`)
    if (usNeinOffen) log(`${usNeinOffen} Crunchyroll-Serien mit US-„nicht verfügbar" bleiben offen — der deutsche Katalog führt sie`)
    /*
      **Und aus denselben Daten kommen die Termine.**

      Bis zum 02.09.2026 endete der Crunchyroll-Abschnitt hier: Er beantwortete
      **ob** es eine deutsche Fassung gibt und warf weg, **wann** sie kam —
      obwohl beides in derselben Antwort steht. Der Kalender zeigte für „Die
      Tagebücher der Apothekerin“ deshalb nur eine Blu-ray im September 2026,
      für eine Serie, die seit dem 18.11.2023 vollständig deutsch läuft
      (Daniel, 02.09.2026: „CRUNCHY WIRD VON UNS GESCANNED!!! WIE Kann so
      unglaublich falsche info bei uns stehen???“). 21.689 datierte deutsche
      Folgen lagen ungenutzt im Repo.

      Die Ableitung steht in `lib/crunchyroll-termine.ts` und ist bewusst
      streng: Sie liefert nur, wo genau ein Titel an der Adresse hängt, genau
      ein Block datierte Folgen hat und dessen Folgenzahl exakt zur unseren
      passt. Was sie liegen lässt, lässt sie mit Absicht liegen.
    */
    const crTermine = alleTermine(crDub.serien, nachUrl)
    let termineNeu = 0
    let termineSchonDa = 0
    for (const t of crTermine) {
      const title = titles.get(t.titleId)
      if (!title) continue
      /*
        **Ein vorhandener Streaming-Termin gewinnt.** Was aus dem Kalender oder
        aus einem kuratierten Eintrag stammt, ist näher an der Quelle als eine
        Ableitung — und ein zweites Release derselben Plattform würde
        behaupten, es gäbe die Staffel zweimal.
      */
      const vorhanden = releases.filter((r) => r.titleId === t.titleId && r.platform === 'crunchyroll')
      if (vorhanden.length) {
        /*
          **Ein gemessener Wochentakt schlägt den Aufnahmetag** (Daniel, 20.09.2026, „Das Band
          der Unterwelt"): Die Serie kam als Katalogtitel herein — ein Eintrag vom 04.04.2026,
          `available-from`, alles an einem Tag. Ihre deutsche Fassung erscheint seitdem Folge
          für Folge; Folge 21 lief am 19.09., im Kalender stand nichts. Crunchyrolls
          Simulcast-Kalender kennt solche Titel nicht, die Folgendaten schon.

          Ersetzt wird nur der **Termin**, nicht der Eintrag: Der Slug bleibt, damit die
          Adresse nicht wandert (CLAUDE.md, „Ein Slug ist eine Adresse").
        */
        const sammel = vorhanden.find(
          (r) =>
            r.schedule?.firstEpisodeDate === r.schedule?.lastEpisodeDate &&
            (r.dateMeaning === 'available-from' || r.releaseType === 'batch'),
        )
        if (t.rhythmus !== 'weekly' || !sammel || vorhanden.length > 1) {
          termineSchonDa++
          continue
        }
        sammel.releaseType = 'weekly'
        sammel.dateMeaning = undefined
        sammel.schedule = {
          ...sammel.schedule,
          firstEpisodeDate: t.firstEpisodeDate,
          lastEpisodeDate: t.lastEpisodeDate,
          time: t.time ?? sammel.schedule?.time,
          episodeCount: t.episodeCount,
          observed: beobachtungenZusammenfuehren(t.beobachtet, sammel.schedule?.observed),
        }
        sammel.herkunft = `Deutsche Fassung bei Crunchyroll — ${t.datiert} Folgen mit belegtem Termin (Block „${t.blockName}"), Sammeldatum ersetzt`
        termineNeu++
        continue
      }
      const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? `Titel ${t.titleId}`
      const adresse = title.streams.find((x) => x.platform === 'crunchyroll')?.url
      releases.push({
        /*
          **Der Slug wird gebaut, nicht gekappt.** `slugify` schneidet bei 80
          Zeichen ab — bei „I Was Reincarnated as the 7th Prince…“ (84 Zeichen)
          fiel damit genau der unterscheidende Teil weg, das Datum, und beide
          Staffeln beanspruchten dieselbe Adresse. Der Bau brach ab: „Termin
          2025-07-30 (Folge 1) liegt nach dem belegten Ende 2024-07-16“ — zwei
          Staffeln in einem Eintrag.

          Denselben Fehler gab es am 30.08.2026 schon einmal bei den
          Disc-Terminen, und `discSlug()` ist die Antwort darauf: Der **Name**
          wird gekappt, das Datum danach angehängt.
        */
        slug: discSlug(`${name} crunchyroll de`, t.firstEpisodeDate),
        titleId: t.titleId,
        name,
        platform: 'crunchyroll',
        platformUrl: adresse,
        releaseType: t.rhythmus,
        schedule: {
          firstEpisodeDate: t.firstEpisodeDate,
          lastEpisodeDate: t.lastEpisodeDate,
          time: t.time,
          episodeCount: t.episodeCount,
          /* Die gemessenen Tage je Folge — sonst rechnet die Fortschreibung an Pausen vorbei. */
          ...(Object.keys(t.beobachtet).length ? { observed: t.beobachtet } : {}),
        },
        /*
          **„Im Angebot seit“, wenn alles an einem Tag kam.** Bei einem
          Katalogtitel nimmt Crunchyroll die ganze Staffel auf einmal auf; das
          Datum ist dann der Tag der Aufnahme, nicht der Erstausstrahlung —
          dieselbe Unterscheidung wie bei ADN.
        */
        dateMeaning: t.rhythmus === 'batch' ? 'available-from' : undefined,
        fsk: title.fsk,
        herkunft: `Deutsche Fassung bei Crunchyroll — ${t.datiert} Folgen mit belegtem Termin (Block „${t.blockName}“)`,
        year: Number(t.firstEpisodeDate.slice(0, 4)),
        sources: [adresse ?? 'https://www.crunchyroll.com/de'],
      })
      termineNeu++
    }
    /*
      **Was die Ableitung verworfen hat, wird sichtbar** (Daniel, 20.09.2026): Riegel, die
      eine Serie stumm durchfallen lassen, kosten Termine, die niemand vermisst — „Das Band
      der Unterwelt" fehlte ein halbes Jahr. Die Gründe stehen ab jetzt in einer Datei, die
      Zahl im Lauf (Skill `stille-ausfaelle-verhindern`).
    */
    if (termineAusgelassen.length) {
      const jeGrund = new Map<string, number>()
      for (const a of termineAusgelassen) jeGrund.set(a.grund, (jeGrund.get(a.grund) ?? 0) + 1)
      const vorher = readJson<{ jeGrund?: Record<string, number> }>('data/termine-ausgelassen.json', {})
      writeJson('data/termine-ausgelassen.json', {
        erzeugtAm: new Date().toISOString(),
        jeGrund: Object.fromEntries(jeGrund),
        faelle: termineAusgelassen.slice(0, 400),
      })
      /*
        **Ein Zuwachs geht in den Posteingang** (Daniel, 20.09.2026): eine Datei, die niemand
        öffnet, ist keine Meldung. `~/.claude/hooks/posteingang.js` liest
        `data/meldungen-an-claude.jsonl` und nennt neue Zeilen beim nächsten Prompt.
      */
      const gestiegen = [...jeGrund].filter(([g, n]) => n > (vorher.jeGrund?.[g] ?? 0))
      if (gestiegen.length && Object.keys(vorher.jeGrund ?? {}).length) {
        meldeAnClaude(
          'bestand-bauen',
          'warnung',
          `Terminableitung verwirft mehr: ${gestiegen
            .map(([g, n]) => `${g} ${vorher.jeGrund?.[g] ?? 0} → ${n}`)
            .join(', ')}`,
          'data/termine-ausgelassen.json',
        )
      }
      log(
        `Terminableitung übersprungen: ${termineAusgelassen.length} Serien — ` +
          [...jeGrund].map(([g, n]) => `${n}× ${g}`).join(', ') +
          ' (data/termine-ausgelassen.json)',
      )
    }
    if (termineNeu || termineSchonDa)
      log(
        `${termineNeu} deutsche Streaming-Termine aus den Crunchyroll-Folgendaten abgeleitet` +
          (termineSchonDa ? ` (${termineSchonDa} hatten schon einen)` : ''),
      )

    /* Vorhandene Wochentermine bekommen die Tage der Folgen, die das Kalenderfenster nicht sah — siehe `beobachtungenAusBlock()`. */
    const crNachKennung = new Map(crDub.serien.map((s) => [s.seriesId, s]))
    let folgenDatiert = 0
    for (const r of releases) {
      if (r.platform !== 'crunchyroll' || r.releaseType !== 'weekly' || !r.schedule.observed) continue
      const kennung = /series\/([A-Z0-9]+)/.exec(r.platformUrl ?? '')?.[1]
      const serie = kennung ? crNachKennung.get(kennung) : undefined
      if (!serie) continue
      const erste = r.schedule.firstEpisodeNumber ?? 1
      const letzte = erste + (r.schedule.episodeCount ?? 0) - 1
      const neu = Object.entries(beobachtungenAusBlock(serie, r.schedule.observed)).filter(
        ([n]) => Number(n) >= erste && Number(n) <= letzte,
      )
      for (const [n, datum] of neu) r.schedule.observed[Number(n)] = datum
      folgenDatiert += neu.length
    }
    if (folgenDatiert) log(`${folgenDatiert} Crunchyroll-Folgen mit ihrem deutschen Tag nachgetragen (vorher geschätzt)`)

    /* Geschrieben wird erst am Ende — nach der letzten Stelle, die entfernt. */
  }

  /**
   * **Seit wann gibt es das auf Deutsch? — die Antwort aus aniSearch.**
   *
   * Gemessen am 03.09.2026: 2.202 Titel im Bestand haben eine belegte deutsche
   * Synchro und keinen einzigen Termin. Der Kasten im Detail-Panel sagt dort
   * „Auf Deutsch verfügbar" und kann nicht sagen, seit wann — obwohl aniSearch
   * es für 1.985 von ihnen weiß, mit Datum und Verlag. „Cowboy Bebop,
   * 08.01.2003 – 02.04.2003, Dybex" liegt seit Wochen im Haus und wurde von
   * nichts gelesen.
   *
   * **Es wird ein Feld, kein Release.** Der erste Anlauf baute daraus 1.985
   * Kalendereinträge — und `titles-core.json`, die Datei, die jeder Besucher
   * beim Erstaufruf lädt, wuchs von 554 KB auf 2,7 MB. Ein DVD-Datum von 2003
   * ist kein Termin, den jemand im Kalender sucht; es beantwortet eine
   * Stammdatenfrage im Detail-Panel. Die Regeln der Übernahme stehen in
   * `lib/anisearch-termine.ts`, die Begründung des Feldes bei `deErstausgabe`
   * in `shared/types.ts`.
   */
  {
    const asRoh = readJson<Record<string, { info?: { languages?: unknown[] } }>>(
      'data/anisearch.json',
      {},
    )
    const schonMitTermin = new Set(releases.map((r) => r.titleId))
    let asNeu = 0
    let asVorJp = 0
    let asSimulcast = 0
    let asDiscDatum = 0
    const discFuerErstausgabe = readJson<Record<string, { datum: string }[]>>('data/disc-ausgaben.json', {})
    for (const title of titles.values()) {
      if (schonMitTermin.has(title.id)) continue
      const termin = terminAusEintrag(
        asRoh[String(title.id)]?.info as { languages?: never[] } | undefined,
      )
      if (!termin) continue
      /*
        **Eine deutsche Fassung gibt es nicht vor dem Original.** Sechs Einträge
        scheitern daran — meist eine Verwechslung mit einem Vorgänger im
        aniSearch-Datensatz. Sie wären in der Anzeige nicht als falsch zu
        erkennen, also bleiben sie draußen.
      */
      if (termin.start && title.jpYear && Number(termin.start.slice(0, 4)) < title.jpYear) {
        asVorJp++
        continue
      }
      /*
        **Ein Simulcast-Datum ist kein Synchro-Datum.** aniSearchs deutscher Block
        nennt die erste deutsche Veröffentlichung überhaupt, und das ist oft der
        OmU-Simulcast: „Dragon Quest: The Adventure of Dai" — 03.10.2020, Publisher
        Crunchyroll, Kazé Deutschland. Die Synchro gibt es nur auf Kazés Disc; im
        Panel stand „Auf Deutsch seit 03.10.2020 · Crunchyroll" (Daniel, 16.09.2026).
        Gemessen: 375 Titel mit deutschem Datum am japanischen Start und einem
        Streamingdienst als erstem Verlag, 119 davon ohne belegten Dub-Stream dort.
        Bei denen fallen Datum und Dienst weg; ein Disc-Verlag bleibt als Spur.
      */
      const asDe = (asRoh[String(title.id)]?.info?.languages as { language?: string; released?: string; publisher?: string[] }[] | undefined) ?? []
      const tagAus = (s?: string) => {
        const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s ?? '')
        return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : undefined
      }
      const deTag = tagAus(asDe.find((l) => l.language === 'Deutsch')?.released)
      const jpTag = tagAus(asDe.find((l) => l.language === 'Japanisch')?.released)
      const verlage = asDe.find((l) => l.language === 'Deutsch')?.publisher ?? []
      const simulcast =
        deTag !== undefined && jpTag !== undefined && Math.abs(deTag - jpTag) <= 7 * 864e5 &&
        verlage.length > 0 && verlagAlsDienst(verlage[0]!) !== undefined &&
        !(title.streams ?? []).some((s) => s.dub === true && s.platform === verlagAlsDienst(verlage[0]!))
      /*
        **Und ein Datum dicht am japanischen Start ist Simulcast, wenn die Discs erst später kamen.**
        „Undefeated Bahamut Chronicle": deutscher Block 20.01.–02.04.2016 (neun Tage nach dem
        japanischen Start, Verlag Nipponart), die deutschen Discs ab 30.06.2017 — Volume 1 bis 4,
        Gesamtausgabe 25.05.2020 (Daniel, 16.09.2026). Dann gilt das früheste Disc-Datum.
      */
      const fruehesteDisc = (discFuerErstausgabe[String(title.id)] ?? [])
        .map((a) => a.datum)
        .filter(Boolean)
        .sort()[0]
      /*
        Erst ab 2012 und nicht bei Filmen: Davor heißt ein deutsches Datum nah am japanischen
        Start eine echte Ausstrahlung mit Synchro — „Wickie" 1974, „Final Fantasy: Die Mächte
        in Dir" im Kino 2001. Gemessen danach: 548 Serien, Stichprobe durchweg OmU-Simulcasts
        (Kazé, peppermint, Crunchyroll) mit späteren deutschen Discs.
      */
      const nahAmStart =
        deTag !== undefined &&
        jpTag !== undefined &&
        deTag - jpTag <= 30 * 864e5 &&
        new Date(jpTag).getUTCFullYear() >= 2012 &&
        title.format !== 'MOVIE'
      const discDatumGilt =
        Boolean(fruehesteDisc) && (simulcast || nahAmStart) && (!termin.start || fruehesteDisc! > termin.start)
      if (discDatumGilt) {
        const disc = verlage.find((v) => verlagAlsDienst(v) === undefined)
        title.deErstausgabe = { von: fruehesteDisc!, ...(disc ? { publisher: disc } : {}), ...(termin.synchro ? { synchro: true } : {}) }
        asDiscDatum++
        asNeu++
        continue
      }
      if (simulcast) {
        const disc = verlage.find((v) => verlagAlsDienst(v) === undefined)
        asSimulcast++
        if (!disc) continue
        title.deErstausgabe = { publisher: disc, ...(termin.synchro ? { synchro: true } : {}) }
        asNeu++
        continue
      }
      title.deErstausgabe = {
        ...(termin.start ? { von: termin.start } : {}),
        ...(termin.zeitraum ? { zeitraum: termin.zeitraum } : {}),
        ...(termin.ende ? { bis: termin.ende } : {}),
        ...(termin.publisher ? { publisher: termin.publisher } : {}),
        ...(termin.synchro ? { synchro: true } : {}),
      }
      asNeu++
    }
    if (asNeu) {
      log(
        `${asNeu} deutsche Erstausgaben aus aniSearch übernommen ` +
          `(${asVorJp} vor der japanischen Ausstrahlung verworfen, ` +
          `${asSimulcast} Simulcast-Daten ohne Dub-Stream nicht als Synchro-Datum, ` +
          `${asDiscDatum} durch das früheste Disc-Datum ersetzt)`,
      )
    }
  }

  /*
    **Erste deutsche Ausstrahlung aus der Wikipedia-Episodenliste** (19.09.2026). Titel mit
    eigenem Termin bekommen von aniSearch kein Datum (siehe oben) — eine TV-Sichtung ist aber
    kein Starttermin. Dragon Ball, One Piece, Conan, Dragon Ball Super, Pokémon Horizonte und
    Daima standen deshalb ohne „Auf Deutsch seit". Die Liste nennt je Folge `EAD`; die früheste
    gilt, wenn der Titel noch keine Angabe hat.
  */
  {
    const wiki = readJson<{ titel?: Record<string, { folgen: { ead?: string }[] }> }>('data/wikipedia-folgen.json', {}).titel ?? {}
    let ausWiki = 0
    for (const [id, liste] of Object.entries(wiki)) {
      const title = titles.get(Number(id))
      const erste = liste.folgen.map((f) => f.ead).filter((d): d is string => Boolean(d)).sort()[0]
      if (!title || title.deErstausgabe || !erste) continue
      title.deErstausgabe = { von: erste, quelle: 'wikipedia' }
      ausWiki++
    }
    if (ausWiki) log(`${ausWiki} deutsche Erstausstrahlungen aus Wikipedia-Episodenlisten`)

    /* Von Hand, wo aniSearchs Datum nicht die Synchro meint (`data/erstausgabe-von-hand.yaml`). */
    const vonHand = (yaml.load(readFileSync(resolve(ROOT, 'data/erstausgabe-von-hand.yaml'), 'utf8')) ?? []) as {
      anilistId?: number
      von?: string
      publisher?: string
      sources?: string[]
    }[]
    for (const e of vonHand) {
      const title = e.anilistId ? titles.get(e.anilistId) : undefined
      if (!title || !e.von || !e.sources?.length) continue
      title.deErstausgabe = { von: e.von, ...(e.publisher ? { publisher: e.publisher } : {}), synchro: true }
    }
  }

  /**
   * Deutsche Tonspuren von der Streaming Availability API — nur Netflix.
   *
   * Diese Quelle nennt je Folge die `audios`, getrennt von den `subtitles`. Für
   * Netflix ist sie die einzige maschinenlesbare Auskunft überhaupt: 532
   * Verweise standen deshalb dauerhaft auf „🇩🇪 ?", und Netflix untersagt das
   * Auslesen seiner Seiten in der robots.txt.
   *
   * **Drei Regeln, jede aus einer Messung vom 21.08.2026** (Herleitung in
   * `lib/motn.ts`):
   *
   *  1. **Nie ein `false`.** Die Quelle hinkt mindestens zwei Tage hinterher —
   *     Folge 7 von „Thunderbolt Fantasy" war am 19.08. fällig, lag am 21.08.
   *     auf Netflix in deutscher Fassung, und die API kannte sie nicht. Ihr
   *     Schweigen ist kein Nein. Gesetzt wird ausschließlich `true`.
   *  2. **Nichts aus einem laufenden Release.** Bei einer laufenden Staffel
   *     entscheidet der Verzug darüber, was die Quelle zeigt; dort bleibt es
   *     beim Crunchyroll-Abruf und bei der Handarbeit. Die Zusicherung steht
   *     unten als `laeuft`, nicht als Kommentar.
   *  3. **Nur Netflix.** Für Crunchyroll widerspricht die Quelle sich selbst,
   *     für ADN ist der Sprachcode `vde` je Folge besser — beide liegen im
   *     Haus. Prime Video und Disney+ werden geholt und ausgewiesen, aber nicht
   *     übernommen, solange die Kontrollmessung sie nicht trägt.
   */
  const motn = readJson<MotnDaten>('data/motn.json', MOTN_LEER)
  const heuteMotn = todayIso()
  let motnBelege = 0
  if (Object.keys(motn.shows ?? {}).length) {
    /**
     * Läuft zu diesem Titel gerade etwas?
     *
     * Der Status wird nie gespeichert, sondern immer gegen heute gerechnet
     * (`shared/logic.ts`) — also auch hier, statt aus einem Feld gelesen.
     */
    const laeuft = new Set<number>()
    for (const release of releases) {
      if (releaseStatus(release, heuteMotn) === 'airing') laeuft.add(release.titleId)
    }

    const alle = [...titles.values()]
    const belege = ordneShowsZu(
      alle,
      motn.shows,
      (t) => (t.franchiseId ? staffelnDesFranchise(alle, t.franchiseId) : []),
      { passtZuSerie, bewerteTreffer, volltreffer },
      tmdbZuordnung(readJson('data/tmdb-titles.json', {}), motn.tmdb),
    )

    let ausgelassenLaufend = 0
    for (const beleg of belege) {
      if (beleg.deutsch && beleg.eindeutig && laeuft.has(beleg.titleId)) ausgelassenLaufend++
      if (!uebernehmbar(beleg, laeuft.has(beleg.titleId), heuteMotn)) continue
      const stream = titles.get(beleg.titleId)?.streams.find((s) => s.platform === beleg.platform)
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      motnBelege++
    }
    log(
      `${motnBelege} Synchro-Angaben über die Streaming Availability API belegt ` +
        `(${Object.keys(motn.shows).length} Serien im Bestand, ${ausgelassenLaufend} laufende ausgelassen)`,
    )
  }

  /**
   * Was ADN uns längst gesagt hat — nachgelesen im eigenen Archiv.
   *
   * ADN nennt je Folge die Sprachen (`vde` = deutsche Synchro, `vostde` =
   * Untertitel), und die Rohantworten liegen seit dem 11.08.2026 unter
   * `data/adn-raw/`. Ein `dub: true` entstand daraus bisher aber nur auf einem
   * Umweg: über einen **Release**. Wo kein Termin herauskam — Katalogtitel,
   * Filme, OVAs —, blieb der Verweis bei „🇩🇪 ?", obwohl die Auskunft im Haus lag
   * (am 21.08.2026 bei 63 von 161 ADN-Verweisen).
   *
   * Wie eng ausgewertet wird und warum das keine menschliche Prüfung ersetzt,
   * steht in `lib/adn-sprachen.ts`. Hier zählt nur die Reihenfolge: Der Block
   * läuft **nach** `dub-confirmed.yaml` und rührt nur an, was noch `undefined`
   * ist. Ein Beispiel dafür, warum das nicht anders geht, ist KILL BLUE — der
   * Verweis trägt `dub: true` aus einer Anime2You-Meldung über eine Synchro ab
   * dem 24.08.2026, während das Archiv vom 21.08. zu Recht zwölf Folgen ohne
   * `vde` führt. Beide Angaben stimmen; die jüngere gewinnt.
   */
  // `pflegen`: Der Bau ist der einzige Lauf, der das Gedächtnis fortschreiben
  // darf — die Checks lesen dieselbe Quelle und dürfen sie nicht verändern.
  /**
   * **Joyn ist ein deutscher Anbieter — dort läuft nichts auf Japanisch.**
   *
   * Daniel am 02.09.2026: „join titel immer als deutsch markieren. deutscher
   * anbieter, da ist immer alles deutsch." Der Kasten zeigte davor „🇩🇪 ?" mit
   * dem Vermerk „Der Anbieter macht dazu keine öffentliche Angabe" — richtig
   * über die Auskunftslage, falsch über die Sache.
   *
   * Das ist kein Raten: Joyn gehört zu ProSiebenSat.1 und führt sein Programm
   * für ein deutschsprachiges Publikum. Was dort im Katalog steht, ist
   * synchronisiert; ein OmU-Angebot gibt es nicht. Die Aussage stammt aus
   * derselben Quelle wie jede Zeile in `dub-confirmed.yaml` — von jemandem, der
   * nachgesehen hat.
   *
   * **Ein von Hand geprüfter Eintrag schlägt das trotzdem.** Die Bedingung
   * `dub === undefined` sorgt dafür: Wo jemand etwas anderes festgestellt hat,
   * bleibt es stehen.
   */
  {
    let joynJa = 0
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'joyn' || stream.dub !== undefined) continue
        stream.dub = true
        joynJa++
      }
    }
    if (joynJa) log(`${joynJa} Joyn-Verweis(e) als deutsch gesetzt — deutscher Anbieter`)
  }

  /**
   * **Alte ADN-Adressen bekommen ihre Serienkennung — vor der Auswertung.**
   *
   * `animationdigitalnetwork.de/video/<slug>` trägt keine Kennung, und der
   * Namensteil ist teils französisch (`50-nuances-de-gras` für „Plus-Sized
   * Elf"). `beurteileAdnVerweis` steigt dort aus, obwohl die Serie im Archiv
   * liegt: Gemessen am 06.09.2026 bekamen **48 von 135** ADN-Verweisen kein
   * Urteil aus dem Archiv, 33 davon allein aus diesem Grund. (Im Datensatz
   * sichtbar offen waren zwölf — der Rest trägt sein `dub` aus einer anderen
   * Quelle und wäre bei deren Ausfall genauso stumm.)
   *
   * Die Kennung wird nicht gesucht, sondern nachgeschlagen — zwei Quellen, und
   * keine davon rät:
   *
   * - **Der Katalog** trägt je Serie eine `anilistId`. Sie entsteht in
   *   `fetch-adn.ts` über `bewerteTreffer`/`passtZuSerie`, wird je Serie nur
   *   einmal vergeben und ist damit dieselbe Zuordnung, aus der die übrigen
   *   ADN-Adressen im Bestand stammen. 33 der 65 alten Adressen sind so
   *   aufgelöst.
   * - **`data/adn-adressen.yaml`** für Serien, die der Katalog gerade nicht
   *   führt — die Liste ist gemessen, nicht geschätzt.
   *
   * Wirkung im selben Lauf gemessen: 38 Adressen berichtigt, danach 31 belegte
   * Ja und 6 belegte Nein; genau ein Verweis bleibt offen, weil seine Serie
   * gemischt ist (Chained Soldier, 1 von 24 Folgen mit `vde`).
   *
   * **Umgeschrieben wird nur die Serienadresse.** Ein Folgenverweis behält
   * seine alte Form, siehe `adnAdresseMitKennung`.
   */
    /**
     * **Serien, die der Katalog gerade nicht führt.**
     *
     * `data/adn-adressen.yaml` hält je AniList-Kennung die ADN-Serienkennung
     * fest — gemessen über `gw.api.animationdigitalnetwork.com/show/<id>` mit
     * `X-Target-Distribution: de`, nicht über einen Seitenaufruf: Beide
     * ADN-Domains antworten jedem Skript mit 403, die alte wie die neue.
     */
    const adnAdressen: Record<number, number> = (() => {
      try {
        const roh = yaml.load(readFileSync(resolve(ROOT, 'data/adn-adressen.yaml'), 'utf8'))
        const raus: Record<number, number> = {}
        for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
          if (!Number.isFinite(Number(k)) || !Number.isFinite(Number(v))) continue
          raus[Number(k)] = Number(v)
        }
        return raus
      } catch {
        return {}
      }
    })()
    /**
   * **Titel ohne eigenes ADN-Release — die Staffel steht dann hier.**
   *
   * Die Staffel kommt sonst aus dem Release-Slug (`adn-461-s3-20231001`). Zu
   * manchen Titeln gibt es kein ADN-Release; ihr Verweis zeigt auf die nackte
   * Serienkennung und bekommt den Befund „gemischt" — richtig und unbrauchbar.
   *
   * `data/adn-staffelzuordnung.yaml` hält je AniList-Kennung die ADN-Staffel
   * fest, belegt über die **Folgenzahl** und nur dort, wo sie eindeutig ist.
   * Gemessen am 07.09.2026 an JoJo (Serie 444): Staffel 1 hat 26 Folgen,
   * Staffel 2 achtundvierzig, Staffel 3 und 4 je 39 — die ersten drei unserer
   * fünf Titel sind damit eindeutig, die beiden 39er ausdrücklich nicht.
   */
  const adnStaffeln: Record<number, string> = (() => {
    try {
      const roh = yaml.load(readFileSync(resolve(ROOT, 'data/adn-staffelzuordnung.yaml'), 'utf8'))
      const raus: Record<number, string> = {}
      for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
        if (!Number.isFinite(Number(k)) || !Number.isFinite(Number(v))) continue
        raus[Number(k)] = String(v)
      }
      return raus
    } catch {
      return {}
    }
  })()
  const katalogKennung = new Map<number, number>()
    // Derselbe Katalog wie oben, samt den dort verworfenen Zuordnungen.
    for (const s of adnKatalog.shows) {
      if (s.anilistId && !katalogKennung.has(s.anilistId)) katalogKennung.set(s.anilistId, s.showId)
    }
    /**
     * **Die Staffel steht im Release-Slug — und sie entscheidet das Urteil.**
     *
     * Eine ADN-Serienkennung ist ein Franchise: 461 führt alle
     * Haikyu!!-Staffeln, 444 alle vier JoJo-Blöcke. Ein Verweis auf die nackte
     * Serie bekommt deshalb „gemischt" — richtig und unbrauchbar.
     *
     * Die Staffel liegt längst im Haus: `adn-461-s3-20231001` steht als Slug an
     * jedem ADN-Release, und sie stammt aus `staffelBloecke()`, das über die
     * **Folgenzahl** zuordnet. Sie wird hier also nicht ermittelt, sondern
     * abgelesen — und nur, wenn sie eindeutig ist: Nennen zwei Releases
     * desselben Titels verschiedene Blöcke, bleibt der Verweis, wie er ist.
     *
     * Gemessen am 06.09.2026: 25 weitere Verweise bekommen so ein Ja. Übrig
     * bleiben acht, deren Serie gemischt ist und zu denen kein ADN-Release
     * existiert — dort sagt niemand, welche Staffel gemeint ist.
     */
    const ausRelease = new Map<number, { show: number; staffel?: string } | null>()
    for (const release of releases) {
      if (release.platform !== 'adn') continue
      const teile = /^adn-(\d+)(?:-s(\d+))?/.exec(release.slug)
      if (!teile) continue
      const jetzt = { show: Number(teile[1]), staffel: teile[2] }
      const bisher = ausRelease.get(release.titleId)
      if (bisher === undefined) ausRelease.set(release.titleId, jetzt)
      else if (bisher && (bisher.show !== jetzt.show || bisher.staffel !== jetzt.staffel)) {
        // Zwei Blöcke, kein eindeutiger Bezug — dann lieber keine Schärfung.
        ausRelease.set(release.titleId, null)
      }
    }
    let berichtigt = 0
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'adn') continue
        const ausSlug = ausRelease.get(title.id) ?? undefined
        const kennung = adnAdressen[title.id] ?? katalogKennung.get(title.id) ?? ausSlug?.show
        const neu = adnAdresseSchaerfen(stream.url, { kennung, staffel: ausSlug?.staffel })
        if (!neu) continue
        stream.url = neu
        berichtigt++
      }
    }
    if (berichtigt) log(`${berichtigt} ADN-Adressen um Serienkennung oder Staffel geschärft`)
    if (adnVerweiseErgaenzt) log(`${adnVerweiseErgaenzt} ADN-Verweise aus ADN-Terminen angelegt`)
  /**
   * **RTL+ hat seine Domain gewechselt — die alten Adressen zeigen ins Leere.**
   *
   * aniSearch führt zu zehn Titeln einen Verweis der Form
   * `www.tvnow.de/serien/<slug>-<nummer>`. TVNow heißt seit dem Umbau
   * `plus.rtl.de`, und die alten Adressen leiten **auf die Startseite** um —
   * gemessen am 07.09.2026: alle zehn antworten mit HTTP 200 und landen auf
   * `https://plus.rtl.de/`. Wer im Kalender darauf klickt, steht vor dem ganzen
   * Katalog statt vor der Serie.
   *
   * `data/rtlplus-befunde.json` weiß das seit dem 22.08.2026 für zwei davon
   * (`lebt: false`, `aufStartseite: true`) — der Befund wurde nur nie
   * angewandt. Dieselbe Klasse Fehler wie beim Handbeleg und bei den
   * ADN-Adressen: **ein Befund, den niemand liest, ist kein Befund.**
   *
   * Die neuen Adressen stehen in `data/rtlplus-adressen.yaml`, je Titel
   * einzeln über RTL+' Sitemaps belegt und mit dem `<title>` der Zielseite
   * gegengelesen.
   */
  const rtlAdressen: Record<number, string> = (() => {
    try {
      const roh = yaml.load(readFileSync(resolve(ROOT, 'data/rtlplus-adressen.yaml'), 'utf8'))
      const raus: Record<number, string> = {}
      for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
        if (!Number.isFinite(Number(k)) || typeof v !== 'string' || !v) continue
        raus[Number(k)] = v
      }
      return raus
    } catch {
      return {}
    }
  })()
  {
    let ersetzt = 0
    for (const title of titles.values()) {
      const slug = rtlAdressen[title.id]
      if (!slug) continue
      for (const stream of title.streams) {
        if (stream.platform !== 'rtlplus' || !/tvnow\.de/.test(stream.url)) continue
        stream.url = `https://plus.rtl.de/${slug}`
        ersetzt++
      }
    }
    if (ersetzt) log(`${ersetzt} RTL+-Adressen von der abgeschalteten Domain tvnow.de umgestellt`)
  }

  /**
   * **Dieselbe Schärfung noch einmal, für alles, was später dazukommt.**
   *
   * Die Runde oben läuft, bevor `build.ts` ganz unten die Anbieter aus
   * aniSearch ergänzt. Ein ADN-Verweis, der dort entsteht, wird von ihr nie
   * berührt — er behält seine Slug-Adresse, `beurteileAdnVerweis` findet
   * nichts im Archiv, und der Verweis bleibt bei „🇩🇪 ?".
   *
   * Gemessen am 07.09.2026: **sieben** solche Verweise, darunter sechs, deren
   * Kennung seit dem 06.09. in `data/adn-adressen.yaml` steht — die Datei war
   * gepflegt und wirkungslos. Das ist derselbe Fehlgriff wie beim Handbeleg
   * einen Tag zuvor: **Wer unten ergänzt, muss unten auch schärfen und
   * beurteilen.**
   */
  const adnStreamSchaerfen = (titleId: number, stream: { platform: string; url: string }): boolean => {
    if (stream.platform !== 'adn') return false
    const ausSlug = ausRelease.get(titleId) ?? undefined
    const kennung = adnAdressen[titleId] ?? katalogKennung.get(titleId) ?? ausSlug?.show
    /* Der Release-Slug zuerst — er stammt aus der laufenden Zuordnung; die Datei
       ist für die Titel, zu denen es kein Release gibt. */
    const staffel = ausSlug?.staffel ?? adnStaffeln[titleId]
    const neu = adnFolgenAdresse(stream.url, adnArchiv) ?? adnAdresseSchaerfen(stream.url, { kennung, staffel })
    if (!neu) return false
    stream.url = neu
    return true
  }


  const adnArchiv = ladeAdnArchiv({ pflegen: true })
  {
    // Folgenverweise auf die alte Domain — Begründung an `adnFolgenAdresse`.
    let umgestellt = 0
    for (const title of titles.values())
      for (const stream of title.streams) {
        if (stream.platform !== 'adn') continue
        const neu = adnFolgenAdresse(stream.url, adnArchiv)
        if (!neu) continue
        stream.url = neu
        umgestellt++
      }
    if (umgestellt) log(`${umgestellt} ADN-Folgenverweise von animationdigitalnetwork.de auf ADNs eigene Adresse umgestellt`)
  }
  if (adnArchiv.serien.size) {
    let adnJa = 0
    let adnNein = 0
    const adnOffen: string[] = []
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'adn' || stream.dub !== undefined) continue
        const befund = beurteileAdnVerweis(stream.url, adnArchiv)
        if (befund.dub === undefined) {
          adnOffen.push(`${title.id}: ${befund.grund}`)
          continue
        }
        stream.dub = befund.dub
        if (befund.dub) adnJa++
        else adnNein++
      }
    }
    log(
      `${adnJa + adnNein} ADN-Verweise aus dem Archiv belegt (${adnJa}× deutsche Synchro, ${adnNein}× nur Untertitel; ` +
        `${adnArchiv.folgenMitVde} von ${adnArchiv.folgenGesamt} Folgen aus ${adnArchiv.serien.size} Serien tragen vde)`,
    )
    // Die offenen Fälle stehen im Protokoll, damit sie nicht still liegenbleiben:
    // Das Archiv wächst mit jedem Montagslauf, und was heute fehlt, kann nächste
    // Woche beantwortet sein.
    if (adnOffen.length) log(`${adnOffen.length} ADN-Verweise bleiben offen — ${adnOffen.join('; ')}`)
  }

  /**
   * **Ein ADN-Katalogeintrag mit gleichem Namen und gleicher Folgenzahl belegt Deutsch.**
   *
   * `data/adn-catalog.json` enthält **nur Serien mit deutschen Folgen**, und in
   * ihren `episodes` stehen **ausschließlich** die deutschen — der Katalog-Lauf
   * filtert vor dem Schreiben auf `vde`. Das steht so in `fetch-adn.ts`, und
   * `episodeAus()` schreibt deshalb bewusst kein `languages`-Feld.
   *
   * **Genau daran bin ich am 29.08.2026 gescheitert**, und der Irrtum gehört
   * hierher: Eine Auswertung suchte in den Katalogfolgen nach `vde`, fand in
   * allen 4.078 nichts und meldete „0 von 113 deutsch" für JoJo — während
   * CLAUDE.md „113 von 152 mit vde" festhält. Das sah nach einem Widerspruch in
   * den Daten aus und war ein Messfehler: gesucht nach einem Feld, das dort nie
   * steht. **Wahr ist das Gegenteil — jede Folge im Katalog ist deutsch.**
   *
   * Was diese Runde löst: Unser Bestand führt ADN unter zwei Adressformen, 70
   * mit Kennung und 65 als Slug aus aniSearch. Die Slugs finden über die
   * Adresse keinen Anschluss an den Katalog; über **Name und Folgenzahl**
   * finden sie ihn.
   *
   * **Zwei Sperren:** Der Name muss eindeutig treffen (ein Katalogtitel, nicht
   * zwei), und die Folgenzahl muss übereinstimmen. „JoJo's Bizarre Adventure"
   * hat bei uns 26 Folgen, der Katalogeintrag 113 — das ist die Sammelserie
   * aller Staffeln und bleibt offen.
   *
   * Nur Ja: Ein Titel, den der Katalog **nicht** führt, hat dort vielleicht
   * trotzdem etwas — der Katalog ist ein Ausschnitt, keine Gesamtschau.
   */
  {
    const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const katalog = readJson<{ shows?: { title?: string; originalTitle?: string; episodes?: unknown[] }[] }>(
      'data/adn-catalog.json',
      {},
    ).shows ?? []
    const nachName = new Map<string, { titel: string; folgen: number }[]>()
    for (const s of katalog) {
      const folgen = (s.episodes ?? []).length
      if (!folgen) continue
      for (const n of [s.title, s.originalTitle]) {
        if (!n) continue
        const k = norm(n)
        if (!nachName.has(k)) nachName.set(k, [])
        nachName.get(k)!.push({ titel: n, folgen })
      }
    }
    let ausKatalog = 0
    for (const title of titles.values()) {
      const stream = title.streams.find((s) => s.platform === 'adn' && s.dub === undefined)
      if (!stream) continue
      const namen = [title.titleDe, title.titleEn, title.titleRomaji].filter(Boolean).map((n) => norm(n))
      const treffer = namen.map((n) => nachName.get(n)).find(Boolean)
      if (!treffer || treffer.length !== 1) continue
      if (treffer[0]!.folgen !== title.episodes) continue
      stream.dub = true
      ausKatalog++
    }
    if (ausKatalog) {
      log(`${ausKatalog} ADN-Verweise über den Katalog belegt (Name und Folgenzahl treffen)`)
    }
  }

  /**
   * Anbieter ohne deutsche Synchro fliegen ganz raus.
   *
   * Bis zum 15.08.2026 blieben sie stehen und trugen ein rotes „🇩🇪 ✕" — die
   * Begründung war, die Auskunft „dort nur Originalton" sei ja brauchbar. Für
   * diese Seite ist sie es nicht: Sie beantwortet **eine** Frage, und zwar wo
   * ein Anime auf Deutsch zu sehen ist. Daniel am 15.08.2026: „wir
   * interessieren uns als app nur für deutsche synchros, keine anderen
   * synchron sprachen".
   *
   * Betroffen sind nur Verweise mit einem **belegten** Nein — aus
   * `dub-confirmed.yaml` oder aus der Folgenliste einer Serienseite. Ein
   * unbeantwortetes `undefined` bleibt selbstverständlich stehen; das ist der
   * Normalfall und heißt „wir wissen es nicht", nicht „dort gibt es keine".
   */
  let ohneDeutsch = 0
  for (const title of titles.values()) {
    const raus = title.streams.filter((s) => s.dub === false)
    if (!raus.length) continue
    title.streams = title.streams.filter((s) => s.dub !== false)
    ohneDeutsch += raus.length
    for (const s of raus) {
      verweiseEntfernt.push({
        titleId: title.id,
        titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
        plattform: s.platform,
        url: s.url,
        seriesId: null,
        grund: 'belegtes Nein: dort gibt es keine deutsche Tonspur',
        geprueftAm: null,
        entferntAm: todayIso(),
        letzterWeg: title.streams.length === 0,
      })
    }
    // `watchLinks` tragen keine Sprachangabe — sie sind Shops und Nischendienste,
    // zu denen niemand die Tonspur belegt. Sie bleiben unangetastet.
  }
  if (ohneDeutsch) log(`${ohneDeutsch} Verweise ohne deutsche Synchro entfernt`)

  /*
    **aniSearch nennt Bezugsquellen — und wir haben sie nie gelesen.**

    Der Abruf archiviert je Werk die Anbieter, bei denen es zu sehen ist. Der
    Bau benutzte davon genau eine Zeile: Sie ersetzt eine Prime-Suchadresse
    durch die echte Produktseite. Alles andere lag ungenutzt.

    **Der teuerste Einzelfall steht in CLAUDE.md und war nie behoben.**
    Detektiv Conan läuft bei Crunchyroll mit 405 deutschen Folgen — von Hand
    belegt am 25.08.2026, Kennung GW4HM7NV3. Im Bestand stand dazu ein
    Amazon-Kaufweg und sonst nichts: Der falsche Verweis (`case-closed`, der
    englische Block) wurde als belegtes Nein entfernt, der richtige nie
    angelegt. aniSearch führt ihn seit jeher — `crunchyroll.com/detektiv-conan`.

    Das ist kein Zufall, sondern die Bauart. `scrape-crunchyroll-dub.ts` bildet
    seine Warteschlange aus den Verweisen, die schon im Bestand stehen: Wo
    keiner steht, wird keiner geprüft, und wo keiner geprüft wird, entsteht auch
    keiner. Ein Kreis, der sich nur von außen öffnen lässt.

    **Der Block steht hier unten mit Absicht** — nach dem Entfernen der belegten
    Neins. Weiter oben sind die Anbieter noch besetzt, und ergänzt würde nichts;
    gemessen am 06.09.2026 kamen an der früheren Stelle 83 Verweise heraus
    statt der 625, die im ausgelieferten Datensatz wirklich fehlen.

    **Vier Riegel, jeder mit belegtem Anlass:**

    - **Die Adresse zählt, nicht der Anbieter.** Ein Crunchyroll-Block ist nicht
      das Werk (Conan oben, Blue Exorcist in CLAUDE.md). Ein Nein zu
      `case-closed` ist deshalb kein Nein zu `detektiv-conan`.
    - **Was einmal entfernt wurde, bleibt entfernt.** `data/verweise-entfernt.json`
      ist das Gedächtnis über Läufe hinweg; ohne diesen Riegel legte der Bau
      jede Woche wieder an, was der Prüflauf gerade verworfen hat — ein Flattern
      zwischen zwei Läufen, das niemandem auffällt.
    - **Ein Handbeleg schlägt alles**, auch ein verneinender. Das ist die Regel,
      an der am 25.08.2026 ein Lauf fünf geprüfte Neins überschrieben hat.
    - **Bei Amazon nur, was als Video belegt ist.** Hinter `/dp/` kann eine DVD
      liegen, und eine Disc als Stream auszugeben wäre schlimmer als gar kein
      Weg. Entschieden wird über `linkBefunde[url].prime` — dieselbe Bedingung
      wie bei der Ersetzung der Suchadressen.

    Die Verweise tragen **keine** Sprachangabe. Sie sagen „hier gibt es das",
    nicht „hier gibt es das auf Deutsch" — und genau so füllen sie die
    Warteschlangen, die bisher an ihrer eigenen Lücke verhungert sind.
  */
  {
    const asAnbieter: Record<string, PlatformId> = {
      crunchyroll: 'crunchyroll',
      'adn-de': 'adn',
      adn: 'adn',
      netflix: 'netflix',
      disneyplus: 'disneyplus',
      youtube: 'youtube',
      joyn: 'joyn',
      'rtl-plus': 'rtlplus',
      'prime-video': 'primevideo',
      'amazon-de': 'primevideo',
      'amazon-(de)': 'primevideo',
      'primevideo-channel-crunchyroll-de': 'primevideo',
      'primevideo-channel-aniverse-de': 'primevideo',
    }
    /** Adressen vergleichen sich nur ohne Protokoll, Parameter und Schrägstrich am Ende. */
    const adressKern = (u: string): string =>
      u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    /*
      **Das Gedächtnis reicht bis in diesen Lauf hinein.**

      `data/verweise-entfernt.json` trägt den Stand des **letzten** Laufs; was
      wenige Zeilen weiter oben gerade als belegtes Nein entfernt wurde, steht
      dort noch nicht. Ohne `verweiseEntfernt` legte derselbe Lauf also wieder
      an, was er selbst eben verworfen hat — das Flattern, gegen das dieser
      Riegel gebaut ist, entstünde innerhalb einer einzigen Ausführung.
    */
    /**
     * **Ein belegtes Nein gilt 28 Tage, nicht für immer.**
     *
     * Der Riegel hielt einen einmal entfernten Verweis dauerhaft draußen. Das
     * ist gegen das Flattern zwischen zwei Läufen richtig — und gegen die
     * Wirklichkeit falsch, denn ein Anbieter nimmt eine deutsche Fassung auch
     * **auf**.
     *
     * Belegt an „Kill Blue" (07.09.2026, von Daniel gemeldet): Am 24.08. führte
     * Crunchyroll dort null deutsche Folgen, der Verweis flog zu Recht heraus.
     * Am **06.09.** erschienen die Folgen 1–8 auf Deutsch — und der Kalender
     * zeigte weiter keinen Crunchyroll-Weg. Das ist die schlimmste Art Fehler,
     * die diese Seite machen kann: Sie behauptet nicht zu wenig, sondern das
     * Gegenteil.
     *
     * **Dieselbe Regel steht seit dem 15.08.2026 in `CLAUDE.md`**, nur für
     * Warteschlangen: „Jede Warteschlange wird nach dem Alter gebildet, nie
     * nach ‚schon beantwortet'." Das Gedächtnis war die Stelle, an der sie nie
     * angewandt wurde — und es ist dieselbe Begründung: Verliert ein Dienst die
     * Lizenz, verschwindet die Fassung; bekommt er sie, erscheint sie.
     *
     * **28 Tage** sind dieselbe Frist, die `scrape-crunchyroll-dub.ts` für die
     * Wiedervorlage nutzt. Sie ist lang genug, dass kein Lauf gegen den
     * nächsten flattert, und kurz genug, dass eine neue Synchro binnen eines
     * Monats ankommt.
     *
     * **Einträge ohne Datum gelten als alt** — sie stammen aus der Zeit vor
     * diesem Feld, und ihr Nein ist entsprechend ungeprüft. Sie kommen damit
     * beim nächsten Bau alle einmal zurück in die Prüfung; das ist gewollt.
     */
    const neinGrenze = addDays(todayIso(), -NEIN_GILT_TAGE)
    /**
     * **Manche Gründe gelten der Adresse, manche nur einem Titel an ihr.**
     *
     * Eine tote Adresse ist für jeden Titel tot. „Beim Anbieter ist kein Platz"
     * und „die Adresse zeigt auf eine andere Reihe" betreffen dagegen genau den
     * Titel, der entfernt wurde. Bis zum 11.09.2026 merkte sich das Gedächtnis
     * nur die Adresse, und bei Sword Art Online flatterte die Prüfliste deshalb
     * von Bau zu Bau: Ein Lauf legte SAO II den Netflix-Weg an, die Platzprüfung
     * warf War of Underworld und Part 2 unter derselben Adresse zu Recht hinaus
     * — und der nächste Lauf hielt die Adresse für entfernt und legte SAO II
     * nicht mehr an. Ohne SAO II war kein Platz voll, War of Underworld blieb,
     * und die Liste fragte wieder nach Folgen, die Daniel am 06.09. gemessen hat.
     */
    /*
      „belegtes Nein" gehört seit dem 17.09.2026 dazu: Das Urteil gilt einem
      Titel, nicht der Adresse. Princess Principal: Kapitel 3 und 4 sind an der
      Serienadresse nicht deutsch, Kapitel 1 und 2 schon — die Sperre für die
      Adresse nahm den beiden deutschen Filmen ihren Weg. Ein Geschwister, das
      die Adresse bekommt, wird selbst beurteilt und bei einem Nein wieder
      entfernt. Gemessen: außer diesen Filmen kein weiterer Titel betroffen
      (nach dem YouTube-Fix in `adressKern()`).
    */
    const NUR_DIESER_TITEL = /^der Anbieter führt |^die Adresse zeigt auf die Reihe|^belegtes Nein/
    const merkeSchluessel = (e: { titleId?: number; url?: string; grund?: string }) =>
      NUR_DIESER_TITEL.test(e.grund ?? '') ? `${e.titleId}|${adressKern(e.url ?? '')}` : adressKern(e.url ?? '')
    const frueherEntferntRoh = new Set([
      ...(readJson<{ verweise?: { titleId?: number; url?: string; grund?: string; entferntAm?: string | null }[] }>(
        'data/verweise-entfernt.json',
        {},
      ).verweise?.filter((e) => (e.entferntAm ?? '') >= neinGrenze).map(merkeSchluessel) ?? []),
      /* Was dieser Lauf selbst gerade verworfen hat, bleibt ohne Frist draußen. */
      ...verweiseEntfernt.map(merkeSchluessel),
    ])
    const frueherEntfernt = {
      has: (kern: string, titleId: number) => frueherEntferntRoh.has(kern) || frueherEntferntRoh.has(`${titleId}|${kern}`),
    }
    /**
     * **Eine tote Crunchyroll-Serie erkennt man an ihrer Kennung, nicht an der
     * Adresse.**
     *
     * Am 07.09.2026 ist der Bau daran rot geworden (Lauf 34106061181):
     * `.../de/series/G4PH0WJDQ/captain-tsubasa-junior-youth-arc` flog als
     * belegtes Nein aus dem Bestand — Crunchyroll meldet für die Serie „Videos
     * nicht mehr verfügbar" —, und dieselbe Runde hier legte Sekunden später
     * `.../series/G4PH0WJDQ/...` **ohne** `/de/` aus aniSearch neu an.
     * `check:cr-zuordnung` hat es zu Recht gemeldet: eine tote Serie, frisch
     * verlinkt.
     *
     * Weder `bekannt` noch `frueherEntfernt` konnten greifen: Beide vergleichen
     * normalisierte **Adressen**, und `adressKern()` gleicht den `/de/`-Teil
     * nicht aus. Die zweite Adresse war nie ein Stream, stand also in keiner
     * der beiden Mengen.
     *
     * **Nur `nichtVerfuegbar` zählt, nicht „gerade keine deutsche Folge".**
     * Der Vorschlag aus dem Reparatur-Lauf (PR #55) nahm zusätzlich jede Serie
     * mit `katalog: 'de'` und leerer Staffelliste — gemessen sind das **227
     * lebendige** Serien. Genau das ist das Kill-Blue-Muster vom selben Tag:
     * Am 22.08. hatte Crunchyroll dort null deutsche Folgen, am 06.09. lagen
     * acht vor. Heute keine Synchro zu haben ist kein Beleg dafür, nie eine zu
     * bekommen — und ein Ausschluss über die Kennung kennt keine Frist.
     */
    const toteCrSerien = new Set(
      crDub.serien.filter((s) => s.nichtVerfuegbar && s.seriesId && !usNeinWiderlegt(s)).map((s) => s.seriesId as string),
    )
    /**
     * **Dieselbe Sperre über die Adresse — für alles ohne Kennung.**
     *
     * Der Riegel unten fragte nur nach `/series/<Kennung>`. Crunchyroll-Adressen
     * im alten Format tragen keine (`crunchyroll.com/inuyashiki-last-hero`), und
     * genau eine davon kam am 07.09.2026 durch: als tot entfernt, von aniSearch
     * im selben Lauf neu ergänzt, Zusicherung rot („keine der 150 toten
     * Crunchyroll-Adressen steht noch im Datensatz", Lauf 34160329089, Issue #54).
     *
     * Verglichen wird über `adressKern()` — dieselbe Serie steht mit und ohne
     * `www.`, mit und ohne Schrägstrich am Ende.
     */
    /**
     * **Auch die Befunde aus `crunchyroll-offene.json` gehören hierher.**
     *
     * `crDub.serien` kennt nur, was der wöchentliche Lauf geprüft hat.
     * `fetch-crunchyroll-offene.ts` belegt daneben eigene Adressen als tot —
     * abgelaufene Videokennung, oder im deutschen Katalog nicht geführt und von
     * JustWatch gegengeprüft.
     *
     * Ohne diese Zeile legt die Nachrunde sie **jeden Lauf** neu an: Gemessen
     * am 10.09.2026 an „Millennium Actress" — die Serienadresse
     * `crunchyroll.com/de/millennium-actress` flog als „nicht mehr verfügbar"
     * heraus, und aus aniSearch kam `…/watch/GPWUKPVP4/…` zurück, eine andere
     * Adresse mit demselben Ziel. Der Verweis stand danach wieder da, ohne
     * Urteil, und mein Block weiter oben sah ihn nie — er läuft vorher.
     *
     * Das ist dieselbe Klasse wie „Wer unten ergänzt, muss unten auch
     * beurteilen" (06.09.2026), nur eine Quelle weiter.
     */
    /* Die Befunde aus dem Einzellauf — beide Blöcke unten lesen sie. */
    const crOffeneBefunde = readJson<Record<string, { herkunft?: string; dub?: boolean }>>(
      'data/crunchyroll-offene.json',
      {},
    )
    const toteCrAdressen = new Set([
      ...crDub.serien
        .filter((s) => !usNeinWiderlegt(s) && (s.nichtVerfuegbar || /nicht mehr verf|404/.test(s.fehler ?? '')))
        .map((s) => adressKern(s.url)),
      ...Object.entries(crOffeneBefunde)
        .filter(([, b]) => b?.herkunft === 'tot')
        .map(([url]) => adressKern(url)),
    ])
    let wegeErgaenzt = 0
    const jeAnbieter: Record<string, number> = {}
    for (const title of titles.values()) {
      const quellen = anisearch[title.id]?.streams ?? []
      if (!quellen.length) continue
      const bekannt = new Set(
        [...title.streams, ...(title.entfernteStreams ?? []), ...(title.watchLinks ?? [])].map((x) =>
          adressKern(x.url),
        ),
      )
      const vorhanden = new Set(title.streams.map((x) => x.platform))
      for (const quelle of quellen) {
        const ziel = asAnbieter[quelle.provider ?? '']
        /*
          **Auch ein ergänzter Verweis geht durch die Adressnormalisierung.**

          `netflixTitelAdresse()` bringt jede Netflix-Adresse auf die Form
          `/title/<id>` — nur läuft sie weiter oben, und dieser Block hängt
          hinten. Am 06.09.2026 landeten dadurch zwei aniSearch-Adressen als
          `/watch/` im Datensatz, und die Pille der Statusanzeige öffnete
          Daniel direkt den laufenden Player: „mach pill clicks zu overview,
          nicht direkt player."

          Der Ort für die Regel ist die Regel selbst, nicht die Reihenfolge:
          Wer hier ergänzt, ergänzt in derselben Form wie alle anderen.
        */
        const url =
          ziel === 'netflix'
            ? netflixTitelAdresse((quelle.url ?? '').split('?')[0])
            : (quelle.url ?? '').split('?')[0]
        if (!ziel || !url) continue
        if (vorhanden.has(ziel)) continue
        if (bekannt.has(adressKern(url)) || frueherEntfernt.has(adressKern(url), title.id)) continue
        if (ziel === 'crunchyroll') {
          /* Die Kennung entscheidet, nicht die Schreibweise der Adresse — siehe `toteCrSerien`. */
          const kennung = /\/series\/([A-Z0-9]+)/.exec(url)?.[1]
          if (kennung && toteCrSerien.has(kennung)) continue
          /* Und wo keine Kennung steht, entscheidet die Adresse — siehe `toteCrAdressen`. */
          if (toteCrAdressen.has(adressKern(url))) continue
        }
        /*
          **Ein verneinender Handbeleg hält den Verweis draußen — ein bejahender
          nicht.**

          Der Riegel stand bis zum 06.09.2026 auf `checks.has(...)`, fragte also
          nur, **ob** jemand hingesehen hat. Das ist für ein Nein genau richtig
          (ein fehlender Verweis ist selbst eine Angabe, siehe CLAUDE.md,
          25.08.2026) und für ein Ja verkehrt herum: Wer geprüft hat, dass es
          dort auf Deutsch läuft, hat den besten Grund geliefert, den Weg
          anzulegen.

          Aufgefallen an „Sword Art Online II" (20594): aniSearch führt für den
          Titel `netflix.com/title/70302573`, zwei Handbelege sagen `dub: true`
          für die Folgen 1–24 — und im Datensatz stand kein Netflix-Weg. Über
          den ganzen Bestand gemessen ist das **der einzige** Fall (1 von 1.092
          bejahenden Handbelegen), die Änderung ist also so eng wie ihr Anlass.
        */
        const beleg = belegFuer(title.id, ziel, url)
        if (beleg && (beleg.dub !== true || beleg.available === false)) continue
        if (ziel === 'primevideo' && linkBefunde[url]?.prime !== true) continue
        if (lautPruefungTot(url)) continue
        title.streams.push({ platform: ziel, url })
        vorhanden.add(ziel)
        jeAnbieter[ziel] = (jeAnbieter[ziel] ?? 0) + 1
        wegeErgaenzt++
      }
    }
    if (wegeErgaenzt) {
      const verteilung = Object.entries(jeAnbieter)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')
      log(`${wegeErgaenzt} Anbieter-Verweise aus aniSearch ergänzt (${verteilung})`)
    }

    /*
      **Der deutsche Crunchyroll-Katalog legt Verweise an, nicht nur richtige Adressen.**

      `data/cr-katalog-de.json` liegt seit dem 22.08.2026 im Repo und wurde bis
      heute nur benutzt, um eine **vorhandene** kaputte Adresse zu ersetzen. Für
      einen Titel ganz ohne Crunchyroll-Verweis wurde er nie gefragt — und damit
      auch nie geprüft, denn die Warteschlange des Dub-Laufs bildet sich aus den
      vorhandenen Verweisen.

      Daniel am 16.09.2026, mit vier Bildern: „Code Geass: Akito the Exiled - The
      Brightness Falls" stand als „Noch keine deutsche Fassung" da, während
      Crunchyroll die Reihe unter GRP585ZQR mit „Audio: Japanese, **Deutsch**,
      Français" führt und alle fünf Folgen als „Synchro | Untertitel" ausweist.
      Vier der fünf Teile hatten einen Prime-Weg, der fünfte gar keinen. „Sogar
      auf crunchyroll existent, wo wir 100%-ige abdeckung haben sollten."

      Gemessen über den Bestand: 2.142 Titel ohne Crunchyroll-Verweis, 304 mit
      einem Katalogtreffer, **75 davon in einem Katalogeintrag mit `de-DE`**.

      **Angelegt wird der Weg ohne Sprachurteil.** Die Tonspurliste im Katalog
      gilt der Reihe, nicht der Folge — sie taugt als Wegweiser, nicht als Zeuge
      (dieselbe Trennung wie bei JustWatch, 10.09.2026). Das Urteil je Folge holt
      der nächste `data:cr-dub`-Lauf, der diesen Verweis jetzt überhaupt erst
      sieht. Ohne `de-DE` im Katalog wird nichts angelegt: Ein Weg, der zur Frage
      dieses Projekts nichts sagt, ist die Mühe des Klicks nicht wert.
    */
    let crAusKatalog = 0
    for (const title of titles.values()) {
      if (title.streams.some((s) => s.platform === 'crunchyroll')) continue
      const url = crAdresseZu(title.titleEn ?? title.titleRomaji ?? '')
      if (!url) continue
      const kennung = url.split('/series/')[1]?.split('/')[0] ?? ''
      if (!crKatalogDeutsch.has(kennung)) continue
      const kern = adressKern(url)
      if (frueherEntfernt.has(kern, title.id)) continue
      if (toteCrSerien.has(kennung)) continue
      const beleg = belegFuer(title.id, 'crunchyroll', url)
      if (beleg && (beleg.dub !== true || beleg.available === false)) continue
      if (lautPruefungTot(url)) continue
      title.streams.push({ platform: 'crunchyroll', url })
      crAusKatalog++
    }
    if (crAusKatalog)
      log(`${crAusKatalog} Crunchyroll-Verweise aus dem deutschen Katalog angelegt (Titel, die bisher keinen hatten)`)

    /*
      **Kanal-Angebote sind Bezugswege, keine Prime-Verweise.**

      aniSearch trennt sauber, was Amazon in einer Oberfläche vermischt:
      `prime-video` ist Amazons eigenes Angebot, `primevideo-channel-<kanal>-de`
      ein Kanal-Abo, das man dort dazubucht. Der Unterschied entscheidet, was
      die Angabe wert ist — bei einem Kanal-Titel zeigt Amazon die Sprachen des
      **Kanals**, nicht die der Folge (CLAUDE.md, 24.08.2026, gemessen an „Kill
      Blue": Amazon behauptet 12 deutsche Folgen, ADN und Netflix sagen vier).

      Als **Weg** stimmt der Verweis trotzdem, und für „wo läuft es" ist er die
      Antwort. Er landet deshalb in `watchLinks` unter dem Namen, den die
      Oberfläche ohnehin führt („Crunchyroll über Prime Video"), statt als
      Stream mit einer Sprachfrage, die dort niemand beantworten kann.

      Der Shop-Verweis `amazon-de` bleibt ein **Kaufweg**: Hinter `/dp/` kann
      eine DVD liegen, und ohne Beleg ist „kaufen" die vorsichtige und richtige
      Auskunft.

      Unbekannte Kanäle werden übersprungen. Ein Name, den die Oberfläche nicht
      kennt, wäre geraten — und ein geratener Anbietername sieht aus wie eine
      Auskunft.
    */
    /*
      **Der Name kommt aus `providerName()`, nicht aus einer zweiten Liste.**

      Hier standen die vier Namen ausgeschrieben — eine Kopie dessen, was
      `shared/mappings.ts` ohnehin führt. Am 07.09.2026 fiel auf, was das
      kostet: Die Umbenennung auf „Prime Video — Crunchyroll Kanalabo" traf nur
      die eine Fassung, und in der „Wo sehen?"-Liste standen beide nebeneinander
      — 376 Einträge unter dem neuen Namen, 54 unter dem alten.

      Zwei Fassungen derselben Zuordnung laufen auseinander; das ist dieselbe
      Lehre, die in `CLAUDE.md` für Regeltexte steht. Die aniSearch-Kennung
      trägt ein `-de` am Ende, das `canonicalProvider()` nicht kennt — deshalb
      wird es abgeschnitten, bevor gefragt wird.
    */
    const kanalName = (provider: string): string | undefined => {
      if (!provider.startsWith('primevideo-channel-')) return undefined
      /* Die aniSearch-Kennung trägt ein `-de`, das `canonicalProvider()` nicht kennt. */
      const name = providerName(provider.replace(/-de$/, ''))
      /* Ein Name, den die Oberfläche nicht kennt, wäre geraten — dann lieber keiner. */
      return name && !/^Primevideo/i.test(name) ? name : undefined
    }
    let kanalWege = 0
    let kaufWege = 0
    for (const title of titles.values()) {
      const quellen = anisearch[title.id]?.streams ?? []
      if (!quellen.length) continue
      if (title.streams.some((x) => x.platform === 'primevideo')) continue
      if (checks.has(dubKey(title.id, 'primevideo'))) continue
      const bekannt = new Set(
        [...title.streams, ...(title.entfernteStreams ?? []), ...(title.watchLinks ?? [])].map((x) =>
          adressKern(x.url),
        ),
      )
      for (const quelle of quellen) {
        const url = (quelle.url ?? '').split('?')[0]
        if (!url || bekannt.has(adressKern(url)) || frueherEntfernt.has(adressKern(url), title.id)) continue
        const kanal = kanalName(quelle.provider ?? '')
        const istShop = quelle.provider === 'amazon-de' || quelle.provider === 'amazon-(de)'
        if (!kanal && !istShop) continue
        title.watchLinks = [
          ...(title.watchLinks ?? []),
          kanal
            ? { name: kanal, url, kind: 'stream' as const, zugang: 'abo' as const }
            : { name: 'Amazon', url, kind: 'buy' as const, zugang: 'kauf' as const },
        ]
        bekannt.add(adressKern(url))
        if (kanal) kanalWege++
        else kaufWege++
      }
    }
    if (kanalWege || kaufWege)
      log(`${kanalWege} Kanal-Angebote und ${kaufWege} Kaufwege aus aniSearch ergänzt`)

    /*
      **Ein frisch ergänzter Verweis wird im selben Lauf beurteilt.**

      Die Auswertungen laufen weiter oben — sie sehen nur, was zu ihrem
      Zeitpunkt dastand. Ohne diese Nachrunde bekäme ein hier entstandener
      Verweis sein Urteil erst beim nächsten Bau, und der Fall, der die ganze
      Ergänzung ausgelöst hat, sähe im ausgelieferten Datensatz einen Tag lang
      unverändert aus: Detektiv Conan mit einem Crunchyroll-Weg und „🇩🇪 ?",
      obwohl der Prüflauf am selben Vormittag 581 deutsche Folgen belegt hat.

      Gefragt werden dieselben Quellen wie oben, nur je Verweis: die geprüften
      Crunchyroll-Serien nach ihrer Adresse, und das ADN-Archiv. Beide sind an
      dieser Stelle bereits geladen; ein zweiter Abruf entsteht nicht.
    */
    const crNachUrl = new Map(crDub.serien.map((serie) => [serie.url, serie] as const))
    let nachJa = 0
    let nachNein = 0
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.dub !== undefined) continue
        /*
          **Der Handbeleg zuerst — er ist der Grund, warum dieser Weg hier steht.**

          Seit dem 06.09.2026 legt die Ergänzung einen Verweis an, wenn ein
          Handbeleg ihn bejaht. Die Runde, die Handbelege anwendet, läuft aber
          weiter oben; der frisch entstandene Weg trug deshalb `dub: undefined`,
          obwohl die Antwort in derselben Datei stand. Bei „Sword Art Online II"
          hieß das: Netflix-Weg da, kein Urteil daran, und die Auskunft „🇩🇪 ?"
          für Folgen, die Daniel selbst gemessen hat.

          Dieselbe Lehre wie beim Rest dieses Blocks — wer unten ergänzt, muss
          unten auch beurteilen.
        */
        const handBeleg = belegFuer(title.id, stream.platform, stream.url, (title.streams ?? []).filter((x) => x.platform === stream.platform).length)
        if (handBeleg?.dub !== undefined) {
          stream.dub = handBeleg.dub
          if (handBeleg.dubRanges?.length) {
            stream.dubRanges = handBeleg.dubRanges.map((r) => ({ from: r.from, to: r.to, dub: r.dub }))
          }
          continue
        }
        if (stream.platform === 'crunchyroll') {
          /**
           * **Auch `crunchyroll-offene.json` gehört hierher — sonst bleibt das
           * Urteil im Bestand liegen.**
           *
           * `crNachUrl` kennt nur, was der wöchentliche Lauf geprüft hat. Die
           * Adressen, die aniSearch hier gerade ergänzt hat, stehen dort selten:
           * `fruits-basket`, `the-promised-neverland`,
           * `watch/GE00266947DEDE/…` — für alle drei lag am 10.09.2026 ein
           * fertiges Urteil in der Datei (zweimal `false`, einmal `true`), und
           * alle drei standen trotzdem auf „🇩🇪 ?".
           *
           * Der Block, der diese Datei anwendet, läuft rund 800 Zeilen weiter
           * oben — also bevor es diese Verweise gibt. Dieselbe Lehre wie im
           * Absatz darüber, nur eine Quelle weiter.
           */
          const ausOffenen = crOffeneBefunde[stream.url]
          if (typeof ausOffenen?.dub === 'boolean') {
            stream.dub = ausOffenen.dub
            continue
          }
          const serie = crNachUrl.get(stream.url)
          if (!serie) continue
          const kapitelUrteil = kapitelImBlock(serie, title)
          if (kapitelUrteil !== undefined) {
            stream.dub = kapitelUrteil
            continue
          }
          for (const urteil of beurteile(serie, [title])) {
            if (urteil.titleId === title.id) stream.dub = urteil.dub
          }
        } else if (stream.platform === 'adn' && adnArchiv.serien.size) {
          /*
            **Erst schärfen, dann beurteilen.**

            Ein hier ergänzter ADN-Verweis trägt die Adresse, die aniSearch
            führt — oft `animationdigitalnetwork.de/video/<slug>` ohne
            Serienkennung, teils mit französischem Namensteil
            (`50-nuances-de-gras`). `beurteileAdnVerweis` findet dazu nichts,
            und der Verweis bleibt bei „🇩🇪 ?".

            Die Schärfung oben läuft, bevor dieser Block überhaupt Verweise
            anlegt. Gemessen am 07.09.2026 blieben deshalb sieben Verweise
            stumm — sechs davon mit einer Kennung, die seit dem Vortag in
            `data/adn-adressen.yaml` steht.
          */
          adnStreamSchaerfen(title.id, stream)
          const befund = beurteileAdnVerweis(stream.url, adnArchiv)
          if (befund.dub !== undefined) stream.dub = befund.dub
        }
      }
      /*
        **Ein Nein entfernt den Verweis — auch hier unten.**

        Der Hauptfilter ist längst durchgelaufen; ein `dub: false`, das erst
        jetzt entsteht, bliebe sonst im ausgelieferten Datensatz stehen. Dort
        steht bei **keinem** Verweis ein Nein, und zwar nicht zufällig: Die
        Seite beantwortet eine Frage, und „dort nur Originalton" ist keine
        Antwort darauf (Daniel, 15.08.2026).
      */
      const raus = title.streams.filter((s) => s.dub === false)
      nachJa += title.streams.filter((s) => s.dub === true).length
      if (!raus.length) continue
      title.streams = title.streams.filter((s) => s.dub !== false)
      nachNein += raus.length
      for (const s of raus) {
        verweiseEntfernt.push({
          titleId: title.id,
          titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
          plattform: s.platform,
          url: s.url,
          seriesId: null,
          grund: 'belegtes Nein: dort gibt es keine deutsche Tonspur',
          geprueftAm: null,
          entferntAm: todayIso(),
          letzterWeg: title.streams.length === 0,
        })
      }
    }
    if (nachNein) log(`${nachNein} frisch ergänzte Verweise gleich wieder entfernt: dort gibt es keine deutsche Tonspur`)
  }

  /**
   * **Wer die Staffeln exakt füllt, lässt für einen weiteren keinen Platz.**
   *
   * Die Umkehrung der Rechnung vom 10.09.2026: Meldet der Anbieter seine
   * Staffelaufteilung, und füllen unsere **beurteilten** Titel jede seiner
   * Staffeln der Reihe nach exakt auf, dann ist dort nichts mehr frei. Ein
   * Titel derselben Adresse ohne Urteil läuft dort nicht — sein Verweis führt
   * ins Leere.
   *
   * Das ist kein Umkehrschluss aus Schweigen, sondern eine Abzählung: Netflix
   * zeigt „Sword Art Online" mit 25 und 24 Folgen, unsere ersten beiden Titel
   * haben genau diese Zahlen und sind belegt. Für die 23 Folgen der beiden
   * Alicization-Teile ist kein Platz — sie laufen dort wirklich nicht. Dasselbe
   * bei „Mushoku Tensei": 23 + 25 = 11 + 12 und 13 + 12, der Special mit seiner
   * einen Folge passt in keine der beiden Staffeln.
   *
   * **Drei Bedingungen, alle notwendig**, und zusammen sind sie streng genug:
   * Die Aufteilung des Anbieters muss vorliegen, die beurteilten Titel müssen
   * **jede** Staffel exakt füllen, und es darf keiner von ihnen übrig bleiben.
   * Fehlt eine davon, wird nichts entfernt — das ist der Unterschied zu der
   * Positionspaarung, die am 22.08.2026 sechs Verweise zu Unrecht gestrichen
   * hat (siehe CLAUDE.md, „Der Anbieter zählt kumulativ").
   */
  {
    const staffelStruktur = readJson<
      Record<string, { staffeln?: { seq: number; folgen: number }[] }>
    >('data/anbieter-staffeln.json', {})
    const netflixKennung = (u: string): string | null =>
      /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(u)?.[1] ?? null
    const jahrRang = (t: Title): number =>
      (t.jpYear ?? 0) * 100 + ({ WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 }[t.jpSeason ?? ''] ?? 0)

    /* Alle Titel je Netflix-Adresse, in der Reihenfolge ihrer Ausstrahlung. */
    const jeAdresse = new Map<string, Array<{ title: Title; stream: StreamLink }>>()
    for (const title of titles.values()) {
      for (const stream of title.streams ?? []) {
        const id = netflixKennung(stream.url)
        if (!id) continue
        const liste = jeAdresse.get(id) ?? []
        liste.push({ title, stream })
        jeAdresse.set(id, liste)
      }
    }

    let ohnePlatz = 0
    for (const [id, liste] of jeAdresse) {
      const staffeln = staffelStruktur[id]?.staffeln
      if (!staffeln?.length) continue
      const offen = liste.filter((e) => e.stream.dub !== true && e.stream.dub !== false)
      if (!offen.length) continue
      const sortiert = [...liste].sort((a, b) => jahrRang(a.title) - jahrRang(b.title) || a.title.id - b.title.id)
      const beurteilt = sortiert.filter((e) => e.stream.dub === true || e.stream.dub === false)

      let i = 0
      let fuellt = true
      for (const st of staffeln) {
        let summe = 0
        while (i < beurteilt.length && summe < (st.folgen ?? 0)) {
          const n = beurteilt[i]!.title.episodes ?? 0
          if (!n || summe + n > (st.folgen ?? 0)) break
          summe += n
          i++
        }
        if (summe !== (st.folgen ?? 0)) {
          fuellt = false
          break
        }
      }
      if (!fuellt || i !== beurteilt.length) continue

      for (const { title, stream } of offen) {
        title.streams = title.streams.filter((x) => x !== stream)
        ohnePlatz++
        verweiseEntfernt.push({
          titleId: title.id,
          titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
          plattform: stream.platform,
          url: stream.url,
          seriesId: null,
          grund:
            `der Anbieter führt ${staffeln.map((st) => st.folgen).join(' + ')} Folgen, und die belegten Titel ` +
            `füllen sie exakt — für ${title.episodes ?? '?'} weitere ist dort kein Platz`,
          geprueftAm: null,
          entferntAm: todayIso(),
          letzterWeg: title.streams.length === 0,
        })
      }
    }
    if (ohnePlatz) log(`${ohnePlatz} Netflix-Verweise entfernt: die Staffeln des Anbieters sind voll`)
  }

  if (verweiseEntfernt.length) {
    const ohneWeg = verweiseEntfernt.filter((e) => e.letzterWeg).length
    log(`${verweiseEntfernt.length} entfernte Verweise protokolliert (${ohneWeg} Titel zeigen danach keinen Weg mehr)`)
  }

  /**
   * Adressen vermerken, die mehrere unserer Einträge bedienen.
   *
   * Anlass (Daniel, 12.08.2026): Bei „The Café Terrace and Its Goddesses"
   * zeigten unsere Staffel 1 und Staffel 2 auf **dieselbe** Crunchyroll-Seite —
   * und dort steht das Ganze als *eine* Staffel mit 24 Folgen. Dasselbe bei
   * „The Case Study of Vanitas". Wer bei uns „Staffel 2" anklickt und dort 24
   * Folgen vorfindet, hält eine der beiden Angaben für falsch; tatsächlich
   * zählen bloß beide anders.
   *
   * Was hier belegt wird, ist genau das und nicht mehr: **wie viele unserer
   * Einträge dieselbe Adresse teilen.** Wie die Plattform ihrerseits in
   * Staffeln einteilt, wissen wir nicht — dafür müsste man die Serienseite
   * abrufen, die ihre Staffelliste per JavaScript nachlädt. Der Hinweis in der
   * Oberfläche sagt deshalb „kann abweichen", nicht „weicht ab".
   */
  const proAdresse = new Map<string, number>()
  for (const title of titles.values()) {
    for (const stream of title.streams) proAdresse.set(`${stream.platform}|${stream.url}`, (proAdresse.get(`${stream.platform}|${stream.url}`) ?? 0) + 1)
  }
  let geteilt = 0
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const anzahl = proAdresse.get(`${stream.platform}|${stream.url}`) ?? 1
      if (anzahl > 1) {
        stream.sharedWith = anzahl
        geteilt++
      }
    }
  }
  log(`${geteilt} Verweise teilen sich eine Adresse mit anderen Einträgen`)

  /**
   * „Season" kommt nicht auf die Seite — auch nicht über einen Release-Namen.
   *
   * Die Namen stammen aus dem Crunchyroll-Kalender und aus AniList und tragen
   * dort „Season 2", „2nd Season", „Final Season". Im Detail-Panel stand das
   * dann neben dem deutschen „Staffel 4" — dasselbe Wort zweimal, in zwei
   * Sprachen, in einem Blickfeld (Daniel, 12.08.2026).
   *
   * Umgestellt wird hier und nicht in der Oberfläche, weil dieselben Namen in
   * die ICS-Feeds und die Teilen-Seiten wandern. Ersetzt wird nur die
   * Staffelmarkierung; der übrige Titel ist ein Eigenname.
   *
   * **Vor** dem Ausrollen der Termine — die kopieren den Namen. Stand die
   * Umstellung dahinter, war sie in `releases.json` erledigt und in
   * `events.json` nicht, und der Kalender zeigte weiter „The 100 Girlfriends …
   * Season 3" (bemerkt bei der Sichtprüfung im Browser, 12.08.2026).
   */
  for (const release of releases) release.name = eindeutschenStaffel(release.name)

  /*
    **Was belegt erschienen ist, ist keine Schätzung mehr.** Eine Meldung mit Folgenbereich
    sagt, bis zu welcher Folge der Anbieter liefert, und ihr Prüftag, bis wann das stand.
    Genau das braucht `expandEvents()` — siehe `schedule.belegtBis`.
  */
  /*
    **Ein Crunchyroll-Verweis nennt seine deutschen Folgen, wo der Bestand sie kennt.**
    Black Clover stand als „155 von 170 Folgen auf Deutsch · Für die übrigen fehlt uns
    eine Angabe", weil nur Netflix Bereiche trug — Crunchyroll führt alle 170 deutsch
    (vier Blöcke, 1–170). Die Stichprobe vom 16.09.2026 fand dasselbe bei JoJo und My
    Hero Academia 4. Gesetzt wird nur bei einem Verweis, der genau einen Titel bedient,
    und nur bei eindeutiger Zählung (keine Nummer doppelt, keine über der Folgenzahl):
    gemessen 160 Verweise, 157 vollständig.
  */
  {
    const crDubNachUrl = new Map(crDub.serien.filter((s) => s.katalog === 'de').map((s) => [s.url, s]))
    let crBereiche = 0
    for (const title of titles.values()) {
      for (const s of title.streams) {
        if (s.platform !== 'crunchyroll' || s.dub !== true || s.dubRanges?.length || s.sharedWith) continue
        const serie = crDubNachUrl.get(s.url)
        if (deutscheFolgenNachDemEnde(serie?.staffeln ?? [], title.episodes)) continue
        const nummern = (serie?.staffeln ?? [])
          .flatMap((st) => (st.deutscheFolgen ?? []).map((f) => f.nummer))
          .filter((n): n is number => Number.isInteger(n) && (n as number) > 0)
        if (!nummern.length || !title.episodes) continue
        if (new Set(nummern).size !== nummern.length || Math.max(...nummern) > title.episodes) continue
        const sortiert = [...nummern].sort((a, b) => a - b)
        const bereiche: { from: number; to: number; dub: boolean }[] = []
        for (const n of sortiert) {
          const letzter = bereiche[bereiche.length - 1]
          if (letzter && letzter.to === n - 1) letzter.to = n
          else bereiche.push({ from: n, to: n, dub: true })
        }
        s.dubRanges = bereiche
        crBereiche++
      }
    }
    if (crBereiche) log(`${crBereiche} Crunchyroll-Verweise mit ihren deutschen Folgen aus dem Bestand`)
  }

  /*
    RTL+-Staffeln, die gerade wöchentlich wachsen (Beyblade X, 19.09.2026). Erst hier: Die
    Bedingung „Synchro am RTL+-Weg belegt" liest `dub`, und das steht erst nach den
    Handbelegen fest (der erste Bau fand deshalb nichts). Und so kann der Termin nicht
    selbst als Beleg in `dubByTitle` einfließen.
  */
  const ausRtl = rtlplusWochentermine(
    readJson<{ titel?: Record<string, { programm: string; folgen: RtlFolge[] }> }>('data/rtlplus-folgen.json', {}).titel ?? {},
    titles,
    releases,
    todayIso(),
  )
  releases.push(...ausRtl)
  if (ausRtl.length) log(`${ausRtl.length} RTL+-Wochentermine: ${ausRtl.map((r) => r.name).join(', ')}`)

  /* kinoheld-Adressen aus der Suche (`fetch-kinoheld.ts`) — der Kino-Banner verlinkt sie. */
  {
    const kinoheld = readJson<Record<string, string>>('data/kinoheld.json', {})
    for (const r of releases) {
      const adresse = kinoheld[r.slug]
      if (r.platform === 'kino' && adresse && !(r.sources ?? []).includes(adresse)) r.sources = [...(r.sources ?? []), adresse]
    }
  }

  let belegtBisGesetzt = 0
  for (const release of releases) {
    if (release.releaseType !== 'weekly') continue
    const title = titles.get(release.titleId)
    const stream = title?.streams.find((s) => s.platform === release.platform && s.dub === true)
    const bis = Math.max(0, ...(stream?.dubRanges ?? []).filter((r) => r.dub).map((r) => r.to))
    if (!title || !stream || !bis) continue
    const am = belegFuer(title.id, stream.platform, stream.url)?.checkedAt?.slice(0, 10)
    if (!am) continue
    release.schedule.belegtBis = { folge: bis, am }
    belegtBisGesetzt++
  }
  if (belegtBisGesetzt) log(`${belegtBisGesetzt} Wochenserien mit belegt erschienenen Folgen — dort keine Schätzung mehr`)
  return { zugangJeAdresse, linkBefunde, crAdresseZu, beantworteteSuchen, suchOffen, alleChecks, lautPruefungTot, checksJePlattform, motnBelege, kanalJeAdresse }
}
