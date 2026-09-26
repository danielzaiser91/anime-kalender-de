import { writeText, writeJson, readJson, log, warn } from '../lib/util.ts'
import { plattformAusAdresse } from '../../shared/adresse-passt.ts'
import { type CartoonEintrag, alsTitel, plattformVon } from '../lib/cartoons.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { type PlatformId, type Title, type Release, type Quelle } from '../../shared/types.ts'
import { OUT, kinoFeld, mitAnkuendigung } from './grundlagen.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { englischAusSynonymen } from '../lib/anisearch-titel.ts'
import { ANILIST_COVER_BASIS } from '../../shared/mappings.ts'
import { todayIso, addDays } from '../../shared/time.ts'
import { quellenName, quellenZusammenfuehren, type Vorschlag, meldungenAus } from '../lib/meldungen.ts'
import { deutschAusSynonymen, reihenFuerKatalog } from './titel-hilfen.ts'

/**
 * Schreibt die Anime **ohne** belegte deutsche Synchro als eigene Datei.
 *
 * Warum eine eigene Datei und nicht `titles.json`: Es sind rund zehnmal so
 * viele wie im gepflegten Bestand, und die überwältigende Mehrheit der Besucher
 * braucht sie nie. Sie in die Hauptdatei zu legen hieße, jedem Aufruf ein
 * Vielfaches an Ladelast aufzubürden für eine Liste, die nur sieht, wer den
 * Schalter in der Datenbank ausdrücklich umlegt (ARCHITEKTUR.md: „Ein neues
 * Feld gehört nur dann in `titles.json`, wenn es die Mehrheit der Besucher
 * braucht").
 *
 * Was schon im gepflegten Bestand steht, fällt hier heraus — sonst stünde ein
 * Titel zweimal in der Liste, einmal mit und einmal ohne Synchro.
 *
 * `bekannt` bildet die Kennung eines gepflegten Titels auf seine `franchiseId`
 * ab. Beides wird gebraucht: die Kennung zum Aussortieren, die Reihe zum
 * Zusammenführen — siehe `reihenFuerKatalog`.
 */
/**
 * **Was der Katalog nicht auflösen konnte, geht an Daniel.**
 *
 * Eine Suchadresse verschwindet ersatzlos von der Seite (siehe die Regel im
 * Bau) — und damit auch die Auskunft, dass es den Titel dort überhaupt gibt.
 * Ohne diese Liste wäre sie weg; mit ihr ist sie eine Frage mit Adresse.
 *
 * Bei Prime kann sie niemand anders beantworten: Amazons robots.txt sperrt 19
 * Bots namentlich und den Pfad der Folgenliste ausdrücklich, und die acht
 * Adressen, die aniSearch dazu kennt, stehen im Link-Check auf „unklar" —
 * Amazons Abwehr hat am 09.09.2026 zugemacht. Was hinter einem Produktpfad
 * liegt, kann eine DVD sein; das entscheidet ein Blick, kein Abruf.
 */
