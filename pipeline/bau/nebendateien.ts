import { writeJson, readJson, log, warn } from '../lib/util.ts'
import { namensIndex } from './ohne-synchro-namen.ts'
import { STAND_ZEILE, writeTextStand } from '../lib/stand-halten.ts'
import { plattformAusAdresse } from '../../shared/adresse-passt.ts'
import { hatAufnahmeBeleg } from '../lib/cartoon-aufnahme.ts'
import { type CartoonEintrag, type JwAngebotTon, alsTitel, jwTonAnbieter, plattformVon, tonAnbieterNamen } from '../lib/cartoons.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { type Title, type Release, type Quelle } from '../../shared/types.ts'
import { OUT, kinoFeld, mitAnkuendigung } from './grundlagen.ts'
import { mitLaufzeit } from '../lib/anisearch-felder.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { ladeKatalogEintraege } from '../lib/katalog-eingefroren.ts'
import { ohneZurueckgestellte } from '../lib/quarantaene.ts'
import { katalogNamen, ladeAnisearchTitel } from './katalog-namen.ts'
import { ANILIST_COVER_BASIS } from '../../shared/mappings.ts'
import { coverFuer } from './cover-regel.ts'
import { bewertungNachRegel, mitProduktFeldern } from './produkt-regel.ts'
import { todayIso, addDays } from '../../shared/time.ts'
import { ohneGesperrte } from './sperre.ts'
import { ersterDeutscherTermin } from '../../shared/tv-signale.ts'
import { eigenesJa, zaehltAlsDeutscherTermin } from '../lib/news.ts'
import { quellenName, quellenZusammenfuehren, type Vorschlag, meldungenAus } from '../lib/meldungen.ts'
import { reihenFuerKatalog } from './titel-hilfen.ts'
import { mitArtikeldaten, type BelegGedaechtnis } from '../lib/beleg-lesung.ts'
import { behalteLesetag, ladeAdnLesetage, mitLesetag, ohneFehlzuordnung } from './adn-lesetag.ts'
import { keinAnimeFehler, keinAnimeVonHand } from './ohne-beleg.ts'
import { ordneCartoonReihen } from './cartoon-reihen.ts'
import { setzeStaffeln, staffelnAusBelegen } from './cartoon-staffeln.ts'
import { verteileWege } from './cartoon-wege.ts'
import { wendeCartoonBelegeAn } from './cartoon-belege.ts'
import { kennzeichneCartoonJwSeiten } from './cartoon-jw-seite.ts'
import type { Staffel } from '../lib/jw-staffeln.ts'
import { ANISEARCH_ID_BASIS, alle as anisearchEintraege } from './anisearch-titel.ts'
import { findeAnisearchDubletten, zeilenMitKennungWeg, type DublettenUrteil } from './anisearch-dubletten.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import { katalogSammeltitel } from './mal-teilung.ts'
import { ohneWerkDubletten } from './werk-doppelt-bau.ts'
import { anisearchKatalogReihenQuelle as anisearchKatalogReihen } from './anisearch-reihen-rein-bau.ts'

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
/** Ziele der Suchadressen-Listen; Prüfungen lenken sie per `SUCHADRESSEN_ORDNER` um, damit sie keine getrackten Dateien beschreiben. */
function suchadressenZiele(): { md: string; json: string } {
  const ordner = process.env.SUCHADRESSEN_ORDNER
  if (ordner) return { md: `${ordner}/18-suchadressen.md`, json: `${ordner}/suchadressen-offen.json` }
  return { md: 'daniel-zum-abarbeiten/listen/18-suchadressen.md', json: 'data/suchadressen-offen.json' }
}

