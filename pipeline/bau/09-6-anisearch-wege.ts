import { type PlatformId, type Title } from '../../shared/types.ts'
import { dubKey, type DubCheck } from '../lib/dub-confirmed.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { NEIN_GILT_TAGE, type EntfernterVerweis } from './grundlagen.ts'
import { readJson, log } from '../lib/util.ts'
import { netflixTitelAdresse } from '../lib/netflix-adresse.ts'
import { providerName } from '../../shared/mappings.ts'
import { kapitelImBlock, beurteile, type CrDubData } from '../lib/crunchyroll-dub.ts'
import { beurteileAdnVerweis } from '../lib/adn-sprachen.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import type { AdnArchiv } from '../lib/adn-sprachen.ts'

export function ergaenzeAnisearchWege({ verweiseEntfernt, crDub, usNeinWiderlegt, titles, anisearch, belegFuer, linkBefunde, lautPruefungTot, crAdresseZu, crKatalogDeutsch, checks, adnArchiv, adnStreamSchaerfen }: {
  verweiseEntfernt: EntfernterVerweis[]
  crDub: CrDubData
  usNeinWiderlegt: (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null; }) => boolean
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  lautPruefungTot: (url: string) => boolean
  crAdresseZu: (name: string) => string | undefined
  crKatalogDeutsch: Set<string>
  checks: Map<string, DubCheck>
  adnArchiv: AdnArchiv
  adnStreamSchaerfen: (titleId: number, stream: { platform: string; url: string; }) => boolean
}) {
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
}