export function schreibeSuchadressen(offen: { id: number; titel: string; plattform: string; url: string }[]): void {
  const ziel = 'daniel-zum-abarbeiten/18-suchadressen.md'
  const stand = new Date().toISOString().slice(0, 10)
  if (!offen.length) {
    writeText(ziel, [`# Suchadressen`, '', `_Stand ${stand}_`, '', 'Nichts offen — jeder Verweis führt auf eine Titelseite.', ''].join('\n'))
    /*
      **Auch „nichts offen" wird geschrieben.** Hier stand nur `return`, und
      `data/suchadressen-offen.json` behielt die letzten sechs Einträge — alle
      am 13.09.2026 geklärt, und die Statusanzeige zeigte weiter „Suchadressen 6"
      (Daniel, 14.09.2026: „wieso passen pills nicht zum echten status?").
    */
    writeJson('data/suchadressen-offen.json', [])
    return
  }
  const anisearch = readJson<Record<string, { streams?: { provider?: string; url?: string }[] }>>(
    'data/anisearch.json',
    {},
  )
  const t = ``
  const zeilen: string[] = [
    '# Suchadressen — welcher Titel steckt dahinter?',
    '',
    `_Stand ${stand} · ${offen.length} offen_`,
    '',
    'Diese Verweise führten auf eine **Suche** statt auf eine Titelseite und sind',
    'deshalb von der Seite verschwunden. Was hier steht, ist die Frage danach, wo',
    'der Titel beim Anbieter wirklich liegt.',
    '',
    `**So antwortest du:** Adresse der Titelseite hinter den Eintrag schreiben — oder ${t}x${t}, wenn es den Titel dort nicht gibt.`,
    `Bei Prime zählt nur eine Video-Adresse (${t}/gp/video/detail/…${t} oder ${t}primevideo.com/detail/…${t});`,
    `hinter einem ${t}/dp/${t} kann eine DVD liegen.`,
    '',
  ]
  for (const e of offen.sort((a, b) => a.plattform.localeCompare(b.plattform) || a.titel.localeCompare(b.titel))) {
    zeilen.push(`## ${e.titel}`, '')
    zeilen.push(`- Anbieter: **${e.plattform}** · unser Titel ${t}${e.id}${t}`)
    zeilen.push(`- war verlinkt als: <${e.url}>`)
    const kandidaten = (anisearch[e.id]?.streams ?? [])
      .map((q) => q.url)
      .filter((u): u is string => Boolean(u))
      /* Nur Kandidaten desselben Anbieters — ein Netflix-Link beantwortet keine Prime-Frage. */
      .filter((u) => (plattformAusAdresse(u) ?? '') === e.plattform)
    for (const k of kandidaten) zeilen.push(`- aniSearch nennt: <${k}> — passt das?`)
    zeilen.push('- **Antwort:** ', '')
  }
  writeText(ziel, zeilen.join('\n') + '\n')
  /*
    **Dieselbe Liste noch einmal als Datei, die ein Werkzeug lesen kann.**

    Die Markdown-Fassung ist für Daniel, diese für `tools/pruefstand.mjs`: Ohne
    sie hat die Statusanzeige für diese Aufgabe keine Pille, und dann steht dort
    weniger Arbeit, als die Prüfliste führt (Daniel, 10.09.2026: „im todo stehen
    viel mehr meldungen etc die ich machen muss als im status app als pill
    stehen"). Eine Anzeige, die nur einen Teil der Arbeit zeigt, beantwortet die
    Frage nicht, für die es sie gibt.
  */
  writeJson('data/suchadressen-offen.json', offen)
  log(`${offen.length} Suchadressen in ${ziel} vorgelegt`)
}

/**
 * **Westliche Animationsserien nach `public/data/cartoons.json`.**
 *
 * Geholt von `fetch-cartoons.ts` aus TMDB, hier nur umgeformt: Aus einem
 * TMDB-Eintrag wird ein `Title` wie jeder andere, damit Kalender, Datenbank
 * und Detail-Panel ihn ohne Sonderfall anzeigen.
 *
 * **Fehlt die Quelldatei, bleibt die alte Fassung stehen** — dieselbe Regel
 * wie beim AniList-Katalog: Ein Lauf ohne warmen Stand soll die Titel nicht
 * von der Seite nehmen.
 */