export function schreibeSuchadressen(offen: { id: number; titel: string; plattform: string; url: string }[]): void {
  const { md: ziel, json } = suchadressenZiele()
  const stand = todayIso()
  if (!offen.length) {
    writeTextStand(ziel, [`# Suchadressen`, '', `_Stand ${stand}_`, '', 'Nichts offen — jeder Verweis führt auf eine Titelseite.', ''].join('\n'), STAND_ZEILE)
    /*
      **Auch „nichts offen" wird geschrieben.** Hier stand nur `return`, und
      `data/suchadressen-offen.json` behielt die letzten sechs Einträge — alle
      am 13.09.2026 geklärt, und die Statusanzeige zeigte weiter „Suchadressen 6".
    */
    writeJson(json, [])
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
  writeTextStand(ziel, zeilen.join('\n') + '\n', STAND_ZEILE)
  /*
    **Dieselbe Liste noch einmal als Datei, die ein Werkzeug lesen kann.**

    Die Markdown-Fassung ist für Daniel, diese für `tools/pruefstand.mjs`: Ohne
    sie hat die Statusanzeige für diese Aufgabe keine Pille, und dann steht dort
    weniger Arbeit, als die Prüfliste führt. Eine Anzeige, die nur einen Teil der Arbeit zeigt,
    beantwortet die
    Frage nicht, für die es sie gibt.
  */
  writeJson(json, offen)
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
  const eintraege = Object.values(roh).filter(hatAufnahmeBeleg)
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
  const jw = readJson<Record<string, { angebote?: (JwAngebotTon & { url?: string })[]; staffeln?: Staffel[]; geprueftAm?: string }>>(
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
  const belegt = wendeCartoonBelegeAn(titel, belege)
  if (belegt) log(`${belegt} Cartoon-Verweise mit Handbeleg`)
  setzeTonHinweise(titel, jw, belege)
  const ungeprueft = setzeStaffeln(titel, roh, jw, staffelnAusBelegen(belege))
  kennzeichneCartoonJwSeiten(titel, belege)
  verteileWege(titel, jw, ungeprueft)
  ordneCartoonReihen(titel)
  writeJson(`${OUT}/cartoons.json`, titel)
  log(`${titel.length} westliche Animationsserien geschrieben`)
}

/**
 * Der Ton laut JustWatch gilt für die Serie (Entscheidung 07.09.2026): ein Hinweis am Titel, nie `dub` am Verweis.
 * Ein Handbeleg „dort nicht deutsch“ nimmt den Anbieter wieder heraus.
 */
function setzeTonHinweise(
  titel: Title[],
  jw: Record<string, { angebote?: JwAngebotTon[] }>,
  belege: { anilistId: number; platform: string; available?: boolean; dub?: boolean }[],
): void {
  const hand = new Set(belege.filter((b) => b.available === false || b.dub === false).map((b) => `${b.anilistId}|${b.platform}`))
  let hinweise = 0
  for (const t of titel) {
    const roh = jwTonAnbieter(jw[String(t.id)]?.angebote).filter((n) => !hand.has(`${t.id}|${plattformVon(n)}`))
    const anbieter = tonAnbieterNamen(roh)
    if (!anbieter.length) continue
    t.dubHinweis = { quelle: 'justwatch', anbieter }
    hinweise++
  }
  if (hinweise) log(`${hinweise} Cartoons mit deutschem Ton laut JustWatch (Serie)`)
}

/**
 * Dasselbe Werk als aniSearch-Zeile und als AniList-Katalogtitel steht nur einmal im Katalog (`anisearch-dubletten.ts`): Eine Zeile hinter dem Schalter
 * weicht dem Katalogtitel; steht die Zeile im Hauptbestand oder trägt sie einen Termin (`geschuetzt`), weicht der Katalogtitel ihr.
 */
export function anisearchDublettenAbziehen(bekannt: Map<number, number>, verschoben: Title[], geschuetzt: Set<number>, eintraege: KatalogEintrag[], kennungen: Map<number, number>, sammeltitel: typeof katalogSammeltitel = katalogSammeltitel): DublettenUrteil {
  const zeile = (id: number) => id >= ANISEARCH_ID_BASIS
  const katalog = eintraege.filter((e) => !bekannt.has(e.id)).map((e) => ({ id: e.id, mal: e.mal, format: e.format, jahr: e.jahr, folgen: e.folgen }))
  const hinter = verschoben.map((t) => t.id).filter((id) => zeile(id) && !geschuetzt.has(id))
  const haupt = [...bekannt.keys(), ...verschoben.map((t) => t.id).filter((id) => geschuetzt.has(id))].filter(zeile)
  const urteil = findeAnisearchDubletten(hinter, haupt, katalog, anisearchEintraege())
  /* Die Sammeltitel zuerst: Ihre getragene Seite bekommt eine Zeile (`freizugebendeSeiten`), und `zeilenMitKennungWeg` lässt sie nur stehen, wenn der Titel schon weicht. */
  const zeilenDa = new Set([...bekannt.keys(), ...verschoben.map((t) => t.id)])
  for (const [titel, seite] of sammeltitel((id) => zeilenDa.has(id))) urteil.katalogWeg.set(titel, seite)
  zeilenMitKennungWeg(hinter, kennungen, anisearchEintraege(), urteil, haupt, new Set(katalog.map((k) => k.id)))
  if (urteil.zeilenWeg.size || urteil.katalogWeg.size) {
    log(`aniSearch-Dubletten: ${urteil.zeilenWeg.size} Zeilen hinter dem Schalter entfallen (der AniList-Katalogtitel gilt), ${urteil.katalogWeg.size} Katalogtitel entfallen (die Zeile steht im Hauptbestand)`)
  }
  return urteil
}

export function schreibeOhneSynchro(
  bekannt: Map<number, number>,
  verschoben: Title[] = [],
  deutscheReihe: Map<number, string> = new Map(),
  geschuetzt: Set<number> = new Set(),
): void {
  // Zurückgestellt heißt: auch nicht hinter dem Schalter (`11-9-quarantaene.ts`).
  const eintraege = ohneZurueckgestellte(ladeKatalogEintraege())
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

  /**
   * Drei Pflichtfelder von `Title` fehlen hier absichtlich: `slug`, `keywords`
   * und `streams`. Sie wären für jeden dieser Titel leer beziehungsweise ohne
   * Verwendung — es gibt zu ihnen keine Teilen-Seite, keine gepflegten
   * Schlagwörter und keinen Anbieter. Ausgeschrieben kosteten die leeren Werte
   * bei achtzehntausend Titeln rund 900 KB. `loadOhneSynchro` setzt sie beim
   * Laden, sodass der Rest der Anwendung sie wie gewohnt vorfindet.
   */
  const ausAnisearch = ladeAnisearchTitel()
  const kennungen = anisearchKennungen([...eintraege.map((e) => ({ id: e.id, mal: e.mal ?? undefined })), ...verschoben.map((t) => ({ id: t.id, mal: t.malId }))])
  const dubletten = anisearchDublettenAbziehen(bekannt, verschoben, geschuetzt, eintraege, kennungen)
  const reihe = anisearchKatalogReihen(reihenFuerKatalog(eintraege, bekannt), eintraege, bekannt, verschoben, kennungen, dubletten)
  const ohne = eintraege
    .filter((e) => !bekannt.has(e.id) && !dubletten.katalogWeg.has(e.id))
    .map((e) => {
      const namen = katalogNamen(e, ausAnisearch[String(e.id)], deutscheReihe.get(reihe.get(e.id) ?? e.id))
      return {
        id: e.id, malId: e.mal,
        ...namen,
        /* Die Kennung geht mit, sonst führt der aniSearch-Verweis ins Leere; zugeordnet wird sie in `anisearch-kennung.ts`. */
        anisearchId: kennungen.get(e.id),
        titleNative: e.t[2] ?? undefined,
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
        coverImage: coverFuer(e.id, e.cover?.startsWith(ANILIST_COVER_BASIS) ? e.cover.slice(ANILIST_COVER_BASIS.length) : (e.cover ?? undefined)),
        ...bewertungNachRegel({}, kennungen.get(e.id)),
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

  /* Wer aus dem Hauptbestand verschoben wurde, muss hier ankommen, auch wenn der Katalog ihn nicht führt (ein Vorfilter verschiebt, er löscht nicht; „Xiao Mao Diao Yu", 17.08.2026). */
  const vorhanden = new Set(ohne.map((t) => t.id))
  const nachgetragen = verschoben.filter((t) => !vorhanden.has(t.id) && !dubletten.zeilenWeg.has(t.id)).map((t) => mitProduktFeldern({ ...t, coverImage: coverFuer(t.id, t.coverImage) }, kennungen.get(t.id)))
  const alle = ohneWerkDubletten([...ohne, ...nachgetragen.map((t) => ({ ...t, ...(kennungen.has(t.id) ? { anisearchId: kennungen.get(t.id) } : {}), dubConfidence: 'low' as const, ohneSynchro: true, ...kinoFeld(t.id) }))], geschuetzt)

  writeJson(`${OUT}/ohne-synchro.json`, alle.map((t) => mitLaufzeit(mitAnkuendigung(t))))
  writeJson(`${OUT}/ohne-synchro-namen.json`, namensIndex(alle))
  meldeOhneSynchro(alle, eintraege.length, nachgetragen.length, bekannt)
}

/**
 * **Was der Lauf über `ohne-synchro.json` ins Protokoll schreibt** (29.09.2026).
 *
 * Die Zahl der MAL-Kennungen steht mit dabei, und bei **null** gibt es eine Warnung: Der
 * AniList-Katalog kommt aus einem Actions-Cache, den mehrere Läufe zugleich überschreiben — ein Lauf,
 * der vor dem Katalog-Refresh startet, reicht den alten Stand unter einem neueren Schlüssel weiter.
 * Genau das ließ `ohne-synchro.json` zweimal mit null Kennungen dastehen, ohne dass etwas rot wurde
 * (Einzelheiten in `docs/wissen/betrieb.md`). Eine Zahl im Protokoll macht es sichtbar.
 */
function meldeOhneSynchro(alle: { id: number; malId?: number }[], katalog: number, nachgetragen: number, bekannt: Map<number, number>): void {
  const anzahl = alle.length
  const mitMal = alle.filter((t) => t.malId).length
  const kaputt = keinAnimeFehler(keinAnimeVonHand(), bekannt, new Set(alle.map((t) => t.id)))
  if (kaputt.length) {
    for (const f of kaputt) console.error('  ✖', f)
    process.exit(1)
  }
  if (!mitMal && anzahl) {
    warn(`Keine MAL-Kennung an ${anzahl} Titeln — der AniList-Katalog im Cache ist zu alt (data:katalog).`)
  }
  log(
    `Ohne deutsche Synchro: ${anzahl} Titel (aus ${katalog} im AniList-Katalog` +
      (nachgetragen ? `, ${nachgetragen} aus dem Hauptbestand nachgetragen)` : ')') +
      `, ${mitMal} mit MAL-Kennung`,
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
  const lesungen = readJson<BelegGedaechtnis>('data/beleg-lesungen.json', {})
  const heute = todayIso()
  const lesetag = ladeAdnLesetage()

  for (const release of releases) {
    const termin = release.schedule.firstEpisodeDate
    /**
     * Kuratierte Termine tragen nur nackte Adressen in `sources`. Daraus wird
     * hier eine vollwertige Herkunftsangabe — sonst hätten ausgerechnet die von
     * Hand geprüften Termine die schlechtere Belegkette als die automatischen.
     * **Kein `sagt`:** Unser Termin als Aussage der Quelle war ein Zirkelschluss.
     */
    const roh: Quelle[] =
      release.quellen ??
      release.sources.map((url) => ({
        url,
        name: quellenName(url),
        gesehenAm: heute,
        stand: 'aktuell' as const,
      }))
    const neu = behalteLesetag(mitLesetag(release, roh, lesetag), historie[release.slug] ?? [], termin)

    const aktuelleAdressen = new Set(neu.map((q) => q.url))
    const alt = ohneFehlzuordnung(historie[release.slug] ?? [], neu).map((q) => {
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
    release.quellen = mitArtikeldaten(zusammen, lesungen, release.titleId)
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
/**
 * **„Jetzt auf Deutsch" verlangt, dass die Staffel überhaupt läuft.**
 *
 * Die geteilte Crunchyroll-Serienseite trägt für „Die Tagebücher der Apothekerin"
 * ein `dub: true` — Staffel 1 und 2 sind dort deutsch. Staffel 3 erbte es, obwohl
 * sie erst am 02.10.2026 startet, und stand so als „Neu auf Deutsch" (Daniel,
 * 01.10.2026). Ein Titel, dessen japanische Ausstrahlung noch aussteht, ist kein
 * Neuzugang „auf Deutsch" — das erledigt die Termin-Meldung.
 *
 * Dasselbe gilt für einen bloß angekündigten deutschen Termin: Was noch nicht
 * erschienen ist, kann nicht „es gibt die Fassung jetzt" heißen.
 */
export function belegteDeutscheSynchro(t: Title, ersterTermin: Map<number, string>, heute: string): boolean {
  const termin = ersterTermin.get(t.id)
  /*
    **Ein geteilter Stream belegt nichts, solange die Staffel nicht läuft.** Der
    früheste deutsche Termin entscheidet mit: Liegt er in der Zukunft, hat die
    Staffel noch nicht begonnen (`jpStart` fehlt bei angekündigten Titeln oft).
  */
  const beginnt = (!t.jpStart || t.jpStart <= heute) && !(termin && termin > heute)
  return (
    Boolean((t as { hasVoices?: boolean }).hasVoices) ||
    (beginnt && (t.streams ?? []).some(eigenesJa)) ||
    (termin !== undefined && termin <= heute)
  )
}

/** Der früheste deutsche Termin je Titel, ohne automatische Kanal-Termine eines Titels ohne eigenes Ja (13.10.2026; Regel in `news.ts`). */
export function ersterTerminMitGrund(releases: Release[], titles: Title[]): Map<number, string> {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const zaehlende = releases.filter((r) => zaehltAlsDeutscherTermin(r, nachId.get(r.titleId)))
  return ersterDeutscherTermin(zaehlende, titles)
}

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

  const ersterTermin = ersterTerminMitGrund(releases, titles)

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
  const belegteSynchro = (t: Title) => belegteDeutscheSynchro(t, ersterTermin, heute)
  const neu = ohneGesperrte(titles)
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
