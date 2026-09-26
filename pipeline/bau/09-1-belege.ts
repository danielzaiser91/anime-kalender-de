import { type PlatformId, type StreamLink, type Release, type Title } from '../../shared/types.ts'
import { crunchyrollSeriesId, type CrunchyrollEntry } from '../lib/crunchyroll.ts'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, warn, log, readJson } from '../lib/util.ts'
import yaml from 'js-yaml'
import { type Zugangsart } from '../../shared/zugangsart.ts'
import { adressKern, adressGleich, loadDubChecks, type DubCheck, dubKey } from '../lib/dub-confirmed.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { kanalAusNotiz } from '../lib/amazon-adresse.ts'
import { crNamensindexAusDatei, crAdresseZu as crAdresseNachName } from '../lib/cr-katalog-adresse.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'
import type { CrDubData } from '../lib/crunchyroll-dub.ts'

export function sammleBelege({
  releases,
  titles,
  crBySeriesId,
  tmdbMehrdeutig,
  tmdbTitles,
  tvJeTmdb,
  toteAdressen,
  crDub,
}: {
  releases: Release[]
  titles: Map<number, Title>
  crBySeriesId: Map<string, CrunchyrollEntry>
  tmdbMehrdeutig: Set<string>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  tvJeTmdb: Set<string>
  toteAdressen: Set<string>
  crDub: CrDubData
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
    /* `crDub` lädt `pruefeSynchroJePlattform` vor dieser Phase. */
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
  return {
    ytKanal,
    ytKauf,
    checksJePlattform,
    youtubeBefunde,
    belegFuer,
    vonHandBelegtAm,
    checks,
    alleChecks,
    zugangJeAdresse,
    joynZugang,
    usNeinWiderlegt,
    crAdresseZu,
    crKatalogDeutsch,
    beantworteteSuchen,
    suchOffen,
    kanalJeAdresse,
  }
}