export function schreibeCartoons(): void {
  const roh = readJson<Record<string, CartoonEintrag>>('data/cartoons.json', {})
  const eintraege = Object.values(roh)
  if (!eintraege.length) {
    warn('Keine data/cartoons.json — cartoons.json bleibt auf dem letzten Stand. Holen mit "npm run data:cartoons".')
    return
  }
  const titel = eintraege
    .map(alsTitel)
    .sort((a, b) => (b.jpYear ?? 0) - (a.jpYear ?? 0) || a.id - b.id)
  /*
    **Handbelege gelten auch hier** (16.09.2026, The Mighty Nein: Daniel fand bei
    Prime alle acht Folgen auf Deutsch). TMDB nennt nur den Dienst; ein Beleg mit
    negativer Kennung trägt Adresse und Sprache nach oder nimmt den Weg heraus.
  */
  /*
    **Die Adresse beim Anbieter kommt von JustWatch** — nur als Wegweiser, die
    Tonspur-Angabe bleibt unbenutzt (CLAUDE.md, JustWatch gilt der Serie).
    Abonnement vor Kauf, wenn beide dasselbe Ziel haben.
  */
  const jw = readJson<Record<string, { angebote?: { anbieter?: string; art?: string; url?: string }[] }>>(
    'data/justwatch-audio.json',
    {},
  )
  let jwAdressen = 0
  for (const t of titel) {
    const angebote = [...(jw[String(t.id)]?.angebote ?? [])].sort(
      (a, b) => Number(b.art === 'FLATRATE') - Number(a.art === 'FLATRATE'),
    )
    for (const s of t.streams) {
      if (s.url) continue
      const a = angebote.find((x) => x.url && plattformVon(x.anbieter ?? '') === s.platform)
      if (a?.url) {
        s.url = a.url
        jwAdressen++
      }
    }
  }
  if (jwAdressen) log(`${jwAdressen} Cartoon-Verweise mit Adresse von JustWatch`)
  const belege = loadDubChecks().filter((b) => b.anilistId < 0)
  const nachId = new Map(titel.map((t) => [t.id, t]))
  let belegt = 0
  for (const b of belege) {
    const t = nachId.get(b.anilistId)
    if (!t) continue
    if (b.available === false || b.dub === false) {
      t.streams = t.streams.filter((s) => s.platform !== b.platform)
      continue
    }
    if (b.dub !== true && !b.url) continue
    let s = t.streams.find((x) => x.platform === b.platform)
    if (!s) {
      s = { platform: b.platform as PlatformId, url: '' }
      t.streams.push(s)
    }
    if (b.url) s.url = b.url
    if (b.dub === true) {
      s.dub = true
      if (b.dubRanges?.length) s.dubRanges = b.dubRanges
      belegt++
    }
  }
  if (belegt) log(`${belegt} Cartoon-Verweise mit Handbeleg`)
  writeJson(`${OUT}/cartoons.json`, titel)
  log(`${titel.length} westliche Animationsserien geschrieben`)
}

export function schreibeOhneSynchro(
  bekannt: Map<number, number>,
  verschoben: Title[] = [],
  deutscheReihe: Map<number, string> = new Map(),
): void {
  const katalog = readJson<{ eintraege?: KatalogEintrag[] }>('data/cache/anilist-katalog.json', {})
  const eintraege = katalog.eintraege ?? []
  if (!eintraege.length) {
    /**
     * Kein Katalog — dann bleibt die zuletzt gebaute Datei **stehen**.
     *
     * Das ist Absicht und nicht bloß Bequemlichkeit: `data/cache/` liegt nicht
     * im Repo, ein CI-Lauf ohne warmen Cache hätte den Katalog also nicht. Eine
     * leere Datei zu schreiben hieße, die 15.000 Titel bei jedem solchen Lauf
     * von der Seite verschwinden zu lassen — und mit ihnen die Möglichkeit,
     * einen davon zu merken.
     */
    warn(
      'Kein AniList-Katalog im Cache — ohne-synchro.json bleibt auf dem letzten Stand. ' +
        'Frisch holen mit "npm run data:katalog".',
    )
    return
  }

  const reihe = reihenFuerKatalog(eintraege, bekannt)

  /**
   * Drei Pflichtfelder von `Title` fehlen hier absichtlich: `slug`, `keywords`
   * und `streams`. Sie wären für jeden dieser Titel leer beziehungsweise ohne
   * Verwendung — es gibt zu ihnen keine Teilen-Seite, keine gepflegten
   * Schlagwörter und keinen Anbieter. Ausgeschrieben kosteten die leeren Werte
   * bei achtzehntausend Titeln rund 900 KB. `loadOhneSynchro` setzt sie beim
   * Laden, sodass der Rest der Anwendung sie wie gewohnt vorfindet.
   */
  /**
   * **Deutsche Titel kommen von aniSearch, nicht von AniList.**
   *
   * AniList führt keine. „Ein Landei aus dem Dorf vor dem letzten Dungeon sucht
   * das Abenteuer in der Stadt" stand deshalb nur unter seinem englischen Namen
   * hier, und Daniel fand ihn am 31.08.2026 nicht — obwohl Prime ihn genau so
   * anzeigt. Sein Urteil: „anilist ist müll, die bessere quelle ist anisearch."
   *
   * `pipeline/fetch-anisearch-titel.ts` holt sie über die Kennung aus
   * `data/anime-ids.json`; die Begründung für aniSearch statt TMDB steht dort
   * und in `status.md`.
   */
  /*
    **`quelle` entscheidet, ob der Name als deutscher gelten darf.**

    Die `<h1>` einer aniSearch-Seite trägt keine Sprachkennzeichnung. Bei einem
    Titel mit deutscher Veröffentlichung steht dort meistens der deutsche Name
    — deshalb hat das lange getragen. Bei einem ohne steht dort der japanische,
    und dann behauptet `titleDe` etwas Falsches: „Tensei Kizoku, Kantei Skill de
    Nariagaru Dai 3 Ki" stand so im Katalog, während aniSearch unter „Synonyme"
    „…: Staffel 3" führt (Daniel, 08.09.2026).

    `ueberschrift` heißt deshalb: Name unbekannter Sprache. Er wird nicht zu
    `titleDe` — `titleRomaji` sagt ohnehin dasselbe, und die Oberfläche fällt
    von selbst darauf zurück.

    **Ein Eintrag ohne `quelle` behält sein `titleDe`.** Er stammt aus einem
    Lauf vor dem 08.09.2026, seine Sprache ist weder belegt noch widerlegt, und
    ein Lauf löscht keine Metadaten. Fällig ist er trotzdem: `faellig()` in
    `fetch-anisearch-titel.ts` holt ihn erneut, und danach entscheidet die
    Herkunft.
  */
  const ausAnisearch = readJson<
    Record<
      string,
      { titel?: string; quelle?: string; anisearchId?: number; englisch?: string; synonyme?: string[] }
    >
  >('data/anisearch-titel.json', {})
  const ohne = eintraege
    .filter((e) => !bekannt.has(e.id))
    .map((e) => {
      const [romaji, englisch, japanisch] = e.t
      const eintrag = ausAnisearch[String(e.id)]
      /*
        **Belegt heißt: aus dem Sprachblock oder den Synonymen.** Ein Eintrag
        ohne `quelle` stammt aus einem Lauf vor dem 08.09.2026 und galt bis zum
        12.09.2026 als deutsch — 1.001 Katalogtitel trugen so einen Namen, den
        niemand als deutsch belegt hatte, davon 335 zu chinesischen Originalen.
        Auf der Seite stand deshalb „Guimi Zhi Zhu: Tebie Pian - Liewu", während
        der englische Titel „Lord of Mysteries Specials" danebenlag (Daniel,
        12.09.2026: „why 2 of these titles have chinese titles").

        Sie fallen jetzt auf Englisch zurück, bis `fetch-anisearch-titel.ts` sie
        erneut geholt und ihre Herkunft vermerkt hat.
      */
      const belegt = eintrag?.quelle === 'sprachblock' || eintrag?.quelle === 'synonym'
      /*
        **Und wo aniSearch schweigt, fragt der Bau die Reihe.** Für den
        Apothekerin-Film kennt aniSearch keinen deutschen Namen; AniList führt
        ihn unter `synonyms`, und der belegte Reihenname macht ihn erkennbar.
      */
      /*
        **Zwei Synonymlisten, dieselbe Regel.**

        AniList führt für den Apothekerin-Film genau ein Synonym, und das ist
        englisch („The Apothecary Diaries Movie"). aniSearch führt den deutschen
        Namen — aber nicht im Sprachblock, sondern unter den Synonymen, wo er
        zwischen der französischen und der spanischen Fassung steht.

        Gefragt werden deshalb beide Listen, aniSearch zuerst: Sie ist die
        Quelle, die deutsche Titel überhaupt kennt.
      */
      const reihenName = deutscheReihe.get(reihe.get(e.id) ?? e.id)
      const deutsch =
        (belegt ? eintrag?.titel : undefined) ??
        deutschAusSynonymen(eintrag?.synonyme, reihenName) ??
        deutschAusSynonymen(e.synonyme, reihenName)
      return {
        id: e.id,
        titleRomaji: romaji ?? undefined,
        /*
          AniList führt bei chinesischen Produktionen oft keinen englischen
          Namen. Zwei Aushilfen, in dieser Reihenfolge: aniSearchs Sprachblock
          „Englisch", und AniLists eigene Synonymliste (`latein`) — dort steht
          für „Guimi Zhi Zhu: Wu Mian Ren Pian" ein „Lord of the Mysteries 2".
        */
        titleEn: englisch ?? eintrag?.englisch ?? englischAusSynonymen(eintrag?.synonyme) ?? e.latein ?? undefined,
        /* Nur, wenn er wirklich etwas Neues sagt — sonst steht dieselbe Zeichenkette zweimal. */
        titleDe: deutsch && deutsch !== englisch && deutsch !== romaji ? deutsch : undefined,
        /*
          **Die Kennung geht mit — sonst nennt die Seite eine Quelle, zu der sie
          nicht führt.**

          Sie steht in derselben Datei wie der Titel und blieb trotzdem liegen:
          Im Detail-Panel stand „aniSearch — deutscher Titel, Beschreibung" ohne
          Verweis, und Daniel fragte zu Recht „warum ist anisearch nicht
          anklickbar?" (03.09.2026). Gemessen: Titel 186148 trägt dort
          `anisearchId: 20083`.

          Das ist derselbe Fehlgriff wie am 28.08.2026 beim Feld `titelId` — ein
          Wert wird geholt, abgelegt und am Ziel nicht ausgepackt. Der Einbau
          endet am Empfänger, nicht am Sender.
        */
        anisearchId: eintrag?.anisearchId,
        titleNative: japanisch ?? undefined,
        format: e.format ?? undefined,
        episodes: e.folgen ?? undefined,
        jpYear: e.jahr ?? undefined,
        /* Der Termin, soweit AniList ihn kennt — bei Ankündigungen das Einzige, was dasteht. */
        jpStart: e.start ?? undefined,
        jpStatus: e.status ?? undefined,
        genres: e.genres,
        /**
         * **Ohne** Adressvorsatz — der wird erst im Browser angehängt. Bei
         * achtzehntausend Titeln spart das über ein Megabyte an Ladelast.
         *
         * Gekürzt wird hier und nicht beim Abrufen, obwohl es dort naheläge:
         * Der Zwischenspeicher überdauert viele Läufe, und Einträge aus einem
         * früheren Lauf tragen noch die volle Adresse. Beim Bauen greift die
         * Kürzung dagegen auf jeden Eintrag, auch auf alte. Passt der Vorsatz
         * nicht (AniList liefert gelegentlich einen anderen Hostnamen), bleibt
         * die Adresse unangetastet — der Browser erkennt das am `http`.
         */
        coverImage: e.cover?.startsWith(ANILIST_COVER_BASIS)
          ? e.cover.slice(ANILIST_COVER_BASIS.length)
          : (e.cover ?? undefined),
        score: e.score ?? undefined,
        /**
         * Fehlt, wenn der Titel allein steht — dann greift in der Oberfläche
         * ohnehin der Rückfall auf die eigene Kennung, und die Zahl wäre
         * fünfzehntausendmal umsonst übertragen.
         */
        franchiseId: reihe.get(e.id) === e.id ? undefined : reihe.get(e.id),
        /**
         * `low` ist hier keine schwache Angabe, sondern die einzig ehrliche:
         * Es gibt nichts zu belegen. Das Feld ist Pflicht, weil dieselbe
         * Oberfläche beide Sorten anzeigt.
         */
        dubConfidence: 'low' as const,
        ohneSynchro: true,
        ...(e.land ? { land: e.land } : {}),
        ...kinoFeld(e.id),
      }
    })

  /**
   * Wer aus dem Hauptbestand verschoben wurde, muss hier ankommen — auch wenn
   * der Katalog ihn nicht führt.
   *
   * Bis zum 17.08.2026 verließ sich der Vorfilter darauf, dass ein verschobener
   * Titel über den AniList-Katalog von selbst wieder auftaucht. Bei acht von
   * neun stimmte das. Der neunte, „Xiao Mao Diao Yu" (215520), stand in keinem
   * der beiden Bestände und war damit über keinen Weg mehr erreichbar — auch
   * nicht mit eingeschaltetem Toggle.
   *
   * Ein Titel, den man nirgends findet, ist stillschweigend gestrichen, und das
   * verbietet der Projektgrundsatz: Gestrichen wird nur, was eine Quelle aktiv
   * widerlegt. Ein fehlender Katalogeintrag widerlegt nichts.
   */
  const vorhanden = new Set(ohne.map((t) => t.id))
  const nachgetragen = verschoben.filter((t) => !vorhanden.has(t.id))
  const alle = [...ohne, ...nachgetragen.map((t) => ({ ...t, dubConfidence: 'low' as const, ohneSynchro: true, ...kinoFeld(t.id) }))]

  writeJson(`${OUT}/ohne-synchro.json`, alle.map(mitAnkuendigung))
  log(
    `Ohne deutsche Synchro: ${alle.length} Titel (aus ${eintraege.length} im AniList-Katalog` +
      (nachgetragen.length ? `, ${nachgetragen.length} aus dem Hauptbestand nachgetragen)` : ')'),
  )
}

/** Wo die Quellen jedes Termins über Läufe hinweg aufbewahrt werden. */
const QUELLEN_HISTORIE = 'data/quellen-historie.json'

/**
 * Gibt jedem Termin seine Quellen — und **behält die überholten**.
 *
 * Die Regel stammt von Wikipedia (`Wikipedia:Link rot`): „Do not delete cited
 * information solely because the URL to the source does not work." Übertragen
 * auf Termine heißt das: Wird ein Termin verschoben, verschwindet die Quelle
 * des alten Termins nicht. Sonst lässt sich die Frage „woher kam eigentlich der
 * 20.08.?" später nicht mehr beantworten — und genau die stellt sich, sobald
 * zwei Quellen sich widersprechen. Beim Inazuma-Fall am 13.08.2026 kostete
 * genau diese fehlende Spur einen halben Tag Nachrecherche.
 *
 * Deshalb liegt neben dem Datensatz eine Historie: Jede Adresse, die je zu
 * einem Termin geführt hat, bleibt dort stehen. Nennt sie inzwischen einen
 * anderen Tag als der geltende Termin, wird sie als überholt **markiert**, aber
 * weiter ausgeliefert.
 */
export function quellenPflegen(releases: Release[]): void {
  const historie = readJson<Record<string, Quelle[]>>(QUELLEN_HISTORIE, {})
  const heute = todayIso()

  for (const release of releases) {
    const termin = release.schedule.firstEpisodeDate
    /**
     * Kuratierte Termine tragen nur nackte Adressen in `sources`. Daraus wird
     * hier eine vollwertige Herkunftsangabe — sonst hätten ausgerechnet die von
     * Hand geprüften Termine die schlechtere Belegkette als die automatischen.
     */
    const neu: Quelle[] =
      release.quellen ??
      release.sources.map((url) => ({
        url,
        name: quellenName(url),
        gesehenAm: heute,
        sagt: termin,
        stand: 'aktuell' as const,
      }))

    const aktuelleAdressen = new Set(neu.map((q) => q.url))
    const alt = (historie[release.slug] ?? []).map((q) => {
      if (aktuelleAdressen.has(q.url)) return q
      /**
       * Die Quelle steht nicht mehr hinter dem geltenden Termin. Ob sie
       * *widerlegt* ist, wissen wir nur, wenn sie selbst einen Tag genannt hat
       * — sonst bleibt es bei „vermutlich", und das steht dann auch so da.
       */
      return q.sagt && q.sagt !== termin
        ? {
            ...q,
            stand: 'ueberholt' as const,
            // Daniels Formulierung (15.08.2026). Sie sagt, was passiert ist,
            // statt zwei Daten nebeneinanderzustellen und den Leser vergleichen
            // zu lassen.
            grund: `Termin verschoben auf: ${termin}`,
          }
        : { ...q, stand: 'vermutlich-ueberholt' as const }
    })

    const zusammen = quellenZusammenfuehren(alt, neu)
    historie[release.slug] = zusammen
    release.quellen = zusammen
  }

  writeJson(QUELLEN_HISTORIE, historie, true)
  const ueberholt = Object.values(historie)
    .flat()
    .filter((q) => q.stand !== 'aktuell').length
  log(`Quellenhistorie: ${Object.keys(historie).length} Termine, davon ${ueberholt} überholte Belege`)
}

/**
 * Veröffentlicht die Fundstellen der Nachrichtenquellen als **Meldungen**.
 *
 * Bis zum 14.08.2026 endete jeder Scraper-Lauf in `data/proposals/` und wartete
 * auf einen Menschen. Von 29 Funden nannte **keiner** einen Tag, 27 nur einen
 * Monat — auf eine Handübertragung zu warten hieß also, dauerhaft zu warten.
 * Seitdem erscheint die Fundstelle selbst auf der Seite: mit Zitat, mit Quelle,
 * und mit der Ansage, dass wir den Termin nicht auslesen konnten.
 *
 * Titel **ohne** Synchro werden mit einbezogen, denn gerade dort ist eine
 * Meldung die einzige Information, die es überhaupt gibt.
 */
export function schreibeMeldungen(slim: Title[]): void {
  const roh = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {})
  const vorschlaege = roh.proposals ?? []
  if (!vorschlaege.length) {
    warn('Keine Vorschläge in data/proposals/anime2you.json — meldungen.json bleibt leer.')
    writeJson(`${OUT}/meldungen.json`, [])
    return
  }

  const ohne = readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])
  const meldungen = meldungenAus(vorschlaege, [...slim, ...ohne], todayIso())
  writeJson(`${OUT}/meldungen.json`, meldungen)
  log(`${meldungen.length} Meldungen aus ${vorschlaege.length} Vorschlägen zugeordnet`)
}

/**
 * Führt Buch darüber, seit wann ein Titel eine belegte deutsche Synchro hat —
 * und meldet die Neuzugänge.
 *
 * Ohne dieses Gedächtnis kann niemand sagen, dass ein Titel **neu** dazukam:
 * Der gebaute Datensatz beschreibt immer nur den Jetzt-Zustand. `data/
 * synchro-historie.json` hält deshalb je Titel den Tag fest, an dem er zum
 * ersten Mal im Bestand auftauchte. Die Datei gehört ins Repo — geht sie
 * verloren, gelten beim nächsten Lauf alle 2.700 Titel als neu, und jeder
 * Abonnent bekommt eine Mail über Serien, die er längst kennt.
 *
 * Genau diese Angabe trägt das Feature, um das Daniel gebeten hat (13.08.2026):
 * Wer einen Titel ohne Synchro merkt, will erfahren, **sobald** es eine gibt —
 * nicht erst, wenn ein Termin im Wochenfenster des Newsletters liegt. Eine
 * Ankündigung ohne Datum wäre sonst nie eine Mail wert, und gerade sie ist die
 * Nachricht, auf die jemand monatelang wartet.
 */
export function schreibeNeuMitSynchro(titles: Title[], releases: Release[]): void {
  const HISTORIE = 'data/synchro-historie.json'
  /** Wie lange ein Zugang als „neu" gilt. */
  const FENSTER_TAGE = 60

  /**
   * `angelegtAm` ist keine Zierde, sondern die Sperre gegen eine Massenmail.
   *
   * Ohne sie war der Fehler unmittelbar da (gemessen 13.08.2026): Der erste
   * Lauf schreibt für **alle** 2.753 Titel das heutige Datum. Der zweite Lauf
   * sieht 2.753 Einträge, die jünger als 60 Tage sind, und hält jeden einzelnen
   * für einen Neuzugang — jeder Abonnent bekäme eine Mail über Serien, die er
   * längst kennt. Der Vergleich mit `angelegtAm` nimmt genau diesen
   * Ausgangsstand dauerhaft aus der Meldung heraus.
   *
   * Ein Titel, der zufällig am selben Tag wirklich neu dazukommt, fällt damit
   * einmalig unter den Tisch. Das ist der richtige Tausch: eine verpasste
   * Meldung gegen tausende falsche.
   */
  interface Historie {
    angelegtAm: string
    seit: Record<string, string>
  }

  const heute = todayIso()
  const historie = readJson<Historie>(HISTORIE, { angelegtAm: heute, seit: {} })
  const erstlauf = Object.keys(historie.seit).length === 0

  for (const t of titles) {
    if (!historie.seit[t.id]) historie.seit[t.id] = heute
  }
  writeJson(HISTORIE, historie, true)

  if (erstlauf) {
    log(`Synchro-Historie angelegt: ${titles.length} Titel als Ausgangsstand, keine Neuzugänge gemeldet`)
    writeJson(`${OUT}/neu-mit-synchro.json`, [])
    return
  }

  const ersterTermin = new Map<number, string>()
  for (const r of releases) {
    const bisher = ersterTermin.get(r.titleId)
    if (!bisher || r.schedule.firstEpisodeDate < bisher) ersterTermin.set(r.titleId, r.schedule.firstEpisodeDate)
  }

  const grenze = addDays(heute, -FENSTER_TAGE)
  /*
    **„Neu im Bestand" ist nicht „neu auf Deutsch".**

    Der Hauptbestand führt jeden Titel, für den MyDubList eine deutsche Synchro
    kennt — auch angekündigte und vermutete. Diese Datei behauptet dagegen
    etwas Stärkeres: Sie speist die Nachrichtenseite („Neu auf Deutsch") und
    den Newsletter, und beide sagen dem Leser, dass es die Fassung **jetzt**
    gibt.

    Am 12.09.2026 stand „Gals Can't Be Kind to Otaku!? — Neu auf Deutsch" auf
    der Seite, während das Panel daneben „Noch keine deutsche Fassung" zeigte;
    Daniel hat bei Crunchyroll nachgesehen: keine deutsche Folge. Gemessen
    waren **6 von 20** Einträgen in dieser Lage — sie wären genauso an die
    Abonnenten gegangen.

    Belegt heißt hier dasselbe wie im Detail-Panel: ein Verweis mit `dub: true`,
    belegte Sprechrollen, oder ein deutscher Termin. Ein Titel ohne all das ist
    ein Neuzugang **des Bestands**, und darüber gibt es nichts zu melden.
  */
  const belegteSynchro = (t: Title): boolean =>
    (t.streams ?? []).some((s) => s.dub === true) ||
    Boolean((t as { hasVoices?: boolean }).hasVoices) ||
    ersterTermin.has(t.id)
  const neu = titles
    .filter((t) => {
      const seit = historie.seit[t.id]
      // Der Ausgangsstand ist kein Neuzugang, egal wie jung sein Datum ist.
      return seit >= grenze && seit !== historie.angelegtAm && belegteSynchro(t)
    })
    .map((t) => ({
      id: t.id,
      name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
      slug: t.slug,
      /** Tag, an dem der Titel erstmals mit belegter Synchro im Bestand stand. */
      seit: historie.seit[t.id],
      /** Erster bekannter deutscher Termin, falls es schon einen gibt. */
      termin: ersterTermin.get(t.id),
      /**
       * **Zu welcher Reihe der Titel gehoert.**

       * Daniel am 28.08.2026: „mach ausserdem, dass wenn man den haupttitel
       * eines anime oder die letzte staffel eines anime als favorit markiert
       * auch informiert wird wenn eine neue staffel/film oder sonstiges neues
       * zu diesem haupttitel erscheint … ich will informiert werden weil ich
       * es sonst evtl verpasse."
       *
       * Der Worker kann daraus die Frage beantworten, ohne den ganzen Bestand
       * zu laden: Liegt einer meiner gemerkten Titel in derselben Reihe?
       */
      franchiseId: t.franchiseId,
      /**
       * Das japanische Erstausstrahlungsjahr — gegen Meldungen ueber Altes.
       *
       * Wird eine OVA von 2005 erstmals erfasst, ist sie fuer den Bestand neu,
       * aber keine Ankuendigung. Der Worker vergleicht sie mit dem Jahr des
       * gemerkten Titels und schweigt ueber alles Aeltere.
       */
      jahr: t.jpYear ?? null,
    }))
    .sort((a, b) => b.seit.localeCompare(a.seit))

  writeJson(`${OUT}/neu-mit-synchro.json`, neu)

  /**
   * **Welcher Titel zu welcher Reihe gehoert — schlank, fuer den Worker.**
   *
   * Der Hinweis auf Neues aus gemerkten Reihen braucht zu jedem gemerkten
   * Titel seine Reihe. In `titles.json` steht sie, aber die Datei ist 2,6 MB
   * gross und wird vom Worker bei jedem Versandlauf geladen — das waere
   * dieselbe Sorte Verschwendung, die dieses Projekt an anderer Stelle
   * vermeidet.
   *
   * Hier stehen nur zwei Zahlen je Titel. Bei 2.763 Titeln sind das rund
   * 40 KB, und die Datei aendert sich nur, wenn ein Titel dazukommt.
   */
  const reihen: Record<string, { f: number; j: number | null }> = {}
  for (const t of titles) {
    if (t.franchiseId) reihen[t.id] = { f: t.franchiseId, j: t.jpYear ?? null }
  }
  writeJson(`${OUT}/reihen.json`, reihen)
  log(`Reihen-Zuordnung: ${Object.keys(reihen).length} Titel`)
  log(`Neu mit deutscher Synchro (${FENSTER_TAGE} Tage): ${neu.length} Titel`)
}
